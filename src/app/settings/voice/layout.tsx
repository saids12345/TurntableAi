// src/app/settings/voice/layout.tsx
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";

export default async function VoiceSettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Next.js 15: cookies() is async, so we await it first
  // Then pass a function that returns the awaited cookies
  const cookieStore = await cookies();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createServerComponentClient({ cookies: () => cookieStore as any });
  const {
    data: { session },
  } = await supabase.auth.getSession();

  // If not signed in, send to /login and come back here after auth
  if (!session) {
    redirect("/login?redirect=/settings/voice");
  }

  return <>{children}</>;
}
