import type { Metadata } from "next";
import { AftercareBoard } from "@/components/atelier/staff/aftercare/aftercare-board";
import { requireStaffPage } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Aftercare · Atelier desk",
  description: "Fit, quality, return and refund corrections on released commissions, by status.",
};

export default async function AtelierAftercarePage() {
  await requireStaffPage();
  return <AftercareBoard />;
}
