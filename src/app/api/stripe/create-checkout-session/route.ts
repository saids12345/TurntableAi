// src/app/api/stripe/create-checkout-session/route.ts
import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getSupabaseRouteClient } from "@/lib/supabaseRoute";

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
  if (typeof next !== "string") return "/";
  if (!next.startsWith("/")) return "/";
  // prevent loops / unsafe redirects
  if (next.startsWith("/login")) return "/";
  if (next.startsWith("/auth")) return "/";
  if (next.startsWith("/api")) return "/";
  return next;
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
        "stripe_customer_id, stripe_subscription_id, stripe_subscription_status"
      )
      .eq("id", user.id)
      .maybeSingle();

    if (profileErr) {
      return NextResponse.json(
        { ok: false, error: `Failed to load profile: ${profileErr.message}` },
        { status: 500 }
      );
    }

    // If already has an active/trialing subscription, don't create another.
    // (We allow incomplete/incomplete_expired to retry.)
    const status = profile?.stripe_subscription_status ?? null;
    const alreadySubscribed =
      status === "active" || status === "trialing" || status === "past_due";

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

    const successUrl = `${appUrl}/billing?success=1&next=${encodeURIComponent(
      nextPath
    )}`;
    const cancelUrl = `${appUrl}/billing?canceled=1&next=${encodeURIComponent(
      nextPath
    )}`;

    const session = await stripe.checkout.sessions.create(
      {
        mode: "subscription",
        customer: customerId,
        line_items: [{ price: priceId, quantity: 1 }],

        // Helps you correlate Stripe → Supabase user
        client_reference_id: user.id,
        metadata: { supabase_user_id: user.id },

        // Card required to start trial
        payment_method_collection: "always",

        subscription_data: {
          trial_period_days: 14,
          // 🔥 This metadata is what your webhook should use to update profiles reliably
          metadata: { supabase_user_id: user.id },
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
