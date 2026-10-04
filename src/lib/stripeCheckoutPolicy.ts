export function shouldBlockNewStripeCheckout(
  status?: string | null,
) {
  const normalized =
    status?.trim().toLowerCase() ?? "";

  if (!normalized) {
    return false;
  }

  return (
    normalized !== "canceled" &&
    normalized !== "incomplete_expired"
  );
}

type ReusableCheckoutSession = {
  mode?: string | null;
  client_reference_id?: string | null;
  metadata?: Record<string, string> | null;
  success_url?: string | null;
  cancel_url?: string | null;
  url?: string | null;
};

export function findReusableStripeCheckoutUrl(
  input: {
    sessions: ReusableCheckoutSession[];
    userId: string;
    priceId: string;
    successUrl: string;
    cancelUrl: string;
  },
) {
  const match =
    input.sessions.find(
      (session) =>
        session.mode ===
          "subscription" &&
        session.client_reference_id ===
          input.userId &&
        session.metadata
          ?.supabase_user_id ===
          input.userId &&
        session.metadata
          ?.turntable_price_id ===
          input.priceId &&
        session.success_url ===
          input.successUrl &&
        session.cancel_url ===
          input.cancelUrl &&
        typeof session.url ===
          "string" &&
        session.url.length > 0,
    );

  return match?.url ?? null;
}
