import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * A durable Checkout claim must exist before any new Stripe customer or
 * Checkout session is created. Concurrent calls cannot both win because
 * stripe_checkout_one_unresolved_per_user is a database UNIQUE index.
 *
 * This module never expires or releases a claim automatically. Any
 * ambiguous Stripe request requires reconciliation before another attempt.
 */
export type StripeCheckoutAttemptStatus =
  | "claimed"
  | "open"
  | "needs_review"
  | "completed"
  | "expired"
  | "released";

export type StripeCheckoutAttempt = {
  attempt_id: string;
  user_id: string;
  price_id: string;
  status: StripeCheckoutAttemptStatus;
  stripe_customer_id: string | null;
  stripe_session_id: string | null;
  checkout_url: string | null;
  session_expires_at: string | null;
};

const table = "stripe_checkout_attempts";
const unresolved = ["claimed", "open", "needs_review"];
const columns =
  "attempt_id,user_id,price_id,status,stripe_customer_id,stripe_session_id,checkout_url,session_expires_at";

function validateAttempt(value: unknown, userId: string): StripeCheckoutAttempt {
  if (!value || typeof value !== "object") {
    throw new Error("Stripe Checkout claim response was invalid");
  }
  const row = value as Partial<StripeCheckoutAttempt>;
  if (
    typeof row.attempt_id !== "string" ||
    row.attempt_id.length === 0 ||
    row.user_id !== userId ||
    typeof row.price_id !== "string" ||
    !["claimed", "open", "needs_review", "completed", "expired", "released"].includes(
      row.status ?? "",
    )
  ) {
    throw new Error("Stripe Checkout claim response failed verification");
  }
  return row as StripeCheckoutAttempt;
}

export function checkoutAttemptIdempotencyKey(
  attemptId: string,
  operation: "customer" | "session",
): string {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(attemptId)) {
    throw new Error("Invalid Stripe Checkout attempt ID");
  }
  return `ttai_checkout_v1_${operation}_${attemptId}`;
}

export async function acquireStripeCheckoutAttempt(
  admin: SupabaseClient,
  userId: string,
  priceId: string,
): Promise<
  | { kind: "acquired"; attempt: StripeCheckoutAttempt }
  | { kind: "existing"; attempt: StripeCheckoutAttempt }
> {
  if (!userId || !priceId) {
    throw new Error("Missing Stripe Checkout claim scope");
  }

  const { data, error } = await admin
    .from(table)
    .insert({ user_id: userId, price_id: priceId, status: "claimed" })
    .select(columns)
    .single();

  if (!error) {
    const attempt = validateAttempt(data, userId);
    if (attempt.price_id !== priceId || attempt.status !== "claimed") {
      throw new Error("New Stripe Checkout claim did not match request");
    }
    return { kind: "acquired", attempt };
  }

  if (error.code !== "23505") {
    throw new Error("Unable to safely acquire Stripe Checkout claim");
  }

  // Only a verified, still-blocking attempt may explain the conflict.
  const lookup = await admin
    .from(table)
    .select(columns)
    .eq("user_id", userId)
    .in("status", unresolved)
    .maybeSingle();

  if (lookup.error || !lookup.data) {
    throw new Error("Unable to reconcile existing Stripe Checkout claim");
  }

  const attempt = validateAttempt(lookup.data, userId);
  if (!unresolved.includes(attempt.status)) {
    throw new Error("Existing Stripe Checkout claim was unexpectedly terminal");
  }
  // A different price is NOT a reusable claim; caller must block.
  return { kind: "existing", attempt };
}

async function transitionStripeCheckoutAttempt(
  admin: SupabaseClient,
  userId: string,
  attemptId: string,
  fromStatus: "claimed" | "open",
  nextStatus: Exclude<StripeCheckoutAttemptStatus, "claimed">,
  patch: Record<string, string | null> = {},
): Promise<void> {
  const { data, error } = await admin
    .from(table)
    .update({ ...patch, status: nextStatus, updated_at: new Date().toISOString() })
    .eq("attempt_id", attemptId)
    .eq("user_id", userId)
    .eq("status", fromStatus)
    .select("attempt_id")
    .maybeSingle();

  if (error || !data || data.attempt_id !== attemptId) {
    throw new Error("Unable to safely transition Stripe Checkout claim");
  }
}

export async function markStripeCheckoutOpen(
  admin: SupabaseClient,
  args: {
    userId: string;
    attemptId: string;
    stripeCustomerId: string;
    stripeSessionId: string;
    checkoutUrl: string;
    expiresAt: number | null;
  },
): Promise<void> {
  if (!args.stripeCustomerId || !args.stripeSessionId || !args.checkoutUrl) {
    throw new Error("Stripe Checkout session evidence is incomplete");
  }
  const date = args.expiresAt === null ? null : new Date(args.expiresAt * 1000);
  if (date && Number.isNaN(date.getTime())) {
    throw new Error("Invalid Stripe Checkout expiration");
  }
  await transitionStripeCheckoutAttempt(
    admin,
    args.userId,
    args.attemptId,
    "claimed",
    "open",
    {
      stripe_customer_id: args.stripeCustomerId,
      stripe_session_id: args.stripeSessionId,
      checkout_url: args.checkoutUrl,
      session_expires_at: date?.toISOString() ?? null,
    },
  );
}

export async function markStripeCheckoutNeedsReview(
  admin: SupabaseClient,
  userId: string,
  attemptId: string,
): Promise<void> {
  await transitionStripeCheckoutAttempt(admin, userId, attemptId, "claimed", "needs_review");
}

/** Call ONLY after independently verifying no session operation occurred. */
export async function releaseVerifiedUnstartedCheckout(
  admin: SupabaseClient,
  userId: string,
  attemptId: string,
): Promise<void> {
  await transitionStripeCheckoutAttempt(admin, userId, attemptId, "claimed", "released");
}

/** Call ONLY after retrieving and verifying terminal status from Stripe. */
export async function markVerifiedStripeCheckoutTerminal(
  admin: SupabaseClient,
  userId: string,
  attemptId: string,
  status: "expired" | "completed",
): Promise<void> {
  await transitionStripeCheckoutAttempt(admin, userId, attemptId, "open", status);
}
