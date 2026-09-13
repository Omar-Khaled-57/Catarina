/**
 * LegalLayout — shared shell for the /privacy and /terms pages: a glass card
 * with a section-colored glow, a Rina sticker, and heading-per-section copy.
 * Body copy uses near-full foreground contrast in both themes for
 * accessibility (muted is too low on the light glass background).
 */

import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import ThemeToggleButton from "@/components/ThemeToggleButton";

export interface LegalSection {
  title: string;
  body: string;
}

export default function LegalLayout({
  title,
  subtitle,
  updated,
  sticker,
  stickerAlt,
  sections,
  children,
}: {
  title: string;
  subtitle: string;
  updated: string;
  sticker: string;
  stickerAlt: string;
  sections: LegalSection[];
  children?: React.ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-10 sm:py-14">
      <div className="mb-6 flex items-center justify-between gap-4">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface/80 px-3 py-2 text-sm font-medium text-text transition-colors hover:border-accent/40 hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <ArrowLeft size={16} aria-hidden="true" />
          Back to home
        </Link>
        <ThemeToggleButton />
      </div>
      <div className="glass relative overflow-hidden rounded-3xl border border-border px-6 py-10 sm:px-10 sm:py-12">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 -right-16 h-64 w-64 rounded-full bg-art/20 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-28 -left-20 h-72 w-72 rounded-full bg-technical/20 blur-3xl"
        />
        <div className="relative">
          <div className="flex items-start justify-between gap-6">
            <div className="min-w-0">
              <h1 className="text-3xl font-bold tracking-tight text-text sm:text-4xl">
                {title}
              </h1>
              <p className="mt-3 max-w-xl text-sm text-text/90 sm:text-base">
                {subtitle}
              </p>
              <p className="mt-2 text-xs font-semibold tracking-wide text-text/75 uppercase">
                Last updated · {updated}
              </p>
            </div>
            <Image
              src={sticker}
              alt={stickerAlt}
              width={160}
              height={160}
              className="h-auto w-24 shrink-0 rounded-2xl drop-shadow-sm sm:w-32"
            />
          </div>

          <div className="mt-8 space-y-6">
            {sections.map((section) => (
              <section key={section.title}>
                <h2 className="text-base font-bold text-text sm:text-lg">
                  {section.title}
                </h2>
                <p className="mt-1.5 text-sm leading-relaxed text-text/90 sm:text-[15px]">
                  {section.body}
                </p>
              </section>
            ))}
          </div>

          {children}
        </div>
      </div>
    </div>
  );
}