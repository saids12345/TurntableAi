import assert from "node:assert/strict";

import {
  buildSquareAuthorizationUrl,
  SQUARE_OAUTH_SCOPES,
} from "@/lib/square";

const previousEnvironment =
  process.env.SQUARE_ENVIRONMENT;

const previousApplicationId =
  process.env.SQUARE_APPLICATION_ID;

try {
  process.env.SQUARE_ENVIRONMENT =
    "sandbox";

  process.env.SQUARE_APPLICATION_ID =
    "sandbox-test-application-id";

  const sandboxUrl =
    new URL(
      buildSquareAuthorizationUrl(
        "sandbox-test-state",
      ),
    );

  assert.equal(
    sandboxUrl.origin,
    "https://connect.squareupsandbox.com",
  );

  assert.equal(
    sandboxUrl.pathname,
    "/oauth2/authorize",
  );

  assert.equal(
    sandboxUrl.searchParams.get("client_id"),
    "sandbox-test-application-id",
  );

  assert.equal(
    sandboxUrl.searchParams.get("scope"),
    SQUARE_OAUTH_SCOPES.join(" "),
  );

  assert.equal(
    sandboxUrl.searchParams.get("state"),
    "sandbox-test-state",
  );

  assert.equal(
    sandboxUrl.searchParams.has("session"),
    false,
  );

  process.env.SQUARE_ENVIRONMENT =
    "production";

  process.env.SQUARE_APPLICATION_ID =
    "production-test-application-id";

  const productionUrl =
    new URL(
      buildSquareAuthorizationUrl(
        "production-test-state",
      ),
    );

  assert.equal(
    productionUrl.origin,
    "https://connect.squareup.com",
  );

  assert.equal(
    productionUrl.pathname,
    "/oauth2/authorize",
  );

  assert.equal(
    productionUrl.searchParams.get("session"),
    "false",
  );

  assert.equal(
    productionUrl.searchParams.get("state"),
    "production-test-state",
  );

  assert.throws(
    () =>
      buildSquareAuthorizationUrl(""),
    /Square OAuth state is required/,
  );

  console.log(
    "✓ Square authorization URL regression test passed",
  );
} finally {
  if (previousEnvironment === undefined) {
    delete process.env.SQUARE_ENVIRONMENT;
  } else {
    process.env.SQUARE_ENVIRONMENT =
      previousEnvironment;
  }

  if (previousApplicationId === undefined) {
    delete process.env.SQUARE_APPLICATION_ID;
  } else {
    process.env.SQUARE_APPLICATION_ID =
      previousApplicationId;
  }
}
