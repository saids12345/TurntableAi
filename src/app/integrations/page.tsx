// src/app/integrations/page.tsx
"use client";

import {
  Suspense,
  useEffect,
  useState,
} from "react";

import {
  useSearchParams,
} from "next/navigation";

type GoogleStatus = {
  loading: boolean;
  connected: boolean;
  locationCount: number;
  accountName: string | null;
  alertEmail: string | null;
  error: boolean;
};

type SquareStatus = {
  loading: boolean;
  connected: boolean;
  locationCount: number;
  lastSyncedAt: string | null;
  error: boolean;
};

function formatSquareLastSyncedAt(
  value: string | null,
) {
  if (!value) {
    return "Not yet synced";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return "Unavailable";
  }

  return date.toLocaleString();
}

function IntegrationsContent() {
  const q =
    useSearchParams();

  const [googleStatus, setGoogleStatus] = useState<GoogleStatus>({
    loading: true,
    connected: false,
    locationCount: 0,
    accountName: null,
    alertEmail: null,
    error: false,
  });
  const [googleAlertEmail, setGoogleAlertEmail] = useState("");
  const [googleBusy, setGoogleBusy] = useState(false);
  const [googleMessage, setGoogleMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadGoogle() {
      try {
        const response = await fetch("/api/google/connection", { cache: "no-store" });
        if (!response.ok) throw new Error("Google status failed");
        const json = await response.json() as {
          connected?: boolean;
          locationCount?: number;
          accountName?: string | null;
          alertEmail?: string | null;
        };
        if (cancelled) return;
        setGoogleStatus({
          loading: false,
          connected: json.connected === true,
          locationCount: typeof json.locationCount === "number" ? json.locationCount : 0,
          accountName: typeof json.accountName === "string" ? json.accountName : null,
          alertEmail: typeof json.alertEmail === "string" ? json.alertEmail : null,
          error: false,
        });
        setGoogleAlertEmail(typeof json.alertEmail === "string" ? json.alertEmail : "");
      } catch {
        if (!cancelled) {
          setGoogleStatus(prev => ({ ...prev, loading: false, error: true }));
        }
      }
    }
    void loadGoogle();
    return () => { cancelled = true; };
  }, []);

  async function saveGoogleAlertEmail() {
    setGoogleBusy(true);
    setGoogleMessage(null);
    try {
      const response = await fetch("/api/google/connection", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alertEmail: googleAlertEmail.trim() }),
      });
      if (!response.ok) throw new Error("Save failed");
      const json = await response.json() as { alertEmail?: string };
      const saved = json.alertEmail ?? googleAlertEmail.trim();
      setGoogleAlertEmail(saved);
      setGoogleStatus(prev => ({ ...prev, alertEmail: saved }));
      setGoogleMessage("Review alert email saved.");
    } catch {
      setGoogleMessage("Could not save the alert email. Check the address and try again.");
    } finally {
      setGoogleBusy(false);
    }
  }

  async function disconnectGoogle() {
    if (!window.confirm(
      "Disconnect Google Business Profile? Future review monitoring will stop. " +
      "Previously saved reviews will remain until you request their deletion.",
    )) return;
    setGoogleBusy(true);
    setGoogleMessage(null);
    try {
      const response = await fetch("/api/google/connection", { method: "DELETE" });
      if (!response.ok) throw new Error("Disconnect failed");
      const json = await response.json() as { revocation?: string };
      setGoogleStatus({
        loading: false, connected: false, locationCount: 0,
        accountName: null, alertEmail: null, error: false,
      });
      setGoogleAlertEmail("");
      setGoogleMessage(json.revocation === "unconfirmed"
        ? "Disconnected from TurnTableAI. Google revocation could not be confirmed; revoke access in your Google Account settings."
        : "Google Business Profile disconnected. Review history remains until separately deleted.");
    } catch {
      setGoogleMessage("Could not disconnect Google. Please try again or contact support.");
    } finally {
      setGoogleBusy(false);
    }
  }

  const [
    squareStatus,
    setSquareStatus,
  ] =
    useState<SquareStatus>({
      loading: true,
      connected: false,
      locationCount: 0,
      lastSyncedAt: null,
      error: false,
    });

  useEffect(() => {
    let cancelled = false;

    async function loadSquareStatus() {
      try {
        const response =
          await fetch(
            "/api/square/status",
            {
              cache: "no-store",
            },
          );

        if (!response.ok) {
          throw new Error(
            "Square status request failed.",
          );
        }

        const json =
          (await response.json()) as {
            connected?: boolean;
            locationCount?: number;
            lastSyncedAt?: string | null;
          };

        if (cancelled) {
          return;
        }

        setSquareStatus({
          loading: false,
          connected:
            json.connected === true,
          locationCount:
            typeof json.locationCount ===
            "number"
              ? json.locationCount
              : 0,
          lastSyncedAt:
            typeof json.lastSyncedAt ===
            "string"
              ? json.lastSyncedAt
              : null,
          error: false,
        });
      } catch {
        if (cancelled) {
          return;
        }

        setSquareStatus({
          loading: false,
          connected: false,
          locationCount: 0,
          lastSyncedAt: null,
          error: true,
        });
      }
    }

    void loadSquareStatus();

    return () => {
      cancelled = true;
    };
  }, []);

  const [
    squareDisconnecting,
    setSquareDisconnecting,
  ] = useState(false);

  const [
    squareDisconnectError,
    setSquareDisconnectError,
  ] = useState(false);

  async function disconnectSquare() {
    const confirmed =
      window.confirm(
        "Disconnect Square from TurnTableAI?",
      );

    if (!confirmed) {
      return;
    }

    setSquareDisconnecting(true);
    setSquareDisconnectError(false);

    try {
      const response =
        await fetch(
          "/api/square/disconnect",
          {
            method: "POST",
          },
        );

      if (!response.ok) {
        throw new Error(
          "Square disconnect failed.",
        );
      }

      setSquareStatus({
        loading: false,
        connected: false,
        locationCount: 0,
        lastSyncedAt: null,
        error: false,
      });
    } catch {
      setSquareDisconnectError(true);
    } finally {
      setSquareDisconnecting(false);
    }
  }

  const connected =
    q.get("connected");

  const error =
    q.get("error");

  const squareLocations =
    q.get("locations");

  const notice =
    connected === "square"
      ? `✅ Square connected${
          squareLocations
            ? ` — ${squareLocations} location${
                squareLocations === "1"
                  ? ""
                  : "s"
              }`
            : ""
        }`
      : connected
      ? "✅ Google connected"
      : error
      ? `⚠️ ${error}`
      : "Connect your restaurant platforms so TurnTableAI can work with real operational data.";

  return (
    <div className="min-h-screen w-full px-3 pb-12 pt-10 sm:px-4 md:px-8">
      <div className="mx-auto max-w-2xl rounded-2xl border border-white/10 bg-black/30 p-6 shadow-2xl backdrop-blur">
        <h1 className="text-2xl font-semibold">
          Integrations
        </h1>

        <p className="mt-2 text-white/70">
          {notice}
        </p>

        <div className="mt-6 grid gap-4">
          <div className="rounded-xl border border-white/10 bg-black/40 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="font-medium">Google Business Profile</div>
                <p className="mt-1 text-sm text-white/60">
                  Monitor reviews and receive email alerts on a schedule, not in real time.
                </p>
                {!googleStatus.loading && !googleStatus.error && (
                  <p className="mt-2 text-xs text-white/70">
                    {googleStatus.connected ? "Connected" : "Not connected"}
                  </p>
                )}
              </div>
              {googleStatus.connected ? (
                <div className="flex gap-2">
                  <form action="/api/google/auth/start" method="GET">
                    <button disabled={googleBusy} className="rounded-lg bg-white/10 px-4 py-2 text-sm hover:bg-white/20 disabled:opacity-50">
                      Reconnect
                    </button>
                  </form>
                  <button type="button" onClick={() => void disconnectGoogle()} disabled={googleBusy}
                    className="rounded-lg bg-white/10 px-4 py-2 text-sm hover:bg-white/20 disabled:opacity-50">
                    {googleBusy ? "Working..." : "Disconnect"}
                  </button>
                </div>
              ) : !googleStatus.loading && !googleStatus.error ? (
                <form action="/api/google/auth/start" method="GET">
                  <button className="rounded-lg bg-white/10 px-4 py-2 text-sm hover:bg-white/20">
                    Connect Google
                  </button>
                </form>
              ) : null}
            </div>

            {googleStatus.loading && <p className="mt-3 text-xs text-white/60">Checking Google connection...</p>}
            {googleStatus.error && (
              <p className="mt-3 text-xs text-amber-200">
                Google connection status is unavailable. Refresh before reconnecting.
              </p>
            )}
            {googleStatus.connected && (
              <div className="mt-4 space-y-3">
                <p className="text-xs text-white/60">
                  {googleStatus.locationCount} monitored Google location{googleStatus.locationCount === 1 ? "" : "s"}
                  {googleStatus.accountName ? ` — ${googleStatus.accountName}` : ""}.
                </p>
                {googleStatus.locationCount === 0 && (
                  <p className="text-xs text-amber-200">Connected, but no locations were found. Review alerts require at least one location.</p>
                )}
                <label htmlFor="google-alert-email" className="block text-sm text-white/80">Review alert email</label>
                <div className="flex flex-wrap gap-2">
                  <input id="google-alert-email" type="email" autoComplete="email"
                    value={googleAlertEmail} onChange={e => setGoogleAlertEmail(e.target.value)}
                    disabled={googleBusy} placeholder="owner@restaurant.com"
                    className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm"
                  />
                  <button type="button" onClick={() => void saveGoogleAlertEmail()} disabled={googleBusy}
                    className="rounded-lg bg-white/10 px-4 py-2 text-sm hover:bg-white/20 disabled:opacity-50">
                    Save email
                  </button>
                </div>
                <p className="text-xs text-white/50">Changes apply to future review alerts. No automated reply is posted to Google.</p>
              </div>
            )}
            {googleMessage && <p role="status" className="mt-3 text-xs text-white/70">{googleMessage}</p>}
            {googleMessage?.includes("revocation could not be confirmed") && (
              <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer"
                className="mt-2 inline-block text-xs underline text-white/80">Google account permissions</a>
            )}
          </div>

          <div className="rounded-xl border border-white/10 bg-black/40 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <div className="font-medium">
                    Square POS
                  </div>

                  {!squareStatus.loading &&
                    !squareStatus.error && (
                      <span className="rounded-full border border-white/10 px-2 py-0.5 text-xs text-white/70">
                        {squareStatus.connected
                          ? "Connected"
                          : "Not connected"}
                      </span>
                    )}
                </div>

                <div className="mt-1 text-sm text-white/60">
                  Connect Square so TurnTableAI can securely read trusted sales and order performance.
                </div>
              </div>

              {squareStatus.connected ? (
                <div className="flex gap-2">
                  <form
                    action="/api/square/auth/start"
                    method="GET"
                  >
                    <button className="rounded-lg bg-white/10 px-4 py-2 text-sm hover:bg-white/20">
                      Reconnect
                    </button>
                  </form>

                  <button
                    type="button"
                    onClick={() => {
                      void disconnectSquare();
                    }}
                    disabled={
                      squareDisconnecting
                    }
                    className="rounded-lg border border-white/10 px-4 py-2 text-sm hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {squareDisconnecting
                      ? "Disconnecting..."
                      : "Disconnect"}
                  </button>
                </div>
              ) : (
                <form
                  action="/api/square/auth/start"
                  method="GET"
                >
                  <button className="rounded-lg bg-white/10 px-4 py-2 text-sm hover:bg-white/20">
                    Connect Square
                  </button>
                </form>
              )}
            </div>

            {squareStatus.loading && (
              <p className="mt-3 text-xs text-white/50">
                Checking Square connection…
              </p>
            )}

            {squareStatus.connected && (
              <div className="mt-3 space-y-1 text-xs text-white/60">
                <p>
                  {
                    squareStatus.locationCount
                  }{" "}
                  Square location
                  {squareStatus.locationCount ===
                  1
                    ? ""
                    : "s"}{" "}
                  connected.
                </p>

                <p>
                  Last successful sync:{" "}
                  {formatSquareLastSyncedAt(
                    squareStatus.lastSyncedAt,
                  )}
                </p>
              </div>
            )}

            {squareStatus.error && (
              <p className="mt-3 text-xs text-white/50">
                Square connection status is temporarily unavailable.
              </p>
            )}

            {squareDisconnectError && (
              <p className="mt-3 text-xs text-white/50">
                Square could not be disconnected. Please try again.
              </p>
            )}
          </div>

          <div className="rounded-xl border border-white/10 bg-black/40 p-4">
            <div className="font-medium">
              Yelp
            </div>

            <div className="mt-1 text-sm text-white/60">
              Yelp’s public API doesn’t provide a continuous review feed. We’ll add an official integration later.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function IntegrationsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          Loading...
        </div>
      }
    >
      <IntegrationsContent />
    </Suspense>
  );
}
