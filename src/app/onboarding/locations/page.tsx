import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabaseServer";
import LocationsClient from "./LocationsClient";

export const dynamic = "force-dynamic";

export default async function OnboardingLocationsPage() {
  const supabase = await getSupabaseServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/login?redirect=%2Fonboarding%2Flocations");
  }

  return <LocationsClient />;
}
