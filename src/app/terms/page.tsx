import { LegalShell } from "@/components/layout/legal-shell";

export default function TermsPage() {
  return (
    <LegalShell title="Terms of Service">
      <p>Last updated: October 30, 2026</p>
      <h2>The service</h2>
      <p>
        SLOP provides a short-form drama entertainment platform. Users cannot
        upload videos or generate AI videos through the website. Only authorized
        administrators publish dramas and episodes.
      </p>
      <h2>Accounts</h2>
      <p>
        Browsing does not require an account. Interactive features (likes,
        saves, comments, reports) require sign-in.
      </p>
      <h2>Premium</h2>
      <p>
        Premium is a monthly subscription priced at $7.99 unless changed by the
        operator. Premium removes advertisements and may include a badge and
        priority access to new features when available. Cancel anytime. Access
        follows verified Stripe subscription status.
      </p>
      <h2>Acceptable use</h2>
      <ul>
        <li>No illegal, exploitative, or abusive behavior.</li>
        <li>No spam, scraping abuse, or attempts to bypass security.</li>
        <li>No impersonation or deceptive misuse of the platform.</li>
      </ul>
      <h2>Contact</h2>
      <p>
        Questions about these terms: contact support from your Account page, or
        use the address configured for this deployment.
      </p>
    </LegalShell>
  );
}
