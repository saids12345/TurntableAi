// src/app/api/google/poll/route.ts
import { NextResponse } from "next/server";
import { getConnByUser, setLastSeen } from "@/lib/store";
import { listReviews, refreshToken, starToNumber } from "@/lib/google";
import { sendReviewEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

/**
 * Polls Google Business Profile for new reviews for the user, and emails alerts.
 * In Step 2 we'll replace userId="demo" with the real authenticated user id
 * (or run a loop for all users if you want a global cron).
 */
export async function POST() {
  const userId = "demo"; // TODO (Step 2): replace with signed-in user id or iterate all users via DB
  const conn = await getConnByUser(userId);
  if (!conn) return NextResponse.json({ ok: true, message: "No Google connection." });

  // Try refreshing access token if we have a refresh_token
  if (conn.tokens.refresh_token) {
    try {
      const r = await refreshToken(conn.tokens.refresh_token);
      conn.tokens.access_token = r.access_token;
      // (Optional) you could persist the refreshed access_token here if you want.
    } catch (e) {
      console.warn("token refresh failed", e);
    }
  }

  let sent = 0;
  const newLastSeen: Record<string, string> = {};

  for (const loc of conn.locations) {
    try {
      const res = await listReviews(conn.tokens.access_token, loc.name);
      const last = conn.lastSeenByLocation?.[loc.name];

      const fresh = (res.reviews || []).filter((r) => r.updateTime && (!last || r.updateTime > last));
      // newest → oldest for nicer mail ordering
      fresh.sort((a, b) => (a.updateTime! < b.updateTime! ? 1 : -1));

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
        await new Promise((res) => setTimeout(res, 200)); // gentle throttle
      }

      const newestUpdate = res.reviews?.[0]?.updateTime || last || new Date().toISOString();
      newLastSeen[loc.name] = newestUpdate;
    } catch (e) {
      console.error("poll error for", loc.name, e);
    }
  }

  if (Object.keys(newLastSeen).length) {
    await setLastSeen(userId, newLastSeen);
  }

  return NextResponse.json({ ok: true, sent });
}

