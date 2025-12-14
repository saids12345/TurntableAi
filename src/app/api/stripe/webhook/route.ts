// src/app/api/stripe/webhook/route.ts
import Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { planFromStripeStatus, isProFromPlan } from "@/lib/plans";

export const runtime = "nodejs";

async function upsertProfileByCustomer(params: {
  customerId: string;
  subscriptionId?: string | null;
  subscriptionStatus?: string | null;
  currentPeriodEnd?: number | null; // unix seconds
}) {
  const plan = planFromStripeStatus(params.subscriptionStatus ?? null);
  const is_pro = isProFromPlan(plan);

  const update = {
    plan,
    is_pro,
    stripe_customer_id: params.customerId,
    stripe_subscription_id: params.subscriptionId ?? null,
    stripe_subscription_status: params.subscriptionStatus ?? null,
    current_period_end: params.currentPeriodEnd
      ? new Date(params.currentPeriodEnd * 1000).toISOString()
      : null,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabaseAdmin
    .from("profiles")
    .update(update)
    .eq("stripe_customer_id", params.customerId);

  if (error) throw error;
}

export async function POST(req: Request) {
  const whsec = process.env.STRIPE_WEBHOOK_SECRET;
  if (!whsec) return new Response("Missing STRIPE_WEBHOOK_SECRET", { status: 500 });

  const sig = req.headers.get("stripe-signature");
  if (!sig) return new Response("Missing stripe-signature header", { status: 400 });

  const payload = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(payload, sig, whsec);
  } catch (err: any) {
    return new Response(`Webhook Error: ${err?.message ?? "Unknown error"}`, {
      status: 400,
    });
  }

  try {
    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;

        const customerId =
          typeof sub.customer === "string" ? sub.customer : sub.customer.id;

        await upsertProfileByCustomer({
          customerId,
          subscriptionId: sub.id,
          subscriptionStatus: sub.status,
          currentPeriodEnd: (sub as any).current_period_end ?? null,

        });

        break;
      }

      case "checkout.session.completed": {
        // Optional helper for first-time checkout
        const session = event.data.object as Stripe.Checkout.Session;

        const customerId =
          typeof session.customer === "string" ? session.customer : session.customer?.id;

        if (customerId) {
          await upsertProfileByCustomer({
            customerId,
            subscriptionId: null,
            subscriptionStatus: "active",
            currentPeriodEnd: null,
          });
        }
        break;
      }

      default:
        // ignore other events
        break;
    }

    return new Response("ok", { status: 200 });
  } catch (err: any) {
    return new Response(`Webhook handler failed: ${err?.message ?? "Unknown"}`, {
      status: 500,
    });
  }
}
