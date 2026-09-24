/**
 * Login Page — Entry point with email/password authentication.
 * Server Component that renders the LoginForm client component.
 * Provides per-page SEO metadata and structured data (WebSite) for the root URL.
 */

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import LoginForm from "@/components/LoginForm";
import { verifyToken } from "@/lib/auth.server";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
const teamName = process.env.NEXT_PUBLIC_TEAM_NAME || "Your Team";

export const metadata: Metadata = {
  title: "Team planning & progress tracking",
  description: `Catarina is the planning home for ${teamName} — set goals and milestones, break them into steps, track progress by section, and keep reusable content in The Cabinet's drawers.`,
  alternates: { canonical: "/" },
  openGraph: {
    title: "Catarina — Team planning & progress tracking",
    description: `The planning home for ${teamName}: goals, milestones, section progress, monthly reports, and a team cabinet.`,
    url: siteUrl,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Catarina — Team planning & progress tracking",
    description: `The planning home for ${teamName}: goals, milestones, section progress, monthly reports, and a team cabinet.`,
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Catarina",
  url: siteUrl,
  description: `The planning home for ${teamName}.`,
  inLanguage: "en",
};

export default async function LoginPage() {
  /* One-time / persistent login: a user with a live session cookie is sent
     straight to the dashboard instead of the login form (no flash). */
  const session = await verifyToken();
  if (session) redirect("/dashboard");

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <LoginForm />
    </>
  );
}