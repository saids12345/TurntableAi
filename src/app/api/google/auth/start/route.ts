// src/app/api/google/auth/start/route.ts
import { NextRequest, NextResponse } from "next/server";
import { googleAuthUrl } from "@/lib/google";

export const runtime = "nodejs"; // ensure Buffer is available

// Edge-safe base64url encode (also fine in Node)
function base64urlEncode(obj: unknown) {
  const json = typeof obj === "string" ? obj : JSON.stringify(obj);
  if (typeof Buffer !== "undefined") {
    return Buffer.from(json).toString("base64url");
  }
  // Fallback (rare, since we force node runtime)
  const s = typeof json === "string" ? json : JSON.stringify(json);
  // @ts-ignore
  return btoa(s).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

export async function GET(req: NextRequest) {
  try {
    // Guard: required env vars for Google OAuth
    for (const key of ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REDIRECT_URI"]) {
      if (!process.env[key]) {
        return NextResponse.json({ error: `Missing env: ${key}` }, { status: 500 });
      }
    }

    const url = new URL(req.url);
    const email = url.searchParams.get("email") || "owner@example.com";

    // TODO (Step 2): replace with the signed-in user's id
    const userId = "demo";

    // Encode small payload to round-trip via OAuth state
    const state = base64urlEncode({ u: userId, e: email });

    // Build Google OAuth URL and redirect (absolute URL object)
    const redirectStr = googleAuthUrl(state);
    return NextResponse.redirect(new URL(redirectStr));
  } catch (e: any) {
    console.error("oauth start error:", e);
    return NextResponse.json({ error: e?.message || "start_oauth_failed" }, { status: 500 });
  }
}
