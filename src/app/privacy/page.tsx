import { LegalShell } from "@/components/layout/legal-shell";

export default function PrivacyPage() {
  return (
    <LegalShell title="Privacy Policy">
      <p>
        SLOP (“we”) operates a short-form drama entertainment website. This
        policy explains what we collect and why.
      </p>
      <h2>What we collect</h2>
      <ul>
        <li>Account data you provide (email, display name, avatar).</li>
        <li>
          Engagement events such as views, likes, saves, comments, and reports.
        </li>
        <li>
          Subscription and billing metadata from Stripe (never raw card numbers).
        </li>
        <li>Technical logs needed to secure and operate the service.</li>
      </ul>
      <h2>How we use data</h2>
      <p>
        To operate the drama catalog and episode feed, personalize optional
        account features, process Premium subscriptions, prevent abuse, and
        improve the product.
      </p>
      <h2>Your choices</h2>
      <p>
        You may update profile settings, cancel Premium, and request account
        deletion from your account page.
      </p>
      <h2>Contact</h2>
      <p>
        Contact privacy requests from your Account page, or use the support
        address configured for this deployment.
      </p>
    </LegalShell>
  );
}
