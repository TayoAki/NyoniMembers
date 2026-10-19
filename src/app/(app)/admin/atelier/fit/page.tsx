import type { Metadata } from "next";
import { FitQueue } from "@/components/atelier/staff/fit/fit-queue";
import { requireAdminPage } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Fit review · Atelier desk",
  description:
    "Measurement sheets awaiting a fitter: approve with the values settled on, or ask the client one question.",
};

export default async function AtelierFitPage() {
  await requireAdminPage();
  return <FitQueue />;
}
