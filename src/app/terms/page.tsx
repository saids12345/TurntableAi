// app/terms/page.tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service | TurnTable AI",
  description:
    "The legal terms that govern your use of TurnTable AI, including acceptable use, IP, warranties, liability, and dispute resolution.",
  // Keep this domain consistent with your OAuth consent screen + production app domain.
  alternates: { canonical: "https://app.turntableai.net/terms" },
};

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-16 prose prose-invert prose-headings:font-semibold">
      <h1>Terms of Service</h1>
      <p><strong>Effective date:</strong> {new Date().toLocaleDateString()}</p>

      <p>
        These Terms of Service (“<strong>Terms</strong>”) govern your access to and use of TurnTable AI’s
        websites, products, and services (the “<strong>Services</strong>”). By using the Services, you agree to
        these Terms. If you’re using the Services on behalf of an entity, you represent that you have authority
        to bind that entity to these Terms.
      </p>

      <h2>1) Accounts &amp; eligibility</h2>
      <ul>
        <li>You must be at least 13 years old (or older if required in your jurisdiction).</li>
        <li>Provide accurate information and keep your account secure. You are responsible for all activity under your account.</li>
        <li>If you log in with a third-party identity provider (e.g., Google), you authorize us to receive your basic profile details as described in our <a href="/privacy">Privacy Policy</a>.</li>
      </ul>

      <h2>2) License &amp; access</h2>
      <p>
        Subject to these Terms, we grant you a limited, revocable, non-exclusive, non-transferable license to
        access and use the Services. We may modify or discontinue features with notice where feasible.
      </p>

      <h2>3) Acceptable use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>Violate any law, IP right, or others’ rights; submit or generate unlawful content</li>
        <li>Upload or share personal data you don’t have the right to process</li>
        <li>Attempt to re-identify individuals from anonymized data</li>
        <li>Abuse, probe, or circumvent security; interfere with or disrupt the Services</li>
        <li>Reverse engineer or copy source code except as permitted by law</li>
        <li>Use outputs to create models that compete with our or our providers’ models</li>
        <li>Use the Services to generate spam, malware, or for surveillance without lawful basis</li>
      </ul>

      <h2>4) AI outputs &amp; your content</h2>
      <ul>
        <li><strong>Your inputs &amp; uploads:</strong> You retain ownership of content you submit. You grant us a license to process, host, and display that content as needed to operate the Services.</li>
        <li><strong>AI outputs:</strong> Subject to third-party terms, you may use, reproduce, modify, and distribute outputs for your lawful purposes. Outputs may be similar for different users.</li>
        <li><strong>No professional advice:</strong> Outputs may be incomplete, inaccurate, or out-of-date and are provided “as is.” You’re responsible for validating results and complying with applicable laws.</li>
      </ul>

      <h2>5) Third-party services</h2>
      <p>Some features rely on third parties (e.g., hosting, authentication, analytics, AI model APIs, payment providers). We’re not responsible for third-party products, terms, or policies.</p>

      <h2>6) Plans, fees &amp; taxes (if applicable)</h2>
      <ul>
        <li>Some features may require a paid plan. Prices and features are shown at purchase time.</li>
        <li>Fees are non-refundable except where required by law or explicitly stated otherwise.</li>
        <li>Applicable taxes may be charged and are your responsibility.</li>
      </ul>

      <h2>7) Google API Services &amp; Limited Use</h2>
      <p>
        If you connect your Google account, the Services may request the scope <code>https://www.googleapis.com/auth/business.manage</code> to:
      </p>
      <ul>
        <li>List your Google Business Profile (GBP) accounts/locations you own;</li>
        <li>Fetch public review data for those locations to provide alerts and reply suggestions.</li>
      </ul>
      <p>
        Our use and transfer to any other app of information received from Google APIs will adhere to the{" "}
        <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer">
          Google API Services User Data Policy
        </a>, including the <strong>Limited Use</strong> requirements. We do not sell or use GBP data for ads or for profiling; we transfer it only as necessary to provide the Services, comply with law, or with your direction.
      </p>
      <p>
        You may revoke our access at any time via Google’s security settings at{" "}
        <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer">
          myaccount.google.com/permissions
        </a>. On disconnection or verified deletion request, we remove stored Google tokens and associated review records as described in our <a href="/data-deletion">Data Deletion</a> page.
      </p>
      <p>Google, Google Business Profile, and related marks are trademarks of Google LLC.</p>

      <h2>8) Intellectual property</h2>
      <p>
        We and our licensors own all rights, title, and interest in and to the Services, including software,
        design, and trademarks. Except for the limited license above, no rights are granted. You may provide
        feedback; we can use it without restriction or obligation.
      </p>

      <h2>9) Confidentiality</h2>
      <p>If you receive non-public information from us that is marked confidential or would reasonably be considered confidential, you must keep it confidential and use it only as permitted by these Terms.</p>

      <h2>10) Termination</h2>
      <ul>
        <li>You may stop using the Services at any time and request account deletion.</li>
        <li>We may suspend or terminate access if you breach these Terms, create risk or legal exposure, or if we discontinue a feature or the Services. Upon termination, the license in Section 2 ends.</li>
      </ul>

      <h2>11) Disclaimers</h2>
      <p>
        THE SERVICES AND ALL OUTPUTS ARE PROVIDED “AS IS” AND “AS AVAILABLE.” TO THE MAXIMUM EXTENT PERMITTED BY
        LAW, WE DISCLAIM ALL WARRANTIES, EXPRESS OR IMPLIED, INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR
        PURPOSE, AND NON-INFRINGEMENT. WE DO NOT GUARANTEE ACCURACY, RELIABILITY, OR AVAILABILITY.
      </p>

      <h2>12) Limitation of liability</h2>
      <p>
        TO THE MAXIMUM EXTENT PERMITTED BY LAW, IN NO EVENT WILL WE BE LIABLE FOR INDIRECT, INCIDENTAL, SPECIAL,
        CONSEQUENTIAL, EXEMPLARY, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS, DATA, OR GOODWILL. OUR AGGREGATE
        LIABILITY FOR ALL CLAIMS WILL NOT EXCEED THE AMOUNT YOU PAID US IN THE 12 MONTHS BEFORE THE EVENT
        (OR USD $100 IF YOU HAVE NOT PAID).
      </p>

      <h2>13) Indemnification</h2>
      <p>You agree to defend, indemnify, and hold harmless TurnTable AI and its affiliates, officers, employees, and agents from claims arising from your use of the Services or violation of these Terms.</p>

      <h2>14) Governing law &amp; disputes</h2>
      <p>
        These Terms are governed by the laws of the State of [Your State], excluding conflict-of-law rules. You
        agree to the exclusive jurisdiction and venue of the courts located in [Your County/State], unless
        applicable law requires otherwise. (If you prefer arbitration, replace this section with your arbitration clause.)
      </p>

      <h2>15) Changes</h2>
      <p>We may update these Terms. We’ll post updates with a new effective date and provide notice of material changes when required. Continued use after the effective date constitutes acceptance.</p>

      <h2>16) Contact</h2>
      <p>Questions? Contact <a href="mailto:legal@turntableai.net">legal@turntableai.net</a>.</p>

      <hr />
      <p className="text-xs opacity-70">
        These Terms are a robust template and not legal advice. Consider counsel to tailor governing law, consumer notices, billing terms, and dispute process.
      </p>
    </main>
  );
}
