// src/lib/email.ts
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY!);
const FROM = process.env.ALERT_FROM_EMAIL || "alerts@example.com";
const APP  = process.env.APP_BASE_URL || "http://localhost:3000";

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
      `<p>You have a new ${input.platform} review${input.rating ? ` (${input.rating}★)` : ""}:</p>`,
      `<blockquote style="margin:0;padding:12px;border-left:3px solid #999;background:#111;color:#eee;border-radius:8px">${escapeHtml(
        input.reviewText || "(no text)"
      )}</blockquote>`,
      input.reviewer ? `<p><b>Reviewer:</b> ${escapeHtml(input.reviewer)}</p>` : "",
      input.createdTime ? `<p><b>Time:</b> ${new Date(input.createdTime).toLocaleString()}</p>` : "",
      `<p><a href="${APP}/reviews" style="display:inline-block;padding:10px 14px;background:#8b5cf6;color:#fff;border-radius:8px;text-decoration:none">Open Review Responder</a></p>`,
      input.reviewUrl ? `<p><a href="${input.reviewUrl}">View on Google</a></p>` : "",
    ]
      .filter(Boolean)
      .join("")
  );

  await resend.emails.send({
    from: FROM,
    to: input.to,
    subject,
    html,
  });
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]!));
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
