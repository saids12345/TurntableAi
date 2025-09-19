// src/lib/google.ts
// Uses Next.js' built-in fetch on the server (no node-fetch import needed)

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI!;
const SCOPE = "https://www.googleapis.com/auth/business.manage";

export function googleAuthUrl(state: string) {
  const base = "https://accounts.google.com/o/oauth2/v2/auth";
  const p = new URLSearchParams({
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    scope: SCOPE,
    state,
  });
  return `${base}?${p.toString()}`;
}

export async function exchangeCode(code: string) {
  const body = new URLSearchParams({
    code,
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    redirect_uri: REDIRECT_URI,
    grant_type: "authorization_code",
  });
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!r.ok) throw new Error(`token exchange failed: ${r.status}`);
  return (await r.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
    token_type?: string;
  };
}

export async function refreshToken(refresh_token: string) {
  const body = new URLSearchParams({
    refresh_token,
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    grant_type: "refresh_token",
  });
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!r.ok) throw new Error(`refresh failed: ${r.status}`);
  return (await r.json()) as { access_token: string; expires_in?: number };
}

async function gfetch<T>(access_token: string, url: string) {
  const r = await fetch(url, { headers: { Authorization: `Bearer ${access_token}` } });
  if (!r.ok) throw new Error(`Google API error: ${r.status}`);
  return (await r.json()) as T;
}

// Accounts & Locations
export async function listAccounts(access_token: string) {
  return await gfetch<{ accounts?: { name: string; accountName?: string }[] }>(
    access_token,
    "https://mybusinessaccountmanagement.googleapis.com/v1/accounts"
  );
}

export async function listLocations(access_token: string, account: string) {
  const url = `https://mybusinessbusinessinformation.googleapis.com/v1/${encodeURIComponent(
    account
  )}/locations?readMask=name,title`;
  return await gfetch<{ locations?: { name: string; title?: string }[] }>(access_token, url);
}

// Reviews (v4)
export async function listReviews(access_token: string, locationName: string) {
  const url = `https://mybusiness.googleapis.com/v4/${encodeURIComponent(
    locationName
  )}/reviews?orderBy=updateTime desc&pageSize=20`;
  return await gfetch<{
    reviews?: {
      reviewId?: string;
      starRating?: "ONE" | "TWO" | "THREE" | "FOUR" | "FIVE";
      comment?: string;
      reviewer?: { displayName?: string };
      createTime?: string;
      updateTime?: string;
      name?: string;
    }[];
  }>(access_token, url);
}

export function starToNumber(star?: string) {
  const map: Record<string, number> = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 };
  return star ? map[star] ?? undefined : undefined;
}
