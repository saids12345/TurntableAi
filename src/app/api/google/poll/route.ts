// src/app/api/google/poll/route.ts
import { NextResponse } from "next/server";
import { getConnByUser, setLastSeen, upsertReviews } from "@/lib/store";
import { listReviews, refreshToken, starToNumber } from "@/lib/google";
import { sendReviewEmail } from "@/lib/email";

// make sure this route isn't cached
export const dynamic = "force-dynamic";

// Helper to get base URL for calling our own API routes
function getBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.APP_BASE_URL ||
    "http://localhost:3000"
  );
}

/**
 * Polls Google Business Profile for new reviews for the user, emails alerts,
 * and upserts the reviews into public.reviews.
 *
 * NOTE: currently uses a hard-coded userId="demo".
 * Later we'll replace that with real auth user ids / all connections.
 */
export async function POST() {
  const userId = "demo"; // TODO (Step 2): replace with signed-in user id(s)
  const conn = await getConnByUser(userId);

  if (!conn) {
    return NextResponse.json({
      ok: true,
      message: "No Google connection.",
    });
  }

  // Refresh access token if we have a refresh_token
  if (conn.tokens.refresh_token) {
    try {
      const r = await refreshToken(conn.tokens.refresh_token);
      conn.tokens.access_token = r.access_token;
    } catch (e) {
      console.warn("token refresh failed", e);
    }
  }

  const baseUrl = getBaseUrl();
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

      // 1) Email alerts (+ AI auto-drafts)
      for (const r of fresh) {
        const rating = starToNumber(r.starRating) ?? null;
        const reviewText = r.comment || "";

        // --- call your AI reply generator ---
        let aiReply: string | null = null;
        try {
          const aiRes = await fetch(`${baseUrl}/api/review-reply`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              reviewText,
              rating,
              platform: "Google",
              tone: "Friendly",
              business: loc.title,
              city: null,
              length: "medium",
              policy_apologize: true,
              policy_no_admission: true,
              policy_offer_remedy_if_low: true,
              language: "English",
            }),
          });

          const aiData: any = await aiRes.json().catch(() => ({}));

          if (
            aiRes.ok &&
            typeof aiData?.reply === "string" &&
            aiData.reply.trim()
          ) {
            aiReply = aiData.reply.trim();
          }
        } catch (err) {
          console.error("AI reply generation failed:", err);
        }

        await sendReviewEmail({
          to: conn.email,
          platform: "Google",
          locationName: loc.title,
          rating: rating ?? undefined,
          reviewText,
          reviewer: r.reviewer?.displayName ?? undefined,
          createdTime: r.createTime ?? undefined,
          aiReply: aiReply ?? undefined,
        });

        sent++;
        // gentle throttle to play nice with email provider / Google
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
      const newestUpdate =
        res.reviews?.[0]?.updateTime || last || new Date().toISOString();
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
export const GET = POST;
