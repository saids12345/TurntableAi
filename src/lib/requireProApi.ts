// src/lib/requireProApi.ts
import { getSupabaseServerClient } from "@/lib/supabaseServer";

export async function requireProApi() {
  const supabase =
  await getSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false as const, status: 401 as const, error: "Unauthorized" };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_pro")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.is_pro) {
    return { ok: false as const, status: 403 as const, error: "Upgrade required" };
  }

  return { ok: true as const, userId: user.id };
}
