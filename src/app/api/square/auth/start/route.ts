import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  buildSquareAuthorizationUrl,
} from "@/lib/square";

import {
  createSquareOAuthState,
  getSquareOAuthStateCookieOptions,
  SQUARE_OAUTH_STATE_COOKIE,
  SQUARE_OAUTH_USER_COOKIE,
} from "@/lib/squareOAuthState";

import {
  requireProForApi,
} from "@/lib/requirePro";

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

export async function GET(
  req: NextRequest,
) {
  try {
    /*
     * Require an authenticated TurnTableAI
     * owner with Pro/trial access.
     */
    const { user } =
      await requireProForApi();

    /*
     * Generate a fresh unpredictable
     * CSRF state value for this OAuth attempt.
     */
    const state =
      createSquareOAuthState();

    /*
     * Build Square's authorization URL.
     * No user identity or secrets are placed
     * inside the state parameter.
     */
    const authorizationUrl =
      buildSquareAuthorizationUrl(
        state,
      );

    const response =
      NextResponse.redirect(
        authorizationUrl,
      );

    /*
     * Save the expected state in an
     * HTTP-only cookie. The callback must
     * match it before any Square tokens
     * are accepted.
     */
    const cookieOptions =
      getSquareOAuthStateCookieOptions();

    response.cookies.set(
      SQUARE_OAUTH_STATE_COOKIE,
      state,
      cookieOptions,
    );

    /*
     * Bind this OAuth attempt to the
     * TurnTableAI user who started it.
     */
    response.cookies.set(
      SQUARE_OAUTH_USER_COOKIE,
      user.id,
      cookieOptions,
    );

    return response;
  } catch (error) {
    /*
     * Preserve intentional auth/pro
     * responses thrown by requireProForApi.
     */
    if (
      error instanceof Response
    ) {
      return error;
    }

    console.error(
      "Square OAuth start failed:",
      error,
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          "square_oauth_start_failed",
      },
      {
        status: 500,
      },
    );
  }
}
