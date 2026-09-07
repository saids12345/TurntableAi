import Link from "next/link";

export const dynamic = "force-dynamic";

export default function UpgradePage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-3xl font-semibold">Upgrade to continue</h1>
      <p className="mt-3 text-base text-neutral-600">
        Your 14-day trial has ended (or you’re not on an active subscription).
        Upgrade to unlock TurnTableAI features again.
      </p>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/billing"
          className="rounded-lg bg-black px-5 py-3 text-white hover:opacity-90"
        >
          Go to Billing
        </Link>

        <Link
          href="/"
          className="rounded-lg border px-5 py-3 hover:bg-neutral-50"
        >
          Back to home
        </Link>
      </div>

      <div className="mt-10 rounded-xl border p-5">
        <h2 className="text-lg font-medium">What you get</h2>
        <ul className="mt-3 list-disc pl-5 text-neutral-700 space-y-2">
          <li>All features unlocked</li>
          <li>Monthly plan: $100</li>
          <li>Cancel anytime</li>
        </ul>
      </div>
    </main>
  );
}
