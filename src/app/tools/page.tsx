import type { Metadata } from "next";
import ToolsView from "./ToolsView";

export const metadata: Metadata = {
  title: "Cabinet",
  description: "Catarina's team cabinet — a toolkit with drag-and-drop drawers for shared reusable content.",
};

export default function ToolsPage() {
  return <ToolsView />;
}
