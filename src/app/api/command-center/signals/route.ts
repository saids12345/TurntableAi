import { NextResponse } from "next/server";
import { getSupabaseRouteClient } from "@/lib/supabaseRoute";
import { getOperatorSnapshot } from "@/lib/operatorSnapshot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type HealthStatus = "healthy" | "watch" | "risk";

type SnapshotLocation = {
  health: HealthStatus;
  avgRating: number | null;
  openAlerts: number;
};

type CommandCenterSnapshot = {
  locations: Array<Record<string, unknown>>;
  alerts: Array<Record<string, unknown>>;
  actions: Array<Record<string, unknown>>;
  briefing?: unknown;
  generatedAt: string;
};

/* =========================
   HELPERS
========================= */

function isHealthStatus(value: unknown): value is HealthStatus {
  return value === "healthy" || value === "watch" || value === "risk";
}

function numOrNull(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function asSafeLocations(value: unknown): SnapshotLocation[] {
  if (!Array.isArray(value)) return [];

  return value.map((item) => {
    const record = item && typeof item === "object" ? (item as Record<string, unknown>) : {};

    return {
      health: isHealthStatus(record.health) ? record.health : "healthy",
      avgRating: numOrNull(record.avgRating),
      openAlerts: numOrNull(record.openAlerts) ?? 0,
    };
  });
}

function asArray(value: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is Record<string, unknown> =>
      !!item && typeof item === "object" && !Array.isArray(item)
  );
}

function asGeneratedAt(value: unknown) {
  if (typeof value === "string" && value.trim()) return value;
  return new Date().toISOString();
}

/* =========================
   INSIGHTS LOGIC
========================= */

function shouldTriggerInsights(locations: SnapshotLocation[]) {
  return locations.some(
    (location) =>
      location.health === "risk" ||
      (location.avgRating !== null && location.avgRating < 4) ||
      location.openAlerts >= 3
  );
}

async function hasRecentGeneratedInsights(supabase: Awaited<ReturnType<typeof getSupabaseRouteClient>>, userId: string) {
  const recentIso = new Date(Date.now() - 15 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("ai_insight_outcomes")
    .select("id, generated_at, created_at")
    .eq("user_id", userId)
    .or(`generated_at.gte.${recentIso},created_at.gte.${recentIso}`)
    .limit(1);

  if (error) {
    console.error("command-center/signals insight recency check error:", error);
    return false;
  }

  return Array.isArray(data) && data.length > 0;
}

async function triggerInsightGeneration(request: Request, supabase: Awaited<ReturnType<typeof getSupabaseRouteClient>>, userId: string) {
  const alreadyRecent = await hasRecentGeneratedInsights(supabase, userId);
  if (alreadyRecent) return;

  try {
    const origin = new URL(request.url).origin;
    const cookie = request.headers.get("cookie") ?? "";

    const response = await fetch(`${origin}/api/ai-insights/generate`, {
      method: "POST",
      headers: cookie ? { cookie } : undefined,
      cache: "no-store",
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      console.error("command-center/signals auto-generate non-200:", {
        status: response.status,
        body: text || null,
      });
    }
  } catch (error) {
    console.error("command-center/signals auto-generate trigger error:", error);
  }
}

/* =========================
   MAIN ROUTE
========================= */

export async function GET(request: Request) {
  try {
    const supabase = await getSupabaseRouteClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) {
      console.error("command-center/signals auth error:", authError);
      return NextResponse.json(
        { error: `Authentication failed: ${authError.message}` },
        { status: 401 }
      );
    }

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let rawSnapshot: unknown;

    try {
      rawSnapshot = await getOperatorSnapshot(user.id);
    } catch (snapshotError) {
      console.error("command-center/signals getOperatorSnapshot error:", snapshotError);

      return NextResponse.json(
        {
          error:
            snapshotError instanceof Error
              ? `Failed to build operator snapshot: ${snapshotError.message}`
              : "Failed to build operator snapshot",
        },
        { status: 500 }
      );
    }

    const snapshotRecord =
      rawSnapshot && typeof rawSnapshot === "object" && !Array.isArray(rawSnapshot)
        ? (rawSnapshot as Record<string, unknown>)
        : {};

    const snapshot: CommandCenterSnapshot = {
      locations: asArray(snapshotRecord.locations),
      alerts: asArray(snapshotRecord.alerts),
      actions: asArray(snapshotRecord.actions),
      briefing: snapshotRecord.briefing,
      generatedAt: asGeneratedAt(snapshotRecord.generatedAt),
    };

    const safeLocations = asSafeLocations(snapshot.locations);

    if (shouldTriggerInsights(safeLocations)) {
      void triggerInsightGeneration(request, supabase, user.id);
    }

    return NextResponse.json({
      locations: snapshot.locations,
      alerts: snapshot.alerts,
      actions: snapshot.actions,
      briefing: snapshot.briefing ?? null,
      generatedAt: snapshot.generatedAt,
      autoInsightTriggerChecked: true,
      ok: true,
    });
  } catch (error) {
    console.error("command-center/signals unexpected error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? `Unexpected error: ${error.message}`
            : "Unexpected error",
      },
      { status: 500 }
    );
  }
}