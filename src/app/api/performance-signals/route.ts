import { NextRequest, NextResponse } from "next/server";
import { getSupabaseRouteClient } from "@/lib/supabaseRoute";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PerformanceSnapshot = {
  locationName: string;
  revenue: number | null;
  orders: number | null;
  avgTicket: number | null;
  laborPct: number | null;
  marginPct: number | null;
  refunds: number | null;
  capturedAt: string;
};

const FALLBACK_SNAPSHOTS: PerformanceSnapshot[] = [
  {
    locationName: "Mira Mesa",
    revenue: 3825,
    orders: 188,
    avgTicket: 20.35,
    laborPct: 26,
    marginPct: 58,
    refunds: 72,
    capturedAt: new Date().toISOString(),
  },
  {
    locationName: "Chula Vista",
    revenue: 4410,
    orders: 219,
    avgTicket: 20.14,
    laborPct: 19,
    marginPct: 64,
    refunds: 18,
    capturedAt: new Date().toISOString(),
  },
  {
    locationName: "Escondido",
    revenue: 3990,
    orders: 201,
    avgTicket: 19.85,
    laborPct: 22,
    marginPct: 61,
    refunds: 36,
    capturedAt: new Date().toISOString(),
  },
  {
    locationName: "La Jolla",
    revenue: 5120,
    orders: 246,
    avgTicket: 20.81,
    laborPct: 18,
    marginPct: 67,
    refunds: 12,
    capturedAt: new Date().toISOString(),
  },
];

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export async function GET() {
  try {
    const supabase = await getSupabaseRouteClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        {
          source: "fallback",
          items: FALLBACK_SNAPSHOTS,
        },
        { status: 200 }
      );
    }

    const { data, error } = await supabase
      .from("performance_signal_history")
      .select(
        "id, location_name, revenue, orders, avg_ticket, labor_pct, margin_pct, refunds, captured_at"
      )
      .eq("user_id", user.id)
      .order("captured_at", { ascending: false });

    if (error) {
      console.error("performance-signals GET error:", error);
      return NextResponse.json(
        {
          source: "fallback",
          items: FALLBACK_SNAPSHOTS,
        },
        { status: 200 }
      );
    }

    if (!data?.length) {
      return NextResponse.json(
        {
          source: "fallback",
          items: FALLBACK_SNAPSHOTS,
        },
        { status: 200 }
      );
    }

    const latestByLocation = new Map<string, PerformanceSnapshot>();

    for (const row of data) {
      const locationName = row.location_name as string;
      if (latestByLocation.has(locationName)) continue;

      latestByLocation.set(locationName, {
        locationName,
        revenue: toNumber(row.revenue),
        orders: toNumber(row.orders),
        avgTicket: toNumber(row.avg_ticket),
        laborPct: toNumber(row.labor_pct),
        marginPct: toNumber(row.margin_pct),
        refunds: toNumber(row.refunds),
        capturedAt: String(row.captured_at),
      });
    }

    return NextResponse.json({
      source: "live",
      items: Array.from(latestByLocation.values()),
    });
  } catch (error) {
    console.error("performance-signals GET unexpected error:", error);
    return NextResponse.json(
      {
        source: "fallback",
        items: FALLBACK_SNAPSHOTS,
      },
      { status: 200 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await getSupabaseRouteClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as Partial<PerformanceSnapshot> | { items?: Partial<PerformanceSnapshot>[] };

    const inputItems = Array.isArray((body as { items?: Partial<PerformanceSnapshot>[] })?.items)
      ? (body as { items?: Partial<PerformanceSnapshot>[] }).items!
      : [body as Partial<PerformanceSnapshot>];

    const rows = inputItems
      .map((item) => ({
        user_id: user.id,
        location_name: typeof item.locationName === "string" ? item.locationName.trim() : "",
        revenue: toNumber(item.revenue),
        orders: toNumber(item.orders),
        avg_ticket: toNumber(item.avgTicket),
        labor_pct: toNumber(item.laborPct),
        margin_pct: toNumber(item.marginPct),
        refunds: toNumber(item.refunds),
        captured_at:
          typeof item.capturedAt === "string" && item.capturedAt.trim()
            ? item.capturedAt
            : new Date().toISOString(),
      }))
      .filter((row) => row.location_name);

    if (!rows.length) {
      return NextResponse.json({ error: "No valid performance rows provided" }, { status: 400 });
    }

    const { error } = await supabase.from("performance_signal_history").insert(rows);

    if (error) {
      console.error("performance-signals POST error:", error);
      return NextResponse.json({ error: "Failed to save performance signals" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, inserted: rows.length });
  } catch (error) {
    console.error("performance-signals POST unexpected error:", error);
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}