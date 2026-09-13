// src/app/api/stripe/create-portal-session/route.ts
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

function sanitizeReturnUrl(input: unknown, baseUrl: string) {
  // Only allow returning to our own site
  if (typeof input !== "string" || input.length === 0) return `${baseUrl}/billing`;

  try {
    const u = new URL(input);
    const base = new URL(baseUrl);

    // same origin only
    if (u.origin !== base.origin) return `${baseUrl}/billing`;

    // prevent returning to auth routes
    if (u.pathname.startsWith("/auth") || u.pathname.startsWith("/login")) {
      return `${baseUrl}/billing`;
    }

    return u.toString();
  } catch {
    return `${baseUrl}/billing`;
  }
}

export async function POST(req: Request) {
  try {
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

    const { data: profile, error: profileErr } = await supabaseAdmin
      .from("profiles")
      .select("stripe_customer_id")
      .eq("id", user.id)
      .maybeSingle();

    if (profileErr) {
      return NextResponse.json(
        { ok: false, error: `Failed to load profile: ${profileErr.message}` },
        { status: 500 }
      );
    }

    let customerId = profile?.stripe_customer_id ?? null;

    // ✅ Self-heal: create + save customer if missing
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
    }

    const appUrl = getBaseUrl();

    const body = await req.json().catch(() => ({}));
    const returnUrl = sanitizeReturnUrl(body?.returnUrl, appUrl);

    const portal = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });

    return NextResponse.json({ ok: true, url: portal.url }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "Failed to create portal session" },
      { status: 500 }
    );
  }
}
