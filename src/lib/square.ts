import "server-only";

export type SquareEnvironment =
  | "sandbox"
  | "production";

export const SQUARE_OAUTH_SCOPES = [
  "MERCHANT_PROFILE_READ",
  "ORDERS_READ",
] as const;

const DEFAULT_API_VERSION =
  "2026-09-16";

function getSquareEnvironment():
  SquareEnvironment {
  const value =
    process.env
      .SQUARE_ENVIRONMENT
      ?.trim()
      .toLowerCase();

  if (
    value !== "sandbox" &&
    value !== "production"
  ) {
    throw new Error(
      "SQUARE_ENVIRONMENT must be either 'sandbox' or 'production'.",
    );
  }

  return value;
}

function getSquareApplicationId() {
  const value =
    process.env
      .SQUARE_APPLICATION_ID
      ?.trim();

  if (!value) {
    throw new Error(
      "Missing SQUARE_APPLICATION_ID",
    );
  }

  return value;
}

function getSquareApplicationSecret() {
  const value =
    process.env
      .SQUARE_APPLICATION_SECRET
      ?.trim();

  if (!value) {
    throw new Error(
      "Missing SQUARE_APPLICATION_SECRET",
    );
  }

  return value;
}

function getSquareApiVersion() {
  return (
    process.env
      .SQUARE_API_VERSION
      ?.trim() ||
    DEFAULT_API_VERSION
  );
}

function getSquareOAuthBaseUrl(
  environment:
    SquareEnvironment,
) {
  return environment ===
    "sandbox"
    ? "https://connect.squareupsandbox.com/oauth2"
    : "https://connect.squareup.com/oauth2";
}

function getSquareApiBaseUrl(
  environment:
    SquareEnvironment,
) {
  return environment ===
    "sandbox"
    ? "https://connect.squareupsandbox.com"
    : "https://connect.squareup.com";
}

type SquareOAuthError = {
  category?: string;
  code?: string;
  detail?: string;
};

export type SquareTokenResponse = {
  access_token: string;
  token_type?: string;
  expires_at?: string;
  merchant_id: string;
  refresh_token?: string;
  refresh_token_expires_at?: string;
  short_lived?: boolean;
  errors?: SquareOAuthError[];
};

export type SquareLocation = {
  id: string;
  name?: string;
  status?: string;
  timezone?: string;
  currency?: string;
};

type SquareLocationsResponse = {
  locations?: SquareLocation[];
  errors?: SquareOAuthError[];
};

function describeSquareErrors(
  errors:
    SquareOAuthError[] |
    undefined,
) {
  if (!errors?.length) {
    return "Unknown Square API error.";
  }

  return errors
    .map((error) =>
      [
        error.code,
        error.detail,
      ]
        .filter(Boolean)
        .join(": "),
    )
    .filter(Boolean)
    .join("; ");
}

export function buildSquareAuthorizationUrl(
  state: string,
) {
  if (!state) {
    throw new Error(
      "Square OAuth state is required.",
    );
  }

  const environment =
    getSquareEnvironment();

  const params =
    new URLSearchParams({
      client_id:
        getSquareApplicationId(),

      scope:
        SQUARE_OAUTH_SCOPES.join(
          " ",
        ),

      state,
    });

  if (environment === "production") {
    params.set("session", "false");
  }

  return (
    `${getSquareOAuthBaseUrl(
      environment,
    )}/authorize?${params.toString()}`
  );
}

export async function exchangeSquareAuthorizationCode(
  code: string,
): Promise<SquareTokenResponse> {
  if (!code) {
    throw new Error(
      "Square authorization code is required.",
    );
  }

  const environment =
    getSquareEnvironment();

  const response =
    await fetch(
      `${getSquareOAuthBaseUrl(
        environment,
      )}/token`,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",

          "Square-Version":
            getSquareApiVersion(),
        },

        body: JSON.stringify({
          client_id:
            getSquareApplicationId(),

          client_secret:
            getSquareApplicationSecret(),

          code,

          grant_type:
            "authorization_code",
        }),

        cache: "no-store",
      },
    );

  const body =
    (await response
      .json()
      .catch(() => ({}))) as
      SquareTokenResponse;

  if (
    !response.ok ||
    body.errors?.length
  ) {
    throw new Error(
      `Square OAuth token exchange failed: ${describeSquareErrors(
        body.errors,
      )}`,
    );
  }

  if (
    !body.access_token ||
    !body.merchant_id
  ) {
    throw new Error(
      "Square OAuth response is missing access_token or merchant_id.",
    );
  }

  return body;
}

export async function refreshSquareAccessToken(
  refreshToken: string,
): Promise<SquareTokenResponse> {
  if (!refreshToken) {
    throw new Error(
      "Square refresh token is required.",
    );
  }

  const environment =
    getSquareEnvironment();

  const response =
    await fetch(
      `${getSquareOAuthBaseUrl(
        environment,
      )}/token`,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",

          "Square-Version":
            getSquareApiVersion(),
        },

        body: JSON.stringify({
          client_id:
            getSquareApplicationId(),

          client_secret:
            getSquareApplicationSecret(),

          refresh_token:
            refreshToken,

          grant_type:
            "refresh_token",
        }),

        cache: "no-store",
      },
    );

  const body =
    (await response
      .json()
      .catch(() => ({}))) as
      SquareTokenResponse;

  if (
    !response.ok ||
    body.errors?.length
  ) {
    throw new Error(
      `Square OAuth refresh failed: ${describeSquareErrors(
        body.errors,
      )}`,
    );
  }

  if (
    !body.access_token ||
    !body.merchant_id
  ) {
    throw new Error(
      "Square refresh response is missing access_token or merchant_id.",
    );
  }

  return body;
}

export async function listSquareLocations(
  accessToken: string,
): Promise<SquareLocation[]> {
  if (!accessToken) {
    throw new Error(
      "Square access token is required.",
    );
  }

  const environment =
    getSquareEnvironment();

  const response =
    await fetch(
      `${getSquareApiBaseUrl(
        environment,
      )}/v2/locations`,
      {
        method: "GET",

        headers: {
          Authorization:
            `Bearer ${accessToken}`,

          "Square-Version":
            getSquareApiVersion(),

          "Content-Type":
            "application/json",
        },

        cache: "no-store",
      },
    );

  const body =
    (await response
      .json()
      .catch(() => ({}))) as
      SquareLocationsResponse;

  if (
    !response.ok ||
    body.errors?.length
  ) {
    throw new Error(
      `Square locations request failed: ${describeSquareErrors(
        body.errors,
      )}`,
    );
  }

  return Array.isArray(
    body.locations,
  )
    ? body.locations
    : [];
}

export function getConfiguredSquareEnvironment():
  SquareEnvironment {
  return getSquareEnvironment();
}

export type SquareMoney = {
  amount?: number;
  currency?: string;
};

export type SquareOrder = {
  id?: string;
  location_id?: string;
  state?: string;
  closed_at?: string;
  total_money?: SquareMoney;
  total_tax_money?: SquareMoney;
  total_tip_money?: SquareMoney;
  total_service_charge_money?: SquareMoney;
  returns?: unknown[];
  refunds?: unknown[];
};

type SquareSearchOrdersResponse = {
  orders?: SquareOrder[];
  cursor?: string;
  errors?: SquareOAuthError[];
};

export type SearchSquareCompletedOrdersInput = {
  accessToken: string;
  locationId: string;
  startAt: string;
  endAt: string;
};

function requireSquareSearchValue(
  value: string,
  label: string,
) {
  const clean = value.trim();

  if (!clean) {
    throw new Error(
      `${label} is required.`,
    );
  }

  return clean;
}

function requireSquareSearchTimestamp(
  value: string,
  label: string,
) {
  const clean =
    requireSquareSearchValue(
      value,
      label,
    );

  const timestamp =
    Date.parse(clean);

  if (!Number.isFinite(timestamp)) {
    throw new Error(
      `${label} must be a valid RFC 3339 timestamp.`,
    );
  }

  return clean;
}

export async function searchSquareCompletedOrders(
  input: SearchSquareCompletedOrdersInput,
): Promise<SquareOrder[]> {
  const accessToken =
    requireSquareSearchValue(
      input.accessToken,
      "Square access token",
    );

  const locationId =
    requireSquareSearchValue(
      input.locationId,
      "Square location id",
    );

  const startAt =
    requireSquareSearchTimestamp(
      input.startAt,
      "Square order search startAt",
    );

  const endAt =
    requireSquareSearchTimestamp(
      input.endAt,
      "Square order search endAt",
    );

  if (
    Date.parse(endAt) <
    Date.parse(startAt)
  ) {
    throw new Error(
      "Square order search endAt must not be before startAt.",
    );
  }

  const environment =
    getSquareEnvironment();

  const orders:
    SquareOrder[] = [];

  let cursor:
    string | undefined;

  do {
    const requestBody: {
      location_ids: string[];
      query: {
        filter: {
          date_time_filter: {
            closed_at: {
              start_at: string;
              end_at: string;
            };
          };
          state_filter: {
            states: string[];
          };
        };
        sort: {
          sort_field: string;
          sort_order: string;
        };
      };
      limit: number;
      return_entries: boolean;
      cursor?: string;
    } = {
      location_ids: [
        locationId,
      ],

      query: {
        filter: {
          date_time_filter: {
            closed_at: {
              start_at:
                startAt,

              end_at:
                endAt,
            },
          },

          state_filter: {
            states: [
              "COMPLETED",
            ],
          },
        },

        sort: {
          sort_field:
            "CLOSED_AT",

          sort_order:
            "ASC",
        },
      },

      limit:
        1000,

      return_entries:
        false,
    };

    if (cursor) {
      requestBody.cursor =
        cursor;
    }

    const response =
      await fetch(
        `${getSquareApiBaseUrl(
          environment,
        )}/v2/orders/search`,
        {
          method:
            "POST",

          headers: {
            Authorization:
              `Bearer ${accessToken}`,

            "Square-Version":
              getSquareApiVersion(),

            "Content-Type":
              "application/json",
          },

          body:
            JSON.stringify(
              requestBody,
            ),

          cache:
            "no-store",
        },
      );

    const body =
      (await response
        .json()
        .catch(
          () => ({}),
        )) as
        SquareSearchOrdersResponse;

    if (
      !response.ok ||
      body.errors?.length
    ) {
      throw new Error(
        `Square orders request failed: ${describeSquareErrors(
          body.errors,
        )}`,
      );
    }

    if (
      Array.isArray(
        body.orders,
      )
    ) {
      orders.push(
        ...body.orders,
      );
    }

    cursor =
      typeof body.cursor ===
        "string" &&
      body.cursor.trim()
        ? body.cursor.trim()
        : undefined;
  } while (cursor);

  return orders;
}

type SquareRevokeResponse = {
  success?: boolean;
  errors?: SquareOAuthError[];
};

export async function revokeSquareAuthorization(
  merchantId: string,
) {
  const cleanMerchantId =
    merchantId.trim();

  if (!cleanMerchantId) {
    throw new Error(
      "Square merchant id is required for revocation.",
    );
  }

  const environment =
    getSquareEnvironment();

  const response =
    await fetch(
      `${getSquareOAuthBaseUrl(
        environment,
      )}/revoke`,
      {
        method: "POST",

        headers: {
          Authorization:
            `Client ${getSquareApplicationSecret()}`,

          "Square-Version":
            getSquareApiVersion(),

          "Content-Type":
            "application/json",
        },

        body:
          JSON.stringify({
            client_id:
              getSquareApplicationId(),

            merchant_id:
              cleanMerchantId,

            revoke_only_access_token:
              false,
          }),

        cache: "no-store",
      },
    );

  const body =
    (await response
      .json()
      .catch(
        () => ({}),
      )) as
      SquareRevokeResponse;

  if (
    !response.ok ||
    body.errors?.length ||
    body.success !== true
  ) {
    throw new Error(
      `Square authorization revocation failed: ${describeSquareErrors(
        body.errors,
      )}`,
    );
  }

  return {
    success: true as const,
  };
}
