import type { Metadata } from "next";
import ArchiveView from "./ArchiveView";

export const metadata: Metadata = {
  title: "Archive",
  description: "Archived monthly team reports and downloads.",
};

export default function ArchivePage() {
  return <ArchiveView />;
}
