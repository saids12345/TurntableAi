import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServer";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { decryptIntegrationToken } from "@/lib/integrationTokenCrypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function signedInUserId(): Promise<string> {
  const supabase = await getSupabaseServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    throw new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }
  return user.id;
}

function fail(error: unknown) {
  if (error instanceof Response) return error;
  console.error("Google connection control failed:", error);
  return NextResponse.json(
    { ok: false, error: "google_connection_control_failed" },
    { status: 500 },
  );
}

function validAlertEmail(value: unknown): value is string {
  if (typeof value !== "string" || value !== value.trim() || value.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function storedToken(value: unknown): string | null {
  if (typeof value !== "string" || !value) return null;
  try {
    return value.startsWith("v1.") ? decryptIntegrationToken(value) : value;
  } catch {
    // Credentials can be removed locally even when a legacy token cannot be decrypted.
    return null;
  }
}

async function revokeGoogleToken(token: string | null): Promise<"confirmed" | "unconfirmed"> {
  if (!token) return "unconfirmed";
  try {
    const response = await fetch("https://oauth2.googleapis.com/revoke", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token }),
      cache: "no-store",
    });
    return response.ok ? "confirmed" : "unconfirmed";
  } catch {
    return "unconfirmed";
  }
}

export async function GET() {
  try {
    const userId = await signedInUserId();
    const admin = getSupabaseAdmin();
    const { data: connection, error } = await admin
      .from("review_connections")
      .select("id,account_name,email")
      .eq("user_id", userId)
      .eq("provider", "google")
      .maybeSingle();
    if (error) throw error;
    if (!connection) {
      return NextResponse.json({
        ok: true, connected: false, locationCount: 0,
        accountName: null, alertEmail: null,
      });
    }
    const { count, error: countError } = await admin
      .from("review_locations")
      .select("id", { count: "exact", head: true })
      .eq("connection_id", connection.id);
    if (countError) throw countError;
    return NextResponse.json({
      ok: true,
      connected: true,
      locationCount: count ?? 0,
      accountName: connection.account_name ?? null,
      alertEmail: connection.email ?? null,
    });
  } catch (error) {
    return fail(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const userId = await signedInUserId();
    const payload = await request.json().catch(() => null);
    if (!payload || !validAlertEmail(payload.alertEmail)) {
      return NextResponse.json(
        { ok: false, error: "invalid_alert_email" },
        { status: 400 },
      );
    }
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from("review_connections")
      .update({ email: payload.alertEmail, updated_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("provider", "google")
      .select("email")
      .maybeSingle();
    if (error) throw error;
    if (!data) {
      return NextResponse.json(
        { ok: false, error: "google_not_connected" },
        { status: 404 },
      );
    }
    return NextResponse.json({ ok: true, alertEmail: data.email });
  } catch (error) {
    return fail(error);
  }
}

export async function DELETE() {
  try {
    // Auth only: an owner must be able to disconnect after a subscription ends.
    const userId = await signedInUserId();
    const admin = getSupabaseAdmin();
    const { data: connection, error } = await admin
      .from("review_connections")
      .select("id,tokens")
      .eq("user_id", userId)
      .eq("provider", "google")
      .maybeSingle();
    if (error) throw error;
    if (!connection) {
      return NextResponse.json({ ok: true, disconnected: false, revocation: "not_needed" });
    }

    // Delete child locations first: do not assume a FK cascade exists in
    // older Supabase tables. Historical reviews are deliberately retained.
    const { error: locationError } = await admin
      .from("review_locations")
      .delete()
      .eq("connection_id", connection.id);
    if (locationError) throw locationError;
    const { error: deleteError } = await admin
      .from("review_connections")
      .delete()
      .eq("id", connection.id)
      .eq("user_id", userId)
      .eq("provider", "google");
    if (deleteError) throw deleteError;

    const rawTokens = connection.tokens;
    const tokens = rawTokens && typeof rawTokens === "object" && !Array.isArray(rawTokens)
      ? rawTokens as Record<string, unknown>
      : {};
    const token = storedToken(tokens.refresh_token) ?? storedToken(tokens.access_token);
    const revocation = await revokeGoogleToken(token);
    return NextResponse.json({ ok: true, disconnected: true, revocation });
  } catch (error) {
    return fail(error);
  }
}
