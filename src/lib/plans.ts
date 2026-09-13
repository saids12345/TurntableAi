export type Plan = "free" | "pro";

export type ProAccessInput = {
  isPro?: boolean | null;
  plan?: string | null;
  stripeSubscriptionStatus?: string | null;
};

/**
 * Stripe is authoritative whenever a real subscription status exists.
 *
 * Access:
 * - trialing
 * - active
 *
 * Locked:
 * - past_due
 * - unpaid
 * - canceled
 * - incomplete
 * - incomplete_expired
 * - paused
 * - any other non-empty Stripe status
 */
export function isAllowedStripeStatus(
  status?: string | null,
): boolean {
  const normalized = status?.trim().toLowerCase();

  return normalized === "trialing" || normalized === "active";
}

export function planFromStripeStatus(
  status?: string | null,
): Plan {
  return isAllowedStripeStatus(status) ? "pro" : "free";
}

export function isProFromPlan(
  plan?: string | null,
): boolean {
  return plan?.trim().toLowerCase() === "pro";
}

/**
 * Canonical TurnTableAI access rule.
 *
 * If Stripe has supplied a subscription status, Stripe wins.
 * This prevents stale is_pro / plan values from overriding
 * past_due, canceled, unpaid, or other locked Stripe states.
 *
 * If there is no Stripe status at all, preserve support for
 * legitimate manual / legacy Pro grants through is_pro or plan.
 */
export function hasProAccess({
  isPro,
  plan,
  stripeSubscriptionStatus,
}: ProAccessInput): boolean {
  const normalizedStripeStatus =
    stripeSubscriptionStatus?.trim().toLowerCase() ?? "";

  if (normalizedStripeStatus) {
    return isAllowedStripeStatus(normalizedStripeStatus);
  }

  return isPro === true || isProFromPlan(plan);
}
