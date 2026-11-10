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
import {
  acquireStripeCheckoutAttempt,
  checkoutAttemptIdempotencyKey,
  markStripeCheckoutNeedsReview,
  markStripeCheckoutOpen,
  markVerifiedStripeCheckoutTerminal,
  releaseVerifiedUnstartedCheckout,
} from "@/lib/stripeCheckoutAttempts";
import {
  isExpectedTurnTableCheckoutPrice,
  resolveStripeCheckoutPriceExpectation,
} from "@/lib/stripePricePolicy";

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

    // Staging is a separate Vercel project whose environment is
    // named "production". Require its exact URL and test API key.
    const priceExpectation = resolveStripeCheckoutPriceExpectation({
      vercelEnv: process.env.VERCEL_ENV,
      siteUrl: process.env.NEXT_PUBLIC_SITE_URL,
      stripeSecretKey: process.env.STRIPE_SECRET_KEY,
    });

    if (!priceExpectation) {
      return NextResponse.json(
        {
          ok: false,
          code: "PRICE_NOT_VERIFIED",
          error: "Subscription configuration could not be verified.",
        },
        { status: 503 },
      );
    }

    // Verify Stripe price before creating any customer or session.
    const checkoutPrice = await stripe.prices.retrieve(
      priceId,
      { expand: ["product"] },
    );

    if (
      !isExpectedTurnTableCheckoutPrice(
        checkoutPrice,
        priceId,
        priceExpectation.expectedLiveMode,
        priceExpectation.expectedProductName,
      )
    ) {
      return NextResponse.json(
        {
          ok: false,
          code: "PRICE_NOT_VERIFIED",
          error:
            "Subscription pricing could not be verified. Please contact support.",
        },
        { status: 503 },
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

    // The database unique index permits exactly one unresolved attempt
    // per account. Acquire this BEFORE creating a Stripe customer/session.
    const claim = await acquireStripeCheckoutAttempt(
      supabaseAdmin, user.id, priceId,
    );

    if (claim.kind === "existing") {
      const existing = claim.attempt;
      if (
        existing.price_id !== priceId ||
        existing.status !== "open" ||
        !existing.stripe_session_id ||
        !existing.stripe_customer_id
      ) {
        return NextResponse.json(
          { ok: false, code: "CHECKOUT_RECONCILIATION_REQUIRED",
            error: "Checkout is already being prepared or requires support review. Please do not retry payment." },
          { status: 409 },
        );
      }

      // Do not rely on cached Checkout URLs or timestamps alone.
      // Verify the actual Stripe session and owner before returning it.
      const existingSession = await stripe.checkout.sessions.retrieve(
        existing.stripe_session_id,
      );
      const existingCustomerId =
        typeof existingSession.customer === "string"
          ? existingSession.customer
          : existingSession.customer?.id ?? null;
      if (
        existingSession.id !== existing.stripe_session_id ||
        existingSession.mode !== "subscription" ||
        existingSession.client_reference_id !== user.id ||
        existingSession.metadata?.supabase_user_id !== user.id ||
        existingSession.metadata?.turntable_price_id !== priceId ||
        existingCustomerId !== existing.stripe_customer_id
      ) {
        return NextResponse.json(
          { ok: false, code: "CHECKOUT_RECONCILIATION_REQUIRED",
            error: "Checkout ownership could not be verified. Please contact support." },
          { status: 503 },
        );
      }

      if (existingSession.status === "complete" || existingSession.status === "expired") {
        await markVerifiedStripeCheckoutTerminal(
          supabaseAdmin, user.id, existing.attempt_id, existingSession.status === "complete" ? "completed" : "expired",
        );
        return NextResponse.json(
          { ok: false, code: "CHECKOUT_STATE_REFRESHED",
            error: "Checkout status was refreshed. Please reload billing before continuing." },
          { status: 409 },
        );
      }

      if (existingSession.status !== "open" || !existingSession.url) {
        return NextResponse.json(
          { ok: false, code: "CHECKOUT_RECONCILIATION_REQUIRED",
            error: "Checkout is not ready. Please contact support." },
          { status: 503 },
        );
      }
      return NextResponse.json(
        { ok: true, url: existingSession.url, reused: true },
        { status: 200 },
      );
    }

    const claimAttemptId = claim.attempt.attempt_id;

    let customerId = profile?.stripe_customer_id ?? null;

    // Create customer if missing
    if (!customerId) {
      const customer = await stripe.customers.create(
        {
          email: user.email ?? undefined,
          metadata: { supabase_user_id: user.id },
        },
        { idempotencyKey: checkoutAttemptIdempotencyKey(claimAttemptId, "customer") },
      );

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
      // No Checkout session was created by this attempt.
      await releaseVerifiedUnstartedCheckout(supabaseAdmin, user.id, claimAttemptId);
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
      // Stripe verified an existing subscription; this attempt made no session.
      await releaseVerifiedUnstartedCheckout(supabaseAdmin, user.id, claimAttemptId);
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
      await releaseVerifiedUnstartedCheckout(supabaseAdmin, user.id, claimAttemptId);
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
      const existingSession = openCheckoutSessions.data.find(
        (session) => session.url === reusableCheckoutUrl &&
          session.status === "open" &&
          session.client_reference_id === user.id &&
          session.metadata?.supabase_user_id === user.id &&
          session.metadata?.turntable_price_id === priceId &&
          (typeof session.customer === "string" ? session.customer : session.customer?.id) === customerId,
      );
      if (!existingSession?.id) {
        throw new Error("Stripe Checkout session reuse evidence was incomplete");
      }
      await markStripeCheckoutOpen(supabaseAdmin, {
        userId: user.id,
        attemptId: claimAttemptId,
        stripeCustomerId: customerId,
        stripeSessionId: existingSession.id,
        checkoutUrl: reusableCheckoutUrl,
        expiresAt: existingSession.expires_at ?? null,
      });
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

    // Never open a second session while an older one is still open,
    // even if a different redirect path prevented reuse.
    if (openCheckoutSessions.data.length > 0) {
      await releaseVerifiedUnstartedCheckout(supabaseAdmin, user.id, claimAttemptId);
      return NextResponse.json(
        { ok: false, code: "EXISTING_CHECKOUT_SESSION",
          error: "Another checkout is already open. Please use the existing checkout or contact support." },
        { status: 409 },
      );
    }

    // A failed or timed-out Stripe call may have created a session.
    // Keep the claim blocked for deliberate Stripe reconciliation.
    let session;
    try {
      session = await stripe.checkout.sessions.create(
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
          turntable_attempt_id:
            claimAttemptId,
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
          idempotencyKey: checkoutAttemptIdempotencyKey(claimAttemptId, "session"),
        },
      );
    } catch (error) {
      await markStripeCheckoutNeedsReview(supabaseAdmin, user.id, claimAttemptId);
      throw error;
    }

    if (!session.url) {
      return NextResponse.json(
        { ok: false, error: "Stripe session created but missing url" },
        { status: 500 }
      );
    }

    await markStripeCheckoutOpen(supabaseAdmin, {
      userId: user.id,
      attemptId: claimAttemptId,
      stripeCustomerId: customerId,
      stripeSessionId: session.id,
      checkoutUrl: session.url,
      expiresAt: session.expires_at ?? null,
    });

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
