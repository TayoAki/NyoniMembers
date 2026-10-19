import type { Metadata } from "next";
import { CaseDesk } from "@/components/atelier/staff/case/case-desk";
import { requireStaffPage } from "@/lib/auth";

type Params = { params: Promise<{ caseId: string }> };

export const metadata: Metadata = {
  title: "Request · Atelier desk",
  description:
    "One request: its owner, the submitted design, the conversation, proposals, appointment, sample and quotes.",
};

export default async function AtelierCasePage({ params }: Params) {
  await requireStaffPage();
  const { caseId } = await params;
  return <CaseDesk caseId={caseId} />;
}
