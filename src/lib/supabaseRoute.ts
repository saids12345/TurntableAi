// src/lib/supabaseRoute.ts
import { cookies as nextCookies } from "next/headers";
import { createRouteHandlerClient, SupabaseClient } from "@supabase/auth-helpers-nextjs";

/**
 * Returns a Supabase client for Route Handlers (app/api/*).
 * Next 15 requires awaiting `cookies()`.
 */
export async function getSupabaseRouteClient(): Promise<SupabaseClient> {
  // Grab the request cookie store for this route handler invocation.
  const cookieStore = await nextCookies();

  const client = createRouteHandlerClient({
    // Cast to any to paper over the type mismatch (runtime behavior is correct).
    cookies: () => cookieStore as any,
  });

  // Cast to SupabaseClient so callers get good IntelliSense.
  return client as unknown as SupabaseClient;
}
