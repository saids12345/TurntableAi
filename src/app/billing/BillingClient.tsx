// src/app/billing/BillingClient.tsx
"use client";

import { useEffect, useMemo, useState } from "react";

type Props = {
  authed: boolean;
  email: string | null;
  isPro: boolean;
  plan?: string;
  stripeStatus?: string | null;
  currentPeriodEnd?: string | null;
  nextPath?: string;
};

function formatDateMaybe(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// ✅ LOCK on past_due
function isAllowedStripeStatus(status?: string | null) {
  return status === "trialing" || status === "active";
}

export default function BillingClient({
  authed,
  email,
  isPro,
  plan,
  stripeStatus,
  currentPeriodEnd,
  nextPath = "/",
}: Props) {
  const [loading, setLoading] = useState<"checkout" | "portal" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const safeNext = nextPath.startsWith("/") ? nextPath : "/";

  const billingPathWithNext = useMemo(() => {
    return `/billing?next=${encodeURIComponent(safeNext)}`;
  }, [safeNext]);

  const loginRedirect = useMemo(() => {
    return `/login?redirect=${encodeURIComponent(billingPathWithNext)}`;
  }, [billingPathWithNext]);

  // If we have any Stripe record, portal can usually open
  const canOpenPortal = authed && (!!stripeStatus || isPro);

  const planLabel = (plan ?? "free").toString();
  const statusLabel = stripeStatus ?? "—";

  const periodLabel = useMemo(() => {
    if (!stripeStatus || !currentPeriodEnd) return "—";
    const when = formatDateMaybe(currentPeriodEnd);

    if (stripeStatus === "trialing") return `Trial ends ${when}`;
    if (stripeStatus === "active") return `Renews on ${when}`;
    if (stripeStatus === "past_due") return `Past due since ${when}`;
    return when;
  }, [stripeStatus, currentPeriodEnd]);

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

  useEffect(() => {
    if (!authed) return;
    if (isPro) {
      try {
        sessionStorage.removeItem("tt_billing_refresh_count");
      } catch {}
      return;
    }
    if (!stripeReturn.success) {
      try {
        sessionStorage.removeItem("tt_billing_refresh_count");
      } catch {}
      return;
    }

    let count = 0;
    try {
      count = Number(
        sessionStorage.getItem("tt_billing_refresh_count") ?? "0"
      );
    } catch {}

    if (count >= 6) return;

    try {
      sessionStorage.setItem("tt_billing_refresh_count", String(count + 1));
    } catch {}

    const t = setTimeout(() => {
      window.location.reload();
    }, 2000);

    return () => clearTimeout(t);
  }, [authed, isPro, stripeReturn.success]);

  const [showSuccess, setShowSuccess] = useState(false);
  useEffect(() => {
    if (!stripeReturn.success) return;
    if (!authed) return;
    if (!isPro) return;

    try {
      const key = "tt_billing_success_shown";
      const already = sessionStorage.getItem(key) === "1";
      if (already) return;
      sessionStorage.setItem(key, "1");
    } catch {
      // ignore
    }

    setShowSuccess(true);
    const t = setTimeout(() => setShowSuccess(false), 4500);
    return () => clearTimeout(t);
  }, [stripeReturn.success, authed, isPro]);

  useEffect(() => {
    if (!authed) return;
    if (!isPro) return;

    try {
      sessionStorage.removeItem("tt_billing_refresh_count");
    } catch {}

    const currentPath =
      typeof window !== "undefined" ? window.location.pathname : "";

    if (!safeNext || safeNext === "/" || safeNext === "/billing") return;
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

      try {
        sessionStorage.removeItem("tt_billing_refresh_count");
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
      sessionStorage.setItem("tt_billing_refresh_count", "0");
    } catch {}
    window.location.reload();
  }

  const alreadyHasAccessByStripe = isAllowedStripeStatus(stripeStatus);

  const proBullets = [
    "AI review replies (unlimited)",
    "Social captions & reels ideas",
    "Sales recap & forecasting",
    "Integrations + alerts (when connected)",
  ];

  const isPastDue = stripeStatus === "past_due";

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-6">
      <div className="w-full max-w-xl rounded-2xl border border-white/10 bg-black/30 p-6 shadow-lg">
        <h1 className="text-2xl font-semibold">Billing</h1>
        <p className="mt-1 text-sm text-white/70">
          Your plan is controlled by Stripe. Trial users have full access.
        </p>

        {showSuccess && (
          <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-200">
            🎉 Trial started — you now have full access.
          </div>
        )}

        <div className="mt-4 rounded-xl border border-white/10 p-4">
          <div className="text-sm text-white/70">Account</div>
          <div className="mt-1 text-base">
            {authed ? email ?? "Logged in" : "Not signed in"}
          </div>

          <div className="mt-4 grid gap-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-white/70">Plan</span>
              <span className="text-white/90 capitalize">{planLabel}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-white/70">Access</span>
              <span className={isPro ? "text-emerald-400" : "text-red-400"}>
                {isPro ? "Unlocked (Trial/Paid)" : "Locked"}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-white/70">Stripe status</span>
              <span className="text-white/90">{statusLabel}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-white/70">Trial / renewal</span>
              <span className="text-white/90">{periodLabel}</span>
            </div>

            <div className="mt-3 rounded-lg border border-white/10 bg-black/30 p-3 text-xs text-white/70">
              <div className="font-medium text-white/80">Pro unlocks:</div>
              <ul className="mt-2 list-disc space-y-1 pl-4">
                {proBullets.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            </div>

            {!isPro && authed && (
              <div
                className={`mt-2 rounded-lg p-3 text-xs ${
                  isPastDue
                    ? "border border-yellow-500/30 bg-yellow-500/10 text-yellow-200"
                    : "border border-white/10 bg-black/30 text-white/70"
                }`}
              >
                {stripeReturn.success ? (
                  <>
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
                  </>
                ) : alreadyHasAccessByStripe ? (
                  <>
                    Your Stripe account already shows an active trial/subscription.
                    Use <span className="text-white/90">Manage billing</span> to
                    update payment method or cancel.
                  </>
                ) : isPastDue ? (
                  <>
                    Your payment is past due, so access is currently locked.
                    Update your billing details to restore Pro access.
                  </>
                ) : stripeStatus ? (
                  <>
                    Your Stripe subscription exists, but access is currently
                    locked. Please update billing to restore access.
                  </>
                ) : (
                  "You're not on an active trial/subscription yet. Start a trial to unlock all features."
                )}
              </div>
            )}

            {stripeReturn.canceled && (
              <div className="mt-2 rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3 text-xs text-yellow-200">
                Checkout canceled. No worries — you can start the trial again
                anytime.
              </div>
            )}
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
            {error}
          </div>
        )}

        <div className="mt-5 flex flex-col gap-3">
          {!authed ? (
            <a
              href={loginRedirect}
              className="inline-flex items-center justify-center rounded-xl bg-white px-4 py-3 font-medium text-black"
            >
              Sign in to continue
            </a>
          ) : isPro ? (
            <button
              onClick={openPortal}
              disabled={loading !== null}
              className="inline-flex items-center justify-center rounded-xl bg-white px-4 py-3 font-medium text-black disabled:opacity-60"
            >
              {loading === "portal"
                ? "Opening billing portal..."
                : "Manage billing"}
            </button>
          ) : (
            <>
              {alreadyHasAccessByStripe ? (
                <button
                  onClick={openPortal}
                  disabled={loading !== null}
                  className="inline-flex items-center justify-center rounded-xl bg-white px-4 py-3 font-medium text-black disabled:opacity-60"
                >
                  {loading === "portal"
                    ? "Opening billing portal..."
                    : "Manage billing"}
                </button>
              ) : (
                <button
                  onClick={startTrial}
                  disabled={loading !== null}
                  className="inline-flex items-center justify-center rounded-xl bg-white px-4 py-3 font-medium text-black disabled:opacity-60"
                >
                  {loading === "checkout"
                    ? "Redirecting to Stripe..."
                    : "Start 14-day free trial ($100/mo after)"}
                </button>
              )}

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

              <p className="text-xs text-white/60">
                Card required to start trial. Cancel anytime in the billing
                portal.
              </p>

              <a
                href="/settings/billing"
                className="text-xs text-white/60 underline underline-offset-2"
              >
                Billing settings →
              </a>
            </>
          )}
        </div>
      </div>
    </div>
  );
}