export type PerformanceSignalSnapshot = {
    locationName: string;
    revenue: number | null;
    orders: number | null;
    avgTicket: number | null;
    laborPct: number | null;
    marginPct: number | null;
    refunds: number | null;
    capturedAt: string;
  };
  
  const LAST_CAPTURE_AT_KEY = "ttai:last-performance-capture-at";
  const LAST_CAPTURE_HASH_KEY = "ttai:last-performance-capture-hash";
  
  function safeNumber(value: unknown): number | null {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim()) {
      const n = Number(value);
      return Number.isFinite(n) ? n : null;
    }
    return null;
  }
  
  export function normalizePerformanceSnapshot(
    input: Partial<PerformanceSignalSnapshot>
  ): PerformanceSignalSnapshot | null {
    const locationName =
      typeof input.locationName === "string" ? input.locationName.trim() : "";
  
    if (!locationName) return null;
  
    return {
      locationName,
      revenue: safeNumber(input.revenue),
      orders: safeNumber(input.orders),
      avgTicket: safeNumber(input.avgTicket),
      laborPct: safeNumber(input.laborPct),
      marginPct: safeNumber(input.marginPct),
      refunds: safeNumber(input.refunds),
      capturedAt:
        typeof input.capturedAt === "string" && input.capturedAt.trim()
          ? input.capturedAt
          : new Date().toISOString(),
    };
  }
  
  export function normalizePerformanceSnapshots(
    inputs: Array<Partial<PerformanceSignalSnapshot>>
  ): PerformanceSignalSnapshot[] {
    return inputs
      .map((item) => normalizePerformanceSnapshot(item))
      .filter((item): item is PerformanceSignalSnapshot => item !== null);
  }
  
  export function hasMeaningfulSnapshotData(snapshot: PerformanceSignalSnapshot) {
    return (
      snapshot.revenue !== null ||
      snapshot.orders !== null ||
      snapshot.avgTicket !== null ||
      snapshot.laborPct !== null ||
      snapshot.marginPct !== null ||
      snapshot.refunds !== null
    );
  }
  
  export function buildSnapshotHash(items: PerformanceSignalSnapshot[]) {
    const stable = [...items]
      .sort((a, b) => a.locationName.localeCompare(b.locationName))
      .map((item) => ({
        locationName: item.locationName,
        revenue: item.revenue,
        orders: item.orders,
        avgTicket: item.avgTicket,
        laborPct: item.laborPct,
        marginPct: item.marginPct,
        refunds: item.refunds,
      }));
  
    return JSON.stringify(stable);
  }
  
  export function shouldCapturePerformanceSnapshots(params: {
    items: PerformanceSignalSnapshot[];
    minIntervalMs?: number;
  }) {
    const { items, minIntervalMs = 30 * 60 * 1000 } = params;
  
    if (typeof window === "undefined") {
      return { ok: false, reason: "window_unavailable" as const };
    }
  
    if (!items.length) {
      return { ok: false, reason: "no_items" as const };
    }
  
    const usefulItems = items.filter(hasMeaningfulSnapshotData);
    if (!usefulItems.length) {
      return { ok: false, reason: "no_meaningful_data" as const };
    }
  
    const now = Date.now();
    const lastAtRaw = window.localStorage.getItem(LAST_CAPTURE_AT_KEY);
    const lastHash = window.localStorage.getItem(LAST_CAPTURE_HASH_KEY);
    const nextHash = buildSnapshotHash(usefulItems);
  
    const lastAt = lastAtRaw ? Number(lastAtRaw) : 0;
    const withinCooldown = Number.isFinite(lastAt) && lastAt > 0 && now - lastAt < minIntervalMs;
    const sameHash = lastHash === nextHash;
  
    if (withinCooldown && sameHash) {
      return { ok: false, reason: "cooldown_and_same_hash" as const };
    }
  
    if (!withinCooldown && sameHash) {
      return { ok: true, reason: "interval_elapsed" as const, items: usefulItems, hash: nextHash };
    }
  
    if (withinCooldown && !sameHash) {
      return { ok: true, reason: "data_changed" as const, items: usefulItems, hash: nextHash };
    }
  
    return { ok: true, reason: "first_or_changed" as const, items: usefulItems, hash: nextHash };
  }
  
  export function markPerformanceSnapshotsCaptured(hash: string) {
    if (typeof window === "undefined") return;
  
    window.localStorage.setItem(LAST_CAPTURE_AT_KEY, String(Date.now()));
    window.localStorage.setItem(LAST_CAPTURE_HASH_KEY, hash);
  }