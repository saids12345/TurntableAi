// src/app/api/google/poll/route.ts
import { NextResponse } from "next/server";
import { getConnByUser, setLastSeen, upsertReviews } from "@/lib/store";
import { listReviews, refreshToken, starToNumber } from "@/lib/google";
import { sendReviewEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

/**
 * Polls Google Business Profile for new reviews for the user, emails alerts,
 * and upserts the reviews into public.reviews.
 *
 * NOTE: Step 2 will replace userId="demo" with the real auth user id.
 */
export async function POST() {
  const userId = "demo"; // TODO (Step 2): replace with signed-in user id (e.g., from Supabase auth)
  const conn = await getConnByUser(userId);
  if (!conn) return NextResponse.json({ ok: true, message: "No Google connection." });

  // Refresh access token if we have a refresh_token
  if (conn.tokens.refresh_token) {
    try {
      const r = await refreshToken(conn.tokens.refresh_token);
      conn.tokens.access_token = r.access_token;
    } catch (e) {
      console.warn("token refresh failed", e);
    }
  }

  let sent = 0;
  let saved = 0;
  const newLastSeen: Record<string, string> = {};

  for (const loc of conn.locations) {
    try {
      const res = await listReviews(conn.tokens.access_token, loc.name);
      const last = conn.lastSeenByLocation?.[loc.name];

      // Only the new ones since last time
      const fresh = (res.reviews || []).filter(
        (r) => r.updateTime && (!last || r.updateTime > last)
      );

      // newest → oldest for nicer email ordering
      fresh.sort((a, b) => (a.updateTime! < b.updateTime! ? 1 : -1));

      // 1) Email alerts
      for (const r of fresh) {
        await sendReviewEmail({
          to: conn.email,
          platform: "Google",
          locationName: loc.title,
          rating: starToNumber(r.starRating),
          reviewText: r.comment || "",
          reviewer: r.reviewer?.displayName,
          createdTime: r.createTime,
        });
        sent++;
        // gentle throttle to play nice
        await new Promise((res) => setTimeout(res, 200));
      }

      // 2) Persist to DB
      if (fresh.length) {
        const payload = fresh.map((r) => ({
          userId,
          provider: "google" as const,
          providerReviewId: (r.name || r.reviewId || "").toString(),
          locationName: loc.name,
          rating: starToNumber(r.starRating) ?? null,
          text: r.comment ?? null,
          author: r.reviewer?.displayName ?? null,
          createTime: r.createTime ?? null,
          updateTime: r.updateTime ?? null,
          raw: r, // keep full provider payload for debugging
        }));

        const result = await upsertReviews(payload);
        saved += result.upserted;
      }

      // advance the high-water mark
      const newestUpdate = res.reviews?.[0]?.updateTime || last || new Date().toISOString();
      newLastSeen[loc.name] = newestUpdate;
    } catch (e) {
      console.error("poll error for", loc.name, e);
    }
  }

  if (Object.keys(newLastSeen).length) {
    await setLastSeen(userId, newLastSeen);
  }

  return NextResponse.json({ ok: true, sent, saved });
}
