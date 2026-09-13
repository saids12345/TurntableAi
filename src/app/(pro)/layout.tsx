import { requirePro } from "@/lib/requirePro";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const h = await headers();
  const path = h.get("next-url") || "/";

  const billingPath = `/billing?next=${encodeURIComponent(path)}`;

  const gate = await requirePro({ billingPath });
  if (!gate.ok) {
    redirect(gate.redirect);
  }

  return <>{children}</>;
}