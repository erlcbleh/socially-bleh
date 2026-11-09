import { Link } from "react-router-dom";
import { LegalPageLayout, type LegalSection } from "../components/legal/LegalPageLayout";

const intro = (
  <>
    <p>
      In this Privacy Policy, <strong>"Socially,"</strong> <strong>"we,"</strong>{" "}
      <strong>"us,"</strong> and <strong>"our"</strong> refer to Socially. This policy
      explains what information we collect, why we collect it, who we share it with, and the choices and rights you
      have.
    </p>
    <p className="mt-3">
      We've tried to keep it plain and specific. If anything is unclear, email us at{" "}
      <a href="mailto:legal@socially.lol">legal@socially.lol</a>.
    </p>
  </>
);

const sections: LegalSection[] = [
  {
    id: "information-we-collect",
    heading: "Information we collect",
    content: (
      <>
        <p>
          <strong>Account and profile.</strong> You sign in with Discord. When you do, we receive your Discord user
          ID, username, and avatar. We don't request your email address. You also provide profile details such
          as your display name, bio, and interests.
        </p>
        <p>
          <strong>Content you create.</strong> As you use Socially we store the content you create, including posts,
          stories, story replies and reactions (which are delivered as direct messages), group chats, direct
          messages, favorited GIFs, follows, likes, bookmarks, and reports. Stories are automatically deleted a set
          time after you post them.
        </p>
        <p>
          <strong>Applications you submit.</strong> If you apply for or are invited to global or community
          verification, set up a professional account, or apply to join our team, we store the information you
          submit, such as your reason for applying and the position and department you're applying for.
        </p>
        <p>
          <strong>Activity and technical data.</strong> We record when you were last active so we can show an online
          indicator to other members of a community, and to help keep the service secure. When you make a request to
          Socially, we also log technical information such as your IP address and browser/device (user-agent)
          information, which we use to enforce rate limits and identify abusive or automated behavior.
        </p>
        <p>
          <strong>Sign-up and log-in IP address.</strong> When you sign up or log in, we store the IP address used
          for that request in a hashed (one-way, non-reversible) form and associate it with your account. We use
          this to enforce account bans and suspensions at the network level, and to check the address against a
          third-party service (proxycheck.io) that flags known VPNs, proxies, and anonymizing networks. See
          "Abuse prevention and automated decisions" below.
        </p>
        <p>
          <strong>Copyright requests.</strong> If you submit a copyright takedown request, we collect the name,
          email address, and other details you provide in that form, even if you don't have a Socially account.
        </p>
        <p>
          <strong>Cookies.</strong> We use a small number of cookies that are strictly necessary to keep you signed
          in and to keep Socially secure. We don't use cookies for advertising or cross-site tracking.
        </p>
      </>
    ),
  },
  {
    id: "how-we-use",
    heading: "How we use your information, and our legal bases",
    content: (
      <>
        <p>We use the information above to:</p>
        <ul>
          <li>Operate and maintain your account and the features you use, including posts, stories, group chats, and messaging.</li>
          <li>
            Personalize what you see, such as your For You feed and suggested accounts to follow. This uses signals
            like your selected interests, who you follow, and the posts and accounts you've liked or engaged
            with.
          </li>
          <li>Review and process professional account, global verification, and community verification requests.</li>
          <li>
            Detect, investigate, and act on reports, spam, and rule violations, including the automated content
            screening described in "Automated content screening" and the abuse prevention described in
            "Abuse prevention and automated decisions."
          </li>
          <li>
            Review reports, including reports about direct messages and group chats. When a message is reported or
            automatically flagged, a snapshot of that message's text is included in the report so a member of
            our staff can review it.
          </li>
          <li>Show an approximate online/offline status to other members of a community you're in.</li>
          <li>
            For professional accounts, measure profile views, post impressions, and link/profile clicks. These are
            shown to the account owner as totals only, never as a list of who viewed or clicked. Individual viewer
            identities are not available to the account owner through these analytics.
          </li>
        </ul>
        <p>Where the GDPR or UK GDPR applies to you, we rely on these legal bases:</p>
        <ul>
          <li>
            <strong>Performance of our contract with you</strong>, to create and operate your account and
            provide the features you use, including hosting your content and delivering your messages.
          </li>
          <li>
            <strong>Our legitimate interests</strong>, to personalize your experience, measure
            professional-account analytics, keep Socially secure, and detect and prevent spam, fraud, and abuse.
            Where we rely on legitimate interests, we balance them against your rights, and you can object as
            described in "Your privacy rights."
          </li>
          <li>
            <strong>Compliance with a legal obligation</strong>, to respond to copyright takedown notices,
            valid legal requests, and other obligations that apply to us.
          </li>
          <li>
            <strong>Consent</strong>, where we specifically ask for it. You can withdraw consent at any time.
          </li>
        </ul>
        <p>We don't use your information for advertising, and we don't sell it.</p>
      </>
    ),
  },
  {
    id: "automated-screening",
    heading: "Automated content screening (OpenAI)",
    content: (
      <>
        <p>
          To help keep Socially safe, some of the content on the platform is automatically screened for material
          that may violate our rules. This screening is performed by OpenAI, acting as our service provider.
        </p>
        <p>
          <strong>What is screened.</strong> We may send the following to OpenAI for screening: the text of posts,
          stories, direct messages, and group chats; and images and video frames from posts and stories. Images and
          video frames are prepared for screening through Cloudinary (see "Third-party services").
        </p>
        <p>
          <strong>Why.</strong> The purpose is limited to checking content against our rules so we can detect
          material such as illegal content, sexual content involving minors, and other serious violations. Our legal
          basis is our legitimate interest in keeping the service and its users safe, and, where applicable,
          compliance with our legal obligations.
        </p>
        <p>
          <strong>Human access.</strong> The screening itself is automated. If content is flagged, it may then be
          reviewed by our staff as part of investigating a report or violation, as described in "Abuse
          prevention and automated decisions" and "How we store direct messages and group chats."
        </p>
        <p>
          <strong>OpenAI's own handling.</strong> OpenAI processes this content on our behalf to perform the
          screening, under its own applicable terms. We don't control, and this policy doesn't describe,
          how OpenAI retains data or whether it is used to train models; for that, refer to OpenAI's own
          policies.
        </p>
      </>
    ),
  },
  {
    id: "abuse-prevention",
    heading: "Abuse prevention and automated decisions",
    content: (
      <>
        <p>
          When you sign up or log in, we check the IP address used for that request against proxycheck.io, a
          third-party service that identifies known VPNs, proxies, and anonymizing networks. We send that IP address
          to proxycheck.io for this check. We also compare the address against accounts that have been banned or
          suspended.
        </p>
        <p>
          If your address is flagged as a VPN/proxy, or is associated with a banned or suspended account, we may
          automatically block the sign-up or log-in and show you an error. This is an automated decision made to
          prevent ban evasion, spam, and abuse.
        </p>
        <p>
          If you believe you were blocked in error (for example, a false positive from a shared or mobile network),
          you can ask us to review the decision by emailing{" "}
          <a href="mailto:support@socially.lol">support@socially.lol</a>. A person will review your request.
        </p>
      </>
    ),
  },
  {
    id: "third-party-services",
    heading: "Third-party services",
    content: (
      <>
        <p>
          We rely on a small number of outside services to run Socially. Some act as our service providers
          (processors), handling data only on our instructions and for the purposes we set. Others are independent
          third parties that handle your data under their own privacy policies.
        </p>
        <p>
          <strong>Service providers (processing on our behalf):</strong>
        </p>
        <ul>
          <li>Cloudflare, to store and serve the images and videos you upload, using Cloudflare R2 storage and its CDN.</li>
          <li>
            Cloudinary, to serve some previously uploaded media and to prepare images and video frames for the
            automated screening in "Automated content screening."
          </li>
          <li>OpenAI, to automatically screen content as described in "Automated content screening."</li>
          <li>proxycheck.io, to check sign-up and log-in IP addresses as described in "Abuse prevention and automated decisions."</li>
        </ul>
        <p>
          <strong>Independent third parties (under their own policies):</strong>
        </p>
        <ul>
          <li>
            Discord, to let you sign in, to notify our team about staff applications, and, where a community owner
            chooses to connect a Discord webhook, to deliver new community posts to that Discord channel. Your use
            of Discord is governed by Discord's own terms and privacy policy.
          </li>
          <li>
            Giphy, to power GIF search in the composer. When you search for GIFs, your search is handled by
            Giphy under its own privacy policy.
          </li>
        </ul>
        <p>
          <strong>Community Discord webhooks.</strong> Community owners can connect a Discord webhook so that new
          posts in their community are delivered to a Discord channel. When a webhook is connected, we store the
          webhook URL and the name of the Discord channel, and we send the text of new posts in that community
          (including links to any media) to Discord as webhook messages. The webhook is used only for that purpose
          and is cleared when community ownership is transferred or the community is deleted.
        </p>
        <p>
          Content you post publicly, such as your profile, posts, and stories, is visible to other users according
          to your privacy settings. We don't sell your personal information. We may share information when
          required to comply with the law or to protect the rights and safety of our users, the public, or Socially.
        </p>
      </>
    ),
  },
  {
    id: "messaging-storage",
    heading: "How we store direct messages and group chats",
    content: (
      <>
        <p>
          Direct messages and group chats are stored on our servers as plain text. They are{" "}
          <strong>not end-to-end encrypted</strong>, which means Socially is technically able to access message
          content, for example, to display your conversations to you, run the automated screening in
          "Automated content screening," and investigate reports.
        </p>
        <p>
          We don't routinely read your messages. Members of our development and moderation team may access
          message content only when it's necessary to investigate a report, respond to a user-submitted or
          automatically-flagged violation, fix a technical problem, or otherwise operate and secure the service.
          Access is limited to what's needed for that work.
        </p>
      </>
    ),
  },
  {
    id: "your-controls",
    heading: "Your controls",
    content: (
      <p>
        You can make your account private, hide your following list, restrict who can message you, block or mute
        other users, and delete individual posts at any time from within Socially. You can deactivate your account
        from Settings, which hides your profile and content until you log back in. To permanently delete your
        account, see "Data retention and deletion."
      </p>
    ),
  },
  {
    id: "your-rights",
    heading: "Your privacy rights",
    content: (
      <>
        <p>
          If the GDPR or UK GDPR applies to you (for example, because you're in the EEA, UK, or Switzerland),
          you have the right to:
        </p>
        <ul>
          <li>Access the personal information we hold about you.</li>
          <li>Correct inaccurate or incomplete information.</li>
          <li>Request erasure of your information.</li>
          <li>Restrict or object to our processing, including processing based on our legitimate interests.</li>
          <li>Receive a copy of your information in a portable format.</li>
          <li>Withdraw consent at any time, where we rely on consent.</li>
          <li>Not be subject to certain solely automated decisions (see "Abuse prevention and automated decisions").</li>
          <li>Lodge a complaint with your local data protection authority.</li>
        </ul>
        <p>
          If you're a California resident, the CCPA/CPRA gives you the right to know what personal information
          we've collected, used, and disclosed about you; to delete it; to correct inaccurate information; to
          opt out of the sale or sharing of personal information (we don't sell or share personal information
          for cross-context behavioral advertising); and to not be discriminated against for exercising these
          rights.
        </p>
        <p>
          If you're located elsewhere, local law may give you similar rights. Wherever you are, you can
          exercise many of these rights directly within Socially, as described in "Your controls" and
          "Data retention and deletion," or by emailing{" "}
          <a href="mailto:legal@socially.lol">legal@socially.lol</a>. We may need to verify your identity before
          completing a request, and we'll respond within the time required by applicable law.
        </p>
      </>
    ),
  },
  {
    id: "international-transfers",
    heading: "International data transfers",
    content: (
      <>
        <p>
          Socially's servers are located in the United States, and the third-party services we rely on (see
          "Third-party services") are based in the United States or operate globally, including through
          content delivery networks. If you're accessing Socially from outside the United States, your
          information will be transferred to, stored, and processed in the United States, which may not have the same
          data protection laws as your country.
        </p>
        <p>
          Where we transfer personal data out of the EEA, UK, or Switzerland, we take steps to protect it as
          required by applicable law, including by relying on appropriate safeguards such as the European
          Commission's Standard Contractual Clauses (and the UK International Data Transfer Addendum) where they
          apply. You can ask us for more information about these safeguards by emailing{" "}
          <a href="mailto:legal@socially.lol">legal@socially.lol</a>.
        </p>
      </>
    ),
  },
  {
    id: "retention",
    heading: "Data retention and deletion",
    content: (
      <>
        <p>
          We keep your information for as long as your account is active. If you deactivate your account, your data
          is retained so you can reactivate by logging back in.
        </p>
        <p>
          You can permanently delete your account and associated data at any time from Settings. When you do, we
          remove your profile, posts, stories, messages, and other associated content from our active systems.
          Please note:
        </p>
        <ul>
          <li>
            <strong>Backups.</strong> Copies of some data may remain in routine, secured backups for a limited period
            until those backups are overwritten in the ordinary course, after which they are removed.
          </li>
          <li>
            <strong>Third-party systems.</strong> Media served through our providers (such as Cloudflare and
            Cloudinary caches) may take a short time to fully clear after deletion.
          </li>
          <li>
            <strong>Security logs.</strong> Security logs used to detect abuse (such as the hashed IP address and
            user-agent information tied to rate-limit or spam flags) are kept separately for a limited time,
            currently up to 90 days, before being automatically deleted.
          </li>
          <li>
            <strong>Legal retention.</strong> We may retain certain information for longer where we're required
            to by law, or where it's necessary to resolve disputes, enforce our terms, or protect against fraud
            and abuse, including records needed to keep a banned or suspended account from returning.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "childrens-privacy",
    heading: "Children's privacy",
    content: (
      <>
        <p>
          You must be at least 13 years old to use Socially, and Socially is not directed at children under 13. We
          don't knowingly collect personal information from anyone under 13.
        </p>
        <p>
          Some countries set a higher minimum age for consenting to online services under the GDPR or UK GDPR (up to
          16). If you live in one of those countries, you must meet that higher age, or have the consent of a parent
          or guardian, to use Socially.
        </p>
        <p>
          If we learn or have reason to believe that an account belongs to someone below the applicable minimum age,
          we'll suspend or terminate that account and remove the associated content. If you're a parent
          or guardian and believe your child has provided us information, or if you believe an account was actioned
          in error, contact <a href="mailto:support@socially.lol">support@socially.lol</a>. See also our{" "}
          <Link to="/terms">Terms of Service</Link>.
        </p>
      </>
    ),
  },
  {
    id: "changes",
    heading: "Changes to this policy",
    content: (
      <p>
        We may update this Privacy Policy from time to time. If we make material changes, we'll let you know
        through Socially before they take effect. The "Last updated" date at the top shows when this
        policy was last revised.
      </p>
    ),
  },
  {
    id: "contact",
    heading: "Contact us",
    content: (
      <p>
        If you have questions about this Privacy Policy, or want to exercise your rights over your data, email us at{" "}
        <a href="mailto:legal@socially.lol">legal@socially.lol</a>. For anything else, contact{" "}
        <a href="mailto:support@socially.lol">support@socially.lol</a> or reach out through our Discord server.
      </p>
    ),
  },
];

export default function PrivacyPolicyPage() {
  return <LegalPageLayout title="Privacy Policy" updated="August 11, 2026" intro={intro} sections={sections} />;
}
