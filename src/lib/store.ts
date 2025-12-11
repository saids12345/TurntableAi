// src/lib/store.ts
import { supabaseServer } from "./supabase";

/* ============================================================================
   Types
============================================================================ */
export type ProviderName = "google";

export type ProviderTokens = {
  access_token: string;
  refresh_token?: string;
  expiry_date?: number;
};

export type GoogleConn = {
  id: string;
  userId: string;
  email: string;
  accountName?: string;
  tokens: ProviderTokens;
  lastSeenByLocation: Record<string, string>;
  locations: { id: string; name: string; title: string }[];
};

/* ============================================================================
   Connections (create/update/read) for review providers
   Tables: review_connections, review_locations
============================================================================ */

/**
 * Upsert (create/update) a connection and its locations for a user.
 * - Ensures a single "google" connection per user.
 * - Replaces locations atomically on each save.
 */
export async function upsertConn(input: {
  userId: string;
  email: string;
  accountName?: string;
  tokens: ProviderTokens;
  locations: { name: string; title: string }[];
  lastSeenByLocation?: Record<string, string>;
}) {
  const db = supabaseServer();

  // Do we already have a google connection for this user?
  const existing = await db
    .from("review_connections")
    .select("id")
    .eq("user_id", input.userId)
    .eq("provider", "google")
    .maybeSingle();

  if (existing.error) throw existing.error;

  let connId: string;

  if (existing.data?.id) {
    // Update existing
    connId = existing.data.id;

    const upd = await db
      .from("review_connections")
      .update({
        email: input.email,
        account_name: input.accountName ?? null,
        tokens: input.tokens,
        last_seen_by_location: input.lastSeenByLocation ?? {},
        updated_at: new Date().toISOString(),
      })
      .eq("id", connId)
      .select("id")
      .single();

    if (upd.error) throw upd.error;

    // Replace locations
    const del = await db
      .from("review_locations")
      .delete()
      .eq("connection_id", connId);
    if (del.error) throw del.error;
  } else {
    // Insert fresh
    const ins = await db
      .from("review_connections")
      .insert({
        user_id: input.userId,
        email: input.email,
        provider: "google",
        account_name: input.accountName ?? null,
        tokens: input.tokens,
        last_seen_by_location: input.lastSeenByLocation ?? {},
      })
      .select("id")
      .single();

    if (ins.error) throw ins.error;
    connId = ins.data.id;
  }

  // Insert locations (if any)
  if (input.locations?.length) {
    const insLoc = await db.from("review_locations").insert(
      input.locations.map((l) => ({
        connection_id: connId,
        name: l.name,
        title: l.title,
      }))
    );
    if (insLoc.error) throw insLoc.error;
  }

  return connId;
}

/**
 * Read a single user's google connection (with locations).
 */
export async function getConnByUser(
  userId: string
): Promise<GoogleConn | null> {
  const db = supabaseServer();

  const res = await db
    .from("review_connections")
    .select(
      "id,user_id,email,account_name,tokens,last_seen_by_location,review_locations(id,name,title)"
    )
    .eq("user_id", userId)
    .eq("provider", "google")
    .single();

  if (res.error) {
    // PGRST116 = no rows
    if ((res.error as any).code === "PGRST116") return null;
    throw res.error;
  }

  const c = res.data as any;
  return {
    id: c.id,
    userId: c.user_id,
    email: c.email,
    accountName: c.account_name ?? undefined,
    tokens: c.tokens as ProviderTokens,
    lastSeenByLocation: c.last_seen_by_location ?? {},
    locations: (c.review_locations || []).map((l: any) => ({
      id: l.id,
      name: l.name,
      title: l.title,
    })),
  };
}

/**
 * 🔥 NEW: Read **all** google connections (multi-tenant).
 * Used by the cron job so we can poll reviews for every connected user.
 */
export async function getAllGoogleConns(): Promise<GoogleConn[]> {
  const db = supabaseServer();

  const res = await db
    .from("review_connections")
    .select(
      "id,user_id,email,account_name,tokens,last_seen_by_location,review_locations(id,name,title)"
    )
    .eq("provider", "google");

  if (res.error) throw res.error;

  return (res.data || []).map((c: any) => ({
    id: c.id,
    userId: c.user_id,
    email: c.email,
    accountName: c.account_name ?? undefined,
    tokens: c.tokens as ProviderTokens,
    lastSeenByLocation: c.last_seen_by_location ?? {},
    locations: (c.review_locations || []).map((l: any) => ({
      id: l.id,
      name: l.name,
      title: l.title,
    })),
  }));
}

/**
 * Merge + persist new last-seen timestamps per location for a user's connection.
 */
export async function setLastSeen(
  userId: string,
  updates: Record<string, string>
) {
  const db = supabaseServer();

  const ex = await db
    .from("review_connections")
    .select("id,last_seen_by_location")
    .eq("user_id", userId)
    .eq("provider", "google")
    .single();

  if (ex.error) throw ex.error;

  const merged = { ...(ex.data.last_seen_by_location || {}), ...updates };

  const upd = await db
    .from("review_connections")
    .update({
      last_seen_by_location: merged,
      updated_at: new Date().toISOString(),
    })
    .eq("id", ex.data.id);

  if (upd.error) throw upd.error;
}

/* ============================================================================
   Reviews (persist fetched provider reviews)
   Table: reviews
   - Unique per (provider, provider_review_id)
============================================================================ */

type UpsertReviewInput = {
  userId: string; // owner in your app (supabase auth user id)
  locationName: string; // provider location resource name (e.g., "locations/123")
  provider: ProviderName; // "google"
  providerReviewId: string; // stable id from provider (e.g., reviewId or name)
  rating?: number | null; // 1..5
  text?: string | null;
  author?: string | null;
  createTime?: string | null; // ISO
  updateTime?: string | null; // ISO
  raw?: any; // full provider payload for debugging
};

/**
 * Upsert many reviews at once. Requires a unique index on (provider, provider_review_id).
 */
export async function upsertReviews(rows: UpsertReviewInput[]) {
  if (!rows?.length) return { upserted: 0 };

  const db = supabaseServer();

  const { error } = await db.from("reviews").upsert(
    rows.map((r) => ({
      user_id: r.userId,
      provider: r.provider,
      provider_review_id: r.providerReviewId,
      location_name: r.locationName,
      rating: r.rating ?? null,
      text: r.text ?? null,
      author: r.author ?? null,
      create_time: r.createTime ?? null,
      update_time: r.updateTime ?? null,
      raw: r.raw ?? null,
    })),
    { onConflict: "provider,provider_review_id" }
  );

  if (error) throw error;
  return { upserted: rows.length };
}
