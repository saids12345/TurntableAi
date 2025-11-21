// src/app/api/gmail/yelp/start/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseRouteClient } from "@/lib/supabaseRoute";

// Pull env vars once at module level
const GMAIL_YELP_CLIENT_ID = process.env.GMAIL_YELP_CLIENT_ID;
const GMAIL_YELP_REDIRECT_URI = process.env.GMAIL_YELP_REDIRECT_URI;

/**
 * Encodes an object safely for use in the OAuth `state` parameter
 */
function base64UrlEncode(obj: unknown): string {
  const json = typeof obj === "string" ? obj : JSON.stringify(obj);
  return Buffer.from(json)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

/**
 * Builds the Google OAuth URL for the Gmail/Yelp reviews inbox
 */
function gmailOAuthUrl(state: string): string {
  if (!GMAIL_YELP_CLIENT_ID || !GMAIL_YELP_REDIRECT_URI) {
    throw new Error(
      "Missing Gmail Yelp OAuth env vars (GMAIL_YELP_CLIENT_ID / GMAIL_YELP_REDIRECT_URI)"
    );
  }

  const params = new URLSearchParams({
    client_id: GMAIL_YELP_CLIENT_ID,
    redirect_uri: GMAIL_YELP_REDIRECT_URI,
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    scope: [
      "https://www.googleapis.com/auth/gmail.readonly",
      "https://www.googleapis.com/auth/userinfo.email",
      "https://www.googleapis.com/auth/userinfo.profile",
      "openid",
    ].join(" "),
    state,
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

/**
 * Starts Gmail OAuth for Yelp alerts.
 * - Requires a signed-in user (Supabase)
 * - Encodes the user id into `state` so we know who to attach tokens to
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const supabase = await getSupabaseRouteClient();
    const { data, error } = await supabase.auth.getUser();

    if (error || !data?.user) {
      // Not logged in — send them to /login and then back here
      const current = new URL(req.url);
      const redirectPath = `${current.pathname}${current.search}`;
      const encodedRedirect = encodeURIComponent(redirectPath);

      return NextResponse.redirect(
        new URL(`/login?redirect=${encodedRedirect}`, req.url)
      );
    }

    const userId = data.user.id;

    // Put user id (and anything else we want later) into state
    const state = base64UrlEncode({ u: userId });

    // Build Google OAuth URL and redirect
    const redirectUrl = gmailOAuthUrl(state);
    return NextResponse.redirect(redirectUrl);
  } catch (e) {
    console.error("gmail yelp start error:", e);
    return NextResponse.json(
      { error: "gmail_yelp_start_failed" },
      { status: 500 }
    );
  }
}

