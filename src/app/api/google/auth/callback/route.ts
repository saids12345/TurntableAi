// src/app/api/google/auth/callback/route.ts
import { NextRequest, NextResponse } from "next/server";
import { exchangeCode, listAccounts, listLocations } from "@/lib/google";
import { upsertConn } from "@/lib/store";

export const runtime = "nodejs"; // ensure Buffer exists for base64url decode

function redirectTo(req: NextRequest, search: string) {
  const origin = new URL(req.url).origin;
  return NextResponse.redirect(new URL(`/integrations${search}`, origin));
}

/**
 * OAuth callback: exchanges code for tokens, loads accounts + locations,
 * and upserts a connection for the user in Supabase.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (!code) return redirectTo(req, "?error=missing_code");

  try {
    // Recover userId + email from state (with safe fallbacks)
    let userId = "demo";
    let email = "owner@example.com";

    if (state) {
      try {
        const json = Buffer.from(state, "base64url").toString("utf8");
        const parsed = JSON.parse(json) as { u?: string; e?: string };
        if (parsed?.u) userId = String(parsed.u);
        if (parsed?.e) email = String(parsed.e);
      } catch {
        // ignore malformed state
      }
    }

    // 1) Exchange auth code for tokens
    const tokens = await exchangeCode(code);

    // 2) Try to fetch accounts & locations.
    // If this fails (no Business Profile / permissions), we just log it
    // and continue with an empty locations array instead of failing OAuth.
    let locs: { name: string; title: string }[] = [];
    let accountName: string | undefined;

    try {
      const accounts = await listAccounts(tokens.access_token);
      const acc = accounts.accounts?.[0];

      if (acc?.name) {
        accountName = acc.name;
        const res = await listLocations(tokens.access_token, acc.name);
        locs = (res.locations || []).map((l) => ({
          name: l.name,
          title: l.title || l.name,
        }));
      }
    } catch (err) {
      console.error("listAccounts/listLocations failed:", err);
      // we keep locs empty; connection will still be saved
    }

    // 3) Save connection in Supabase (even if locs is empty)
    await upsertConn({
      userId,
      email,
      accountName,
      tokens: {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
      },
      locations: locs,
    });

    return redirectTo(req, "?connected=google");
  } catch (e: any) {
    console.error("oauth callback failed:", e);

    // DEV: surface the actual error text in the query param so you can see it
    const msg =
      typeof e?.message === "string" ? e.message : "oauth_failed";

    return redirectTo(
      req,
      `?error=${encodeURIComponent(msg.slice(0, 80))}` // keep it short
    );
  }
}
