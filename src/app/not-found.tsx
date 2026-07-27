/**
 * NotFound — Custom404 page with context-aware messages.
 * Server Component that renders the NotFoundContent client component.
 * Shows different descriptions based on the URL path.
 */

import NotFoundContent from "@/components/NotFoundContent";

export default function NotFound() {
  return <NotFoundContent />;
}
