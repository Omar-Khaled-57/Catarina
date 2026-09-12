"use client";

/**
 * Tools Layout — every Cabinet page shares the authenticated AuthShell.
 */

import AuthShell from "@/components/AuthShell";

export default function ToolsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AuthShell>{children}</AuthShell>;
}