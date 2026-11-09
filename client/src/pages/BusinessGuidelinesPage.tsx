import { Link } from "react-router-dom";
import { LegalPageLayout, type LegalSection } from "../components/legal/LegalPageLayout";

const sections: LegalSection[] = [
  {
    id: "who-for",
    heading: "Who business accounts are for",
    content: (
      <>
        <p>
          Business accounts are for established communities and the people who run them. Roleplay servers,
          departments, media teams and development studios that serve the ER:LC community. They get a dedicated
          profile, collaborator access so a whole team can post from one account, and a business badge.
        </p>
        <p>
          Every application is reviewed by Socially staff. Meeting the requirements below does not guarantee
          approval, and we can decline or remove a business account at any time.
        </p>
      </>
    ),
  },
  {
    id: "requirements",
    heading: "Requirements",
    content: (
      <>
        <p>You must meet all of these before you apply.</p>
        <ul>
          <li>
            <strong>A permanent Discord invite.</strong> Your application starts with an invite link to your server.
            It must never expire, or we can't verify it. We check it automatically when you apply and staff
            check it again during review.
          </li>
          <li>
            <strong>Related to ERLC content.</strong> The server must be built around Emergency Response: Liberty
            County. Roleplay, community, media, development, or services for ERLC players.
          </li>
          <li>
            <strong>500 members minimum.</strong> We read the member count straight from your invite. Servers under
            500 members are rejected automatically, and inflated counts from bots or member-boosting services are
            grounds for removal.
          </li>
          <li>
            <strong>Good activity.</strong> Real, consistent conversation from real members. A large but dead server
            won't be approved.
          </li>
          <li>
            <strong>Professional staff.</strong> An active staff team that moderates the server, handles reports, and
            treats members respectfully.
          </li>
          <li>
            <strong>Good standing.</strong> The server and the applicant must follow Discord's Terms of Service
            and Socially's <Link to="/terms">Terms of Service</Link>.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "how-to-apply",
    heading: "How to apply",
    content: (
      <>
        <ul>
          <li>Apply from your personal account, in Settings &rarr; Business.</li>
          <li>Paste your permanent Discord invite. We verify the server and its member count on the spot.</li>
          <li>Confirm you meet each requirement, then add your business name, bio, logo, and banner.</li>
          <li>Staff review the application and you'll get a notification either way.</li>
        </ul>
        <p>
          One Discord server can back only one business account. If your server is already tied to an application,
          yours will be declined.
        </p>
      </>
    ),
  },
  {
    id: "running",
    heading: "Running your business account",
    content: (
      <ul>
        <li>Represent your business honestly, don't impersonate another server, brand, or person.</li>
        <li>Keep your name, logo, and bio accurate and appropriate.</li>
        <li>You're responsible for everything your collaborators post from the account.</li>
        <li>No spam, engagement farming, scams, or paid-promotion schemes.</li>
        <li>Don't sell, transfer, or rent the account to anyone else.</li>
      </ul>
    ),
  },
  {
    id: "enforcement",
    heading: "Enforcement",
    content: (
      <>
        <p>
          If a business account breaks these guidelines, we may remove the badge, suspend the account, or delete it.
          Serious or repeated violations can also affect the owner's personal account. If your server drops
          below the requirements after approval, we may ask you to fix it or close the business account.
        </p>
        <p>
          Questions or think we got a decision wrong? Reach out to Socially staff and we'll take another look.
        </p>
      </>
    ),
  },
];

export default function BusinessGuidelinesPage() {
  return <LegalPageLayout title="Business Guidelines" updated="August 2, 2026" sections={sections} />;
}
