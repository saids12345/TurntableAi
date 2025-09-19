// src/lib/store.ts
import { supabaseServer } from "./supabase";

// Shared shape
export type GoogleConn = {
  id: string;
  userId: string;
  email: string;
  accountName?: string;
  tokens: { access_token: string; refresh_token?: string; expiry_date?: number };
  lastSeenByLocation: Record<string, string>;
  locations: { id: string; name: string; title: string }[];
};

// Upsert (create/update) a connection and its locations
export async function upsertConn(input: {
  userId: string;
  email: string;
  accountName?: string;
  tokens: { access_token: string; refresh_token?: string; expiry_date?: number };
  locations: { name: string; title: string }[];
  lastSeenByLocation?: Record<string, string>;
}) {
  const db = supabaseServer();

  const existing = await db
    .from("review_connections")
    .select("id")
    .eq("user_id", input.userId)
    .eq("provider", "google")
    .maybeSingle();
  if (existing.error) throw existing.error;

  let connId: string;

  if (existing.data?.id) {
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

    const del = await db.from("review_locations").delete().eq("connection_id", connId);
    if (del.error) throw del.error;
  } else {
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

  if (input.locations.length) {
    const insLoc = await db.from("review_locations").insert(
      input.locations.map((l) => ({ connection_id: connId, name: l.name, title: l.title }))
    );
    if (insLoc.error) throw insLoc.error;
  }

  return connId;
}

// Read a user’s connection (google)
export async function getConnByUser(userId: string): Promise<GoogleConn | null> {
  const db = supabaseServer();
  const res = await db
    .from("review_connections")
    .select("id,user_id,email,account_name,tokens,last_seen_by_location,review_locations(id,name,title)")
    .eq("user_id", userId)
    .eq("provider", "google")
    .single();

  if (res.error) {
    if (res.error.code === "PGRST116") return null; // no rows
    throw res.error;
  }

  const c = res.data as any;
  return {
    id: c.id,
    userId: c.user_id,
    email: c.email,
    accountName: c.account_name ?? undefined,
    tokens: c.tokens,
    lastSeenByLocation: c.last_seen_by_location ?? {},
    locations: (c.review_locations || []).map((l: any) => ({ id: l.id, name: l.name, title: l.title })),
  };
}

// Merge + persist new last-seen timestamps per location
export async function setLastSeen(userId: string, updates: Record<string, string>) {
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
    .update({ last_seen_by_location: merged, updated_at: new Date().toISOString() })
    .eq("id", ex.data.id);
  if (upd.error) throw upd.error;
}
