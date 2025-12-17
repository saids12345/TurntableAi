// src/app/api/stripe/webhook/route.ts
import Stripe from "stripe";
import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { planFromStripeStatus, isProFromPlan } from "@/lib/plans";

export const runtime = "nodejs";

/**
 * Important on Vercel/Next:
 * - Ensures this route is always treated as a dynamic server route
 * - Avoids accidental static optimization / route not included behavior
 */
export const dynamic = "force-dynamic";

/**
 * ✅ TEMP DEBUG: proves the route is deployed on production
 * You can remove later.
 */
export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      route: "/api/stripe/webhook",
      message:
        "GET works → this deployment contains the webhook route. POST should not 404 anymore.",
      vercelCommit: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
      time: new Date().toISOString(),
    },
    { status: 200 }
  );
}

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

  // Try updating by stripe_customer_id (your original approach)
  const { data: updatedByCustomer, error: updateByCustomerError } =
    await supabaseAdmin
      .from("profiles")
      .update(update)
      .eq("stripe_customer_id", params.customerId)
      .select("id")
      .maybeSingle();

  if (updateByCustomerError) throw updateByCustomerError;

  // If no row matched, we can't update anything yet.
  // This is common if the profile row exists but stripe_customer_id has not been written yet.
  if (!updatedByCustomer) {
    // No-op (or you can choose to insert a row if that's your desired behavior)
    // If you want to link by email later, you'd do it here.
    return;
  }
}

export async function POST(req: Request) {
  const whsec = process.env.STRIPE_WEBHOOK_SECRET;
  if (!whsec) {
    return new Response("Missing STRIPE_WEBHOOK_SECRET", { status: 500 });
  }

  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return new Response("Missing stripe-signature header", { status: 400 });
  }

  // MUST be raw text for Stripe signature verification
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
        const session = event.data.object as Stripe.Checkout.Session;

        const customerId =
          typeof session.customer === "string"
            ? session.customer
            : session.customer?.id;

        // If you want, you can also store session.subscription here:
        // const subscriptionId =
        //   typeof session.subscription === "string"
        //     ? session.subscription
        //     : session.subscription?.id ?? null;

        if (customerId) {
          // This "active" write is a helper; real plan comes from subscription webhook
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
