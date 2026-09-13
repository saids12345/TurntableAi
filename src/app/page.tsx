import { redirect } from "next/navigation";
import MarketingHome from "@/components/MarketingHome";
import { getSupabaseServerClient } from "@/lib/supabaseServer";

export default async function HomePage() {
  const supabase = await getSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/command-center");
  }

  return <MarketingHome />;
}