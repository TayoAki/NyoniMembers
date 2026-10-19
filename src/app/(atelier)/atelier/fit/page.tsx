import type { Metadata } from "next";
import { Suspense } from "react";
import { FitPage } from "@/components/atelier/fit/fit-page";
import { FitSkeleton } from "@/components/atelier/fit/fit-skeleton";

export const metadata: Metadata = {
  title: "Fit",
  description:
    "How the house measures you: a fitting at a showroom or guided measurements from home, your fit profile as a fitter approved it, and the measurement guide.",
};

export default function AtelierFitPage() {
  return (
    <Suspense fallback={<FitSkeleton />}>
      <FitPage />
    </Suspense>
  );
}
