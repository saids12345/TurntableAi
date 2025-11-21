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

    // Exchange auth code for tokens
    const tokens = await exchangeCode(code);

    // Fetch accounts & locations
    const accounts = await listAccounts(tokens.access_token);
    const acc = accounts.accounts?.[0];
    let locs: { name: string; title: string }[] = [];
    if (acc?.name) {
      const res = await listLocations(tokens.access_token, acc.name);
      locs = (res.locations || []).map((l) => ({
        name: l.name,
        title: l.title || l.name,
      }));
    }

    // Save connection in Supabase
    await upsertConn({
      userId,
      email,
      accountName: acc?.name,
      tokens: { access_token: tokens.access_token, refresh_token: tokens.refresh_token },
      locations: locs,
    });

    return redirectTo(req, "?connected=google");
  } catch (e) {
    console.error("oauth callback failed:", e);
    return redirectTo(req, "?error=oauth_failed");
  }
}
