"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  assessOnboardingStatus,
  type OnboardingStatus,
  type ProviderRecordState,
} from "@/lib/onboardingReadiness";

type Step = "connections" | "readiness";
type LoadState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; status: OnboardingStatus };

function object(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

async function readJson(path: string, signal: AbortSignal): Promise<unknown> {
  const response = await fetch(path, {
    method: "GET",
    cache: "no-store",
    credentials: "same-origin",
    signal,
  });
  if (response.status === 401) {
    window.location.assign(`/login?redirect=${encodeURIComponent(window.location.pathname)}`);
    throw new Error("Session expired. Sign in and retry.");
  }
  if (!response.ok) throw new Error("Setup information is temporarily unavailable.");
  return response.json();
}

function parseGroup(value: unknown): { name: string; expected: number } | null {
  const body = object(value);
  if (!body || body.ok !== true) throw new Error("Restaurant setup response incomplete.");
  if (body.restaurant === null) return null;
  const restaurant = object(body.restaurant);
  if (!restaurant || typeof restaurant.name !== "string" ||
      typeof restaurant.expected_location_count !== "number" ||
      !Number.isInteger(restaurant.expected_location_count) ||
      (restaurant.expected_location_count as number) < 1 ||
      (restaurant.expected_location_count as number) > 100) {
    throw new Error("Restaurant setup response incomplete.");
  }
  return { name: restaurant.name, expected: restaurant.expected_location_count as number };
}

function parseLocationCount(value: unknown): number {
  const body = object(value);
  if (!body || body.ok !== true || !Array.isArray(body.locations) ||
      typeof body.expectedLocationCount !== "number" ||
      body.locations.length > 100 ||
      !body.locations.every((item: unknown) => typeof object(item)?.id === "string")) {
    throw new Error("Saved location response incomplete.");
  }
  return body.locations.length;
}

function parseProviderRecord(value: unknown): ProviderRecordState {
  const body = object(value);
  if (!body || body.ok !== true || typeof body.connected !== "boolean") {
    throw new Error("Provider status response incomplete.");
  }
  // This is a stored-account status, not a live OAuth or data-feed verification.
  return body.connected ? "present" : "absent";
}

function ProviderStatus({ name, state }: { name: string; state: ProviderRecordState }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
      <p className="font-semibold text-white">{name}</p>
      <p className="mt-2 text-sm text-neutral-300" role="status">
        {state === "present" ? "Saved account record found" :
          state === "absent" ? "No saved account record" : "Status unavailable"}
      </p>
      <p className="mt-2 text-xs leading-5 text-neutral-500">
        A stored record is not proof of current authorization, ownership, or a verified data feed.
      </p>
    </div>
  );
}

export default function OnboardingStatusClient({ step }: { step: Step }) {
  const [load, setLoad] = useState<LoadState>({ kind: "loading" });
  const [revision, setRevision] = useState(0);

  const refresh = useCallback(async (signal: AbortSignal) => {
    try {
      setLoad({ kind: "loading" });
      const group = parseGroup(await readJson("/api/onboarding", signal));
      if (!group) {
        setLoad({ kind: "ready", status: {
          restaurantName: null, expectedLocationCount: 1, savedLocationCount: 0,
          google: "unavailable", square: "unavailable",
        } });
        return;
      }

      const locations = parseLocationCount(
        await readJson("/api/onboarding/locations", signal)
      );

      let providers: { google: ProviderRecordState; square: ProviderRecordState } = {
        google: "unavailable", square: "unavailable",
      };
      try {
        providers.google = parseProviderRecord(
          await readJson("/api/google/connection", signal)
        );
      } catch (error) {
        if (signal.aborted) return;
        if (error instanceof Error && error.message.startsWith("Session expired")) throw error;
      }
      try {
        providers.square = parseProviderRecord(
          await readJson("/api/square/status", signal)
        );
      } catch (error) {
        if (signal.aborted) return;
        // A non-Pro account receives unavailable, never an invented Square status.
        if (error instanceof Error && error.message.startsWith("Session expired")) throw error;
      }

      if (!signal.aborted) setLoad({ kind: "ready", status: {
        restaurantName: group.name,
        expectedLocationCount: group.expected,
        savedLocationCount: locations,
        ...providers,
      } });
    } catch {
      if (!signal.aborted) setLoad({
        kind: "error",
        message: "We couldn't load your onboarding status. No saved data has been changed.",
      });
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void refresh(controller.signal);
    return () => controller.abort();
  }, [refresh, revision]);

  const ready = load.kind === "ready" ? assessOnboardingStatus(load.status) : null;
  const isConnections = step === "connections";

  return (
    <main className="mx-auto max-w-5xl px-4 pb-24 pt-12 sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">
        TurnTableAI / Getting started
      </p>
      <h1 className="mt-4 text-3xl font-semibold text-white sm:text-5xl">
        {isConnections ? "Connect your restaurant tools" : "Your restaurant readiness review"}
      </h1>
      <p className="mt-4 max-w-3xl text-sm leading-6 text-neutral-400">
        {isConnections
          ? "Step 3 of 4. Review existing provider records, then manage connections using our established integration controls."
          : "Step 4 of 4. See what is saved, what is missing, and what still needs live verification before AI can rely on it."}
      </p>

      <div className="mt-8 rounded-3xl border border-white/10 bg-neutral-950/80 p-6 sm:p-8">
        {load.kind === "loading" && (
          <p role="status" className="text-sm text-neutral-300">Checking your saved setup…</p>
        )}
        {load.kind === "error" && (
          <div role="alert" className="space-y-4">
            <p className="text-sm text-amber-200">{load.message}</p>
            <button type="button" onClick={() => setRevision(n => n + 1)}
              className="rounded-xl border border-white/20 px-4 py-2 text-sm text-white">Try again</button>
          </div>
        )}
        {load.kind === "ready" && ready && (
          <div className="space-y-7">
            {!load.status.restaurantName && (
              <p role="alert" className="rounded-xl border border-amber-300/20 p-4 text-sm text-amber-100">
                Save your restaurant details before connecting locations.
              </p>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 p-5">
                <p className="text-xs uppercase tracking-wider text-neutral-400">Restaurant</p>
                <p className="mt-2 font-medium text-white">{load.status.restaurantName ?? "Not saved yet"}</p>
                <p className="mt-2 text-sm text-neutral-400">
                  {ready.restaurantSaved ? "Details saved" : "Needs setup"}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 p-5">
                <p className="text-xs uppercase tracking-wider text-neutral-400">Locations</p>
                <p className="mt-2 font-medium text-white">
                  {load.status.savedLocationCount} of {load.status.expectedLocationCount} planned
                </p>
                <p className="mt-2 text-sm text-neutral-400">
                  {ready.locationsEntered ? "Planned locations entered" : "More location details needed"}
                </p>
              </div>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-white">Provider connections</h2>
              <p className="mt-2 text-sm text-neutral-400">
                Statuses below describe saved provider snapshots, not current permission or trusted data.
                Square Sandbox records are excluded.
              </p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <ProviderStatus name="Google Business Profile" state={load.status.google} />
                <ProviderStatus name="Square — Production" state={load.status.square} />
              </div>
            </div>

            {!isConnections && (
              <div className="rounded-2xl border border-amber-300/20 bg-amber-300/[0.04] p-5">
                <h2 className="text-lg font-semibold text-white">AI data readiness — Not verified</h2>
                <p className="mt-2 text-sm leading-6 text-neutral-300">
                  Saved locations and provider account records do not establish live OAuth access,
                  successful data ingestion, physical ownership, or trusted evidence for the Brain.
                  This review does not activate AI features or grant Pro access.
                </p>
              </div>
            )}
            {ready.providerStateUnavailable && (
              <p className="text-sm text-amber-200" role="status">
                Provider status could not be verified right now. Retry rather than treating it as disconnected.
              </p>
            )}
            <div className="flex flex-wrap gap-3 border-t border-white/10 pt-6">
              <Link href="/onboarding/locations"
                className="rounded-xl border border-white/20 px-5 py-3 text-sm text-white">
                Review saved locations
              </Link>
              <Link href="/integrations"
                className="rounded-xl border border-white/20 px-5 py-3 text-sm text-white">
                Manage existing integrations
              </Link>
              {isConnections && (
                <Link href="/onboarding/readiness"
                  className="rounded-xl bg-white px-5 py-3 text-sm font-semibold text-black">
                  Review readiness
                </Link>
              )}
              <button type="button" onClick={() => setRevision(n => n + 1)}
                className="rounded-xl border border-white/20 px-5 py-3 text-sm text-white">
                Refresh status
              </button>
            </div>
            <p className="text-xs leading-5 text-neutral-500">
              Connecting accounts requires the existing authorized integration flow and an eligible
              subscription or trial. No provider data is imported or modified by this page.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
