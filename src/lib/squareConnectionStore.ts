import "server-only";

import {
  encryptPosToken,
} from "@/lib/posTokenCrypto";

import {
  getSupabaseAdmin,
} from "@/lib/supabaseAdmin";

import type {
  SquareEnvironment,
} from "@/lib/square";

export type SquareStoredLocationInput = {
  providerLocationId: string;
  name: string;
  timezone?: string | null;
  currency?: string | null;
  status?: string | null;
};

export type SaveSquareConnectionInput = {
  userId: string;

  environment:
    SquareEnvironment;

  merchantId: string;

  accessToken: string;

  refreshToken: string;

  accessTokenExpiresAt?:
    string | null;

  refreshTokenExpiresAt?:
    string | null;

  scopes:
    readonly string[];

  locations:
    SquareStoredLocationInput[];
};

function requireValue(
  value: string,
  label: string,
) {
  const clean =
    value.trim();

  if (!clean) {
    throw new Error(
      `${label} is required.`,
    );
  }

  return clean;
}

export async function saveSquareConnection(
  input: SaveSquareConnectionInput,
) {
  const userId =
    requireValue(
      input.userId,
      "Square connection userId",
    );

  const merchantId =
    requireValue(
      input.merchantId,
      "Square merchantId",
    );

  const accessToken =
    requireValue(
      input.accessToken,
      "Square access token",
    );

  const refreshToken =
    requireValue(
      input.refreshToken,
      "Square refresh token",
    );

  const now =
    new Date().toISOString();

  const supabaseAdmin =
    getSupabaseAdmin();

  /*
   * Tokens are encrypted BEFORE
   * anything is sent to Supabase.
   */
  const accessTokenEncrypted =
    encryptPosToken(
      accessToken,
    );

  const refreshTokenEncrypted =
    encryptPosToken(
      refreshToken,
    );

  /*
   * A user can connect multiple Square
   * merchant accounts. The unique identity
   * is:
   *
   * user + provider + environment + merchant
   */
  const {
    data: connection,
    error: connectionError,
  } =
    await supabaseAdmin
      .from(
        "pos_connections",
      )
      .upsert(
        {
          user_id:
            userId,

          provider:
            "square",

          environment:
            input.environment,

          provider_account_id:
            merchantId,

          access_token_encrypted:
            accessTokenEncrypted,

          refresh_token_encrypted:
            refreshTokenEncrypted,

          access_token_expires_at:
            input.accessTokenExpiresAt ??
            null,

          refresh_token_expires_at:
            input.refreshTokenExpiresAt ??
            null,

          scopes: [
            ...input.scopes,
          ],

          updated_at:
            now,
        },
        {
          onConflict:
            "user_id,provider,environment,provider_account_id",
        },
      )
      .select(
        "id",
      )
      .single();

  if (
    connectionError ||
    !connection?.id
  ) {
    throw new Error(
      `Square connection save failed: ${
        connectionError?.message ??
        "missing connection id"
      }`,
    );
  }

  const connectionId =
    String(
      connection.id,
    );

  /*
   * Read the currently stored locations.
   * We will upsert the fresh Square list
   * first, then remove locations that no
   * longer exist.
   */
  const {
    data: existingLocations,
    error: existingLocationsError,
  } =
    await supabaseAdmin
      .from(
        "pos_locations",
      )
      .select(
        "id, provider_location_id",
      )
      .eq(
        "connection_id",
        connectionId,
      );

  if (
    existingLocationsError
  ) {
    throw new Error(
      `Square location lookup failed: ${existingLocationsError.message}`,
    );
  }

  /*
   * Deduplicate locations by Square's
   * stable location id.
   */
  const normalizedLocations =
    Array.from(
      new Map(
        input.locations.map(
          (location) => {
            const providerLocationId =
              requireValue(
                location.providerLocationId,
                "Square location id",
              );

            const name =
              requireValue(
                location.name,
                "Square location name",
              );

            return [
              providerLocationId,
              {
                connection_id:
                  connectionId,

                provider_location_id:
                  providerLocationId,

                name,

                timezone:
                  location.timezone ??
                  null,

                currency:
                  location.currency ??
                  null,

                status:
                  location.status ??
                  null,

                updated_at:
                  now,
              },
            ] as const;
          },
        ),
      ).values(),
    );

  /*
   * Upsert fresh locations before deleting
   * anything. If this fails, existing
   * locations remain untouched.
   */
  if (
    normalizedLocations.length >
    0
  ) {
    const {
      error: locationUpsertError,
    } =
      await supabaseAdmin
        .from(
          "pos_locations",
        )
        .upsert(
          normalizedLocations,
          {
            onConflict:
              "connection_id,provider_location_id",
          },
        );

    if (
      locationUpsertError
    ) {
      throw new Error(
        `Square location save failed: ${locationUpsertError.message}`,
      );
    }
  }

  const activeProviderLocationIds =
    new Set(
      normalizedLocations.map(
        (location) =>
          location.provider_location_id,
      ),
    );

  const staleLocationIds =
    (
      existingLocations ??
      []
    )
      .filter(
        (location) =>
          !activeProviderLocationIds.has(
            String(
              location.provider_location_id,
            ),
          ),
      )
      .map(
        (location) =>
          String(
            location.id,
          ),
      );

  /*
   * Remove locations Square no longer
   * reports for this merchant.
   */
  if (
    staleLocationIds.length >
    0
  ) {
    const {
      error: staleDeleteError,
    } =
      await supabaseAdmin
        .from(
          "pos_locations",
        )
        .delete()
        .in(
          "id",
          staleLocationIds,
        );

    if (
      staleDeleteError
    ) {
      throw new Error(
        `Square stale location cleanup failed: ${staleDeleteError.message}`,
      );
    }
  }

  return {
    connectionId,
    merchantId,
    locationCount:
      normalizedLocations.length,
  };
}
