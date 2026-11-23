import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServer";
import { parseRestaurantIdentity } from "@/lib/onboardingInput";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStore = {
  "Cache-Control": "no-store",
};

function json(
  body: unknown,
  status = 200,
) {
  return NextResponse.json(body, {
    status,
    headers: noStore,
  });
}

async function getSession() {
  const supabase = await getSupabaseServerClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) return null;

  return { supabase, user };
}

export async function GET() {
  try {
    const session = await getSession();

    if (!session) {
      return json({ error: "Unauthorized" }, 401);
    }

    const { data: group, error: groupError } =
      await session.supabase
        .from("restaurant_groups")
        .select(
          "id,name,expected_location_count,primary_goal"
        )
        .eq("owner_user_id", session.user.id)
        .maybeSingle();

    if (groupError) {
      throw groupError;
    }

    if (!group) {
      return json({
        ok: true,
        restaurant: null,
        progress: null,
      });
    }

    const { data: progress, error: progressError } =
      await session.supabase
        .from("restaurant_onboarding")
        .select("current_step,completed_at")
        .eq("group_id", group.id)
        .maybeSingle();

    if (progressError) {
      throw progressError;
    }

    return json({
      ok: true,
      restaurant: group,
      progress,
    });
  } catch (error) {
    console.error("Onboarding GET failed:", error);

    return json(
      { error: "Restaurant setup is temporarily unavailable." },
      503,
    );
  }
}

export async function PUT(request: Request) {
  try {
    const session = await getSession();

    if (!session) {
      return json({ error: "Unauthorized" }, 401);
    }

    const text = await request.text();

    if (text.length > 8192) {
      return json({ error: "Request is too large." }, 413);
    }

    let payload: unknown;

    try {
      payload = JSON.parse(text);
    } catch {
      return json({ error: "Invalid JSON." }, 400);
    }

    const parsed = parseRestaurantIdentity(payload);

    if (!parsed.ok) {
      return json({ error: parsed.error }, 400);
    }

    const now = new Date().toISOString();

    // Ownership comes exclusively from the session.
    // Never accept an owner or group ID from the browser.
    const { data: group, error: groupError } =
      await session.supabase
        .from("restaurant_groups")
        .upsert(
          {
            owner_user_id: session.user.id,
            name: parsed.value.name,
            expected_location_count:
              parsed.value.expectedLocationCount,
            primary_goal: parsed.value.primaryGoal,
            updated_at: now,
          },
          {
            onConflict: "owner_user_id",
          },
        )
        .select(
          "id,name,expected_location_count,primary_goal"
        )
        .single();

    if (groupError || !group) {
      throw groupError ?? new Error("Missing restaurant group");
    }

    // Create progress once. Existing progress must never
    // be reset when a customer edits restaurant details.
    const { error: createError } =
      await session.supabase
        .from("restaurant_onboarding")
        .upsert(
          {
            group_id: group.id,
            current_step: "locations",
          },
          {
            onConflict: "group_id",
            ignoreDuplicates: true,
          },
        );

    if (createError) {
      throw createError;
    }

    const { data: progress, error: progressError } =
      await session.supabase
        .from("restaurant_onboarding")
        .select("current_step,completed_at")
        .eq("group_id", group.id)
        .single();

    if (progressError || !progress) {
      throw progressError ?? new Error("Missing onboarding progress");
    }

    return json({
      ok: true,
      restaurant: group,
      progress,
    });
  } catch (error) {
    console.error("Onboarding PUT failed:", error);

    return json(
      { error: "Could not save restaurant setup. Please retry." },
      503,
    );
  }
}
