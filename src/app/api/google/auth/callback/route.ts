// src/app/api/google/auth/callback/route.ts
import { NextRequest, NextResponse } from "next/server";
import { exchangeCode, listAccounts, listLocations } from "@/lib/google";
import { upsertConn } from "@/lib/store";

/**
 * OAuth callback: exchanges code for tokens, loads accounts + locations,
 * and upserts a connection for the user in Supabase.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (!code) return NextResponse.redirect("/integrations?error=missing_code");

  try {
    // recover userId + email from state (or provide fallbacks)
    let userId = "demo";
    let email = "owner@example.com";
    if (state) {
      try {
        const parsed = JSON.parse(Buffer.from(state, "base64url").toString());
        if (parsed?.u) userId = String(parsed.u);
        if (parsed?.e) email = String(parsed.e);
      } catch {}
    }

    const tokens = await exchangeCode(code);

    // Fetch accounts & locations
    const accounts = await listAccounts(tokens.access_token);
    const acc = accounts.accounts?.[0];
    let locs: { name: string; title: string }[] = [];
    if (acc?.name) {
      const res = await listLocations(tokens.access_token, acc.name);
      locs = (res.locations || []).map((l) => ({ name: l.name, title: l.title || l.name }));
    }

    // Save connection in Supabase
    await upsertConn({
      userId,
      email,
      accountName: acc?.name,
      tokens: { access_token: tokens.access_token, refresh_token: tokens.refresh_token },
      locations: locs,
    });

    return NextResponse.redirect("/integrations?connected=google");
  } catch (e) {
    console.error("oauth callback failed:", e);
    return NextResponse.redirect("/integrations?error=oauth_failed");
  }
}
