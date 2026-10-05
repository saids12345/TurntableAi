import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const KEY_BYTES = 32;
const IV_BYTES = 12;
const VERSION = "v1";

function getEncryptionKey(): Buffer {
  const raw =
    process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY?.trim();

  if (!raw) {
    throw new Error(
      "Missing INTEGRATION_TOKEN_ENCRYPTION_KEY",
    );
  }

  const key =
    Buffer.from(
      raw,
      "base64",
    );

  if (key.length !== KEY_BYTES) {
    throw new Error(
      "INTEGRATION_TOKEN_ENCRYPTION_KEY must be a base64-encoded 32-byte key.",
    );
  }

  return key;
}

export function encryptIntegrationToken(
  plaintext: string,
): string {
  if (
    typeof plaintext !== "string" ||
    plaintext.length === 0
  ) {
    throw new Error(
      "Cannot encrypt an empty integration token.",
    );
  }

  const key = getEncryptionKey();
  const iv = randomBytes(IV_BYTES);

  const cipher =
    createCipheriv(
      ALGORITHM,
      key,
      iv,
    );

  const ciphertext =
    Buffer.concat([
      cipher.update(
        plaintext,
        "utf8",
      ),
      cipher.final(),
    ]);

  const authTag =
    cipher.getAuthTag();

  return [
    VERSION,
    iv.toString("base64url"),
    authTag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}

export function decryptIntegrationToken(
  encryptedValue: string,
): string {
  const parts =
    encryptedValue.split(".");

  if (
    parts.length !== 4 ||
    parts[0] !== VERSION
  ) {
    throw new Error(
      "Invalid encrypted integration token format.",
    );
  }

  const [
    ,
    ivPart,
    tagPart,
    ciphertextPart,
  ] = parts;

  const key = getEncryptionKey();

  const iv =
    Buffer.from(
      ivPart,
      "base64url",
    );

  const authTag =
    Buffer.from(
      tagPart,
      "base64url",
    );

  const ciphertext =
    Buffer.from(
      ciphertextPart,
      "base64url",
    );

  if (iv.length !== IV_BYTES) {
    throw new Error(
      "Invalid encrypted integration token IV.",
    );
  }

  const decipher =
    createDecipheriv(
      ALGORITHM,
      key,
      iv,
    );

  decipher.setAuthTag(
    authTag,
  );

  const plaintext =
    Buffer.concat([
      decipher.update(
        ciphertext,
      ),
      decipher.final(),
    ]);

  return plaintext.toString(
    "utf8",
  );
}
