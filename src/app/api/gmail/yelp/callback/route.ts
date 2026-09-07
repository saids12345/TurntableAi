// src/app/api/gmail/yelp/callback/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseRouteClient } from "@/lib/supabaseRoute";


// Read envs once (but don't crash at import-time)
const GMAIL_YELP_CLIENT_ID = process.env.GMAIL_YELP_CLIENT_ID;
const GMAIL_YELP_CLIENT_SECRET = process.env.GMAIL_YELP_CLIENT_SECRET;
const GMAIL_YELP_REDIRECT_URI = process.env.GMAIL_YELP_REDIRECT_URI;

const NEXT_PUBLIC_SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

function jsonError(
  message: string,
  status: number = 500,
  extra: Record<string, unknown> = {}
) {
  console.error("[gmail-yelp-callback]", message, extra);
  return NextResponse.json({ error: message, ...extra }, { status });
}

/**
 * Decode base64url encoded state.
 * Returns null if invalid.
 */
function base64UrlDecode<T = any>(s: string): T | null {
  try {
    const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64.length % 4 ? "=".repeat(4 - (b64.length % 4)) : "";
    const json = Buffer.from(b64 + pad, "base64").toString("utf8");
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  try {
    // 1) Read query params
    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code");
    const error = searchParams.get("error");
    const state = searchParams.get("state"); // we set this in /start

    if (error) {
      return jsonError("google_returned_error", 400, { provider_error: error });
    }

    if (!code) {
      return jsonError("missing_code_param", 400);
    }

    // 2) Get signed-in Supabase user
    const supabase = await getSupabaseRouteClient();
    const { data, error: userError } = await supabase.auth.getUser();

    if (userError || !data.user) {
      return jsonError("not_authenticated", 401, { userError });
    }

    const userId = data.user.id;

    // 🔒 Pro lock. Redirect instead of JSON.
const { data: profile } = await supabase
  .from("profiles")
  .select("is_pro, plan")
  .eq("id", userId)
  .maybeSingle();

const isPro =
  !!profile?.is_pro ||
  profile?.plan === "pro";

if (!isPro) {
  const current = new URL(req.url);

  const redirectPath =
    `${current.pathname}${current.search}`;

  return NextResponse.redirect(
    new URL(
      `/upgrade?redirect=${encodeURIComponent(redirectPath)}`,
      current.origin,
    ),
  );
}

    // 2.5) Validate OAuth state (CSRF protection)
    // We encoded { u: userId } in /start. Verify it matches.
    if (state) {
      const decoded = base64UrlDecode<{ u?: string }>(state);
      if (!decoded?.u || decoded.u !== userId) {
        return jsonError("invalid_oauth_state", 400, {
          expectedUser: userId,
          stateUser: decoded?.u ?? null,
        });
      }
    } else {
      // If you want to be strict, you can error here.
      // We'll allow it but log it.
      console.warn("[gmail-yelp-callback] Missing state param (CSRF protection weakened)");
    }

    // 3) Exchange code for tokens with Google
    if (
      !GMAIL_YELP_CLIENT_ID ||
      !GMAIL_YELP_CLIENT_SECRET ||
      !GMAIL_YELP_REDIRECT_URI
    ) {
      return jsonError("missing_gmail_yelp_env_vars", 500, {
        hasClientId: !!GMAIL_YELP_CLIENT_ID,
        hasSecret: !!GMAIL_YELP_CLIENT_SECRET,
        hasRedirect: !!GMAIL_YELP_REDIRECT_URI,
      });
    }

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: GMAIL_YELP_CLIENT_ID,
        client_secret: GMAIL_YELP_CLIENT_SECRET,
        redirect_uri: GMAIL_YELP_REDIRECT_URI,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text().catch(() => "");
      return jsonError("token_exchange_failed", 500, {
        status: tokenRes.status,
        body: errText,
      });
    }

    const tokenJson: any = await tokenRes.json();
    const accessToken: string | undefined = tokenJson.access_token;
    let refreshToken: string | undefined = tokenJson.refresh_token;
    const expiresIn: number | undefined = tokenJson.expires_in;

    if (!accessToken) {
      return jsonError("missing_access_token_in_response", 500, { tokenJson });
    }

    // If refresh_token is not returned (common on re-consent), reuse existing.
    if (!refreshToken) {
      const { data: existing, error: existingErr } = await supabase
        .from("gmail_yelp_tokens")
        .select("refresh_token")
        .eq("user_id", userId)
        .maybeSingle();

      if (existingErr) {
        return jsonError("failed_to_load_existing_refresh_token", 500, {
          existingErr,
        });
      }

      if (existing?.refresh_token) {
        refreshToken = existing.refresh_token as string;
      }
    }

    if (!refreshToken) {
      // Still no refresh token — tell dev what happened.
      return jsonError("missing_refresh_token_in_response", 500, {
        hint: "Google may not return refresh_token on reconnect. Try disconnecting/revoking access and re-connecting with prompt=consent.",
        tokenJson,
      });
    }

    const expiresAt = expiresIn
      ? new Date(Date.now() + expiresIn * 1000).toISOString()
      : null;

    // 4) Store tokens in Supabase (table: gmail_yelp_tokens)
    const { error: upsertError } = await supabase.from("gmail_yelp_tokens").upsert(
      {
        user_id: userId,
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_at: expiresAt,
      },
      { onConflict: "user_id" }
    );

    if (upsertError) {
      return jsonError("supabase_upsert_failed", 500, { upsertError });
    }

    // 5) Redirect back to integrations page with success flag
    const redirectUrl = new URL("/integrations", NEXT_PUBLIC_SITE_URL);
    redirectUrl.searchParams.set("gmail_yelp", "connected");

    return NextResponse.redirect(redirectUrl.toString());
  } catch (e: any) {
    return jsonError("unhandled_callback_error", 500, {
      message: e?.message,
      stack: e?.stack,
    });
  }
}
