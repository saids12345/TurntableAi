// src/app/api/google/poll/route.ts
import { NextResponse } from "next/server";
import { getAllGoogleConns, setLastSeen, upsertReviews } from "@/lib/store";
import { listReviews, refreshToken, starToNumber } from "@/lib/google";
import { sendReviewEmail } from "@/lib/email";
import { generateReviewReply } from "@/lib/reviewReplyGenerator";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { hasProAccess } from "@/lib/plans";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const CRON_SECRET = process.env.CRON_SECRET;

type GoogleReview = NonNullable<Awaited<ReturnType<typeof listReviews>>["reviews"]>[number];

function confirmedReviewEmail(result: unknown): boolean {
  if (!result || typeof result !== "object") return false;
  const value = result as {
    id?: unknown;
    data?: { id?: unknown } | null;
    error?: unknown;
  };
  if (value.error) return false;
  // Reject development's console-only fallback and unconfirmed provider sends.
  return (typeof value.id === "string" && value.id.length > 0 && value.id !== "dev-fallback") ||
    (typeof value.data?.id === "string" && value.data.id.length > 0);
}

async function findDraftContext(userId: string): Promise<{
  allowed: boolean;
  styleGuide: string | null;
}> {
  const db = getSupabaseAdmin();
  const { data: profile, error: profileError } = await db.from("profiles")
    .select("is_pro,plan,stripe_subscription_status")
    .eq("id", userId)
    .maybeSingle();
  if (profileError) throw new Error("Unable to verify background reply access");
  const allowed = Boolean(profile) && hasProAccess({
    isPro: profile?.is_pro,
    plan: profile?.plan,
    stripeSubscriptionStatus: profile?.stripe_subscription_status,
  });
  if (!allowed) return { allowed: false, styleGuide: null };

  const { data: voice, error: voiceError } = await db.from("voice_profiles")
    .select("style_guide")
    .eq("user_id", userId)
    .maybeSingle();
  if (voiceError) throw new Error("Unable to load background review voice");
  return {
    allowed: true,
    styleGuide: typeof voice?.style_guide === "string" ? voice.style_guide : null,
  };
}

// Retain the existing secret-locked system endpoint. Do not expose a
// user-controlled bypass into internal polling or into the reply generator.
export async function POST(req: Request) {
  if (!CRON_SECRET || req.headers.get("x-cron-secret") !== CRON_SECRET) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let totalSent = 0;
  let totalSaved = 0;
  let failedLocations = 0;
  let draftFailures = 0;

  try {
    const connections = await getAllGoogleConns();
    if (!connections.length) {
      return NextResponse.json({ ok: true, message: "No Google connections configured.", sent: 0, saved: 0 });
    }

    for (const conn of connections) {
      const { userId } = conn;
      if (!conn.tokens?.access_token || !Array.isArray(conn.locations)) {
        failedLocations++;
        console.error("Invalid Google review connection", { userId });
        continue;
      }

      let accessToken = conn.tokens.access_token;
      if (conn.tokens.refresh_token) {
        try {
          const refreshed = await refreshToken(conn.tokens.refresh_token);
          accessToken = refreshed.access_token;
        } catch (error) {
          failedLocations += Math.max(conn.locations.length, 1);
          console.error("Google review token refresh failed", { userId, error });
          continue;
        }
      }

      let draftContext: { allowed: boolean; styleGuide: string | null } = {
        allowed: false,
        styleGuide: null,
      };
      try {
        draftContext = await findDraftContext(userId);
      } catch (error) {
        // Review alert delivery can continue without an AI draft.
        draftFailures++;
        console.error("Google review draft context failed", { userId, error });
      }

      for (const loc of conn.locations) {
        try {
          const watermark = conn.lastSeenByLocation?.[loc.name] ?? null;
          const collected: GoogleReview[] = [];
          let nextPageToken: string | undefined;
          let finished = false;
          const seenPages = new Set<string>();

          // The API orders by updateTime descending. Page through all new
          // reviews; never advance a checkpoint on an incomplete 20-item page.
          for (let page = 0; page < 20; page++) {
            const response = await listReviews(accessToken, loc.name, nextPageToken);
            const pageReviews = response.reviews ?? [];
            const reachedPrevious = pageReviews.some(
              (review) => Boolean(watermark && review.updateTime && review.updateTime <= watermark),
            );
            for (const review of pageReviews) {
              if (!review.updateTime || (watermark && review.updateTime <= watermark)) continue;
              if (!review.name && !review.reviewId) {
                throw new Error("Google review missing stable provider ID");
              }
              collected.push(review);
            }
            // Preserve the existing first-connect limit: without a saved
            // watermark, do not turn a newly connected account's entire
            // historical review archive into hundreds of emails.
            if (!watermark || reachedPrevious || !response.nextPageToken) {
              finished = true;
              break;
            }
            if (seenPages.has(response.nextPageToken)) {
              throw new Error("Google review pagination loop");
            }
            seenPages.add(response.nextPageToken);
            nextPageToken = response.nextPageToken;
          }
          if (!finished) throw new Error("Google review pagination incomplete");

          // Multiple pages may contain the same review. Keep only its newest
          // version, then process in ascending update time for safe checkpoints.
          const deduped = new Map<string, GoogleReview>();
          for (const review of collected) {
            const id = String(review.name || review.reviewId);
            const existing = deduped.get(id);
            if (!existing || String(review.updateTime) > String(existing.updateTime)) {
              deduped.set(id, review);
            }
          }
          const fresh = Array.from(deduped.values()).sort((a, b) =>
            String(a.updateTime).localeCompare(String(b.updateTime)) ||
            String(a.name || a.reviewId).localeCompare(String(b.name || b.reviewId)),
          );
          if (!fresh.length) continue;

          // Persist first: a failed database write must never trigger emails.
          await upsertReviews(fresh.map((review) => ({
            userId,
            provider: "google" as const,
            providerReviewId: String(review.name || review.reviewId),
            locationName: loc.name,
            rating: starToNumber(review.starRating) ?? null,
            text: review.comment ?? null,
            author: review.reviewer?.displayName ?? null,
            createTime: review.createTime ?? null,
            updateTime: review.updateTime ?? null,
            raw: review,
          })));
          totalSaved += fresh.length;

          // Equal timestamps form a checkpoint group. If any notification in
          // a group fails, don't skip the others on the next poll.
          for (let start = 0; start < fresh.length;) {
            const stamp = fresh[start].updateTime!;
            let end = start + 1;
            while (end < fresh.length && fresh[end].updateTime === stamp) end++;

            for (const review of fresh.slice(start, end)) {
              let aiReply: string | null = null;
              if (draftContext.allowed) {
                try {
                  aiReply = await generateReviewReply({
                    reviewText: review.comment ?? "",
                    rating: starToNumber(review.starRating) ?? null,
                    platform: "Google",
                    tone: "Friendly",
                    business: loc.title,
                    city: null,
                    length: "medium",
                    policy_apologize: true,
                    policy_no_admission: true,
                    policy_offer_remedy_if_low: true,
                    language: "English",
                    styleGuide: draftContext.styleGuide,
                  });
                } catch (error) {
                  draftFailures++;
                  console.error("Background Google review draft failed", { userId, error });
                }
              }

              const delivered = await sendReviewEmail({
                to: conn.email,
                platform: "Google",
                locationName: loc.title,
                rating: starToNumber(review.starRating) ?? undefined,
                reviewText: review.comment ?? "",
                reviewer: review.reviewer?.displayName ?? undefined,
                createdTime: review.createTime ?? undefined,
                aiReply: aiReply ?? undefined,
              });
              if (!confirmedReviewEmail(delivered)) {
                throw new Error("Google review notification delivery unconfirmed");
              }
              totalSent++;
            }

            await setLastSeen(userId, { [loc.name]: stamp });
            start = end;
          }
        } catch (error) {
          failedLocations++;
          console.error("Google review location poll failed", { userId, location: loc.name, error });
        }
      }
    }
  } catch (error) {
    console.error("Google review polling failed", error);
    return NextResponse.json({ ok: false, error: "Google review polling failed" }, { status: 500 });
  }

  return NextResponse.json({
    ok: failedLocations === 0,
    sent: totalSent,
    saved: totalSaved,
    failedLocations,
    draftFailures,
  }, { status: failedLocations ? 500 : 200 });
}

export const GET = POST;
