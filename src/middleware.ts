// src/middleware.ts
import { NextRequest, NextResponse } from "next/server";
import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs";

// Simple in-memory rate limiter for API routes (dev-friendly)
const buckets = new Map<string, { hits: number; ts: number }>();
const WINDOW_MS = 10_000; // 10s window
const LIMIT = 8; // 8 requests per IP + endpoint per window

export async function middleware(req: NextRequest) {
  // Always create a response we can mutate (needed by Supabase auth helpers)
  const res = NextResponse.next();

  // 1) Refresh/establish Supabase session (handles magic-link callback)
  try {
    const supabase = createMiddlewareClient({ req, res });
    await supabase.auth.getSession(); // silently refreshes & sets cookies
  } catch {
    // ignore; unauthenticated users continue
  }

  // 2) Apply rate limiting **only** to /api/*
  const url = new URL(req.url);
  if (url.pathname.startsWith("/api/")) {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      // @ts-ignore – not present in NextRequest but some envs attach it
      req.ip ||
      "local";

    const key = `${ip}:${url.pathname}`;
    const now = Date.now();
    const bucket = buckets.get(key) ?? { hits: 0, ts: now };

    // reset window if expired
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
  }

  // 3) Return the (possibly cookie-mutated) response
  return res;
}

// Run on ALL routes so the Supabase /auth/v1/callback works.
// (App Router ignores _next/static etc efficiently.)
export const config = {
  matcher: ["/(.*)"],
};
