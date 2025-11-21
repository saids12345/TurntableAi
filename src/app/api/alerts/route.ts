import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/email";

// Explicit runtime — ensures Node.js environment (important for Resend/SendGrid)
export const runtime = "nodejs";

type Body = {
  to: string;
  subject: string;
  html?: string;
  text?: string;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;

    // --- Basic validation ---
    if (!body?.to || !body?.subject) {
      return NextResponse.json({ error: 'Missing "to" or "subject"' }, { status: 400 });
    }

    // --- Prefer HTML; fallback to escaped plain text ---
    const html =
      body.html ??
      `<pre>${(body.text || "")
        .replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] as string))}</pre>`;

    const text = body.text || "(no text)";

    // --- Send via helper (Resend or SendGrid under the hood) ---
    await sendEmail({
      to: body.to,
      subject: body.subject,
      html,
      text,
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err: any) {
    console.error("Email send error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to send alert" },
      { status: 500 }
    );
  }
}


