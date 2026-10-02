import assert from "node:assert/strict";

import {
  createSquareOAuthState,
  getSquareOAuthStateCookieOptions,
  SQUARE_OAUTH_STATE_MAX_AGE_SECONDS,
  verifySquareOAuthState,
} from "@/lib/squareOAuthState";

const state =
  createSquareOAuthState();

const secondState =
  createSquareOAuthState();

assert.ok(
  state.length >= 40,
);

assert.notEqual(
  state,
  secondState,
);

assert.equal(
  verifySquareOAuthState(
    state,
    state,
  ),
  true,
);

assert.equal(
  verifySquareOAuthState(
    `${state}x`,
    state,
  ),
  false,
);

assert.equal(
  verifySquareOAuthState(
    secondState,
    state,
  ),
  false,
);

assert.equal(
  verifySquareOAuthState(
    null,
    state,
  ),
  false,
);

assert.equal(
  verifySquareOAuthState(
    state,
    null,
  ),
  false,
);

const cookieOptions =
  getSquareOAuthStateCookieOptions();

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
  SQUARE_OAUTH_STATE_MAX_AGE_SECONDS,
);

console.log(
  "✓ Square OAuth state regression test passed",
);
