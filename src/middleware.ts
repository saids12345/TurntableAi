import { NextResponse } from "next/server";

const buckets = new Map<string, { hits: number; ts: number }>();
const WINDOW_MS = 10_000; // 10s
const LIMIT = 8;          // 8 requests / 10s per IP+endpoint

export function middleware(req: Request) {
  const url = new URL(req.url);
  if (!url.pathname.startsWith("/api/")) return;

  const ip = req.headers.get("x-forwarded-for") || "local";
  const now = Date.now();
  const key = `${ip}:${url.pathname}`;
  const bucket = buckets.get(key) ?? { hits: 0, ts: now };

  if (now - bucket.ts > WINDOW_MS) {
    bucket.hits = 0;
    bucket.ts = now;
  }

  bucket.hits += 1;
  buckets.set(key, bucket);

  if (bucket.hits > LIMIT) {
    return NextResponse.json(
      { ok: false, error: "Too many requests. Please wait a few seconds." },
      { status: 429 }
    );
  }

  return NextResponse.next();
}

export const config = { matcher: ["/api/:path*"] };
