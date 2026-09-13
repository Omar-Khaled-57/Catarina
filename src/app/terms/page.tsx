/**
 * Terms of Service — /terms. Static server component so the page is visible
 * (and indexable) without logging in. Also used as the consent-screen link.
 */

import type { Metadata } from "next";
import LegalLayout from "@/components/LegalLayout";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The terms that govern your use of Catarina.",
};

const sections = [
  {
    title: "Acceptance",
    body: "By signing up to or using Catarina you agree to these terms. If you are using it on behalf of a team, you confirm you have the authority to do so.",
  },
  {
    title: "Accounts",
    body: "You are responsible for keeping your login details safe and for everything that happens under your account. Your account is tied to the email you registered with, and your role is assigned by your team administrator.",
  },
  {
    title: "Acceptable use",
    body: "Use Catarina for legitimate team planning. Don't abuse, overload, or attempt to break the service, scrape other teams' data, or use the app to store anything unlawful.",
  },
  {
    title: "Content you store",
    body: "You keep ownership of everything you put into the app. Because The Drawers can use your Google Drive, content you place there is also stored under your Google account and remains subject to Google's own terms of service and privacy policy.",
  },
  {
    title: "Team collaboration",
    body: "Content you add to a shared space may be visible to — and editable by — the teammates you collaborate with, including files synced to the shared “Catarina” Drive folder.",
  },
  {
    title: "Service availability",
    body: "We work to keep Catarina available and reliable, but features, design and availability can change as the product evolves. Temporary downtime for maintenance doesn't count as a breach of these terms.",
  },
  {
    title: "Termination",
    body: "Your team administrator can remove your access, and you can stop using the service at any time. Sections and goals you authored remain with the team once shared.",
  },
  {
    title: "Disclaimers & liability",
    body: "Catarina is provided “as is” without warranties of any kind. We are not liable for indirect or consequential losses arising from your use of the service or any third-party service it depends on (such as Google Drive).",
  },
  {
    title: "Privacy",
    body: "Controlling and protecting your data is part of these terms — see our Privacy Policy for details.",
  },
];

export default function TermsPage() {
  return (
    <LegalLayout
      title="Terms of Service"
      subtitle="The ground rules for using Catarina and everything you store in it."
      updated="September 13, 2026"
      sticker="/rina/thumb.webp"
      stickerAlt="Catarina giving a thumbs up in agreement"
      sections={sections}
    >
      <p className="mt-8 border-t border-border pt-6 text-xs text-text/80">
        By signing in you agree to these terms. Something not here? Contact
        your team administrator. See the{" "}
        <Link
          href="/privacy"
          className="font-semibold text-text/90 underline underline-offset-2 transition-colors hover:text-accent"
        >
          Privacy Policy
        </Link>
        .
      </p>
    </LegalLayout>
  );
}