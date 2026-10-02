import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  exchangeSquareAuthorizationCode,
  getConfiguredSquareEnvironment,
  listSquareLocations,
  SQUARE_OAUTH_SCOPES,
} from "@/lib/square";

import {
  saveSquareConnection,
} from "@/lib/squareConnectionStore";

import {
  getSquareOAuthStateCookieOptions,
  SQUARE_OAUTH_STATE_COOKIE,
  SQUARE_OAUTH_USER_COOKIE,
  verifySquareOAuthState,
} from "@/lib/squareOAuthState";

import {
  requireProForApi,
} from "@/lib/requirePro";

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

function redirectToIntegrations(
  req: NextRequest,
  params:
    Record<string, string>,
) {
  const url =
    new URL(
      "/integrations",
      req.url,
    );

  for (
    const [
      key,
      value,
    ] of Object.entries(
      params,
    )
  ) {
    url.searchParams.set(
      key,
      value,
    );
  }

  const response =
    NextResponse.redirect(
      url,
    );

  const cookieOptions =
    getSquareOAuthStateCookieOptions();

  /*
   * OAuth state/user cookies are one-time.
   * Always destroy them after the callback.
   */
  response.cookies.set(
    SQUARE_OAUTH_STATE_COOKIE,
    "",
    {
      ...cookieOptions,
      maxAge: 0,
    },
  );

  response.cookies.set(
    SQUARE_OAUTH_USER_COOKIE,
    "",
    {
      ...cookieOptions,
      maxAge: 0,
    },
  );

  return response;
}

export async function GET(
  req: NextRequest,
) {
  const url =
    new URL(
      req.url,
    );

  const returnedState =
    url.searchParams.get(
      "state",
    );

  const storedState =
    req.cookies.get(
      SQUARE_OAUTH_STATE_COOKIE,
    )?.value;

  const initiatingUserId =
    req.cookies.get(
      SQUARE_OAUTH_USER_COOKIE,
    )?.value;

  /*
   * Verify CSRF state BEFORE accepting
   * any authorization result from Square.
   */
  if (
    !verifySquareOAuthState(
      returnedState,
      storedState,
    )
  ) {
    return redirectToIntegrations(
      req,
      {
        error:
          "square_state_mismatch",
      },
    );
  }

  try {
    /*
     * The callback must still belong to
     * a signed-in Pro/trial TurnTableAI user.
     */
    const { user } =
      await requireProForApi();

    /*
     * Prevent an OAuth attempt started by
     * one TurnTableAI user from being
     * completed under another account.
     */
    if (
      !initiatingUserId ||
      initiatingUserId !==
        user.id
    ) {
      return redirectToIntegrations(
        req,
        {
          error:
            "square_user_mismatch",
        },
      );
    }

    /*
     * Square returns an error when the
     * seller denies authorization or the
     * authorization request fails.
     */
    const oauthError =
      url.searchParams.get(
        "error",
      );

    if (oauthError) {
      return redirectToIntegrations(
        req,
        {
          error:
            oauthError ===
            "access_denied"
              ? "square_access_denied"
              : "square_oauth_failed",
        },
      );
    }

    const code =
      url.searchParams.get(
        "code",
      );

    if (!code) {
      return redirectToIntegrations(
        req,
        {
          error:
            "square_missing_code",
        },
      );
    }

    /*
     * Exchange the short-lived authorization
     * code for Square OAuth credentials.
     */
    const tokens =
      await exchangeSquareAuthorizationCode(
        code,
      );

    if (
      !tokens.refresh_token
    ) {
      throw new Error(
        "Square OAuth response is missing refresh_token.",
      );
    }

    /*
     * Load the real Square locations while
     * the fresh access token is available.
     */
    const locations =
      await listSquareLocations(
        tokens.access_token,
      );

    /*
     * Encrypt credentials and persist the
     * merchant + locations server-side.
     */
    const saved =
      await saveSquareConnection(
        {
          userId:
            user.id,

          environment:
            getConfiguredSquareEnvironment(),

          merchantId:
            tokens.merchant_id,

          accessToken:
            tokens.access_token,

          refreshToken:
            tokens.refresh_token,

          accessTokenExpiresAt:
            tokens.expires_at ??
            null,

          refreshTokenExpiresAt:
            tokens.refresh_token_expires_at ??
            null,

          scopes:
            SQUARE_OAUTH_SCOPES,

          locations:
            locations.map(
              (location) => ({
                providerLocationId:
                  location.id,

                name:
                  location.name
                    ?.trim() ||
                  location.id,

                timezone:
                  location.timezone ??
                  null,

                currency:
                  location.currency ??
                  null,

                status:
                  location.status ??
                  null,
              }),
            ),
        },
      );

    return redirectToIntegrations(
      req,
      {
        connected:
          "square",

        locations:
          String(
            saved.locationCount,
          ),
      },
    );
  } catch (error) {
    /*
     * Do not expose OAuth credentials,
     * provider payloads, or internal
     * database details to the browser.
     */
    if (
      error instanceof Response
    ) {
      return redirectToIntegrations(
        req,
        {
          error:
            error.status === 401
              ? "square_not_authenticated"
              : error.status === 402
              ? "square_pro_required"
              : "square_auth_failed",
        },
      );
    }

    console.error(
      "Square OAuth callback failed:",
      error,
    );

    return redirectToIntegrations(
      req,
      {
        error:
          "square_connection_failed",
      },
    );
  }
}
