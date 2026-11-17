type PriceEvidence = {
  id?: string;
  active?: boolean;
  type?: string;
  currency?: string;
  unit_amount?: number | null;
  billing_scheme?: string;
  recurring?: {
    interval?: string;
    interval_count?: number;
  } | null;
  livemode?: boolean;
  product?: unknown;
};

export type ExpectedStripeProductName =
  | "TurnTableAI Pro"
  | "TurnTableAI Pro — Staging";

export function resolveStripeCheckoutPriceExpectation(config: {
  vercelEnv?: string;
  siteUrl?: string;
  stripeSecretKey?: string;
  nodeEnv?: string;
  supabaseUrl?: string;
}): {
  expectedLiveMode: boolean | null;
  expectedProductName: ExpectedStripeProductName;
} | null {
  const siteUrl = config.siteUrl?.replace(/\/+$/, "");

  const stagingSupabaseUrl =
    "https://sdlskzyizslisraurxzf.supabase.co";
  const stagingSiteUrl =
    "https://turntableai-staging.vercel.app";

  // When using the isolated Staging DB, never fall through to
  // a Production or unverified checkout policy.
  if (config.supabaseUrl === stagingSupabaseUrl) {
    const testKey = config.stripeSecretKey?.startsWith("sk_test_") === true;
    const local = !config.vercelEnv && config.nodeEnv === "development" &&
      (!siteUrl || siteUrl === "http://localhost:3000");
    const hosted = config.vercelEnv === "production" &&
      siteUrl === stagingSiteUrl;
    if (!testKey || (!local && !hosted)) return null;
    return {
      expectedLiveMode: false,
      expectedProductName: "TurnTableAI Pro — Staging",
    };
  }

  // Hosted Staging must never accept explicitly different DB credentials.
  if (siteUrl === stagingSiteUrl) {
    if (
      (config.supabaseUrl && config.supabaseUrl !== stagingSupabaseUrl) ||
      config.vercelEnv !== "production" ||
      !config.stripeSecretKey?.startsWith("sk_test_")
    ) return null;
    return {
      expectedLiveMode: false,
      expectedProductName: "TurnTableAI Pro — Staging",
    };
  }

  return {
    expectedLiveMode:
      config.vercelEnv === "production"
    ? true
        : config.vercelEnv === "preview"
          ? false
          : null,
    expectedProductName: "TurnTableAI Pro",
  };
}

export function isExpectedTurnTableCheckoutPrice(
  price: PriceEvidence | null,
  configuredPriceId: string,
  expectedLiveMode: boolean | null,
  expectedProductName: ExpectedStripeProductName = "TurnTableAI Pro",
): boolean {
  if (!price || price.id !== configuredPriceId) {
    return false;
  }

  const product = price.product;

  if (!product || typeof product !== "object") {
    return false;
  }

  const verifiedProduct = product as {
    name?: unknown;
    active?: unknown;
    deleted?: unknown;
  };

  if (
    verifiedProduct.name !== expectedProductName ||
    verifiedProduct.active !== true ||
    verifiedProduct.deleted === true
  ) {
    return false;
  }

  if (
    price.active !== true ||
    price.type !== "recurring" ||
    price.currency?.toLowerCase() !== "usd" ||
    price.unit_amount !== 10000 ||
    price.billing_scheme !== "per_unit" ||
    price.recurring?.interval !== "month" ||
    price.recurring?.interval_count !== 1
  ) {
    return false;
  }

  if (
    expectedLiveMode !== null &&
    price.livemode !== expectedLiveMode
  ) {
    return false;
  }

  return true;
}
