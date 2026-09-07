// src/lib/requirePro.ts
import { getSupabaseServerClient } from "@/lib/supabaseServer";

/**
 * Returns { ok: true } if user is Pro, otherwise { ok:false, redirect }.
 * Use in Server Components/pages.
 */
export async function requirePro(opts?: { billingPath?: string }) {
  const supabase = await getSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    // If you passed a billingPath, we should go there after login
    const redirectTo = opts?.billingPath ?? "/billing";
    return {
      ok: false as const,
      redirect: `/login?redirect=${encodeURIComponent(redirectTo)}`,
    };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_pro, plan")
    .eq("id", user.id)
    .maybeSingle();

  const isPro = !!profile?.is_pro || profile?.plan === "pro";
  if (!isPro) {
    return {
      ok: false as const,
      redirect: opts?.billingPath ?? "/billing?next=/",
    };
  }

  return { ok: true as const, user };
}

/**
 * API/route-handler guard.
 * Throws Response(401/402) so callers stop immediately.
 */
export async function requireProForApi() {
  const supabase = await getSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_pro, plan")
    .eq("id", user.id)
    .maybeSingle();

  const isPro = !!profile?.is_pro || profile?.plan === "pro";
  if (!isPro) {
    throw new Response(JSON.stringify({ error: "Pro required" }), {
      status: 402,
      headers: { "content-type": "application/json" },
    });
  }

  return { user };
}
