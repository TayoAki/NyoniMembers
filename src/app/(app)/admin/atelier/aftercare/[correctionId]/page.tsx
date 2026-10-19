import type { Metadata } from "next";
import { CorrectionDesk } from "@/components/atelier/staff/aftercare/correction-desk";
import { requireAdminPage } from "@/lib/auth";

type Params = { params: Promise<{ correctionId: string }> };

export const metadata: Metadata = {
  title: "Correction · Atelier desk",
  description: "One correction: the issue, the commission as it was made, the remedy, the refund and the status.",
};

export default async function AtelierCorrectionPage({ params }: Params) {
  await requireAdminPage();
  const { correctionId } = await params;
  return <CorrectionDesk correctionId={correctionId} />;
}
