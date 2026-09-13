/**
 * Privacy Policy — /privacy. Static server component so the page is visible
 * (and indexable) without logging in. Also used as the consent-screen link.
 */

import type { Metadata } from "next";
import Link from "next/link";
import LegalLayout from "@/components/LegalLayout";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Catarina's privacy policy — what we store and how your data is handled.",
};

const sections = [
  {
    title: "Introduction",
    body: "This policy explains what Catarina collects, why, how long we keep it, and the choices you have. You'll find it referenced throughout the app — every place that gathers your data points here.",
  },
  {
    title: "Information we collect",
    body: "Account details: your full name, email address, a securely hashed password, and an optional profile picture. The team and sections you belong to, and your role. Content you create: goals, milestones, steps, comments, notes, and anything you put into The Drawers (drawers, envelopes, and files, including their names and content). Google Drive connection: if you connect your Google account to back up The Drawers, we store the account email and the OAuth tokens needed to sync — encrypted at rest before they are ever saved.",
  },
  {
    title: "Why we use it",
    body: "Your data has one job: making the app work for your team. We render your dashboards, keep goals and drawing cups in sync across team members, send you the notifications you ask for, and back up The Drawers to your Google Drive when you choose to connect it. We do not use your content for advertising, training models, or any purpose you didn't ask for.",
  },
  {
    title: "Cookies & local storage",
    body: "We use standard session cookies and local browser storage so you stay signed in and your preferences (appearance theme, which features you've already seen) are remembered on your device. These are essential to how the app works — nothing here is used for third-party tracking.",
  },
  {
    title: "Third-party services",
    body: "Catarina runs on a few infrastructure providers: our data is stored in a cloud database (Turso) and the app is served by our hosting provider (Vercel). When you connect Google Drive, files you place in The Drawers are stored by Google under your own account, which is subject to Google Cloud's own terms and privacy policy. We share only the minimum data each provider needs to run their service.",
  },
  {
    title: "Sharing within your team",
    body: "Goals, milestones, comments, and the drawers you place in shared spaces are visible to the other members of your team. Connecting The Drawers to Google Drive creates a root folder named “Catarina” that is shared with your teammates so everyone works on the same drawers. Whatever you store stays inside your team — we never transfer your data to anyone else outside these providers.",
  },
  {
    title: "How long we keep it",
    body: "We keep your account and its content for as long as your account is active. Files you keep in the shared Drive folder remain there under your Google account even after you stop using the app. We don't hold any copy of your Drive content outside the app's own database, apart from the connection tokens needed to access it.",
  },
  {
    title: "Your rights and choices",
    body: "You can review and edit your own profile at any time. You can rename or delete the content you create (deleting a drawer item in the app moves it to your Drive trash, from where it's recoverable until emptied). You can disconnect Google Drive from The Drawers page — we then delete the stored tokens. You may also ask your team administrator to delete your account; when the data is requested we remove your profile and connections. You can withdraw consent or exercise any of these rights by contacting the team that manages your workspace.",
  },
  {
    title: "Children",
    body: "Catarina is intended for teams and workplaces. We don't knowingly collect information from children, and if we learn that we have, we delete it.",
  },
  {
    title: "Security",
    body: "Passwords are stored as hashes, never in plain text. Google Drive tokens are encrypted at rest with a key kept outside the database. Access to the app requires signing in, and roles restrict who can manage teams and settings. While no service is perfectly secure, we follow reasonable industry practices to protect your data.",
  },
  {
    title: "Changes to this policy",
    body: "If this policy changes in a meaningful way, we'll point to the updated version from the app and update the date above. Continued use of Catarina after changes means you accept the updated policy.",
  },
  {
    title: "Contact",
    body: "Questions about this policy or your data? Reach out to the administrator of your team workspace, who can get in touch with the people who run Catarina. We're happy to explain exactly what we store and why.",
  },
];

export default function PrivacyPage() {
  return (
    <LegalLayout
      title="Privacy Policy"
      subtitle="How Catarina collects, uses, and protects your information."
      updated="September 13, 2026"
      sticker="/rina/think.webp"
      stickerAlt="Catarina thinking about privacy"
      sections={sections}
    >
      <p className="mt-8 border-t border-border pt-6 text-xs text-text/80">
        This policy covers the app you&apos;re using. The rules for using it live in
        the{" "}
        <Link
          href="/terms"
          className="font-semibold text-text/90 underline underline-offset-2 transition-colors hover:text-accent"
        >
          Terms of Service
        </Link>
        .
      </p>
    </LegalLayout>
  );
}