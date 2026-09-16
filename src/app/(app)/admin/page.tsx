import type { Metadata } from "next";
import { AdminDashboard } from "@/components/admin/admin-dashboard";
import { requireSignedIn } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Admin",
  description: "Revenue, cost of goods and the state of the credit meter.",
};

export default async function AdminPage() {
  await requireSignedIn();
  return <AdminDashboard />;
}
