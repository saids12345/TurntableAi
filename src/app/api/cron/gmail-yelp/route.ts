// src/app/api/cron/gmail-yelp/route.ts
import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

const CRON_SECRET = process.env.CRON_SECRET;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const ALERT_FROM_EMAIL = process.env.ALERT_FROM_EMAIL;
const ALERT_TO_EMAIL = process.env.ALERT_TO_EMAIL;

// Re-use your site URL logic so this works on dev + prod
function getBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.APP_BASE_URL ||
    "http://localhost:3000"
  );
}

// Small helper so we can await a delay
function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Call /api/google/poll with simple retry logic
async function callGooglePollWithRetry(maxAttempts = 3) {
  const url = `${getBaseUrl()}/api/google/poll`;

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        // If /api/google/poll is using the App Router,
        // this keeps it from being cached.
        cache: "no-store",
      });

      if (!res.ok) {
        throw new Error(`google/poll responded with ${res.status}`);
      }

      const json = await res.json();
      return { ok: true, json };
    } catch (err) {
      lastError = err;

      // If it's the last attempt, bubble the error
      if (attempt === maxAttempts) {
        break;
      }

      // Backoff: 1s, 2s, 3s...
      await sleep(attempt * 1000);
    }
  }

  return { ok: false, error: lastError };
}

// Optional: allow forcing an email for testing with ?test=1
function isTestRequest(req: NextRequest): boolean {
  try {
    const url = new URL(req.url);
    return url.searchParams.get("test") === "1";
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  // 1) Check cron secret
  const incomingSecret = req.headers.get("x-cron-secret");

  if (!CRON_SECRET || incomingSecret !== CRON_SECRET) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized cron request" },
      { status: 401 },
    );
  }

  const testMode = isTestRequest(req);

  // 2) Call google/poll with retry
  const pollResult = await callGooglePollWithRetry();

  if (!pollResult.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: "google/poll failed after retries",
        detail:
          pollResult.error instanceof Error
            ? pollResult.error.message
            : String(pollResult.error),
      },
      { status: 500 },
    );
  }

  const pollJson = pollResult.json as any;
  const inner = pollJson?.result ?? {};
  const saved = typeof inner.saved === "number" ? inner.saved : 0;

  // 3) Decide whether to send an email
  const shouldSendEmail = testMode || saved > 0;

  const emailStatus: {
    attempted: boolean;
    sent?: boolean;
    error?: string;
  } = { attempted: false };

  if (shouldSendEmail && RESEND_API_KEY && ALERT_FROM_EMAIL && ALERT_TO_EMAIL) {
    emailStatus.attempted = true;

    try {
      const resend = new Resend(RESEND_API_KEY);

      const toList = ALERT_TO_EMAIL.split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      const subject = testMode
        ? "[TurnTable AI] Test review alert"
        : `[TurnTable AI] ${saved} new review${saved === 1 ? "" : "s"} detected`;

      const reviewCountText = testMode
        ? "This is a TEST alert. No actual reviews were fetched."
        : saved === 0
          ? "No new reviews were saved."
          : `We just detected and saved <strong>${saved}</strong> new review${
              saved === 1 ? "" : "s"
            } from your connected accounts.`;

      const html = `
        <div style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 16px;">
          <h2 style="margin-bottom: 8px;">TurnTable AI – New Review Alert</h2>
          <p style="margin: 0 0 12px 0;">${reviewCountText}</p>

          <p style="margin: 0 0 12px 0;">
            Log in to your TurnTable AI dashboard to see the full text,
            AI-generated replies, and post them to Google/Yelp:
          </p>

          <p style="margin: 0 0 16px 0;">
            <a href="https://turntableai.net/reviews" 
               style="background:#fbbf24;color:#111;padding:10px 16px;border-radius:999px;text-decoration:none;font-weight:600;">
              Open Reviews Inbox
            </a>
          </p>

          <hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0;" />

          <p style="font-size:12px;color:#6b7280;margin:0;">
            You received this email because review alerts are enabled for your TurnTable AI account.
            If you didn't expect this, you can disable alerts in Settings.
          </p>
        </div>
      `;

      await resend.emails.send({
        from: ALERT_FROM_EMAIL,
        to: toList,
        subject,
        html,
      });

      emailStatus.sent = true;
    } catch (err) {
      emailStatus.sent = false;
      emailStatus.error =
        err instanceof Error ? err.message : "Unknown error sending email";
    }
  }

  // 4) Respond back with what happened
  return NextResponse.json({
    ok: true,
    status: 200,
    polledFrom: `${getBaseUrl()}/api/google/poll`,
    result: pollJson?.result ?? null,
    emailStatus,
    testMode,
  });
}
