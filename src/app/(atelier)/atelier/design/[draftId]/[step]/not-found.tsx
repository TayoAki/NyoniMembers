"use client";

import { Compass } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { STEP_LABELS, STUDIO_STEPS } from "@convex/shared/atelier/enums";
import { EmptyState } from "@/components/common/empty-state";
import { Button } from "@/components/ui/button";
import { routes } from "@/lib/routes";

/** Inside the studio frame: the address named a step the studio does not have. */
export default function StepNotFound() {
  const params = useParams<{ draftId?: string }>();
  const back = params.draftId ? routes.atelier.design(params.draftId) : routes.atelier.drafts;
  const steps = STUDIO_STEPS.map((step) => STEP_LABELS[step].toLowerCase()).join(", ");
  return (
    <div className="py-2">
      <EmptyState
        icon={Compass}
        className="rounded-none"
        title="This step does not exist"
        description={`The studio has seven steps: ${steps}. Your design is unchanged.`}
        action={
          <Button className="min-h-11" nativeButton={false} render={<Link href={back} />}>
            Back to the design
          </Button>
        }
      />
    </div>
  );
}
