"use client";

/**
 * Footer — App footer with branding and links.
 * Hodor-inspired neon teal accent on dark background.
 */

import Link from "next/link";
import Image from "next/image";

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border bg-surface/50 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* Left: Logo + Branding */}
          <div className="flex items-center gap-2.5">
            <Image
              src="/logo.webp"
              alt="Catarina"
              width={24}
              height={24}
              className="h-6 w-6 rounded-lg object-contain"
            />
            <span className="text-sm font-bold text-text tracking-tight">
              Catarina
            </span>
            <span className="text-xs text-text-muted">
              &copy; {year} Devora
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
            Built with care for the Devora team
          </p>
        </div>
      </div>
    </footer>
  );
}
