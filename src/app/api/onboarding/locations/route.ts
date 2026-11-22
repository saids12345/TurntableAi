import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServer";
import {
  isLocationId,
  parseLocationDetails,
  type LocationDetails,
} from "@/lib/onboardingLocationInput";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const fields = "id,name,city,region,country_code,created_at";

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

async function sessionGroup() {
  const supabase = await getSupabaseServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return { kind: "unauthorized" as const };
  }

  // This query runs under the authenticated user's RLS policies.
  const { data: group, error } = await supabase
    .from("restaurant_groups")
    .select("id,expected_location_count")
    .eq("owner_user_id", user.id)
    .maybeSingle();

  if (error) throw error;
  if (!group) return { kind: "missing_group" as const };

  return { kind: "ready" as const, supabase, group };
}

function gateError(kind: "unauthorized" | "missing_group") {
  return kind === "unauthorized"
    ? json({ error: "Unauthorized" }, 401)
    : json({ error: "Set up your restaurant first." }, 409);
}

async function parseBody(request: Request) {
  if (!/^application\/json(?:;|$)/i.test(request.headers.get("content-type") ?? "")) {
    return { ok: false as const, response: json({ error: "Use JSON." }, 415) };
  }

  const text = await request.text();
  if (text.length > 4096) {
    return { ok: false as const, response: json({ error: "Request is too large." }, 413) };
  }

  try {
    return { ok: true as const, value: JSON.parse(text) as unknown };
  } catch {
    return { ok: false as const, response: json({ error: "Invalid JSON." }, 400) };
  }
}

function rowForDb(value: LocationDetails) {
  return {
    name: value.name,
    city: value.city,
    region: value.region,
    country_code: value.countryCode,
  };
}

export async function GET() {
  try {
    const session = await sessionGroup();
    if (session.kind !== "ready") return gateError(session.kind);

    const { data, error } = await session.supabase
      .from("restaurant_locations")
      .select(fields)
      .eq("group_id", session.group.id)
      .eq("is_active", true)
      .order("created_at", { ascending: true });

    if (error) throw error;

    return json({
      ok: true,
      expectedLocationCount: session.group.expected_location_count,
      locations: data ?? [],
    });
  } catch (error) {
    console.error("Onboarding locations GET failed:", error);
    return json({ error: "Location setup is temporarily unavailable." }, 503);
  }
}

export async function POST(request: Request) {
  try {
    const session = await sessionGroup();
    if (session.kind !== "ready") return gateError(session.kind);

    const body = await parseBody(request);
    if (!body.ok) return body.response;

    const parsed = parseLocationDetails(body.value);
    if (!parsed.ok) return json({ error: parsed.error }, 400);

    // A safety ceiling independent of the owner's estimated location count.
    const { count, error: countError } = await session.supabase
      .from("restaurant_locations")
      .select("id", { count: "exact", head: true })
      .eq("group_id", session.group.id)
      .eq("is_active", true);

    if (countError) throw countError;
    if (count === null || count === undefined) {
      throw new Error("Missing location count");
    }
    if (count >= 100) {
      return json({ error: "Maximum 100 locations per restaurant group." }, 409);
    }

    const { data, error } = await session.supabase
      .from("restaurant_locations")
      .insert({
        group_id: session.group.id,
        ...rowForDb(parsed.value),
      })
      .select(fields)
      .single();

    if (error || !data) throw error ?? new Error("Location not returned");

    return json({ ok: true, location: data }, 201);
  } catch (error) {
    console.error("Onboarding locations POST failed:", error);
    return json({ error: "Could not add location. Please retry." }, 503);
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await sessionGroup();
    if (session.kind !== "ready") return gateError(session.kind);

    const body = await parseBody(request);
    if (!body.ok) return body.response;

    if (!body.value || typeof body.value !== "object" || Array.isArray(body.value)) {
      return json({ error: "Invalid location details." }, 400);
    }
    const value = body.value as Record<string, unknown>;
    if (!isLocationId(value.id)) {
      return json({ error: "Invalid location ID." }, 400);
    }
    const { id, ...details } = value;
    const parsed = parseLocationDetails(details);
    if (!parsed.ok) return json({ error: parsed.error }, 400);

    const { data, error } = await session.supabase
      .from("restaurant_locations")
      .update(rowForDb(parsed.value))
      .eq("id", id)
      .eq("group_id", session.group.id)
      .eq("is_active", true)
      .select(fields)
      .maybeSingle();

    if (error) throw error;
    if (!data) return json({ error: "Location not found." }, 404);

    return json({ ok: true, location: data });
  } catch (error) {
    console.error("Onboarding locations PATCH failed:", error);
    return json({ error: "Could not update location. Please retry." }, 503);
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await sessionGroup();
    if (session.kind !== "ready") return gateError(session.kind);

    const body = await parseBody(request);
    if (!body.ok) return body.response;

    if (
      !body.value ||
      typeof body.value !== "object" ||
      Array.isArray(body.value) ||
      Object.keys(body.value).length !== 1 ||
      !isLocationId((body.value as Record<string, unknown>).id)
    ) {
      return json({ error: "Invalid location ID." }, 400);
    }

    const id = (body.value as { id: string }).id;
    const { data, error } = await session.supabase
      .from("restaurant_locations")
      // Reversible removal: the onboarding schema grants UPDATE,
      // not DELETE, and archived records remain recoverable.
      .update({ is_active: false })
      .eq("id", id)
      .eq("group_id", session.group.id)
      .eq("is_active", true)
      .select("id")
      .maybeSingle();

    if (error) throw error;
    if (!data) return json({ error: "Location not found." }, 404);

    return json({ ok: true, archived: true });
  } catch (error) {
    console.error("Onboarding locations DELETE failed:", error);
    return json({ error: "Could not remove location. Please retry." }, 503);
  }
}
