export type Plan = "free" | "pro";

export function planFromStripeStatus(status?: string | null): Plan {
  // If Stripe says active/trialing/etc -> treat as pro
  if (!status) return "free";
  const s = status.toLowerCase();
  if (["active", "trialing", "past_due", "unpaid"].includes(s)) return "pro";
  return "free";
}

export function isProFromPlan(plan: Plan): boolean {
  return plan === "pro";
}
