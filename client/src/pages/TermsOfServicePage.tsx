import { Link } from "react-router-dom";
import { LegalPageLayout, type LegalSection } from "../components/legal/LegalPageLayout";

const intro = (
  <>
    <p>
      In these Terms of Service, <strong>"Socially,"</strong> <strong>"we,"</strong>{" "}
      <strong>"us,"</strong> and <strong>"our"</strong> refer to Socially. These terms are
      the agreement between you and Socially for your use of the service.
    </p>
    <p className="mt-3">
      Please read them carefully. They cover your account, your content, what's allowed, and the legal terms
      that apply.
    </p>
  </>
);

const sections: LegalSection[] = [
  {
    id: "acceptance",
    heading: "Acceptance of terms",
    content: (
      <p>
        By creating an account or using Socially, you agree to these Terms of Service and our{" "}
        <Link to="/privacy">Privacy Policy</Link>. If you don't agree, please don't use Socially.
      </p>
    ),
  },
  {
    id: "your-account",
    heading: "Your account",
    content: (
      <>
        <p>
          You sign in to Socially with Discord, and you're responsible for the activity on your account. You
          must be at least 13 years old to use Socially. You may link up to one personal and one professional account
          to the same Discord account. Keep your login secure and let us know if you believe your account has been
          compromised.
        </p>
        <p>
          If we learn or have reason to believe that an account belongs to someone under 13, we'll suspend or
          terminate that account and remove the associated content. If you believe this was done in error, contact{" "}
          <a href="mailto:support@socially.lol">support@socially.lol</a>.
        </p>
      </>
    ),
  },
  {
    id: "third-party-services",
    heading: "Third-party services",
    content: (
      <p>
        Socially depends on third-party services to operate, including Discord for sign-in. When you use Discord to
        sign in, you're also subject to Discord's own terms and privacy policy, and your ability to use
        Socially depends on your Discord account remaining in good standing. Community owners may also connect a
        Discord webhook, which delivers new posts in that community to a Discord channel of the owner's choosing;
        the owner is responsible for the channel it's connected to, and posts sent this way are subject to
        Discord's terms and policies. We aren't responsible for the
        availability or conduct of Discord or any other third-party service we rely on. See our{" "}
        <Link to="/privacy">Privacy Policy</Link> for the full list of third-party services we use and what they do.
      </p>
    ),
  },
  {
    id: "your-content",
    heading: "Your content",
    content: (
      <p>
        You own the posts, stories, and other content you share on Socially. By posting, you grant us a license to
        host, display, and distribute that content on Socially so we can operate the service. You're
        responsible for what you post and for having the rights to share it.
      </p>
    ),
  },
  {
    id: "your-data",
    heading: "Your data",
    content: (
      <p>
        We collect, store, and use information about you and your use of Socially as described in our{" "}
        <Link to="/privacy">Privacy Policy</Link>, which explains what we collect, how it's stored, how we use
        it, and the controls and rights you have over it.
      </p>
    ),
  },
  {
    id: "copyright",
    heading: "Copyright (DMCA)",
    content: (
      <p>
        If you believe content on Socially infringes your copyright, you can submit a takedown request through our{" "}
        <Link to="/copyright">Copyright request form</Link>. We review valid requests and remove infringing content
        when appropriate. We may also terminate the accounts of users who are repeat infringers.
      </p>
    ),
  },
  {
    id: "prohibited-content",
    heading: "What you can't post",
    content: (
      <>
        <p>Don't post content that:</p>
        <ul>
          <li>Is illegal, or that facilitates illegal activity.</li>
          <li>
            Sexualizes minors in any way. We have zero tolerance for this: we immediately remove the content,
            terminate the account, and cooperate with law enforcement.
          </li>
          <li>Depicts or threatens serious violence, or promotes terrorism.</li>
          <li>
            Is hate speech, or targets someone based on a protected characteristic like race, religion, gender,
            sexual orientation, or disability.
          </li>
          <li>
            Harasses, bullies, threatens, or doxxes another person, including sharing someone's private
            information without their consent.
          </li>
          <li>Impersonates another person, brand, or organization in a misleading way.</li>
          <li>Infringes someone else's copyright, trademark, or other intellectual property rights.</li>
          <li>Is spam, a scam, or otherwise deceptive, including fake engagement or coordinated inauthentic behavior.</li>
          <li>Contains malware or is designed to compromise another user's device or account.</li>
        </ul>
      </>
    ),
  },
  {
    id: "prohibited-conduct",
    heading: "What you can't do",
    content: (
      <>
        <p>Don't:</p>
        <ul>
          <li>Access, or attempt to access, accounts, data, or systems that aren't yours.</li>
          <li>Circumvent rate limits, or use bots, scrapers, or other automated means to abuse the service.</li>
          <li>Create a new account to evade a suspension or ban.</li>
          <li>Buy, sell, or transfer your account to someone else.</li>
          <li>Attempt to disrupt or interfere with Socially's infrastructure or security.</li>
          <li>Use Socially to violate any applicable law.</li>
        </ul>
      </>
    ),
  },
  {
    id: "enforcement",
    heading: "Enforcement",
    content: (
      <p>
        We may remove content, suspend, or ban accounts that violate these terms, based on our own review, reports
        from other users, or automated screening of posted content. To help identify abusive or automated behavior,
        we log identifying request information (such as IP address and browser/device information) when rate limits
        are exceeded or other abuse signals are detected. Community owners and staff may set additional rules for
        their own communities, including group chats hosted within them, and verified professional accounts must
        follow any additional rules that apply to them.
      </p>
    ),
  },
  {
    id: "appeals",
    heading: "Appeals",
    content: (
      <p>
        If your account or content is suspended, banned, or removed and you believe this was a mistake, you can
        appeal by emailing <a href="mailto:support@socially.lol">support@socially.lol</a> with your username and the
        reason you believe the action was incorrect. We review appeals but aren't obligated to reverse any
        decision.
      </p>
    ),
  },
  {
    id: "professional-accounts",
    heading: "Professional and verified accounts",
    content: (
      <p>
        Socially offers two kinds of account verification: global verification, reviewed by Socially staff and shown
        across the whole platform, and community verification, reviewed by the staff of an individual community and
        shown only within that community. A community's owner can configure the follower threshold and whether
        community verification is invite-only, application-only, or both. Professional accounts and both kinds of
        verification are subject to review, and we may approve, reject, or revoke status at our discretion.
      </p>
    ),
  },
  {
    id: "termination",
    heading: "Termination",
    content: (
      <p>
        You may deactivate your account at any time from Settings. We may suspend or terminate accounts that violate
        these terms or for any other reason, with or without notice.
      </p>
    ),
  },
  {
    id: "disclaimers",
    heading: "Disclaimers",
    content: (
      <p>
        Socially is provided "as is" without warranties of any kind. We don't guarantee that the
        service will be uninterrupted, secure, or error-free.
      </p>
    ),
  },
  {
    id: "liability",
    heading: "Limitation of liability",
    content: (
      <>
        <p>
          To the maximum extent permitted by law, Socially, and anyone who develops, maintains, or operates it,
          won't be liable for any indirect, incidental, special, consequential, or punitive damages, or any
          loss of profits, data, goodwill, or other intangible losses, arising from your use of or inability to use
          Socially, even if we've been advised of the possibility of those damages.
        </p>
        <p>
          To the maximum extent permitted by law, our total liability for any claim arising out of or relating to
          these terms or Socially is limited to the greater of (a) the amount you paid us, if any, in the 12 months
          before the claim arose, or (b) $100.
        </p>
        <p>
          These limits apply regardless of the legal theory the claim is based on. Some jurisdictions don't
          allow the exclusion or limitation of certain damages, so some of the limits above may not apply to you.
        </p>
      </>
    ),
  },
  {
    id: "indemnification",
    heading: "Indemnification",
    content: (
      <p>
        You agree to indemnify and hold harmless Socially, and anyone who develops, maintains, or operates it, from
        any claims, damages, losses, or expenses (including reasonable legal fees) arising from your use of Socially,
        your content, or your violation of these terms.
      </p>
    ),
  },
  {
    id: "governing-law",
    heading: "Governing law and venue",
    content: (
      <p>
        These terms are governed by the laws of the State of Delaware, without regard to its conflict of laws rules.
        Any dispute arising out of or relating to these terms or Socially will be brought exclusively in the state or
        federal courts located in Delaware, and you consent to the personal jurisdiction of those courts.
      </p>
    ),
  },
  {
    id: "general",
    heading: "General terms",
    content: (
      <p>
        If any part of these terms is found unenforceable, the rest will remain in effect. These terms, together with
        our <Link to="/privacy">Privacy Policy</Link>, are the entire agreement between you and Socially about your
        use of the service. Our failure to enforce any part of these terms isn't a waiver of our right to do so
        later. You may not assign these terms without our consent; we may assign them freely.
      </p>
    ),
  },
  {
    id: "changes",
    heading: "Changes to these terms",
    content: (
      <p>
        We may update these Terms of Service from time to time. Continued use of Socially after changes take effect
        means you accept the updated terms.
      </p>
    ),
  },
  {
    id: "contact",
    heading: "Contact us",
    content: (
      <p>
        If you have questions about these Terms of Service, email us at{" "}
        <a href="mailto:legal@socially.lol">legal@socially.lol</a>. For help with your account, contact{" "}
        <a href="mailto:support@socially.lol">support@socially.lol</a> or reach out through our Discord server.
      </p>
    ),
  },
];

export default function TermsOfServicePage() {
  return <LegalPageLayout title="Terms of Service" updated="August 10, 2026" intro={intro} sections={sections} />;
}
