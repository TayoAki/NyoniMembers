"use client";

import { usePathname } from "next/navigation";
import { deskLinkFor, StaffShell } from "@/components/atelier/staff/staff-shell";
import { ErrorAlert } from "@/components/common/error-alert";
import { toClientError } from "@/lib/errors";

/** Inside the desk frame, so the desk strip stays and the failed desk is named. */
export default function AtelierDeskError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const desk = deskLinkFor(usePathname());
  return (
    <StaffShell title={desk ? desk.label : "Atelier desk"}>
      <ErrorAlert
        title={desk ? `${desk.label} could not be loaded` : "The Atelier desk could not be loaded"}
        message={`${toClientError(error).message} Nothing was changed by this error; try again or open another desk.`}
        onRetry={retry}
        retryLabel="Try again"
        className="max-w-2xl"
      />
    </StaffShell>
  );
}
