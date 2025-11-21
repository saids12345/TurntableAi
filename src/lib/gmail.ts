// src/lib/gmail.ts
//
// Helpers for Gmail OAuth + basic profile access.
// We'll use this for Yelp review alert emails.

const GMAIL_CLIENT_ID = process.env.GMAIL_CLIENT_ID!;
const GMAIL_CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET!;
const GMAIL_REDIRECT_URI = process.env.GMAIL_REDIRECT_URI!;

// Scopes:
// - gmail.readonly: read messages (needed for Yelp alerts)
// - userinfo.email/profile + openid: to know which Gmail account we're connected to
const GMAIL_SCOPE = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
  "openid",
].join(" ");

if (!GMAIL_CLIENT_ID || !GMAIL_CLIENT_SECRET || !GMAIL_REDIRECT_URI) {
  // In dev, this will show in the server console if you forgot to set env vars.
  console.warn(
    "[gmail] Missing GMAIL_CLIENT_ID / GMAIL_CLIENT_SECRET / GMAIL_REDIRECT_URI env vars."
  );
}

export type GmailTokenResponse = {
  access_token: string;
  refresh_token?: string;
  scope?: string;
  expires_in?: number;
  token_type?: string;
  id_token?: string;
};

// Build the Google OAuth URL for Gmail with our scopes.
export function gmailAuthUrl(state: string) {
  const base = "https://accounts.google.com/o/oauth2/v2/auth";
  const params = new URLSearchParams({
    response_type: "code",
    access_type: "offline", // we want a refresh_token
    prompt: "consent", // always ask so we reliably get refresh_token
    client_id: GMAIL_CLIENT_ID,
    redirect_uri: GMAIL_REDIRECT_URI,
    scope: GMAIL_SCOPE,
    state,
  });
  return `${base}?${params.toString()}`;
}

// Exchange the "code" from the callback for access + refresh tokens.
export async function exchangeGmailCode(code: string): Promise<GmailTokenResponse> {
  const body = new URLSearchParams({
    code,
    client_id: GMAIL_CLIENT_ID,
    client_secret: GMAIL_CLIENT_SECRET,
    redirect_uri: GMAIL_REDIRECT_URI,
    grant_type: "authorization_code",
  });

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gmail token exchange failed: ${res.status} ${text}`);
  }

  return (await res.json()) as GmailTokenResponse;
}

// (Small helper) Use the access_token to fetch the Gmail account's email.
export async function getGmailProfile(access_token: string): Promise<{
  email: string;
  name?: string;
}> {
  const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${access_token}` },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gmail profile fetch failed: ${res.status} ${text}`);
  }

  const data = (await res.json()) as {
    email?: string;
    name?: string;
    given_name?: string;
    family_name?: string;
  };

  if (!data.email) {
    throw new Error("Gmail profile did not include an email address");
  }

  return { email: data.email, name: data.name };
}
