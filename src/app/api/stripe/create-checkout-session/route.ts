// src/app/api/stripe/create-checkout-session/route.ts
import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getSupabaseRouteClient } from "@/lib/supabaseRoute";
import { sanitizeInternalPath } from "@/lib/safeInternalPath";
import {
  findReusableStripeCheckoutUrl,
  shouldBlockNewStripeCheckout,
} from "@/lib/stripeCheckoutPolicy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    process.env.APP_BASE_URL?.replace(/\/$/, "") ||
    "http://localhost:3000"
  );
}

function sanitizeNextPath(next: unknown): string {
  const safeNext =
    sanitizeInternalPath(next);

  // prevent loops / unsafe redirects
  if (safeNext.startsWith("/login")) return "/";
  if (safeNext.startsWith("/auth")) return "/";
  if (safeNext.startsWith("/api")) return "/";

  return safeNext;
}

export async function POST(req: Request) {
  try {
    const priceId = process.env.STRIPE_PRICE_ID;
    const appUrl = getBaseUrl();

    if (!priceId) {
      return NextResponse.json(
        { ok: false, error: "Missing STRIPE_PRICE_ID" },
        { status: 500 }
      );
    }

    // Read next from request body (optional)
    const body = await req.json().catch(() => ({}));
    const nextPath = sanitizeNextPath(body?.next);

    // Auth: must be logged in
    const supabase = await getSupabaseRouteClient();
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr || !user) {
      return NextResponse.json(
        { ok: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    const supabaseAdmin = getSupabaseAdmin();

    // Load profile (customer/sub info)
    const { data: profile, error: profileErr } = await supabaseAdmin
      .from("profiles")
      .select(
        "stripe_customer_id, stripe_subscription_id, stripe_subscription_status, stripe_trial_used_at"
      )
      .eq("id", user.id)
      .maybeSingle();

    if (profileErr) {
      return NextResponse.json(
        { ok: false, error: `Failed to load profile: ${profileErr.message}` },
        { status: 500 }
      );
    }

    // Do not create another checkout while Stripe still has
    // a non-terminal subscription. Only canceled or
    // incomplete_expired subscriptions may start again.
    const status = profile?.stripe_subscription_status ?? null;
    let hasUsedTrial = Boolean(profile?.stripe_trial_used_at);

    const alreadySubscribed =
      shouldBlockNewStripeCheckout(
        status,
      );

    if (alreadySubscribed) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "You already have a subscription on this account. Use Manage billing.",
          code: "ALREADY_SUBSCRIBED",
        },
        { status: 409 }
      );
    }

    let customerId = profile?.stripe_customer_id ?? null;

    // Create customer if missing
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email ?? undefined,
        metadata: { supabase_user_id: user.id },
      });

      customerId = customer.id;

      const { error: saveErr } = await supabaseAdmin
        .from("profiles")
        .update({
          stripe_customer_id: customerId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);

      if (saveErr) {
        return NextResponse.json(
          {
            ok: false,
            error: `Failed to save stripe_customer_id: ${saveErr.message}`,
          },
          { status: 500 }
        );
      }
    } else {
      // best effort: ensure metadata is present for older customers
      try {
        await stripe.customers.update(customerId, {
          metadata: { supabase_user_id: user.id },
        });
      } catch {
        // ignore
      }
    }

    /*
     * Stripe is authoritative for current subscription state.
     * This protects against a stale Supabase profile creating
     * a duplicate subscription or duplicate free trial.
     */
    const stripeSubscriptions =
      await stripe.subscriptions.list({
        customer:
          customerId,
        status:
          "all",
        limit:
          100,
      });

    if (stripeSubscriptions.has_more) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Could not safely verify existing Stripe subscriptions.",
        },
        {
          status: 500,
        },
      );
    }

    const stripeAlreadySubscribed =
      stripeSubscriptions.data.some(
        (subscription) =>
          shouldBlockNewStripeCheckout(
            subscription.status,
          ),
      );

    if (stripeAlreadySubscribed) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "You already have a subscription on this account. Use Manage billing.",
          code:
            "ALREADY_SUBSCRIBED",
        },
        {
          status: 409,
        },
      );
    }

    if (!hasUsedTrial) {
      hasUsedTrial =
        stripeSubscriptions.data.some(
          (subscription) =>
            typeof subscription.trial_start ===
            "number",
        );
    }

    const successUrl = `${appUrl}/billing?success=1&next=${encodeURIComponent(
      nextPath
    )}`;
    const cancelUrl = `${appUrl}/billing?canceled=1&next=${encodeURIComponent(
      nextPath
    )}`;

    const openCheckoutSessions =
      await stripe.checkout.sessions.list({
        customer:
          customerId,
        status:
          "open",
        limit:
          100,
      });

    if (openCheckoutSessions.has_more) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Could not safely verify existing Stripe checkout sessions.",
        },
        {
          status: 500,
        },
      );
    }

    const reusableCheckoutUrl =
      findReusableStripeCheckoutUrl({
        sessions:
          openCheckoutSessions.data,

        userId:
          user.id,

        priceId,

        successUrl,
        cancelUrl,
      });

    if (reusableCheckoutUrl) {
      return NextResponse.json(
        {
          ok: true,
          url:
            reusableCheckoutUrl,
          reused: true,
        },
        {
          status: 200,
        },
      );
    }

    const session = await stripe.checkout.sessions.create(
      {
        mode: "subscription",
        customer: customerId,
        line_items: [{ price: priceId, quantity: 1 }],

        // Helps you correlate Stripe → Supabase user
        client_reference_id: user.id,
        metadata: {
          supabase_user_id:
            user.id,
          turntable_price_id:
            priceId,
        },

        // Card required to start trial
        payment_method_collection: "always",

        subscription_data: hasUsedTrial
          ? {
              metadata: {
                supabase_user_id: user.id,
              },
            }
          : {
              trial_period_days: 14,
              metadata: {
                supabase_user_id: user.id,
              },
            },

        success_url: successUrl,
        cancel_url: cancelUrl,

        allow_promotion_codes: false,
      },
      {
        // Unique per attempt so Stripe never blocks repeat clicks as a “duplicate”
        idempotencyKey: `ttai_checkout_${user.id}_${priceId}_${Date.now()}`,
      }
    );

    if (!session.url) {
      return NextResponse.json(
        { ok: false, error: "Stripe session created but missing url" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, url: session.url }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      {
        ok: false,
        error: err?.message || "Unknown error creating checkout session",
      },
      { status: 500 }
    );
  }
}
