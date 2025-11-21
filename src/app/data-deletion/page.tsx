// src/app/data-deletion/page.tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Data Deletion | TurnTable AI",
  description: "How to disconnect Google and request deletion of your TurnTable AI account data.",
  alternates: { canonical: "https://app.turntableai.net/data-deletion" },
};

export default function DataDeletionPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16 prose prose-invert prose-headings:font-semibold">
      <h1>Data Deletion</h1>
      <p>Here’s how to remove your data from TurnTable AI.</p>

      <h2>Disconnect Google</h2>
      <ol>
        <li>In the app, go to <strong>Integrations</strong> → <strong>Disconnect</strong> (Google Business Profile).</li>
        <li>
          Or revoke access directly in your Google Account:{" "}
          <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer">
            myaccount.google.com/permissions
          </a>.
        </li>
      </ol>

      <h2>Request account deletion</h2>
      <p>
        Email <a href="mailto:support@turntableai.net">support@turntableai.net</a> from the address linked to your
        account with the subject “Account Deletion Request.” We’ll confirm and remove:
      </p>
      <ul>
        <li>Google OAuth tokens and connected location IDs</li>
        <li>Stored review records associated with your account</li>
        <li>Profile and usage records not required for legal or financial compliance</li>
      </ul>
      <p>We complete deletion within <strong>30 days</strong>, subject to legal retention obligations.</p>

      <h2>Questions</h2>
      <p>Contact <a href="mailto:privacy@turntableai.net">privacy@turntableai.net</a>.</p>
    </main>
  );
}
