/**
 * NotFound — Custom404 page with context-aware messages.
 * Server Component that renders the NotFoundContent client component.
 * Shows different descriptions based on the URL path.
 */

import type { Metadata } from "next";
import NotFoundContent from "@/components/NotFoundContent";

export const metadata: Metadata = {
  title: "Page not found",
  description: "The page you're looking for doesn't exist or has been moved.",
};

export default function NotFound() {
  return <NotFoundContent />;
}