// src/app/api/google/poll/route.ts
import { NextResponse } from "next/server";
import { getAllGoogleConns, setLastSeen, upsertReviews } from "@/lib/store";
import { listReviews, refreshToken, starToNumber } from "@/lib/google";
import { sendReviewEmail } from "@/lib/email";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const CRON_SECRET = process.env.CRON_SECRET;

// Helper to get base URL for calling our own API routes
function getBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.APP_BASE_URL ||
    "http://localhost:3000"
  );
}

export async function POST(req: Request) {
  // ✅ Secret-lock (cron/system job) — not Pro-lock
  const incoming = req.headers.get("x-cron-secret");
  if (!CRON_SECRET || incoming !== CRON_SECRET) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const baseUrl = getBaseUrl();

  const conns = await getAllGoogleConns();
  if (!conns.length) {
    return NextResponse.json({
      ok: true,
      message: "No Google connections configured.",
      sent: 0,
      saved: 0,
    });
  }

  let totalSent = 0;
  let totalSaved = 0;

  for (const conn of conns) {
    const userId = conn.userId;
    const newLastSeen: Record<string, string> = {};
    let sent = 0;
    let saved = 0;

    if (!conn?.tokens?.access_token || !Array.isArray(conn.locations)) {
      console.warn("Skipping Google conn with missing data", { userId });
      continue;
    }

    if (conn.tokens.refresh_token) {
      try {
        const r = await refreshToken(conn.tokens.refresh_token);
        conn.tokens.access_token = r.access_token;
      } catch (e) {
        console.warn("token refresh failed for user", userId, e);
      }
    }

    for (const loc of conn.locations) {
      try {
        const res = await listReviews(conn.tokens.access_token, loc.name);
        const last = conn.lastSeenByLocation?.[loc.name];

        const fresh = (res.reviews || []).filter(
          (r) => r.updateTime && (!last || r.updateTime > last)
        );

        fresh.sort((a, b) => (a.updateTime! < b.updateTime! ? 1 : -1));

        for (const r of fresh) {
          const rating = starToNumber(r.starRating) ?? null;
          const reviewText = r.comment || "";

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
              cache: "no-store",
            });

            const aiData: any = await aiRes.json().catch(() => ({}));
            if (aiRes.ok && typeof aiData?.reply === "string" && aiData.reply.trim()) {
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
          await new Promise((res) => setTimeout(res, 200));
        }

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
            raw: r,
          }));

          const result = await upsertReviews(payload);
          saved += result.upserted;
        }

        const newestUpdate =
          res.reviews?.[0]?.updateTime || last || new Date().toISOString();
        newLastSeen[loc.name] = newestUpdate;
      } catch (e) {
        console.error("poll error for user/location", { userId, loc: loc.name }, e);
      }
    }

    if (Object.keys(newLastSeen).length) {
      await setLastSeen(userId, newLastSeen);
    }

    totalSent += sent;
    totalSaved += saved;
  }

  return NextResponse.json({
    ok: true,
    sent: totalSent,
    saved: totalSaved,
  });
}

// Allow GET for manual tests (still secret-locked)
export const GET = POST;
