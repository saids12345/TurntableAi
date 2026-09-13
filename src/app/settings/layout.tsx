// src/app/settings/layout.tsx
import SettingsNav from "./SettingsNav";
import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await getSupabaseServerClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  // ✅ Settings should be behind auth
  if (error || !user) {
    redirect("/login?redirect=/settings/billing");
  }

  return (
    <div className="min-h-[70vh] p-6">
      <div className="mx-auto w-full max-w-5xl">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold">Settings</h1>
          <p className="mt-1 text-sm text-white/70">
            Manage billing and app preferences.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-[220px_1fr]">
          <div className="rounded-2xl border border-white/10 bg-black/30 p-3 shadow-lg">
            <SettingsNav />
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/30 p-4 shadow-lg">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
