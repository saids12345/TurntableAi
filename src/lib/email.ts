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
const FROM = process.env.ALERT_FROM_EMAIL || "alerts@example.com";
const APP  = process.env.APP_BASE_URL || "http://localhost:3000";

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
};

export async function sendReviewEmail(input: ReviewEmail) {
  const subject = `📣 New ${input.platform} review for ${input.locationName}`;
  const html = wrapper(
    subject,
    [
      `<p>You have a new ${input.platform} review${
        input.rating ? ` (${input.rating}★)` : ""
      }:</p>`,
      `<blockquote style="margin:0;padding:12px;border-left:3px solid #999;background:#111;color:#eee;border-radius:8px">${escapeHtml(
        input.reviewText || "(no text)"
      )}</blockquote>`,
      input.reviewer ? `<p><b>Reviewer:</b> ${escapeHtml(input.reviewer)}</p>` : "",
      input.createdTime ? `<p><b>Time:</b> ${new Date(input.createdTime).toLocaleString()}</p>` : "",
      `<p><a href="${APP}/reviews" style="display:inline-block;padding:10px 14px;background:#8b5cf6;color:#fff;border-radius:8px;text-decoration:none">Open Review Responder</a></p>`,
      input.reviewUrl ? `<p><a href="${input.reviewUrl}">View on Google</a></p>` : "",
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
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[
        m
      ] as string)
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
