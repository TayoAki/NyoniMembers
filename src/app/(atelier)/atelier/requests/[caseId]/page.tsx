import type { Metadata } from "next";
import { CasePage } from "@/components/atelier/requests/case-page";

type Params = { params: Promise<{ caseId: string }> };

export const metadata: Metadata = {
  title: "Your request",
  description:
    "One request to the house: the receipt, your concierge, any proposed change, the quote and its payment state, and the conversation.",
};

export default async function AtelierRequestPage({ params }: Params) {
  const { caseId } = await params;
  return <CasePage caseId={caseId} />;
}
