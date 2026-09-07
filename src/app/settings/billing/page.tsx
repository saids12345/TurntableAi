// src/app/settings/billing/page.tsx
import BillingSettingsClient from "./BillingSettingsClient";
import { getSupabaseServerClient } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

// ✅ LOCK on past_due
function isAllowedStripeStatus(status?: string | null) {
  return status === "trialing" || status === "active";
}

export default async function BillingSettingsPage() {
  const supabase = await getSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Not signed in
  if (!user) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-6">
        <div className="w-full max-w-xl rounded-2xl border border-white/10 bg-black/30 p-6 shadow-lg">
          <h1 className="text-2xl font-semibold">Billing settings</h1>
          <p className="mt-2 text-sm text-white/70">
            Please sign in to manage your subscription.
          </p>

          <a
            href="/login?redirect=/settings/billing"
            className="mt-4 inline-flex items-center justify-center rounded-xl bg-white px-4 py-3 font-medium text-black"
          >
            Sign in
          </a>
        </div>
      </div>
    );
  }

  // Load billing profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("plan, is_pro, stripe_subscription_status, current_period_end")
    .eq("id", user.id)
    .maybeSingle();

  const stripeStatus =
    (profile?.stripe_subscription_status as string | null) ?? null;

  const isPro =
    profile?.is_pro === true ||
    profile?.plan === "pro" ||
    isAllowedStripeStatus(stripeStatus);

  const planLabel = (profile?.plan ?? "free").toString();
  const statusLabel = stripeStatus ?? "—";
  const periodEndLabel = profile?.current_period_end
    ? new Date(profile.current_period_end as any).toLocaleString()
    : "—";

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-6">
      <div className="w-full max-w-xl rounded-2xl border border-white/10 bg-black/30 p-6 shadow-lg">
        <h1 className="text-2xl font-semibold">Billing settings</h1>
        <p className="mt-1 text-sm text-white/70">
          Manage your subscription securely via Stripe.
        </p>

        <div className="mt-4 rounded-xl border border-white/10 p-4">
          <div className="text-sm text-white/70">Account</div>
          <div className="mt-1 text-base">{user.email ?? "Logged in"}</div>

          <div className="mt-4 grid gap-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-white/70">Plan</span>
              <span className="text-white/90 capitalize">{planLabel}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-white/70">Access</span>
              <span className={isPro ? "text-emerald-400" : "text-red-400"}>
                {isPro ? "Unlocked (Trial/Paid)" : "Locked"}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-white/70">Stripe status</span>
              <span className="text-white/90">{statusLabel}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-white/70">Current period end</span>
              <span className="text-white/90">{periodEndLabel}</span>
            </div>
          </div>
        </div>

        <div className="mt-5">
          <BillingSettingsClient
            authed={true}
            isPro={isPro}
            stripeStatus={stripeStatus}
            nextPath="/settings/billing"
          />
        </div>

        <div className="mt-4 text-xs text-white/60">
          Tip: You can also manage billing at{" "}
          <a className="underline underline-offset-2" href="/billing">
            /billing
          </a>
          .
        </div>
      </div>
    </div>
  );
}