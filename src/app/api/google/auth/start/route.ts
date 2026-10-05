// src/app/api/google/auth/start/route.ts
import { NextRequest, NextResponse } from "next/server";
import { googleAuthUrl } from "@/lib/google";
import {
  createGoogleOAuthState,
  getGoogleOAuthStateCookieOptions,
  GOOGLE_OAUTH_STATE_COOKIE,
  GOOGLE_OAUTH_USER_COOKIE,
} from "@/lib/googleOAuthState";
import { requireProForApi } from "@/lib/requirePro";

export const runtime = "nodejs"; // ensure Buffer is available
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { user } = await requireProForApi();

  try {
    for (const key of [
      "GOOGLE_INTEGRATIONS_CLIENT_ID",
      "GOOGLE_INTEGRATIONS_CLIENT_SECRET",
      "GOOGLE_INTEGRATIONS_REDIRECT",
    ]) {
      if (!process.env[key]) {
        return NextResponse.json(
          { error: `Missing env: ${key}` },
          { status: 500 },
        );
      }
    }

    const state = createGoogleOAuthState();
    const redirectStr = googleAuthUrl(state);

    const response = NextResponse.redirect(
      new URL(redirectStr),
    );

    const cookieOptions =
      getGoogleOAuthStateCookieOptions();

    response.cookies.set(
      GOOGLE_OAUTH_STATE_COOKIE,
      state,
      cookieOptions,
    );

    response.cookies.set(
      GOOGLE_OAUTH_USER_COOKIE,
      user.id,
      cookieOptions,
    );

    return response;
  } catch (e: any) {
    console.error("oauth start error:", e);

    return NextResponse.json(
      { error: e?.message || "start_oauth_failed" },
      { status: 500 },
    );
  }
}
