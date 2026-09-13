import type { Metadata } from "next";
import ArchivedMonthView from "./ArchivedMonthView";

export const metadata: Metadata = {
  title: "Month Report",
  description: "Archived monthly report with section details and performance charts.",
};

export default function ArchivedMonthPage({ params }: { params: Promise<{ monthId: string }> }) {
  return <ArchivedMonthView params={params} />;
}
