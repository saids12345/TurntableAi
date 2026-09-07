// src/app/api/google/auth/start/route.ts
import { NextRequest, NextResponse } from "next/server";
import { googleAuthUrl } from "@/lib/google";
import { getSupabaseRouteClient } from "@/lib/supabaseRoute";
import { requireProForApi } from "@/lib/requirePro";

export const runtime = "nodejs"; // ensure Buffer is available
export const dynamic = "force-dynamic";

// base64url encode (Node)
function base64urlEncode(obj: unknown) {
  const json = typeof obj === "string" ? obj : JSON.stringify(obj);
  return Buffer.from(json).toString("base64url");
}

export async function GET(req: NextRequest) {
  // 🔒 Pro lock (trial or paid)
  await requireProForApi();

  try {
    // Guard: required env vars for Google OAuth
    for (const key of [
      "GOOGLE_CLIENT_ID",
      "GOOGLE_CLIENT_SECRET",
      "GOOGLE_REDIRECT_URI",
    ]) {
      if (!process.env[key]) {
        return NextResponse.json(
          { error: `Missing env: ${key}` },
          { status: 500 }
        );
      }
    }

    // Must be signed in
    const supabase = await getSupabaseRouteClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      // Not logged in — send them to /login and then back here
      const current = new URL(req.url);
      const redirectPath = `${current.pathname}${current.search}`;
      const encodedRedirect = encodeURIComponent(redirectPath);

      return NextResponse.redirect(
        new URL(`/login?redirect=${encodedRedirect}`, req.url)
      );
    }

    // Encode ONLY the user id in state (do not trust email from query params)
    const state = base64urlEncode({ u: user.id });

    const redirectStr = googleAuthUrl(state);
    return NextResponse.redirect(new URL(redirectStr));
  } catch (e: any) {
    console.error("oauth start error:", e);
    return NextResponse.json(
      { error: e?.message || "start_oauth_failed" },
      { status: 500 }
    );
  }
}
