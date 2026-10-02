import assert from "node:assert/strict";

import {
  decryptPosToken,
  encryptPosToken,
} from "@/lib/posTokenCrypto";

const previousKey =
  process.env.POS_TOKEN_ENCRYPTION_KEY;

try {
  /*
   * 32-byte test key.
   * This is ONLY for the regression test.
   */
  process.env.POS_TOKEN_ENCRYPTION_KEY =
    Buffer.from(
      "12345678901234567890123456789012",
      "utf8",
    ).toString("base64");

  const originalToken =
    "square-test-access-token-123456";

  const encrypted =
    encryptPosToken(
      originalToken,
    );

  assert.notEqual(
    encrypted,
    originalToken,
  );

  assert.ok(
    encrypted.startsWith(
      "v1.",
    ),
  );

  const decrypted =
    decryptPosToken(
      encrypted,
    );

  assert.equal(
    decrypted,
    originalToken,
  );

  /*
   * AES-GCM authentication must reject tampering.
   */
  const parts =
    encrypted.split(".");

  const ciphertext =
    Buffer.from(
      parts[3],
      "base64url",
    );

  ciphertext[0] =
    ciphertext[0] ^ 1;

  const tampered = [
    parts[0],
    parts[1],
    parts[2],
    ciphertext.toString(
      "base64url",
    ),
  ].join(".");

  assert.throws(
    () =>
      decryptPosToken(
        tampered,
      ),
  );

  console.log(
    "✓ POS token encryption regression test passed",
  );
} finally {
  if (
    previousKey === undefined
  ) {
    delete process.env
      .POS_TOKEN_ENCRYPTION_KEY;
  } else {
    process.env
      .POS_TOKEN_ENCRYPTION_KEY =
      previousKey;
  }
}
