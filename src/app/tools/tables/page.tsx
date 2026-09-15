import type { Metadata } from "next";
import TableList from "@/components/tools/tables/TableList";
import { getSectionLabels, getSectionColors } from "@/lib/sections";

export const metadata: Metadata = {
  title: "Tables",
  description: "Catarina's team tables — one free-form grid per team, grouped by section.",
};

export default async function TablesPage() {
  const [labels, colors] = await Promise.all([getSectionLabels(), getSectionColors()]);
  const sectionMeta: Record<string, { label: string; color: string }> = {};
  for (const key of Object.keys(labels)) {
    sectionMeta[key] = { label: labels[key], color: colors[key] ?? "#00E8A2" };
  }

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight text-text sm:text-3xl">Team tables</h1>
        <p className="max-w-2xl text-sm text-text-muted">
          One free-form grid per team — merge cells into blocks, mark dates to
          light up today&apos;s row or column, drop Rina stickers for flair, and
          export a themed PDF. Every table syncs to the whole section.
        </p>
      </header>

      <TableList sectionMeta={sectionMeta} />
    </section>
  );
}