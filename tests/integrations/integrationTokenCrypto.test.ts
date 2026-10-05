import assert from "node:assert/strict";

import {
  decryptIntegrationToken,
  encryptIntegrationToken,
} from "@/lib/integrationTokenCrypto";

const previousKey =
  process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY;

try {
  process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY =
    Buffer.alloc(
      32,
      7,
    ).toString(
      "base64",
    );

  const original =
    "google-test-secret-token";

  const encrypted =
    encryptIntegrationToken(
      original,
    );

  assert.notEqual(
    encrypted,
    original,
  );

  assert.ok(
    encrypted.startsWith("v1."),
  );

  assert.equal(
    decryptIntegrationToken(
      encrypted,
    ),
    original,
  );

  const secondEncrypted =
    encryptIntegrationToken(
      original,
    );

  assert.notEqual(
    encrypted,
    secondEncrypted,
  );

  console.log(
    "✓ Integration token crypto regression test passed",
  );
} finally {
  if (previousKey === undefined) {
    delete process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY;
  } else {
    process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY =
      previousKey;
  }
}
