// src/app/api/voice-profile/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { getSupabaseRouteClient } from "@/lib/supabaseRoute";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ---------- helpers ----------
function buildStylePrompt(samples: string[]) {
  const joined = samples
    .map((s, i) => `Sample ${i + 1}:\n${s.trim()}`)
    .join("\n\n");

  return `
You are a brand voice analyst.

Given REAL social captions and/or review replies for a small, community-rooted café,
write a concise, reusable **Brand Voice Style Guide** as short bullet points.

Requirements:
- 8–12 bullets. Be specific and actionable.
- Cover tone, sentence length, emojis/hashtags policy, sensory language, inclusivity,
  do/don’t phrasing, and examples of signature phrases.
- Keep it neutral and brand-safe (no slang that can alienate).

${joined}
`.trim();
}

function extractText(resp: any): string {
  // v5 Responses: some SDK versions expose `output_text`, others a content array
  const direct = resp?.output_text;
  if (typeof direct === "string" && direct.trim()) return direct.trim();

  const content = resp?.output?.[0]?.content ?? [];
  const node =
    content.find((p: any) => typeof p?.text === "string") ??
    content.find((p: any) => typeof p?.output_text === "string");

  const text = node?.text ?? node?.output_text;
  return typeof text === "string" ? text.trim() : "";
}

// ---------- routes ----------
export async function GET() {
  const supabase = await getSupabaseRouteClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("voice_profiles")
    .select("*")
    .eq("user_id", user.id)
    .single();

  // PGRST116 = no rows
  if (error && error.code !== "PGRST116") {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ profile: data ?? null });
}

export async function POST(req: NextRequest) {
  const supabase = await getSupabaseRouteClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const samples: string[] = Array.isArray(body?.samples) ? body.samples : [];

  if (samples.length < 3) {
    return NextResponse.json(
      { error: "Please provide at least 3 samples." },
      { status: 400 },
    );
  }

  const prompt = buildStylePrompt(samples);

  const aiResp = await openai.responses.create({
    model: "gpt-4.1-mini",
    input: prompt,
  });

  // ✅ FIX: cast/normalize the response to satisfy TS
  const style_guide = extractText(aiResp) || "No result.";

  const { data, error } = await supabase
    .from("voice_profiles")
    .upsert(
      {
        user_id: user.id,
        samples,
        style_guide,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }, // requires UNIQUE(user_id) or PRIMARY KEY (user_id)
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ profile: data });
}

export async function DELETE() {
  const supabase = await getSupabaseRouteClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { error } = await supabase
    .from("voice_profiles")
    .delete()
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
