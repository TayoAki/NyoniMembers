import type { Metadata } from "next";
import { Suspense } from "react";
import { FittingsPage } from "@/components/atelier/fittings/fittings-page";
import { FittingsSkeleton } from "@/components/atelier/fittings/fittings-skeleton";

export const metadata: Metadata = {
  title: "Fittings",
  description:
    "Request a consultation, measurements or a fitting at a Nyoni Couture showroom, or a video appointment. The house confirms a real time; a preferred date is never a reserved slot.",
};

export default function AtelierFittingsPage() {
  return (
    <Suspense fallback={<FittingsSkeleton />}>
      <FittingsPage />
    </Suspense>
  );
}
