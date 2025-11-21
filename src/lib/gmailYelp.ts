// src/lib/gmailYelp.ts
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Result shape for a single user's Gmail/Yelp poll.
 */
export type GmailYelpPollResult = {
  sentCount: number; // how many alert emails were sent for this user
};

/**
 * Background poll for one user.
 *
 * Right now this is a SAFE STUB so we don't break your existing "Test poll now".
 * Later, we'll move your real Gmail/Yelp polling logic into here so BOTH:
 *   - the manual "Test poll now" button, and
 *   - the background cron job
 * share the exact same logic.
 */
export async function pollGmailYelpForUser(opts: {
  supabase: SupabaseClient;
  userId: string;
}): Promise<GmailYelpPollResult> {
  const { supabase, userId } = opts;

  // 🔹 For now, just log that the cron ran.
  //    Your existing /api/gmail/yelp/poll route still does the real work
  //    for the "Test poll now" button. We are not touching that yet.
  console.log("[gmail-yelp] background poll stub for user:", userId);

  // Example: you *could* verify the user exists, tokens exist, etc.
  // (This is optional while we're still stubbing.)
  const { data: tokenRow, error: tokenError } = await supabase
    .from("gmail_yelp_tokens")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (tokenError) {
    console.error("[gmail-yelp] error checking tokens", { userId, tokenError });
  } else if (!tokenRow) {
    console.warn("[gmail-yelp] no gmail_yelp_tokens row for user", userId);
  }

  // 🔹 Return 0 for now. Once we move your real logic here,
  //    this will reflect how many alert emails were sent.
  return { sentCount: 0 };
}
