// src/app/api/stripe/webhook/route.ts
import Stripe from "stripe";
import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { planFromStripeStatus, isProFromPlan } from "@/lib/plans";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

function log(message: string, data?: any) {
  if (data) console.log(`[stripe-webhook] ${message}`, data);
  else console.log(`[stripe-webhook] ${message}`);
}

async function upsertProfileByCustomer(params: {
  customerId: string;
  subscriptionId?: string | null;
  subscriptionStatus?: string | null;
  currentPeriodEnd?: number | null; // unix seconds
}) {
  const supabaseAdmin = getSupabaseAdmin();

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

  const { data: updatedByCustomer, error } = await supabaseAdmin
    .from("profiles")
    .update(update)
    .eq("stripe_customer_id", params.customerId)
    .select("id")
    .maybeSingle();

  if (error) throw error;

  if (!updatedByCustomer) {
    log("No profile matched stripe_customer_id (no-op)", {
      customerId: params.customerId,
    });
    return;
  }

  log("Updated profile by stripe_customer_id", {
    customerId: params.customerId,
    plan,
    is_pro,
  });
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
    log("Received event", { type: event.type, id: event.id });

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

        const subscriptionId =
          typeof session.subscription === "string"
            ? session.subscription
            : session.subscription?.id ?? null;

        if (customerId) {
          await upsertProfileByCustomer({
            customerId,
            subscriptionId,
            subscriptionStatus: "active",
            currentPeriodEnd: null,
          });
        }

        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;

        // Some Stripe typings versions don't include invoice.subscription,
        // so we safely read it via `any` to avoid TS errors.
        const anyInvoice = invoice as any;

        const customerId =
          typeof invoice.customer === "string" ? invoice.customer : null;

        const subscriptionId =
          typeof anyInvoice.subscription === "string"
            ? anyInvoice.subscription
            : anyInvoice.subscription?.id ?? null;

        log("Handling invoice.payment_succeeded", {
          customerId,
          subscriptionId,
          paid: (invoice as any).paid,
          status: (invoice as any).status,
        });

        if (customerId && subscriptionId) {
          const sub = await stripe.subscriptions.retrieve(subscriptionId);

          await upsertProfileByCustomer({
            customerId,
            subscriptionId: sub.id,
            subscriptionStatus: sub.status,
            currentPeriodEnd: (sub as any).current_period_end ?? null,
          });
        }

        break;
      }

      default:
        break;
    }

    return new Response("ok", { status: 200 });
  } catch (err: any) {
    log("Webhook handler failed", { message: err?.message, stack: err?.stack });
    return new Response(`Webhook handler failed: ${err?.message ?? "Unknown"}`, {
      status: 500,
    });
  }
}
