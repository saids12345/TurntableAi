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

export function isExpectedTurnTableCheckoutPrice(
  price: PriceEvidence | null,
  configuredPriceId: string,
  expectedLiveMode: boolean | null,
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
    verifiedProduct.name !== "TurnTableAI Pro" ||
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
