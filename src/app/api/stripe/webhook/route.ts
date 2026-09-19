// src/app/api/stripe/webhook/route.ts
import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function toIsoFromUnixSeconds(sec: unknown): string | null {
  if (typeof sec !== "number") return null;
  return new Date(sec * 1000).toISOString();
}

/**
 * Stripe's newer API versions moved current_period_end from
 * the Subscription object to individual SubscriptionItems.
 *
 * During a trial, trial_end is the most useful customer-facing
 * date. For active subscriptions, use the latest item period end.
 *
 * The legacy fallback keeps this compatible with older Stripe
 * API versions as well.
 */
function getSubscriptionPeriodEndUnix(
  sub: Stripe.Subscription
): number | null {
  const trialEnd =
    (sub as any).trial_end;

  if (
    sub.status === "trialing" &&
    typeof trialEnd === "number"
  ) {
    return trialEnd;
  }

  const itemPeriodEnds =
    sub.items?.data
      .map(
        (item) =>
          (item as any)
            .current_period_end
      )
      .filter(
        (value): value is number =>
          typeof value === "number"
      ) ?? [];

  if (itemPeriodEnds.length > 0) {
    return Math.max(
      ...itemPeriodEnds
    );
  }

  const legacyPeriodEnd =
    (sub as any)
      .current_period_end;

  return typeof legacyPeriodEnd ===
    "number"
    ? legacyPeriodEnd
    : null;
}

function getSupabaseUserIdFromMetadata(obj: any): string | null {
  const id = obj?.metadata?.supabase_user_id;
  return typeof id === "string" && id.length > 0 ? id : null;
}

// ✅ LOCK on past_due
function computeIsPro(status: unknown): boolean {
  return status === "trialing" || status === "active";
}

function getCustomerIdFromObj(obj: any): string | null {
  const c = obj?.customer;
  if (typeof c === "string") return c;
  if (c && typeof c === "object" && typeof c.id === "string") return c.id;
  return null;
}

/**
 * Stripe may deliver the same webhook more than once.
 *
 * An event is considered processed only AFTER its business
 * logic has completed successfully.
 *
 * This is important: if Supabase or Stripe temporarily fails,
 * the event remains unprocessed so Stripe can safely retry it.
 */
async function isEventProcessed(
  eventId: string
): Promise<boolean> {
  const supabaseAdmin =
    getSupabaseAdmin();

  const { data, error } =
    await supabaseAdmin
      .from("stripe_webhook_events")
      .select("event_id")
      .eq("event_id", eventId)
      .maybeSingle();

  if (error) {
    throw new Error(
      `Stripe webhook dedupe lookup failed: ${error.message}`
    );
  }

  return Boolean(data?.event_id);
}

async function markEventProcessed(
  event: Stripe.Event
): Promise<void> {
  const supabaseAdmin =
    getSupabaseAdmin();

  const { error } =
    await supabaseAdmin
      .from("stripe_webhook_events")
      .insert({
        event_id: event.id,
        event_type: event.type,
        processed_at:
          new Date().toISOString(),
      });

  if (!error) {
    return;
  }

  // A concurrent delivery may have completed first.
  // PostgreSQL 23505 = unique violation.
  if (
    (error as any)?.code ===
    "23505"
  ) {
    return;
  }

  throw new Error(
    `Stripe webhook completion write failed: ${error.message}`
  );
}

/**
 * Fallback resolution if metadata is missing:
 * 1) Find profile by stripe_customer_id in Supabase
 * 2) If not found, retrieve Stripe customer and read metadata.supabase_user_id
 */
async function resolveSupabaseUserId(args: {
  maybeSupabaseUserId: string | null;
  stripeCustomerId: string | null;
}): Promise<string | null> {
  const { maybeSupabaseUserId, stripeCustomerId } = args;

  if (maybeSupabaseUserId) return maybeSupabaseUserId;
  if (!stripeCustomerId) return null;

  const supabaseAdmin = getSupabaseAdmin();

  const { data: profileByCustomer, error } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("stripe_customer_id", stripeCustomerId)
    .maybeSingle();

  if (error) {
    console.error(
      "[stripe-webhook] lookup by stripe_customer_id failed:",
      error
    );
  } else if (profileByCustomer?.id) {
    return profileByCustomer.id as string;
  }

  try {
    const customer = await stripe.customers.retrieve(stripeCustomerId);
    const id = getSupabaseUserIdFromMetadata(customer as any);
    if (id) return id;
  } catch (e: any) {
    console.error(
      "[stripe-webhook] retrieve customer failed:",
      e?.message || e
    );
  }

  return null;
}

async function upsertProfile(args: {
  supabaseUserId: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  stripeSubscriptionStatus: string | null;
  currentPeriodEndIso: string | null;
}) {
  const {
    supabaseUserId,
    stripeCustomerId,
    stripeSubscriptionId,
    stripeSubscriptionStatus,
    currentPeriodEndIso,
  } = args;

  const isPro = computeIsPro(stripeSubscriptionStatus);
  const supabaseAdmin = getSupabaseAdmin();

  const payload: Record<string, any> = {
    id: supabaseUserId,
    stripe_customer_id: stripeCustomerId,
    stripe_subscription_id: stripeSubscriptionId,
    stripe_subscription_status: stripeSubscriptionStatus,
    current_period_end: currentPeriodEndIso,
    is_pro: isPro,
    plan: isPro ? "pro" : "free",
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabaseAdmin
    .from("profiles")
    .upsert(payload, { onConflict: "id" });

  if (error) throw new Error(`Supabase upsert failed: ${error.message}`);
}

export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json(
      { ok: false, error: "Missing STRIPE_WEBHOOK_SECRET" },
      { status: 500 }
    );
  }

  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json(
      { ok: false, error: "Missing stripe-signature header" },
      { status: 400 }
    );
  }

  let event: Stripe.Event;

  try {
    const buf = Buffer.from(await req.arrayBuffer());
    event = stripe.webhooks.constructEvent(buf, sig, secret);
  } catch (err: any) {
    return NextResponse.json(
      {
        ok: false,
        error: `Webhook signature verification failed: ${err?.message}`,
      },
      { status: 400 }
    );
  }

  try {
    console.log("[stripe-webhook] event:", event.type, "id:", event.id);

    const alreadyProcessed =
      await isEventProcessed(
        event.id
      );

    if (alreadyProcessed) {
      console.log(
        "[stripe-webhook] duplicate event ignored:",
        event.id
      );

      return NextResponse.json(
        {
          ok: true,
          deduped: true,
        },
        {
          status: 200,
        }
      );
    }

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;

        const stripeCustomerId = getCustomerIdFromObj(session);

        const subscriptionId =
          typeof session.subscription === "string"
            ? session.subscription
            : (session.subscription as any)?.id ?? null;

        const supabaseUserId = await resolveSupabaseUserId({
          maybeSupabaseUserId: getSupabaseUserIdFromMetadata(session),
          stripeCustomerId,
        });

        console.log("[stripe-webhook] checkout.session.completed", {
          stripeCustomerId,
          subscriptionId,
          supabaseUserId,
        });

        if (
          !supabaseUserId ||
          !subscriptionId
        ) {
          throw new Error(
            `Could not resolve checkout session ${session.id} to a TurnTableAI user and subscription.`
          );
        }

        const sub = await stripe.subscriptions.retrieve(subscriptionId);

        await upsertProfile({
          supabaseUserId,
          stripeCustomerId,
          stripeSubscriptionId: sub.id ?? null,
          stripeSubscriptionStatus: (sub.status as any) ?? null,
          currentPeriodEndIso:
            toIsoFromUnixSeconds(
              getSubscriptionPeriodEndUnix(
                sub
              )
            ),
        });

        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;

        const stripeCustomerId = getCustomerIdFromObj(sub);

        const supabaseUserId = await resolveSupabaseUserId({
          maybeSupabaseUserId: getSupabaseUserIdFromMetadata(sub),
          stripeCustomerId,
        });

        console.log("[stripe-webhook] subscription upsert", {
          stripeCustomerId,
          subscriptionId: sub.id,
          status: sub.status,
          supabaseUserId,
        });

        if (!supabaseUserId) {
          throw new Error(
            `Could not resolve subscription ${sub.id} to a TurnTableAI user.`
          );
        }

        /*
         * Stripe does not guarantee webhook delivery order.
         *
         * Re-read the subscription so an older delayed webhook
         * cannot overwrite the profile with stale subscription
         * status.
         */
        const latestSub =
          await stripe.subscriptions.retrieve(
            sub.id
          );

        const latestCustomerId =
          getCustomerIdFromObj(
            latestSub
          ) ??
          stripeCustomerId;

        await upsertProfile({
          supabaseUserId,
          stripeCustomerId:
            latestCustomerId,
          stripeSubscriptionId:
            latestSub.id ?? null,
          stripeSubscriptionStatus:
            (latestSub.status as any) ??
            null,
          currentPeriodEndIso:
            toIsoFromUnixSeconds(
              getSubscriptionPeriodEndUnix(
                latestSub
              )
            ),
        });

        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;

        const stripeCustomerId = getCustomerIdFromObj(sub);

        const supabaseUserId = await resolveSupabaseUserId({
          maybeSupabaseUserId: getSupabaseUserIdFromMetadata(sub),
          stripeCustomerId,
        });

        console.log("[stripe-webhook] subscription deleted", {
          stripeCustomerId,
          subscriptionId: sub.id,
          supabaseUserId,
        });

        if (!supabaseUserId) {
          throw new Error(
            `Could not resolve deleted subscription ${sub.id} to a TurnTableAI user.`
          );
        }

        await upsertProfile({
          supabaseUserId,
          stripeCustomerId,
          stripeSubscriptionId: null,
          stripeSubscriptionStatus: "canceled",
          currentPeriodEndIso: null,
        });

        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const stripeCustomerId = getCustomerIdFromObj(invoice);

        const invoiceSubscription = (invoice as any)?.subscription;
        const subscriptionId =
          typeof invoiceSubscription === "string"
            ? invoiceSubscription
            : invoiceSubscription?.id ?? null;

        console.warn("[stripe-webhook] invoice.payment_failed", {
          stripeCustomerId,
          invoiceId: invoice.id,
          subscriptionId,
        });

        if (!subscriptionId) break;

        const sub = await stripe.subscriptions.retrieve(subscriptionId);
        const supabaseUserId = await resolveSupabaseUserId({
          maybeSupabaseUserId: getSupabaseUserIdFromMetadata(sub),
          stripeCustomerId,
        });

        if (!supabaseUserId) {
          throw new Error(
            `Could not resolve failed-payment subscription ${sub.id} to a TurnTableAI user.`
          );
        }

        await upsertProfile({
          supabaseUserId,
          stripeCustomerId,
          stripeSubscriptionId: sub.id ?? null,
          stripeSubscriptionStatus: (sub.status as any) ?? null,
          currentPeriodEndIso:
            toIsoFromUnixSeconds(
              getSubscriptionPeriodEndUnix(
                sub
              )
            ),
        });

        break;
      }

      default:
        break;
    }

    await markEventProcessed(
      event
    );

    return NextResponse.json(
      {
        ok: true,
      },
      {
        status: 200,
      }
    );
  } catch (err: any) {
    console.error("[stripe-webhook] error:", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "Webhook handler error" },
      { status: 500 }
    );
  }
}