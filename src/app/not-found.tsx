"use client";

/**
 * NotFound — Custom 404 page with context-aware messages.
 * Shows different descriptions based on the URL path
 * (e.g., unknown section, missing month, access denied).
 */

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, ArrowLeft } from "lucide-react";

function getPathContext(pathname: string): { title: string; description: string } {
  if (pathname.startsWith("/dashboard/archive")) {
    return {
      title: "Month not found",
      description: "This month report doesn't exist or has been deleted. Catarina checked everywhere — it's gone.",
    };
  }
  if (/^\/dashboard\/[^/]+/.test(pathname)) {
    const section = pathname.split("/dashboard/")[1]?.split("/")[0] || "";
    return {
      title: `Unknown section: ${section}`,
      description: `There's no team section called "${section}". Did you mistype it? Catarina can't find it either.`,
    };
  }
  if (pathname.startsWith("/dashboard/admin")) {
    return {
      title: "Access denied",
      description: "You don't have admin privileges to view this page. Ask an admin for access.",
    };
  }
  return {
    title: "Lost in the void?",
    description: "The page you're looking for doesn't exist or has been moved. Even Catarina can't find it — and she remembers everything.",
  };
}

export default function NotFound() {
  const pathname = usePathname();
  const ctx = getPathContext(pathname);

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="text-center">
        <Image
          src="/rina/404.webp"
          alt="404"
          width={280}
          height={280}
          className="w-[200px] sm:w-[280px] h-auto mx-auto drop-shadow-xl -mb-6 object-contain"
          priority
        />
        <h1 className="text-4xl font-black text-text mb-3 tracking-tight">
          {ctx.title}
        </h1>
        <p className="text-text-muted mb-8 max-w-md mx-auto text-sm leading-relaxed">
          {ctx.description}
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-bold text-bg shadow-lg shadow-accent/20 hover:bg-accent-2 transition-colors"
          >
            <Home size={16} />
            Go Home
          </Link>
          <button
            onClick={() => history.back()}
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface-2 px-5 py-2.5 text-sm font-semibold text-text hover:bg-surface transition-colors"
          >
            <ArrowLeft size={16} />
            Go Back
          </button>
        </div>
      </div>
    </div>
  );
}
