import type { Metadata } from "next";
import { ProductionBoard } from "@/components/atelier/staff/production/production-board";
import { requireStaffPage } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Production · Atelier desk",
  description: "Every commission by status: preflight, release, making, shipping and fit review.",
};

export default async function AtelierProductionPage() {
  await requireStaffPage();
  return <ProductionBoard />;
}
