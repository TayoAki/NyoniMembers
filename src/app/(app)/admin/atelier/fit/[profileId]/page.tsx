import type { Metadata } from "next";
import { FitReview } from "@/components/atelier/staff/fit/fit-review";
import { requireAdminPage } from "@/lib/auth";

type Params = { params: Promise<{ profileId: string }> };

export const metadata: Metadata = {
  title: "Fit profile · Atelier desk",
  description: "One measurement sheet: the client's values, the fitter's values, photographs and the decision.",
};

export default async function AtelierFitProfilePage({ params }: Params) {
  await requireAdminPage();
  const { profileId } = await params;
  return <FitReview profileId={profileId} />;
}
