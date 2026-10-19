"use client";

import type { DraftStatus } from "@convex/shared/atelier/enums";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

/**
 * A design that has left the studio is read here, not changed: the panel's choices stay on screen,
 * disabled, and this says where a change goes instead (the request, or a duplicate of an archived one).
 */
export function LockedNote({ status, what, className }: { status: DraftStatus; what: string; className?: string }) {
  if (status === "draft") return null;
  return (
    <Alert className={cn("rounded-none", className)}>
      {status === "archived" ? (
        <>
          <AlertTitle>This design has been archived</AlertTitle>
          <AlertDescription>Its {what} can still be read here; duplicate it to work on it again.</AlertDescription>
        </>
      ) : (
        <>
          <AlertTitle>This design has been sent to the house</AlertTitle>
          <AlertDescription>
            Its {what} can still be read here; to change them, reply on your request and your concierge will propose the
            change.
          </AlertDescription>
        </>
      )}
    </Alert>
  );
}
