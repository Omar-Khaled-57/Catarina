import type { Metadata } from "next";
import DashboardView from "./DashboardView";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Team planning dashboard — goals, milestones, and progress across all sections.",
};

export default function DashboardPage() {
  return <DashboardView />;
}
