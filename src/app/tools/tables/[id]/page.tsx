import type { Metadata } from "next";
import TableEditor from "@/components/tools/tables/TableEditor";
import { getSectionLabels } from "@/lib/sections";

export const metadata: Metadata = {
  title: "Edit table",
  description: "Edit a team table — merge cells, mark dates, drop stickers, export a themed PDF.",
};

export default async function TablePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const labels = await getSectionLabels();

  return <TableEditor tableId={id} sectionMeta={labels} />;
}