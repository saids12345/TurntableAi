// src/app/api/voice-profile/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseRouteClient } from "@/lib/supabaseRoute";

/**
 * GET  /api/voice-profile
 * Returns the current user's saved brand voice style guide (if any).
 */
export async function GET(_req: NextRequest) {
  try {
    const supabase = await getSupabaseRouteClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Not signed in" },
        { status: 401 }
      );
    }

    const { data, error } = await supabase
      .from("voice_profiles")
      .select("style_guide, updated_at")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      console.error("voice-profile GET error", error);
      return NextResponse.json(
        { error: "Failed to load voice profile" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      styleGuide: data?.style_guide ?? null,
      updatedAt: data?.updated_at ?? null,
    });
  } catch (err) {
    console.error("voice-profile GET unexpected", err);
    return NextResponse.json(
      { error: "Server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/voice-profile
 * Body: { styleGuide: string }
 * Saves / updates the current user's brand voice style guide.
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await getSupabaseRouteClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Not signed in" },
        { status: 401 }
      );
    }

    const body = (await req.json().catch(() => ({}))) as {
      styleGuide?: string;
    };

    const raw = (body.styleGuide ?? "").toString();
    const styleGuide = raw.trim();

    if (!styleGuide) {
      return NextResponse.json(
        { error: "Style guide cannot be empty." },
        { status: 400 }
      );
    }

    // simple length guard so people don't paste a whole book
    if (styleGuide.length > 6000) {
      return NextResponse.json(
        { error: "Style guide is too long (max ~6000 characters)." },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();

    const { error } = await supabase
      .from("voice_profiles")
      .upsert(
        [
          {
            user_id: user.id,
            style_guide: styleGuide,
            updated_at: now,
          },
        ],
        { onConflict: "user_id" }
      );

    if (error) {
      console.error("voice-profile POST error", error);
      return NextResponse.json(
        { error: "Failed to save voice profile" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      styleGuide,
      updatedAt: now,
    });
  } catch (err) {
    console.error("voice-profile POST unexpected", err);
    return NextResponse.json(
      { error: "Server error" },
      { status: 500 }
    );
  }
}

