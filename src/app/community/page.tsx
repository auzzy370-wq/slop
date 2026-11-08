import { LegalShell } from "@/components/layout/legal-shell";

export default function CommunityGuidelinesPage() {
  return (
    <LegalShell title="Community Guidelines">
      <p>
        SLOP is for discovering and discussing short-form dramas — not
        harassment or illegal content.
      </p>
      <h2>Do</h2>
      <ul>
        <li>Watch, share, and discuss published dramas in good faith.</li>
        <li>Report spam, abuse, or policy concerns.</li>
        <li>Respect other viewers in comments.</li>
      </ul>
      <h2>Don’t</h2>
      <ul>
        <li>Post illegal, exploitative, or deceptive content in comments.</li>
        <li>Harass, threaten, or impersonate others.</li>
        <li>Attempt to upload or generate videos — that is not available.</li>
        <li>Game ranking, spam reports, or evade bans.</li>
      </ul>
      <h2>Enforcement</h2>
      <p>
        Moderators may remove comments, disable commenting, suspend accounts, or
        unpublish content. Appeal from Account → request help, or email the
        address listed in site settings when configured.
      </p>
    </LegalShell>
  );
}
