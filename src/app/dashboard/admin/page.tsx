import type { Metadata } from "next";
import AdminView from "./AdminView";

export const metadata: Metadata = {
  title: "Admin Panel",
  description: "Manage team members, sections, roles, and permissions.",
};

export default function AdminPage() {
  return <AdminView />;
}
