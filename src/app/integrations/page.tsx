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

  const [email, setEmail] =
    useState(
      "owner@example.com",
    );

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
                <div className="font-medium">
                  Google Business Profile
                </div>

                <div className="text-sm text-white/60">
                  Connect your Google listing to get email alerts for new reviews.
                </div>
              </div>

              <form
                action="/api/google/auth/start"
                method="GET"
              >
                <input
                  type="hidden"
                  name="email"
                  value={email}
                />

                <button className="rounded-lg bg-white/10 px-4 py-2 text-sm hover:bg-white/20">
                  Connect
                </button>
              </form>
            </div>

            <div className="mt-3">
              <label className="block text-sm text-white/80">
                Alert email (where notifications go)
              </label>

              <input
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm"
                value={email}
                onChange={(e) =>
                  setEmail(
                    e.target.value,
                  )
                }
                placeholder="owner@restaurant.com"
              />

              <p className="mt-1 text-xs text-white/50">
                Tip: use a shared inbox like managers@…
              </p>
            </div>

            <div className="mt-4 flex gap-2">
            <button
                onClick={async () => {
                  const r =
                    await fetch(
                      "/api/google/poll",
                      {
                        method:
                          "POST",
                      },
                    );

                  const j =
                    await r.json();

                  alert(
                    `Polled. Emails sent: ${
                      j.sent ?? 0
                    }`,
                  );
                }}
                className="rounded-lg border border-white/10 px-4 py-2 text-sm hover:bg-white/10"
              >
                Test poll now
              </button>
            </div>
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
