"use client";

import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { useId, useState } from "react";
import { toast } from "sonner";
import { StatusLine } from "@/components/atelier/common/status-line";
import { ChoiceList, ChoiceRow } from "@/components/atelier/fit/choice-list";
import { ErrorAlert } from "@/components/common/error-alert";
import { LoadingRows } from "@/components/common/loading-grid";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { useGuestKeyArg, useOwnerArgs } from "@/hooks/atelier/use-owner-args";
import { reportError, type ClientError } from "@/lib/errors";
import { routes } from "@/lib/routes";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import type { DraftSummary } from "@convex/atelier/drafts";
import type { FitProfileView } from "@convex/atelier/fit";

function reasonFor(draft: DraftSummary): string | null {
  if (draft.status === "submitted") return "Sent to the house — its fit profile is settled with your concierge.";
  if (draft.status === "archived") return "Archived.";
  if (!draft.ownedByAccount) return "Saved to this browser only — save it to your account first.";
  return null;
}

/**
 * S20 "Use this profile for a design" (C16): attaches an approved version to one of the account's
 * designs. The server allows only approved profiles and account-owned drafts; the list says why a
 * design cannot be chosen rather than hiding it.
 */
export function UseProfileDialog({ profile }: { profile: FitProfileView }) {
  const ids = useId();
  const [open, setOpen] = useState(false);
  const [draftId, setDraftId] = useState<Id<"atelierDrafts"> | null>(null);
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<ClientError | null>(null);
  const [attached, setAttached] = useState<{ draftId: Id<"atelierDrafts">; name: string } | null>(null);
  const guestKeyArg = useGuestKeyArg();
  const drafts = useQuery(api.atelier.drafts.listMine, useOwnerArgs({}, open));
  const confirmReuse = useMutation(api.atelier.fit.confirmReuse);
  const approved = profile.status === "approved";

  async function attach() {
    if (!draftId) return;
    const draft = drafts?.find((entry) => entry._id === draftId);
    setPending(true);
    setFailure(null);
    try {
      await confirmReuse({ ...guestKeyArg, profileId: profile._id, draftId });
      setAttached({ draftId, name: draft?.name ?? "your design" });
      toast.success(`Fit profile v${profile.version} attached to ${draft?.name ?? "your design"}.`);
    } catch (error) {
      setFailure(reportError(error, "Could not attach the profile."));
    } finally {
      setPending(false);
    }
  }

  function onOpenChange(next: boolean) {
    if (pending) return;
    setOpen(next);
    if (!next) {
      setDraftId(null);
      setFailure(null);
      setAttached(null);
    }
  }

  return (
    <div className="space-y-1.5">
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogTrigger render={<Button className="h-11 rounded-none px-5" disabled={!approved} />}>
          Use this profile for a design
        </DialogTrigger>
        <DialogContent className="rounded-none sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Use version {profile.version} for a design</DialogTitle>
            <DialogDescription>
              Choose one of your designs. Attaching a profile changes nothing in the design itself; the house cuts
              against the version attached when you request a quote.
            </DialogDescription>
          </DialogHeader>

          {attached ? (
            <div className="space-y-3 py-2">
              <StatusLine tone="gold" live>
                Attached to {attached.name}
              </StatusLine>
              <Link
                href={routes.atelier.step(attached.draftId, "fit")}
                className="inline-flex min-h-11 items-center text-sm font-medium underline underline-offset-4"
              >
                Open the design’s Fit step
              </Link>
            </div>
          ) : drafts === undefined ? (
            <LoadingRows count={3} />
          ) : drafts.length === 0 ? (
            <p className="py-2 text-sm text-muted-foreground">
              No designs on your account yet.{" "}
              <Link href={routes.atelier.home} className="underline underline-offset-4">
                Start designing
              </Link>
              .
            </p>
          ) : (
            <ChoiceList
              value={draftId ?? ""}
              onValueChange={(value) => setDraftId(value as Id<"atelierDrafts">)}
              aria-label="Your designs"
              disabled={pending}
              className="max-h-[50svh] overflow-y-auto"
            >
              {drafts.map((draft) => {
                const reason = reasonFor(draft);
                return (
                  <ChoiceRow
                    key={draft._id}
                    id={`${ids}-${draft._id}`}
                    value={draft._id}
                    title={draft.name}
                    description={draft.summary}
                    disabled={reason !== null}
                    reason={reason}
                  />
                );
              })}
            </ChoiceList>
          )}

          {failure ? (
            <ErrorAlert
              title="The profile was not attached"
              message={
                <>
                  {failure.message}
                  {failure.code === "INVALID_STATE" && failure.message.toLowerCase().includes("save this design") ? (
                    <>
                      {" "}
                      <Link href={routes.atelier.link} className="underline underline-offset-4">
                        Save it to your account
                      </Link>
                    </>
                  ) : null}
                </>
              }
              className="rounded-none"
            />
          ) : null}

          <DialogFooter>
            <Button variant="outline" className="rounded-none" onClick={() => onOpenChange(false)} disabled={pending}>
              {attached ? "Close" : "Cancel"}
            </Button>
            {attached ? null : (
              <Button className="rounded-none" onClick={attach} disabled={!draftId || pending} aria-busy={pending}>
                {pending ? <Spinner data-icon="inline-start" aria-label="Attaching" /> : null}
                {pending ? "Attaching…" : "Attach"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {!approved ? (
        <p className="text-xs text-muted-foreground">
          Only a profile a fitter has approved can be attached to a design.
        </p>
      ) : null}
    </div>
  );
}
