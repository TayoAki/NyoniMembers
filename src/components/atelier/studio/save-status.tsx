"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { StatusLine, type StatusTone } from "@/components/atelier/common/status-line";
import { Button } from "@/components/ui/button";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { useStudio } from "./panel-contract";
import { useStudioCore } from "./studio-provider";

/**
 * S15. The truthful save indicator: the scope of what "saved" means, the moment of saving, a failure
 * that keeps the change on the stage, and the warning when this browser cannot keep drafts at all.
 */
export function SaveStatus({ className }: { className?: string }) {
  const { editor } = useStudio();
  const { storageAvailable, retrySave, discardFailedChange, lastFailure } = useStudioCore();
  const pathname = usePathname();
  const { saving } = editor;

  let tone: StatusTone = "neutral";
  let words: string;
  if (saving.state === "saving") {
    words = "Saving…";
  } else if (saving.state === "error") {
    tone = "destructive";
    words = "Could not save — your change is still here";
  } else if (saving.scope === "browser" && !storageAvailable) {
    tone = "warning";
    words = "This browser is not keeping drafts — download your design before you leave";
  } else {
    words = saving.scope === "account" ? "Saved to your account" : "Saved to this browser";
  }

  const failed = saving.state === "error";
  const needsSignIn = lastFailure?.code === "UNAUTHENTICATED";
  // The house's rules refused the change (a design already sent, say): sending it again cannot succeed.
  const refused = lastFailure?.code === "INVALID_STATE";

  return (
    <div className={cn("flex flex-wrap items-center gap-x-4 gap-y-1", className)}>
      <StatusLine live tone={tone}>
        {words}
      </StatusLine>
      {failed ? (
        <span className="flex flex-wrap items-center gap-x-1">
          {needsSignIn ? (
            <Button
              variant="link"
              size="xs"
              className="min-h-11 px-1"
              nativeButton={false}
              render={<Link href={`${routes.signIn}?redirect_url=${encodeURIComponent(pathname)}`} />}
            >
              Sign in to keep working
            </Button>
          ) : retrySave && !refused ? (
            <Button variant="link" size="xs" className="min-h-11 px-1" onClick={retrySave}>
              Try again
            </Button>
          ) : null}
          {discardFailedChange ? (
            <Button
              variant="link"
              size="xs"
              className="min-h-11 px-1 text-muted-foreground"
              onClick={discardFailedChange}
            >
              Discard the change
            </Button>
          ) : null}
        </span>
      ) : null}
      {failed && lastFailure ? (
        <p className="basis-full text-xs leading-relaxed text-muted-foreground">{lastFailure.message}</p>
      ) : null}
    </div>
  );
}
