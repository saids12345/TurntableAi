"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type Location = {
  id: string;
  name: string;
  city: string | null;
  region: string | null;
  country_code: string | null;
  created_at: string;
};

type Draft = {
  name: string;
  city: string;
  region: string;
  countryCode: string;
};

type ListResponse = {
  ok?: boolean;
  expectedLocationCount?: number;
  locations?: Location[];
  error?: string;
};

type MutationResponse = {
  ok?: boolean;
  location?: Location;
  error?: string;
};

const emptyDraft = (): Draft => ({
  name: "",
  city: "",
  region: "",
  countryCode: "",
});

function asDraft(location: Location): Draft {
  return {
    name: location.name,
    city: location.city ?? "",
    region: location.region ?? "",
    countryCode: location.country_code ?? "",
  };
}

function validate(draft: Draft): string | null {
  const name = draft.name.trim();
  if (!name || name.length > 160 || /[\u0000-\u001F\u007F]/.test(name)) {
    return "Enter a location name of up to 160 characters.";
  }
  if (draft.city.trim().length > 120 || draft.region.trim().length > 120) {
    return "City and state or region must be 120 characters or fewer.";
  }
  const code = draft.countryCode.trim();
  if (code && !/^[A-Za-z]{2}$/.test(code)) {
    return "Use a two-letter country code (such as US), or leave it blank.";
  }
  return null;
}

function displayPlace(location: Location): string {
  const parts = [location.city, location.region, location.country_code].filter(Boolean);
  return parts.length ? parts.join(", ") : "No geographic details added yet";
}

function LocationFields({
  value,
  onChange,
  prefix,
  disabled,
}: {
  value: Draft;
  onChange: (value: Draft) => void;
  prefix: string;
  disabled: boolean;
}) {
  const base = "mt-2 w-full rounded-xl border border-white/15 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder:text-neutral-600 focus:border-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-300/20 disabled:opacity-50";
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="block text-sm font-medium text-neutral-200 sm:col-span-2" htmlFor={`${prefix}-name`}>
        Location name <span className="text-cyan-200">*</span>
        <input id={`${prefix}-name`} className={base} required maxLength={160} disabled={disabled}
          placeholder="e.g. Downtown San Diego" value={value.name}
          onChange={event => onChange({ ...value, name: event.target.value })} />
      </label>
      <label className="block text-sm font-medium text-neutral-200" htmlFor={`${prefix}-city`}>
        City <span className="font-normal text-neutral-500">(optional)</span>
        <input id={`${prefix}-city`} className={base} maxLength={120} disabled={disabled}
          placeholder="San Diego" value={value.city}
          onChange={event => onChange({ ...value, city: event.target.value })} />
      </label>
      <label className="block text-sm font-medium text-neutral-200" htmlFor={`${prefix}-region`}>
        State or region <span className="font-normal text-neutral-500">(optional)</span>
        <input id={`${prefix}-region`} className={base} maxLength={120} disabled={disabled}
          placeholder="California" value={value.region}
          onChange={event => onChange({ ...value, region: event.target.value })} />
      </label>
      <label className="block text-sm font-medium text-neutral-200 sm:col-span-2" htmlFor={`${prefix}-country`}>
        Country code <span className="font-normal text-neutral-500">(optional)</span>
        <input id={`${prefix}-country`} className={`${base} sm:max-w-48`} maxLength={2} disabled={disabled}
          autoCapitalize="characters" placeholder="US" value={value.countryCode}
          onChange={event => onChange({ ...value, countryCode: event.target.value })} />
        <span className="mt-2 block text-xs font-normal text-neutral-500">Two letters. You can refine location details later.</span>
      </label>
    </div>
  );
}

export default function LocationsClient() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [expected, setExpected] = useState(1);
  const [loading, setLoading] = useState(true);
  const [missingGroup, setMissingGroup] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Draft>(emptyDraft);
  const [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState(0);

  const loadLocations = useCallback(async (signal?: AbortSignal) => {
    const response = await fetch("/api/onboarding/locations", {
      cache: "no-store",
      signal,
    });
    if (response.status === 401) {
      window.location.assign("/login?redirect=%2Fonboarding%2Flocations");
      return null;
    }
    if (response.status === 409) return { missingGroup: true as const };
    if (!response.ok) throw new Error("Could not load your locations. Please try again.");
    const body = (await response.json()) as ListResponse;
    if (body.ok !== true || !Array.isArray(body.locations) ||
        typeof body.expectedLocationCount !== "number") {
      throw new Error("Location data was incomplete. Please retry.");
    }
    return { missingGroup: false as const, body };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setLoadError(null);
    setMissingGroup(false);
    void loadLocations(controller.signal)
      .then(result => {
        if (controller.signal.aborted || !result) return;
        if (result.missingGroup) {
          setMissingGroup(true);
        } else {
          setLocations(result.body.locations ?? []);
          setExpected(result.body.expectedLocationCount ?? 1);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setLoadError("We couldn't load your saved locations. Your data hasn't been changed.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [loadLocations, retry]);

  async function mutate(method: "POST" | "PATCH" | "DELETE", payload: unknown): Promise<MutationResponse> {
    const response = await fetch("/api/onboarding/locations", {
      method,
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (response.status === 401) {
      window.location.assign("/login?redirect=%2Fonboarding%2Flocations");
      throw new Error("Your session expired. Please sign in again.");
    }
    const body = (await response.json().catch(() => ({}))) as MutationResponse;
    if (!response.ok || body.ok !== true) {
      throw new Error(typeof body.error === "string" ? body.error : "Could not save your changes. Please try again.");
    }
    return body;
  }

  async function addLocation(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const error = validate(draft);
    if (error) { setNotice(error); return; }
    setBusy(true);
    setNotice(null);
    try {
      const result = await mutate("POST", draft);
      if (!result.location) throw new Error("Could not confirm the saved location.");
      setLocations(previous => [...previous, result.location!]);
      setDraft(emptyDraft());
      setNotice(`${result.location.name} saved to your account.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not add location.");
    } finally {
      setBusy(false);
    }
  }

  function beginEdit(location: Location) {
    setEditingId(location.id);
    setEditDraft(asDraft(location));
    setNotice(null);
  }

  async function updateLocation(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingId || busy) return;
    const error = validate(editDraft);
    if (error) { setNotice(error); return; }
    setBusy(true);
    setNotice(null);
    try {
      const result = await mutate("PATCH", { id: editingId, ...editDraft });
      if (!result.location) throw new Error("Could not confirm the saved changes.");
      const updated = result.location;
      setLocations(previous => previous.map(item => item.id === updated.id ? updated : item));
      setEditingId(null);
      setNotice(`${updated.name} updated successfully.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not update location.");
    } finally {
      setBusy(false);
    }
  }

  async function archiveLocation(location: Location) {
    if (busy) return;
    if (!window.confirm(`Remove ${location.name} from your onboarding list? This won't erase historical provider records.`)) return;
    setBusy(true);
    setNotice(null);
    try {
      await mutate("DELETE", { id: location.id });
      setLocations(previous => previous.filter(item => item.id !== location.id));
      if (editingId === location.id) setEditingId(null);
      setNotice(`${location.name} removed from your active setup.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not remove location.");
    } finally {
      setBusy(false);
    }
  }

  const complete = expected > 0 && locations.length >= expected;
  const remaining = Math.max(0, expected - locations.length);
  const progress = expected > 0 ? Math.min(100, Math.round((locations.length / expected) * 100)) : 0;

  return (
    <main className="mx-auto max-w-6xl px-4 pb-24 pt-10 sm:px-6 lg:pt-16">
      <div className="mb-10 flex flex-wrap items-start justify-between gap-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300">TurnTableAI / Getting started</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-5xl">Every location, accounted for.</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-400 sm:text-base">
            Build a clear picture of your restaurant group, one location at a time.
          </p>
        </div>
        <Link href="/onboarding" className="rounded-full border border-white/15 px-4 py-2 text-sm text-neutral-300 transition hover:border-white/40 hover:text-white">
          Back to restaurant details
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-[245px_minmax(0,1fr)]">
        <aside className="h-fit rounded-3xl border border-white/10 bg-white/[0.03] p-5">
          <p className="mb-5 text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">Your setup</p>
          <ol className="space-y-5">
            {["Restaurant", "Locations", "Connections", "Readiness"].map((step, index) => (
              <li key={step} className="flex items-start gap-3">
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${index === 1 ? "bg-cyan-300 text-neutral-950" : "border border-white/15 text-neutral-400"}`}>
                  {index === 0 && !loading && !missingGroup && !loadError ? "✓" : index + 1}
                </span>
                <div>
                  <p className={`text-sm font-medium ${index === 1 ? "text-white" : "text-neutral-400"}`}>{step}</p>
                  <p className="mt-1 text-xs text-neutral-500">{index === 0 ? missingGroup ? "Needs setup" : loading ? "Checking…" : loadError ? "Unavailable" : "Saved" : index === 1 ? "Current step" : "Coming next"}</p>
                </div>
              </li>
            ))}
          </ol>
          <div className="mt-7 rounded-xl border border-cyan-300/15 bg-cyan-300/5 p-3">
            <p className="text-sm font-medium text-cyan-100">{loading ? "Checking saved locations…" : `${locations.length} of ${expected} planned`}</p>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-label="Location setup progress" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-full rounded-full bg-cyan-300 transition-all" style={{ width: `${progress}%` }} />
            </div>
            <p className="mt-3 text-xs leading-5 text-cyan-100/75">
              {loading || missingGroup || loadError ? "Location details appear when your setup is available." : complete ? "Your planned locations have been entered." : `${remaining} more ${remaining === 1 ? "location" : "locations"} to match your estimate.`}
            </p>
          </div>
        </aside>

        <div className="space-y-6">
          <section className="overflow-hidden rounded-3xl border border-white/10 bg-neutral-950/80 shadow-2xl shadow-black/20">
            <div className="border-b border-white/10 bg-gradient-to-r from-cyan-400/10 via-indigo-400/5 to-transparent p-6 sm:p-9">
              <div className="flex items-center justify-between gap-3">
                <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs font-semibold text-cyan-200">Step 2 of 4</span>
                <span className="text-xs text-neutral-400">Save each location as you go</span>
              </div>
              <h2 className="mt-5 text-2xl font-semibold tracking-tight sm:text-3xl">Your restaurant locations</h2>
              <p className="mt-2 text-sm leading-6 text-neutral-400">
                Start with names your team uses. Addresses and platform connections can be refined later.
              </p>
            </div>

            {loading ? (
              <div className="p-8 text-sm text-neutral-400" role="status">Loading your saved locations…</div>
            ) : loadError ? (
              <div className="space-y-4 p-8" role="alert">
                <p className="text-sm text-rose-200">{loadError}</p>
                <button type="button" onClick={() => setRetry(value => value + 1)} className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black">Try again</button>
              </div>
            ) : missingGroup ? (
              <div className="space-y-4 p-8">
                <p className="text-sm text-amber-200">Save your restaurant details before adding locations.</p>
                <Link href="/onboarding" className="inline-flex rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black">Go to restaurant setup</Link>
              </div>
            ) : (
              <div className="space-y-7 p-6 sm:p-9">
                <div aria-live="polite" role="status" className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-neutral-300">
                  {complete
                    ? `You've entered ${locations.length} ${locations.length === 1 ? "location" : "locations"}. Your location list is saved.`
                    : `You've entered ${locations.length} ${locations.length === 1 ? "location" : "locations"}. Add ${remaining} more to match your estimate.`}
                </div>
                {notice && <p className="rounded-xl border border-cyan-300/20 bg-cyan-300/5 p-4 text-sm text-cyan-100" role="status" aria-live="polite">{notice}</p>}
                <div>
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-base font-semibold">Saved locations</h3>
                    <span className="text-xs text-neutral-500">{locations.length} active</span>
                  </div>
                  {locations.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-white/15 p-6 text-sm text-neutral-400">No locations added yet. Your first location takes less than a minute.</p>
                  ) : (
                    <ul className="space-y-3">
                      {locations.map((location, index) => (
                        <li key={location.id} className="rounded-2xl border border-white/10 bg-white/[0.025] p-4 sm:p-5">
                          {editingId === location.id ? (
                            <form className="space-y-5" onSubmit={event => void updateLocation(event)}>
                              <div className="text-sm font-semibold text-cyan-200">Edit location {index + 1}</div>
                              <LocationFields value={editDraft} onChange={setEditDraft} prefix={`edit-${location.id}`} disabled={busy} />
                              <div className="flex flex-wrap gap-3">
                                <button type="submit" disabled={busy || Boolean(validate(editDraft))} className="rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-black disabled:opacity-40">{busy ? "Saving…" : "Save changes"}</button>
                                <button type="button" disabled={busy} onClick={() => setEditingId(null)} className="rounded-xl border border-white/15 px-5 py-2.5 text-sm text-neutral-300">Cancel</button>
                              </div>
                            </form>
                          ) : (
                            <div className="flex flex-wrap items-start justify-between gap-4">
                              <div className="flex min-w-0 items-start gap-3">
                                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 text-xs font-semibold text-neutral-300">{index + 1}</span>
                                <div className="min-w-0">
                                  <p className="break-words font-semibold text-white">{location.name}</p>
                                  <p className="mt-1 text-sm text-neutral-400">{displayPlace(location)}</p>
                                  <p className="mt-2 text-xs text-neutral-500">Added manually · Not yet matched to Google or Square</p>
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <button type="button" disabled={busy} onClick={() => beginEdit(location)} className="rounded-xl border border-white/15 px-3 py-2 text-xs font-medium text-neutral-200 hover:bg-white/10 disabled:opacity-50">Edit</button>
                                <button type="button" disabled={busy} onClick={() => void archiveLocation(location)} className="rounded-xl border border-rose-300/20 px-3 py-2 text-xs font-medium text-rose-200 hover:bg-rose-300/10 disabled:opacity-50">Remove</button>
                              </div>
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <form className="space-y-5 border-t border-white/10 pt-7" onSubmit={event => void addLocation(event)}>
                  <div>
                    <h3 className="text-lg font-semibold">Add a location</h3>
                    <p className="mt-2 text-sm text-neutral-400">Each location is saved separately, so you can safely return later.</p>
                  </div>
                  <LocationFields value={draft} onChange={setDraft} prefix="add-location" disabled={busy || locations.length >= 100} />
                  <div className="flex flex-wrap items-center gap-3">
                    <button type="submit" disabled={busy || locations.length >= 100 || Boolean(validate(draft))} className="rounded-xl bg-white px-6 py-3 text-sm font-semibold text-black transition hover:bg-cyan-100 disabled:cursor-not-allowed disabled:opacity-40">{busy ? "Saving…" : "Save location"}</button>
                    <p className="text-xs text-neutral-500">Saved directly to your Staging account during testing.</p>
                  </div>
                </form>
              </div>
            )}
          </section>

          <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-5 sm:p-6">
            <p className="text-sm font-semibold text-white">Coming next: connect your tools</p>
            <p className="mt-2 text-sm leading-6 text-neutral-400">
              We'll guide you through Google Business Profile and Square. Adding locations here does not mean those platforms are connected or your data is ready.
            </p>
            <Link href="/onboarding/connections" className="mt-4 inline-flex rounded-xl border border-cyan-300/30 px-4 py-2.5 text-sm font-semibold text-cyan-100 hover:bg-cyan-300/10">
              Review connections and readiness
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
