// src/lib/supabase.ts
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const srv  = process.env.SUPABASE_SERVICE_ROLE!;

// Use ONLY in API routes / server utilities (never import into client components)
export function supabaseServer() {
  return createClient(url, srv, { auth: { persistSession: false } });
}

// Optional: public client if you ever want it in client components
export function supabasePublic() {
  return createClient(url, anon);
}
