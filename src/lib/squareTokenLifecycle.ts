import "server-only";

import {
  refreshSquareAccessToken,
} from "@/lib/square";

import {
  updateSquareConnectionTokens,
} from "@/lib/squareConnectionStore";

import type {
  SquareProductionConnection,
} from "@/lib/squareConnectionReader";

const REFRESH_BUFFER_MS =
  5 * 60 * 1000;

export function shouldRefreshSquareAccessToken(
  expiresAt: string | null,
  nowMs = Date.now(),
) {
  if (!expiresAt) {
    return false;
  }

  const expiresMs =
    Date.parse(expiresAt);

  if (!Number.isFinite(expiresMs)) {
    throw new Error(
      "Invalid Square access token expiration timestamp.",
    );
  }

  return (
    expiresMs - nowMs <=
    REFRESH_BUFFER_MS
  );
}

export async function getFreshSquareAccessToken(
  connection: SquareProductionConnection,
) {
  if (
    !shouldRefreshSquareAccessToken(
      connection.accessTokenExpiresAt,
    )
  ) {
    return connection.accessToken;
  }

  if (!connection.refreshToken) {
    throw new Error(
      "Square access token requires refresh but no refresh token is stored.",
    );
  }

  const refreshed =
    await refreshSquareAccessToken(
      connection.refreshToken,
    );

  if (
    refreshed.merchant_id !==
    connection.merchantId
  ) {
    throw new Error(
      "Square refresh merchant mismatch.",
    );
  }

  const refreshToken =
    refreshed.refresh_token ??
    connection.refreshToken;

  await updateSquareConnectionTokens({
    connectionId:
      connection.connectionId,

    merchantId:
      connection.merchantId,

    accessToken:
      refreshed.access_token,

    refreshToken,

    accessTokenExpiresAt:
      refreshed.expires_at ??
      null,

    refreshTokenExpiresAt:
      refreshed.refresh_token_expires_at ??
      connection.refreshTokenExpiresAt,
  });

  return refreshed.access_token;
}
