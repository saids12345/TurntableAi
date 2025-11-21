// app/privacy/page.tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | TurnTable AI",
  description:
    "How TurnTable AI collects, uses, and protects your information, plus your choices and rights under global privacy laws.",
  // ⬇️ Use your production domain here. Keep it consistent with the OAuth Consent Screen.
  alternates: { canonical: "https://app.turntableai.net/privacy" },
};

export default function PrivacyPolicyPage() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-16 prose prose-invert prose-headings:font-semibold">
      <h1>Privacy Policy</h1>
      <p><strong>Effective date:</strong> {new Date().toLocaleDateString()}</p>

      <p>
        This Privacy Policy explains how <strong>TurnTable AI</strong> (“<strong>we</strong>,” “<strong>us</strong>,”
        “<strong>our</strong>”) collects, uses, discloses, and protects personal information when you use our
        websites, products, and services (the “<strong>Services</strong>”). By using the Services, you agree to this Policy.
      </p>

      <h2>1) Who we are</h2>
      <p>
        Controller: <strong>TurnTable AI</strong><br />
        Website: <a href="https://turntableai.net">turntableai.net</a><br />
        Contact: <a href="mailto:privacy@turntableai.net">privacy@turntableai.net</a><br />
        Postal Address: 123 Example St, City, State/Region, Country
      </p>

      <h2>2) Scope</h2>
      <p>
        This Policy applies to personal information we process about visitors, account holders, prospective
        customers, and end users. It does not cover third-party websites, services, or integrations not operated by us.
      </p>

      <h2>3) Information we collect</h2>
      <ul>
        <li><strong>Account &amp; profile data:</strong> name, display name, email address, avatar, organization/role, settings.</li>
        <li><strong>Authentication data:</strong> identifiers and basic profile data received from your identity provider (e.g., Google OAuth).
          We do <em>not</em> receive your password.</li>
        <li><strong>Content you submit:</strong> prompts/inputs/files/feedback and generated outputs.</li>
        <li><strong>Usage &amp; device data:</strong> logs, pages viewed, features used, referral URL, timestamps, IP address, approximate location (derived from IP), browser/OS, device identifiers, diagnostics.</li>
        <li><strong>Cookies &amp; similar tech:</strong> session cookies, authentication tokens, analytics and preference cookies (see “Cookies” below).</li>
        <li><strong>Payments (if applicable):</strong> billing name/email and transaction metadata handled by our payment provider; we don’t store full card numbers.</li>
        <li><strong>Support communications:</strong> messages you send us and metadata needed to respond.</li>
      </ul>

      <h3>Google Business Profile (GBP) data we access via Google APIs</h3>
      <p>
        If you connect your Google account, we request the scope <code>https://www.googleapis.com/auth/business.manage</code> to access:
      </p>
      <ul>
        <li><strong>GBP account and location metadata</strong> you own (e.g., account/location IDs, names/titles).</li>
        <li><strong>Public review data</strong> for those locations (e.g., review ID, star rating, text, reviewer display name if available, create/update timestamps).</li>
      </ul>
      <p>We do <strong>not</strong> access Google Ads data, personal Gmail, or unrelated Google user data.</p>

      <h2>4) How we use information</h2>
      <ul>
        <li>Provide, operate, and improve the Services</li>
        <li>Authenticate users and secure accounts</li>
        <li>Personalize features and remember preferences</li>
        <li>Measure engagement, debug, monitor uptime, and prevent abuse</li>
        <li>Provide customer support and respond to requests</li>
        <li>Send service-related communications (e.g., security, changes)</li>
        <li>Comply with legal obligations and enforce our <a href="/terms">Terms of Service</a></li>
        <li>With consent, send optional product updates and marketing (opt-out anytime)</li>
      </ul>

      <h3>Specific uses for Google Business Profile data</h3>
      <ul>
        <li>List your GBP locations so you can choose what to monitor</li>
        <li>Fetch new reviews to send email alerts/notifications</li>
        <li>Generate editable, on-brand reply suggestions for those reviews</li>
      </ul>

      <h3>Legal bases for processing (GDPR/UK GDPR)</h3>
      <ul>
        <li><strong>Performance of a contract</strong> (to provide the Services you request)</li>
        <li><strong>Legitimate interests</strong> (security, analytics, improvement)</li>
        <li><strong>Consent</strong> (e.g., certain cookies/marketing; connecting your GBP account)</li>
        <li><strong>Legal obligation</strong> (record-keeping, compliance)</li>
      </ul>

      <h2>5) AI &amp; model providers</h2>
      <p>
        When you use AI features, your inputs and relevant context may be sent to model providers (e.g., OpenAI,
        Anthropic, or Google) to generate outputs. We apply appropriate technical and contractual safeguards. We
        do <strong>not</strong> sell your prompts or outputs. Providers may retain limited logs for abuse detection and
        reliability per their policies.
      </p>

      <h2>6) When we share information</h2>
      <ul>
        <li><strong>Service providers/sub-processors</strong> (hosting, authentication, analytics, email, payments, error monitoring, AI APIs) under appropriate agreements.</li>
        <li><strong>Legal &amp; safety</strong> (lawful requests; protection of rights or safety).</li>
        <li><strong>Business transfers</strong> (merger, acquisition, financing, or sale of assets with standard protections).</li>
        <li><strong>With your direction</strong> (e.g., third-party integrations you connect).</li>
      </ul>

      <h2>7) International data transfers</h2>
      <p>
        We may transfer and process information outside your country/region. Where required, we rely on lawful mechanisms (e.g., EU Standard Contractual Clauses) and apply safeguards.
      </p>

      <h2>8) Retention</h2>
      <p>
        We keep personal information only as long as necessary for the purposes described here. For GBP
        connections, we store OAuth tokens (access/refresh), connected location IDs/titles, and “last-seen”
        timestamps for reviews. We may store minimal review fields to display recent activity. You can disconnect
        at any time and request deletion as below.
      </p>

      <h2>9) Security</h2>
      <p>
        We use reasonable technical and organizational measures (encrypted transport, least-privilege access,
        environment isolation, monitoring). No system is 100% secure; please use strong passwords and protect your credentials.
      </p>

      <h2>10) Your rights &amp; choices</h2>
      <ul>
        <li><strong>Access, correction, deletion</strong>—request a copy, fix inaccuracies, or ask us to delete your information.</li>
        <li><strong>Portability</strong>—receive data in a portable format where feasible.</li>
        <li><strong>Objection/restriction</strong>—object to or restrict certain processing.</li>
        <li><strong>Marketing</strong>—opt out of non-essential emails anytime.</li>
        <li><strong>Cookies</strong>—manage via browser/system settings; see “Cookies.”</li>
      </ul>
      <p>
        To exercise rights, contact <a href="mailto:privacy@turntableai.net">privacy@turntableai.net</a>. We may
        need to verify your request. Residents of the EEA/UK/California and certain US states have additional
        rights under local law, which we honor where applicable.
      </p>

      <h3>California (CCPA/CPRA) disclosures</h3>
      <ul>
        <li>We do <strong>not</strong> sell personal information for money.</li>
        <li>We do not knowingly “share” personal information for cross-context behavioral advertising.</li>
        <li>You can request access, correction, deletion, or to limit the use of sensitive personal information by emailing <a href="mailto:privacy@turntableai.net">privacy@turntableai.net</a>.</li>
      </ul>

      <h2>11) Cookies &amp; similar technologies</h2>
      <p>
        We use strictly necessary cookies (security/session), functional cookies (preferences), and analytics
        cookies (to understand usage and improve the product). You can block/delete cookies in your browser; some
        features may not work without them.
      </p>
      <ul>
        <li><strong>Essential:</strong> session token, CSRF, auth state</li>
        <li><strong>Functional:</strong> theme, locale, UI preferences</li>
        <li><strong>Analytics:</strong> privacy-respecting analytics for traffic/performance (not for ad profiling)</li>
      </ul>

      <h2>12) Google API Services User Data Policy (Limited Use)</h2>
      <p>
        TurnTable AI’s use and transfer to any other app of information received from Google APIs will adhere to
        the <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer">
        Google API Services User Data Policy</a>, including the Limited Use requirements. We use GBP data solely
        to provide the features described above; we do not transfer it to third parties except as necessary to
        provide the Services, comply with law, or with your direction. We do not serve ads based on GBP data.
      </p>

      <h2>13) Disconnecting Google &amp; data deletion</h2>
      <p>
        You can disconnect Google anytime in the app (Integrations → Disconnect). To request deletion of your
        account data, follow the steps at <a href="/data-deletion">/data-deletion</a> or email
        {" "}<a href="mailto:support@turntableai.net">support@turntableai.net</a>. We remove Google tokens and
        stored review records associated with your account within 30 days, subject to legal retention obligations.
      </p>

      <h2>14) Children’s privacy</h2>
      <p>
        The Services are not directed to children under 13 (or the age required in your jurisdiction). If you
        believe a child has provided personal information, contact us to request deletion.
      </p>

      <h2>15) Changes to this Policy</h2>
      <p>
        We may update this Policy to reflect changes in our practices or legal requirements. We will post the
        updated version and change the “Effective date.” Material changes may be communicated via the Services or email.
      </p>

      <h2>16) Contact</h2>
      <p>Questions or requests: <a href="mailto:privacy@turntableai.net">privacy@turntableai.net</a></p>

      <hr />
      <p className="text-xs opacity-70">
        This Privacy Policy is provided for general informational purposes and does not constitute legal advice.
      </p>
    </main>
  );
}
