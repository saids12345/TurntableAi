import "server-only";

import {
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

export const GOOGLE_OAUTH_STATE_COOKIE =
  "turntable_google_oauth_state";

export const GOOGLE_OAUTH_USER_COOKIE =
  "turntable_google_oauth_user";

export const GOOGLE_OAUTH_STATE_MAX_AGE_SECONDS =
  10 * 60;

const STATE_BYTES = 32;

export function createGoogleOAuthState(): string {
  return randomBytes(
    STATE_BYTES,
  ).toString(
    "base64url",
  );
}

export function verifyGoogleOAuthState(
  returnedState: string | null | undefined,
  storedState: string | null | undefined,
): boolean {
  if (
    !returnedState ||
    !storedState
  ) {
    return false;
  }

  const returned =
    Buffer.from(
      returnedState,
      "utf8",
    );

  const stored =
    Buffer.from(
      storedState,
      "utf8",
    );

  if (
    returned.length !==
    stored.length
  ) {
    return false;
  }

  return timingSafeEqual(
    returned,
    stored,
  );
}

export function getGoogleOAuthStateCookieOptions() {
  return {
    httpOnly: true,
    secure:
      process.env.NODE_ENV ===
      "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge:
      GOOGLE_OAUTH_STATE_MAX_AGE_SECONDS,
  };
}
