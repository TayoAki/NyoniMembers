import type { Metadata } from "next";
import { CaseDesk } from "@/components/atelier/staff/case/case-desk";
import { requireAdminPage } from "@/lib/auth";

type Params = { params: Promise<{ caseId: string }> };

export const metadata: Metadata = {
  title: "Request · Atelier desk",
  description:
    "One request: its owner, the submitted design, the conversation, proposals, appointment, sample and quotes.",
};

export default async function AtelierCasePage({ params }: Params) {
  await requireAdminPage();
  const { caseId } = await params;
  return <CaseDesk caseId={caseId} />;
}
