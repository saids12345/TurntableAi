// src/lib/email.ts

// We still import the SDK at runtime, but we won't depend on its types
import { Resend } from "resend";

/* ──────────────────────────────────────────────────────────────────────────
   Minimal client typing (sidestep SDK typing mismatches)
   ────────────────────────────────────────────────────────────────────────── */

type EmailPayload = {
  from: string;
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
};

interface EmailClient {
  emails: {
    send(payload: EmailPayload): Promise<{ id?: string }>;
  };
}

/* ──────────────────────────────────────────────────────────────────────────
   Config
   ────────────────────────────────────────────────────────────────────────── */

const RESEND_KEY = process.env.RESEND_API_KEY || "";
// e.g. "TurnTable AI <alerts@turntableai.net>"
const FROM = process.env.ALERT_FROM_EMAIL || "TurnTable AI <alerts@example.com>";
const APP =
  process.env.APP_BASE_URL ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  "http://localhost:3000";

/** Create a client only when we have a key; cast to our minimal interface. */
const client: EmailClient | null = RESEND_KEY
  ? ((new Resend(RESEND_KEY)) as unknown as EmailClient)
  : null;

/* ──────────────────────────────────────────────────────────────────────────
   Generic sender
   ────────────────────────────────────────────────────────────────────────── */

type SendEmailOpts = {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  title?: string;
};

export async function sendEmail(opts: SendEmailOpts) {
  const html =
    opts.html ??
    (opts.text
      ? wrapper(
          opts.title || opts.subject,
          `<pre style="font-family: ui-monospace, SFMono-Regular, Menlo, monospace; white-space: pre-wrap; margin:0">${escapeHtml(
            opts.text
          )}</pre>`
        )
      : undefined);

  if (!client) {
    // Dev fallback: don’t crash if no key
    console.info("[sendEmail:fallback]", {
      to: opts.to,
      subject: opts.subject,
      preview: html || opts.text,
    });
    return { id: "dev-fallback" as const };
  }

  return await client.emails.send({
    from: FROM,
    to: opts.to,
    subject: opts.subject,
    html,
    text: opts.text,
  });
}

/* ──────────────────────────────────────────────────────────────────────────
   Review-specific helper (convenience)
   ────────────────────────────────────────────────────────────────────────── */

type ReviewEmail = {
  to: string;
  platform: "Google";
  locationName: string;
  rating?: number;
  reviewText: string;
  reviewer?: string;
  reviewUrl?: string;
  createdTime?: string;
  aiReply?: string; // optional AI draft preview
};

export async function sendReviewEmail(input: ReviewEmail) {
  const subject = `📣 New ${input.platform} review for ${input.locationName}`;

  // Header bits
  const ratingLine =
    typeof input.rating === "number"
      ? `<p style="margin:0 0 4px;font-size:14px;color:#facc15">Rating: ${input.rating}★</p>`
      : "";

  const reviewerLine = input.reviewer
    ? `<p style="margin:0 0 4px;font-size:13px;color:#e5e5e5">From: <strong>${escapeHtml(
        input.reviewer
      )}</strong></p>`
    : "";

  const timeLine = input.createdTime
    ? `<p style="margin:0 0 4px;font-size:12px;color:#9ca3af">Time: ${new Date(
        input.createdTime
      ).toLocaleString()}</p>`
    : "";

  // Original review block
  const reviewBlock = `
    <div style="margin-top:12px;padding:12px 14px;border-radius:10px;background:#020617;border:1px solid #1f2937">
      <p style="margin:0 0 6px;font-size:13px;color:#9ca3af">Customer review</p>
      <p style="margin:0;font-size:14px;line-height:1.5;color:#f9fafb">
        ${escapeHtml(input.reviewText || "(no review text)")}
      </p>
    </div>
  `;

  // AI draft preview (optional)
  const aiReplyBlock = input.aiReply
    ? `
      <div style="margin-top:20px;padding:12px 14px;border-radius:10px;background:#0b0615;border:1px solid #7c3aed">
        <p style="margin:0 0 6px;font-size:13px;color:#c4b5fd">AI-drafted reply</p>
        <p style="margin:0;font-size:14px;line-height:1.5;color:#ede9fe">
          ${escapeHtml(input.aiReply)}
        </p>
      </div>
    `
    : "";

  // CTAs
  const ctaBlock = `
    <div style="margin-top:22px;display:flex;gap:12px;flex-wrap:wrap;align-items:center">
      <a href="${APP}/reviews"
         style="display:inline-block;padding:10px 16px;border-radius:999px;background:#6366f1;color:white;font-size:14px;text-decoration:none;font-weight:500">
        Open Review Responder
      </a>
      ${
        input.reviewUrl
          ? `<a href="${input.reviewUrl}"
                style="font-size:13px;color:#93c5fd;text-decoration:underline">
                View on ${input.platform}
             </a>`
          : ""
      }
    </div>
  `;

  // Footer / notification hint
  const footer = `
    <p style="margin-top:24px;font-size:11px;color:#6b7280">
      You’re receiving this email because review alerts are enabled for your account.
      You can manage notifications from your
      <a href="${APP}/settings?tab=notifications" style="color:#93c5fd">TurnTable AI settings</a>.
    </p>
  `;

  const html = wrapper(
    subject,
    [
      ratingLine,
      reviewerLine,
      timeLine,
      reviewBlock,
      aiReplyBlock,
      ctaBlock,
      footer,
    ].join("")
  );

  return sendEmail({ to: input.to, subject, html });
}

/* ──────────────────────────────────────────────────────────────────────────
   Utilities
   ────────────────────────────────────────────────────────────────────────── */

function escapeHtml(s: string) {
  return s.replace(
    /[&<>"']/g,
    (m) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      }[m] as string)
  );
}

function wrapper(title: string, inner: string) {
  return `<!doctype html><html><body style="background:#0b0b0b;color:#eaeaea;font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto">
  <div style="max-width:640px;margin:24px auto;padding:24px;border:1px solid #222;border-radius:16px;background:#0f0f0f">
    <h2 style="margin:0 0 10px">${title}</h2>
    ${inner}
    <p style="margin-top:24px;color:#bbb">Sent by TurnTable AI</p>
  </div>
  </body></html>`;
}
