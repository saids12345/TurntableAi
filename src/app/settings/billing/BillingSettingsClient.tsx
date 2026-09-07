// src/app/settings/billing/BillingSettingsClient.tsx
"use client";

import { useEffect, useMemo, useState } from "react";

type Props = {
  authed: boolean;
  isPro?: boolean;
  stripeStatus?: string | null;
  nextPath?: string; // where to go after unlocking (optional)
};

export default function BillingSettingsClient({
  authed,
  isPro = false,
  stripeStatus = null,
  nextPath = "/",
}: Props) {
  const [loading, setLoading] = useState<"checkout" | "portal" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const safeNext = nextPath.startsWith("/") ? nextPath : "/";

  const settingsBillingPath = useMemo(() => {
    return `/settings/billing?next=${encodeURIComponent(safeNext)}`;
  }, [safeNext]);

  const loginRedirect = useMemo(() => {
    return `/login?redirect=${encodeURIComponent(settingsBillingPath)}`;
  }, [settingsBillingPath]);

  const canOpenPortal = authed && !!stripeStatus;

  // Read Stripe return flags from URL
  const [stripeReturn, setStripeReturn] = useState<{
    success: boolean;
    canceled: boolean;
  }>({ success: false, canceled: false });

  useEffect(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      setStripeReturn({
        success: sp.get("success") === "1",
        canceled: sp.get("canceled") === "1",
      });
    } catch {
      // ignore
    }
  }, []);

  /**
   * If we came back from Stripe successfully but profile hasn't updated yet
   * (webhook delay), refresh a few times.
   */
  useEffect(() => {
    if (!authed) return;

    if (isPro) {
      try {
        sessionStorage.removeItem("tt_settings_billing_refresh_count");
      } catch {}
      return;
    }

    if (!stripeReturn.success) {
      try {
        sessionStorage.removeItem("tt_settings_billing_refresh_count");
      } catch {}
      return;
    }

    let count = 0;
    try {
      count = Number(
        sessionStorage.getItem("tt_settings_billing_refresh_count") ?? "0"
      );
    } catch {}

    if (count >= 6) return;

    try {
      sessionStorage.setItem(
        "tt_settings_billing_refresh_count",
        String(count + 1)
      );
    } catch {}

    const t = setTimeout(() => {
      window.location.reload();
    }, 2000);

    return () => clearTimeout(t);
  }, [authed, isPro, stripeReturn.success]);

  /**
   * Optional: after they become Pro, send them back to where they came from
   */
  useEffect(() => {
    if (!authed) return;
    if (!isPro) return;

    try {
      sessionStorage.removeItem("tt_settings_billing_refresh_count");
    } catch {}

    if (!safeNext || safeNext === "/" || safeNext === "/settings/billing") return;

    const currentPath =
      typeof window !== "undefined" ? window.location.pathname : "";
    if (safeNext === currentPath) return;

    window.location.replace(safeNext);
  }, [authed, isPro, safeNext]);

  async function startTrial() {
    try {
      setError(null);
      setLoading("checkout");

      const res = await fetch("/api/stripe/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ next: safeNext }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.status === 401) {
        window.location.href = loginRedirect;
        return;
      }

      if (res.status === 409) {
        setError(
          data?.error || "You already have a subscription. Use Manage billing."
        );
        return;
      }

      if (!res.ok) {
        const detail =
          data?.error ||
          data?.message ||
          `Server returned ${res.status} ${res.statusText}`;
        throw new Error(detail);
      }

      if (!data?.url) {
        throw new Error("Server responded ok but did not include Stripe url");
      }

      // reset refresh counter before leaving
      try {
        sessionStorage.removeItem("tt_settings_billing_refresh_count");
      } catch {}

      window.location.href = data.url;
    } catch (e: any) {
      setError(e?.message || "Something went wrong");
    } finally {
      setLoading(null);
    }
  }

  async function openPortal() {
    try {
      setError(null);
      setLoading("portal");

      const res = await fetch("/api/stripe/create-portal-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ returnUrl: window.location.href }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.status === 401) {
        window.location.href = loginRedirect;
        return;
      }

      if (!res.ok || !data?.url) {
        throw new Error(
          data?.error ||
            data?.message ||
            `Failed to create portal session (${res.status})`
        );
      }

      window.location.href = data.url;
    } catch (e: any) {
      setError(e?.message || "Something went wrong");
    } finally {
      setLoading(null);
    }
  }

  function refreshAccessNow() {
    try {
      sessionStorage.setItem("tt_settings_billing_refresh_count", "0");
    } catch {}
    window.location.reload();
  }

  return (
    <div className="flex flex-col gap-3">
      {!authed ? (
        <a
          href={loginRedirect}
          className="inline-flex items-center justify-center rounded-xl bg-white text-black px-4 py-3 font-medium"
        >
          Sign in to manage billing
        </a>
      ) : isPro ? (
        <button
          onClick={openPortal}
          disabled={loading !== null}
          className="inline-flex items-center justify-center rounded-xl bg-white text-black px-4 py-3 font-medium disabled:opacity-60"
        >
          {loading === "portal" ? "Opening billing portal..." : "Manage billing"}
        </button>
      ) : (
        <>
          <button
            onClick={startTrial}
            disabled={loading !== null}
            className="inline-flex items-center justify-center rounded-xl bg-white text-black px-4 py-3 font-medium disabled:opacity-60"
          >
            {loading === "checkout"
              ? "Redirecting to Stripe..."
              : "Start 14-day free trial ($100/mo after)"}
          </button>

          {canOpenPortal && (
            <button
              onClick={openPortal}
              disabled={loading !== null}
              className="inline-flex items-center justify-center rounded-xl border border-white/20 bg-black/40 px-4 py-3 font-medium disabled:opacity-60"
            >
              {loading === "portal"
                ? "Opening billing portal..."
                : "Manage billing"}
            </button>
          )}

          {stripeReturn.success && (
            <div className="rounded-xl border border-white/10 bg-black/30 p-3 text-xs text-white/70">
              Stripe checkout returned successfully — syncing access…
              <div className="mt-2">
                If this doesn’t unlock within a few seconds, click{" "}
                <button
                  onClick={refreshAccessNow}
                  className="underline underline-offset-2"
                >
                  Refresh access
                </button>
                .
              </div>
            </div>
          )}

          {stripeReturn.canceled && (
            <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-3 text-xs text-yellow-200">
              Checkout canceled. You can start the trial again anytime.
            </div>
          )}

          <p className="text-xs text-white/60">
            Card required to start trial. Cancel anytime in the billing portal.
          </p>
        </>
      )}

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
          {error}
        </div>
      )}
    </div>
  );
}
