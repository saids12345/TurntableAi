// src/app/api/review-analyze/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Reuse the same normalization pattern as review-reply
function extractText(resp: any): string {
  const direct = resp?.output_text;
  if (typeof direct === "string" && direct.trim()) return direct.trim();

  const content = resp?.output?.[0]?.content ?? [];
  const node =
    content.find((p: any) => typeof p?.text === "string") ??
    content.find((p: any) => typeof p?.output_text === "string");

  const text = node?.text ?? node?.output_text;
  return typeof text === "string" ? text.trim() : "";
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({} as any));
  const reviewText = String(body?.reviewText ?? "").trim();

  if (!reviewText) {
    return NextResponse.json(
      { error: "Missing reviewText" },
      { status: 400 }
    );
  }

  const prompt = `
You are analyzing a customer review for a local restaurant.
Return ONLY a single JSON object with this exact shape:

{
  "detectedRating": number | null,     // integer 1–5 if clearly implied, otherwise null
  "toneLabel": string | null,          // e.g. "Angry", "Mixed", "Happy", "Concerned but polite"
  "lengthSuggestion": "short" | "medium" | "long",
  "sentimentSummary": string | null,   // very short phrase
  "issues": string[],                  // list of short bullet-style issues, can be empty
  "languageName": string | null        // e.g. "English", "Spanish", "Arabic", or another language name
}

Do not include any explanation outside of the JSON.

Review:
"""
${reviewText}
"""
`.trim();

  try {
    const ai = await openai.responses.create({
      model: "gpt-4.1-mini",
      input: prompt,
    });

    const raw = extractText(ai);
    let parsed: any = {};
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = {};
    }

    const ratingRaw = parsed?.detectedRating;
    const ratingNum =
      typeof ratingRaw === "number" || typeof ratingRaw === "string"
        ? Number(ratingRaw)
        : NaN;
    const detectedRating =
      Number.isFinite(ratingNum) && ratingNum >= 1 && ratingNum <= 5
        ? Math.round(ratingNum)
        : null;

    const lengthSuggestionRaw = parsed?.lengthSuggestion;
    const allowedLengths = ["short", "medium", "long"] as const;
    const lengthSuggestion = allowedLengths.includes(lengthSuggestionRaw)
      ? (lengthSuggestionRaw as (typeof allowedLengths)[number])
      : null;

    const toneLabel =
      typeof parsed?.toneLabel === "string" && parsed.toneLabel.trim()
        ? parsed.toneLabel.trim()
        : null;

    const sentimentSummary =
      typeof parsed?.sentimentSummary === "string" &&
      parsed.sentimentSummary.trim()
        ? parsed.sentimentSummary.trim()
        : null;

    const issues =
      Array.isArray(parsed?.issues)
        ? parsed.issues.filter((x: any) => typeof x === "string" && x.trim())
        : [];

    const languageName =
      typeof parsed?.languageName === "string" && parsed.languageName.trim()
        ? parsed.languageName.trim()
        : null;

    return NextResponse.json({
      detectedRating,
      toneLabel,
      lengthSuggestion,
      sentimentSummary,
      issues,
      languageName,
    });
  } catch (err: any) {
    console.error("review-analyze error", err);
    return NextResponse.json(
      { error: "Failed to analyze review" },
      { status: 500 }
    );
  }
}
