import assert from "node:assert/strict";

import {
  revokeSquareAuthorization,
} from "@/lib/square";

async function main() {
  const originalFetch =
    globalThis.fetch;

  const previousEnvironment =
    process.env.SQUARE_ENVIRONMENT;

  const previousApplicationId =
    process.env.SQUARE_APPLICATION_ID;

  const previousApplicationSecret =
    process.env.SQUARE_APPLICATION_SECRET;

  process.env.SQUARE_ENVIRONMENT =
    "production";

  process.env.SQUARE_APPLICATION_ID =
    "production-test-app";

  process.env.SQUARE_APPLICATION_SECRET =
    "production-test-secret";

  let request:
    | {
        url: string;
        init?: RequestInit;
      }
    | undefined;

  globalThis.fetch =
    async (
      input:
        string |
        URL |
        Request,
      init?: RequestInit,
    ) => {
      request = {
        url:
          typeof input ===
          "string"
            ? input
            : input.toString(),
        init,
      };

      return new Response(
        JSON.stringify({
          success: true,
        }),
        {
          status: 200,
          headers: {
            "content-type":
              "application/json",
          },
        },
      );
    };

  try {
    await revokeSquareAuthorization(
      "merchant-123",
    );

    assert.equal(
      request?.url,
      "https://connect.squareup.com/oauth2/revoke",
    );

    const headers =
      new Headers(
        request?.init?.headers,
      );

    assert.equal(
      headers.get(
        "Authorization",
      ),
      "Client production-test-secret",
    );

    const body =
      JSON.parse(
        String(
          request?.init?.body,
        ),
      );

    assert.equal(
      body.client_id,
      "production-test-app",
    );

    assert.equal(
      body.merchant_id,
      "merchant-123",
    );

    assert.equal(
      body.revoke_only_access_token,
      false,
    );

    assert.equal(
      "access_token" in body,
      false,
    );

    console.log(
      "✓ Square authorization revocation regression test passed",
    );
  } finally {
    globalThis.fetch =
      originalFetch;

    process.env.SQUARE_ENVIRONMENT =
      previousEnvironment;

    process.env.SQUARE_APPLICATION_ID =
      previousApplicationId;

    process.env.SQUARE_APPLICATION_SECRET =
      previousApplicationSecret;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
