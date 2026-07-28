"use client";

/**
 * Footer — App footer with branding and links.
 * Hodor-inspired neon teal accent on dark background.
 */

import Link from "next/link";
import Image from "next/image";

export default function Footer() {
  const year = new Date().getFullYear();
  const teamName = process.env.NEXT_PUBLIC_TEAM_NAME || "Your Team";

  return (
    <footer className="border-t border-border bg-surface/50 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* Left: Logo + Branding */}
          <div className="flex items-center gap-2.5">
            <Image
              src="/icons/logo.webp"
              alt="Catarina"
              width={40}
              height={40}
              className="w-8 h-8 sm:w-10 sm:h-10 min-w-8 sm:min-w-10 rounded-lg object-contain"
            />
            <span className="text-sm font-bold text-text tracking-tight">
              Catarina
            </span>
            <span className="text-xs text-text-muted">
              &copy; {year} {teamName}
            </span>
            <span className="text-[10px] font-bold text-accent bg-accent/10 border border-accent/20 px-1.5 py-0.5 rounded-md font-mono">
              v0.4.3
            </span>
          </div>

          {/* Center: Links */}
          <div className="flex items-center gap-4 text-xs text-text-muted">
            <Link
              href="/dashboard"
              className="hover:text-accent transition-colors"
            >
              Dashboard
            </Link>
            <Link
              href="/dashboard/archive"
              className="hover:text-accent transition-colors"
            >
              Archive
            </Link>
          </div>

          {/* Right: Tagline */}
          <p className="text-[11px] text-text-muted/60">
            Built with care for {teamName}
          </p>
        </div>
      </div>
    </footer>
  );
}
