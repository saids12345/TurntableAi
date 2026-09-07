// src/app/api/google/auth/callback/route.ts
import { NextRequest, NextResponse } from "next/server";
import { exchangeCode, listAccounts, listLocations } from "@/lib/google";
import { upsertConn } from "@/lib/store";
import { getSupabaseRouteClient } from "@/lib/supabaseRoute";
import { requireProForApi } from "@/lib/requirePro";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function redirectTo(req: NextRequest, search: string) {
  const origin = new URL(req.url).origin;
  return NextResponse.redirect(new URL(`/integrations${search}`, origin));
}

function safeDecodeState(state: string | null): { u?: string; e?: string } {
  if (!state) return {};
  try {
    const json = Buffer.from(state, "base64url").toString("utf8");
    const parsed = JSON.parse(json) as { u?: string; e?: string };
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

/**
 * OAuth callback: exchanges code for tokens, loads accounts + locations,
 * and upserts a connection for the signed-in user in Supabase.
 */
export async function GET(req: NextRequest) {
  // 🔒 Pro lock (trial or paid)
  await requireProForApi();

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (!code) return redirectTo(req, "?error=missing_code");

  try {
    // 1) Must be signed in (use session cookies)
    const supabase = await getSupabaseRouteClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return redirectTo(req, "?error=not_authenticated");
    }

    // 2) Verify state user matches signed-in user (CSRF / wrong-account protection)
    const parsed = safeDecodeState(state);
    const stateUserId = parsed?.u ? String(parsed.u) : null;

    if (!stateUserId) {
      return redirectTo(req, "?error=missing_state");
    }

    if (stateUserId !== user.id) {
      return redirectTo(req, "?error=state_user_mismatch");
    }

    const userId = user.id;
    const email = user.email ?? "owner@example.com";

    // 3) Exchange auth code for tokens
    const tokens = await exchangeCode(code);

    // 4) Fetch accounts & locations (best-effort)
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
      // keep locs empty; connection will still be saved
    }

    // 5) Save connection in Supabase
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

    const msg = typeof e?.message === "string" ? e.message : "oauth_failed";
    return redirectTo(req, `?error=${encodeURIComponent(msg.slice(0, 80))}`);
  }
}
