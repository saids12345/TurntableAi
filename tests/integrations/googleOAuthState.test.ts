import assert from "node:assert/strict";

import {
  createGoogleOAuthState,
  getGoogleOAuthStateCookieOptions,
  GOOGLE_OAUTH_STATE_MAX_AGE_SECONDS,
  verifyGoogleOAuthState,
} from "@/lib/googleOAuthState";

const state =
  createGoogleOAuthState();

const secondState =
  createGoogleOAuthState();

assert.ok(
  state.length >= 40,
);

assert.notEqual(
  state,
  secondState,
);

assert.equal(
  verifyGoogleOAuthState(
    state,
    state,
  ),
  true,
);

assert.equal(
  verifyGoogleOAuthState(
    secondState,
    state,
  ),
  false,
);

assert.equal(
  verifyGoogleOAuthState(
    `${state}x`,
    state,
  ),
  false,
);

assert.equal(
  verifyGoogleOAuthState(
    null,
    state,
  ),
  false,
);

assert.equal(
  verifyGoogleOAuthState(
    state,
    null,
  ),
  false,
);

const cookieOptions =
  getGoogleOAuthStateCookieOptions();

assert.equal(
  cookieOptions.httpOnly,
  true,
);

assert.equal(
  cookieOptions.sameSite,
  "lax",
);

assert.equal(
  cookieOptions.path,
  "/",
);

assert.equal(
  cookieOptions.maxAge,
  GOOGLE_OAUTH_STATE_MAX_AGE_SECONDS,
);

console.log(
  "✓ Google OAuth state regression test passed",
);
