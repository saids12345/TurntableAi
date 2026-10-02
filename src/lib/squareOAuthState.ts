import "server-only";

import {
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

export const SQUARE_OAUTH_STATE_COOKIE =
  "turntable_square_oauth_state";

export const SQUARE_OAUTH_USER_COOKIE =
  "turntable_square_oauth_user";

export const SQUARE_OAUTH_STATE_MAX_AGE_SECONDS =
  10 * 60;

const STATE_BYTES = 32;

export function createSquareOAuthState():
  string {
  return randomBytes(
    STATE_BYTES,
  ).toString(
    "base64url",
  );
}

export function verifySquareOAuthState(
  returnedState:
    string | null | undefined,
  storedState:
    string | null | undefined,
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

export function getSquareOAuthStateCookieOptions() {
  return {
    httpOnly: true,
    secure:
      process.env.NODE_ENV ===
      "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge:
      SQUARE_OAUTH_STATE_MAX_AGE_SECONDS,
  };
}
