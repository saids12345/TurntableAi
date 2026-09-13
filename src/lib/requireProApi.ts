// src/lib/requireProApi.ts
import { getSupabaseServerClient } from "@/lib/supabaseServer";
import { hasProAccess } from "@/lib/plans";

export async function requireProApi() {
  const supabase = await getSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false as const,
      status: 401 as const,
      error: "Unauthorized",
    };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_pro, plan, stripe_subscription_status")
    .eq("id", user.id)
    .maybeSingle();

  const isPro = hasProAccess({
    isPro: profile?.is_pro,
    plan: profile?.plan,
    stripeSubscriptionStatus: profile?.stripe_subscription_status,
  });

  if (!isPro) {
    return {
      ok: false as const,
      status: 403 as const,
      error: "Upgrade required",
    };
  }

  return {
    ok: true as const,
    userId: user.id,
  };
}
