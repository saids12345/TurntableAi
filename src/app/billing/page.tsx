// src/app/billing/page.tsx
import BillingClient from "./BillingClient";
import { getSupabaseServerClient } from "@/lib/supabaseServer";
import { hasProAccess } from "@/lib/plans";

export const dynamic = "force-dynamic";


export default async function BillingPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const supabase = await getSupabaseServerClient();

  const nextParam = searchParams?.next;
  const next =
    typeof nextParam === "string" && nextParam.startsWith("/") ? nextParam : "/";

  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();

  if (userErr || !user) {
    return (
      <BillingClient
        authed={false}
        email={null}
        isPro={false}
        plan="free"
        stripeStatus={null}
        currentPeriodEnd={null}
        nextPath={next}
      />
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("plan, is_pro, stripe_subscription_status, current_period_end")
    .eq("id", user.id)
    .maybeSingle();

  const stripeStatus =
    (profile?.stripe_subscription_status as string | null) ?? null;

  const isPro = hasProAccess({
    isPro: profile?.is_pro,
    plan: profile?.plan,
    stripeSubscriptionStatus: stripeStatus,
  });

  return (
    <BillingClient
      authed={true}
      email={user.email ?? null}
      isPro={isPro}
      plan={(profile?.plan as any) ?? "free"}
      stripeStatus={stripeStatus}
      currentPeriodEnd={(profile?.current_period_end as any) ?? null}
      nextPath={next}
    />
  );
}