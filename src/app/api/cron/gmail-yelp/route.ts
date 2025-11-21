// src/app/api/cron/gmail-yelp/route.ts
import { NextRequest, NextResponse } from "next/server";

/**
 * Cron endpoint to poll Gmail for new Google reviews.
 *
 * This is meant to be called by a cron job (Vercel / Supabase / etc.)
 * and NOT by the browser directly.
 *
 * Security:
 *  - Requires the header:  x-cron-secret: <CRON_SECRET>
 *  - CRON_SECRET is defined in your .env.local
 */

const CRON_SECRET = process.env.CRON_SECRET;

// Helper to get base URL for calling the existing /api/google/poll route
function getBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.APP_BASE_URL ||
    "http://localhost:3000"
  );
}

export async function POST(req: NextRequest) {
  // 1) Check that CRON_SECRET is configured
  if (!CRON_SECRET) {
    return NextResponse.json(
      { ok: false, error: "CRON_SECRET not configured" },
      { status: 500 }
    );
  }

  // 2) Validate the incoming cron secret header
  const incomingSecret = req.headers.get("x-cron-secret");

  if (!incomingSecret || incomingSecret !== CRON_SECRET) {
    return NextResponse.json(
      {
        ok: false,
        error: "unauthorized",
        message:
          "Missing or invalid x-cron-secret header. This endpoint is for cron only.",
      },
      { status: 401 }
    );
  }

  // 3) Call your existing Google reviews poll route
  const baseUrl = getBaseUrl();
  const pollUrl = `${baseUrl}/api/google/poll`;

  try {
    const res = await fetch(pollUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    });

    let data: unknown = null;
    try {
      data = await res.json();
    } catch {
      // If the poll route returns no JSON body, that's fine
      data = null;
    }

    return NextResponse.json(
      {
        ok: res.ok,
        status: res.status,
        polledFrom: pollUrl,
        result: data,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("cron gmail-yelp error:", error);

    return NextResponse.json(
      {
        ok: false,
        error: "cron_request_failed",
      },
      { status: 500 }
    );
  }
}
