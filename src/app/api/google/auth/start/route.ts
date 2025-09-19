// src/app/api/google/auth/start/route.ts
import { NextRequest, NextResponse } from "next/server";
import { googleAuthUrl } from "@/lib/google";

/**
 * Starts Google OAuth.
 * Accepts ?email=owner@restaurant.com (optional) and bakes it into the OAuth state.
 * For now we use userId = "demo" (will be replaced by real auth later).
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const email = url.searchParams.get("email") || "owner@example.com";
  const userId = "demo"; // TODO: replace with signed-in user id in Step 2

  // encode a small payload into state so we get it back in the callback
  const statePayload = { u: userId, e: email };
  const state = Buffer.from(JSON.stringify(statePayload)).toString("base64url");

  return NextResponse.redirect(googleAuthUrl(state));
}

