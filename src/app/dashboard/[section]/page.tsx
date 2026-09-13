import type { Metadata } from "next";
import SectionView from "./SectionView";

export const metadata: Metadata = {
  title: "Section",
  description: "Goals, milestones, steps, and progress for a team section.",
};

export default function SectionPage({ params }: { params: Promise<{ section: string }> }) {
  return <SectionView params={params} />;
}
