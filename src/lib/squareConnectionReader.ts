import "server-only";

import {
  decryptPosToken,
} from "@/lib/posTokenCrypto";

import {
  getSupabaseAdmin,
} from "@/lib/supabaseAdmin";

export type SquareProductionLocation = {
  providerLocationId: string;
  name: string;
  timezone: string | null;
  currency: string | null;
  status: string | null;
};

export type SquareProductionConnection = {
  connectionId: string;
  userId: string;
  merchantId: string;
  accessToken: string;
  refreshToken: string | null;
  accessTokenExpiresAt: string | null;
  refreshTokenExpiresAt: string | null;
  locations: SquareProductionLocation[];
};

export async function loadSquareProductionConnections(
  userId: string,
): Promise<SquareProductionConnection[]> {
  const cleanUserId =
    userId.trim();

  if (!cleanUserId) {
    throw new Error(
      "Square connection userId is required.",
    );
  }

  const supabase =
    getSupabaseAdmin();

  const {
    data: connections,
    error: connectionError,
  } =
    await supabase
      .from("pos_connections")
      .select(
        "id,user_id,provider_account_id,access_token_encrypted,refresh_token_encrypted,access_token_expires_at,refresh_token_expires_at",
      )
      .eq("user_id", cleanUserId)
      .eq("provider", "square")
      .eq("environment", "production");

  if (connectionError) {
    throw new Error(
      `Square production connection lookup failed: ${connectionError.message}`,
    );
  }

  if (!connections?.length) {
    return [];
  }

  const connectionIds =
    connections.map(
      (connection) =>
        String(connection.id),
    );

  const {
    data: locations,
    error: locationError,
  } =
    await supabase
      .from("pos_locations")
      .select(
        "connection_id,provider_location_id,name,timezone,currency,status",
      )
      .in(
        "connection_id",
        connectionIds,
      );

  if (locationError) {
    throw new Error(
      `Square production location lookup failed: ${locationError.message}`,
    );
  }

  return connections.map(
    (connection) => ({
      connectionId:
        String(connection.id),

      userId:
        String(connection.user_id),

      merchantId:
        String(connection.provider_account_id),

      accessToken:
        decryptPosToken(
          String(
            connection.access_token_encrypted,
          ),
        ),

      refreshToken:
        connection.refresh_token_encrypted
          ? decryptPosToken(
              String(
                connection.refresh_token_encrypted,
              ),
            )
          : null,

      accessTokenExpiresAt:
        connection.access_token_expires_at
          ? String(
              connection.access_token_expires_at,
            )
          : null,

      refreshTokenExpiresAt:
        connection.refresh_token_expires_at
          ? String(
              connection.refresh_token_expires_at,
            )
          : null,

      locations:
        (locations ?? [])
          .filter(
            (location) =>
              String(
                location.connection_id,
              ) ===
              String(connection.id),
          )
          .map(
            (location) => ({
              providerLocationId:
                String(
                  location.provider_location_id,
                ),

              name:
                String(
                  location.name,
                ),

              timezone:
                location.timezone
                  ? String(
                      location.timezone,
                    )
                  : null,

              currency:
                location.currency
                  ? String(
                      location.currency,
                    )
                  : null,

              status:
                location.status
                  ? String(
                      location.status,
                    )
                  : null,
            }),
          ),
    }),
  );
}

export async function listSquareProductionUserIds() {
  const supabase =
    getSupabaseAdmin();

  const { data, error } =
    await supabase
      .from("pos_connections")
      .select("user_id")
      .eq("provider", "square")
      .eq("environment", "production");

  if (error) {
    throw new Error(
      `Square production user lookup failed: ${error.message}`,
    );
  }

  return Array.from(
    new Set(
      (data ?? []).map(
        (row) =>
          String(row.user_id),
      ),
    ),
  );
}
