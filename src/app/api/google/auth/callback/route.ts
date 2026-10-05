// src/app/api/google/auth/callback/route.ts
import { NextRequest, NextResponse } from "next/server";
import { exchangeCode, listAccounts, listLocations } from "@/lib/google";
import { upsertConn } from "@/lib/store";
import {
  getGoogleOAuthStateCookieOptions,
  GOOGLE_OAUTH_STATE_COOKIE,
  GOOGLE_OAUTH_USER_COOKIE,
  verifyGoogleOAuthState,
} from "@/lib/googleOAuthState";
import { requireProForApi } from "@/lib/requirePro";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function redirectTo(req: NextRequest, search: string) {
  const origin = new URL(req.url).origin;

  const response = NextResponse.redirect(
    new URL(`/integrations${search}`, origin),
  );

  const cookieOptions =
    getGoogleOAuthStateCookieOptions();

  response.cookies.set(
    GOOGLE_OAUTH_STATE_COOKIE,
    "",
    {
      ...cookieOptions,
      maxAge: 0,
    },
  );

  response.cookies.set(
    GOOGLE_OAUTH_USER_COOKIE,
    "",
    {
      ...cookieOptions,
      maxAge: 0,
    },
  );

  return response;
}

/**
 * OAuth callback: exchanges code for tokens, loads accounts + locations,
 * and upserts a connection for the signed-in user in Supabase.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);

  const code = url.searchParams.get("code");
  const returnedState = url.searchParams.get("state");

  const storedState =
    req.cookies.get(
      GOOGLE_OAUTH_STATE_COOKIE,
    )?.value;

  const initiatingUserId =
    req.cookies.get(
      GOOGLE_OAUTH_USER_COOKIE,
    )?.value;

  if (
    !verifyGoogleOAuthState(
      returnedState,
      storedState,
    )
  ) {
    return redirectTo(
      req,
      "?error=google_state_mismatch",
    );
  }

  try {
    const { user } =
      await requireProForApi();

    if (
      !initiatingUserId ||
      initiatingUserId !== user.id
    ) {
      return redirectTo(
        req,
        "?error=google_user_mismatch",
      );
    }

    const oauthError =
      url.searchParams.get("error");

    if (oauthError) {
      return redirectTo(
        req,
        oauthError === "access_denied"
          ? "?error=google_access_denied"
          : "?error=google_oauth_failed",
      );
    }

    if (!code) {
      return redirectTo(
        req,
        "?error=missing_code",
      );
    }

    const userId = user.id;
    const email =
      user.email ?? "owner@example.com";

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
    if (e instanceof Response) {
      return redirectTo(
        req,
        e.status === 401
          ? "?error=not_authenticated"
          : e.status === 402
            ? "?error=pro_required"
            : "?error=oauth_failed",
      );
    }

    console.error("oauth callback failed:", e);

    const msg =
      typeof e?.message === "string"
        ? e.message
        : "oauth_failed";

    return redirectTo(
      req,
      `?error=${encodeURIComponent(msg.slice(0, 80))}`,
    );
  }
}
