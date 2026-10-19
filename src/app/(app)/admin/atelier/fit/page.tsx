import type { Metadata } from "next";
import { FitQueue } from "@/components/atelier/staff/fit/fit-queue";
import { requireStaffPage } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Fit review · Atelier desk",
  description:
    "Measurement sheets awaiting a fitter: approve with the values settled on, or ask the client one question.",
};

export default async function AtelierFitPage() {
  await requireStaffPage();
  return <FitQueue />;
}
