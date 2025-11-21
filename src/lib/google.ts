// src/lib/google.ts
// Server-side helpers for Google OAuth (Integrations client)
// Uses Next.js built-in fetch

// ✅ Use the INTEGRATIONS OAuth client (not your login client)
const CLIENT_ID = process.env.GOOGLE_INTEGRATIONS_CLIENT_ID!;
const CLIENT_SECRET = process.env.GOOGLE_INTEGRATIONS_CLIENT_SECRET!;
const REDIRECT_URI = process.env.GOOGLE_INTEGRATIONS_REDIRECT!;

// Scopes we need now (Gmail) and soon (Google Business Profile)
const SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/business.manage",
];

// Build the Google consent URL
export function googleAuthUrl(state: string) {
  const base = "https://accounts.google.com/o/oauth2/v2/auth";
  const p = new URLSearchParams({
    response_type: "code",
    access_type: "offline",  // get refresh_token
    prompt: "consent",       // ensure refresh_token on reconnect
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI, // e.g. http://localhost:3000/api/google/oauth/callback
    scope: SCOPES.join(" "),
    state,
    include_granted_scopes: "true",
  });
  return `${base}?${p.toString()}`;
}

// Exchange auth code for tokens
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
    id_token?: string;
  };
}

// Refresh an access token
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

// --- Minimal Google API helpers (we'll use these soon) ---
async function gfetch<T>(access_token: string, url: string) {
  const r = await fetch(url, { headers: { Authorization: `Bearer ${access_token}` } });
  if (!r.ok) throw new Error(`Google API error: ${r.status}`);
  return (await r.json()) as T;
}

// Gmail example (for polling review emails later)
export async function listGmailMessages(access_token: string, q: string, maxResults = 25) {
  const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(q)}&maxResults=${maxResults}`;
  return gfetch<{ messages?: { id: string; threadId: string }[] }>(access_token, url);
}

// Google Business Profile (kept from your version)
export async function listAccounts(access_token: string) {
  return gfetch<{ accounts?: { name: string; accountName?: string }[] }>(
    access_token,
    "https://mybusinessaccountmanagement.googleapis.com/v1/accounts"
  );
}

export async function listLocations(access_token: string, account: string) {
  const url = `https://mybusinessbusinessinformation.googleapis.com/v1/${encodeURIComponent(
    account
  )}/locations?readMask=name,title`;
  return gfetch<{ locations?: { name: string; title?: string }[] }>(access_token, url);
}

export async function listReviews(access_token: string, locationName: string) {
  const url = `https://mybusiness.googleapis.com/v4/${encodeURIComponent(
    locationName
  )}/reviews?orderBy=updateTime desc&pageSize=20`;
  return gfetch<{
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
