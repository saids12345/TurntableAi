import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabaseServer";
import OnboardingStatusClient from "../OnboardingStatusClient";

export const dynamic = "force-dynamic";

export default async function ReadinessPage() {
  const supabase = await getSupabaseServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    redirect("/login?redirect=%2Fonboarding%2Freadiness");
  }
  return <OnboardingStatusClient step="readiness" />;
}
