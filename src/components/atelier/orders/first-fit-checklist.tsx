"use client";

import { useMutation } from "convex/react";
import { useId, useState } from "react";
import { AtelierSection } from "@/components/atelier/common/atelier-section";
import { StatusLine } from "@/components/atelier/common/status-line";
import { checklistEditable } from "@/components/atelier/orders/order-words";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { ErrorAlert } from "@/components/common/error-alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useGuestKeyArg } from "@/hooks/atelier/use-owner-args";
import { toClientError, type ClientError } from "@/lib/errors";
import { formatDate } from "@/lib/format";
import { api } from "@convex/_generated/api";
import type { OrderView } from "@convex/atelier/orders";
import type { ChecklistState, FitRegion } from "@convex/shared/atelier/enums";
import { HOUSE_POLICY } from "@convex/shared/atelier/policy";

const STATE_WORDS: Record<ChecklistState, string> = {
  unchecked: "Not checked yet",
  ok: "OK",
  issue: "Issue noted",
};

type SaveState = { kind: "idle" } | { kind: "saving" } | { kind: "saved" } | { kind: "error"; error: ClientError };

/**
 * S30 (C23): the first-fit checklist over every region, saved with the house as each answer is given,
 * and the acceptance of the fit. Delivery never closes the review; only the client does, and an issue
 * goes to aftercare rather than being argued away.
 */
export function FirstFitChecklist({
  order,
  onRaiseIssue,
}: {
  order: OrderView;
  onRaiseIssue: (region: FitRegion) => void;
}) {
  const ids = useId();
  const guestKeyArg = useGuestKeyArg();
  const saveChecklist = useMutation(api.atelier.orders.setFirstFitChecklist);
  const acceptFit = useMutation(api.atelier.orders.acceptFit);
  const [pending, setPending] = useState<Partial<Record<FitRegion, ChecklistState>>>({});
  const [save, setSave] = useState<SaveState>({ kind: "idle" });
  const [acceptError, setAcceptError] = useState<ClientError | null>(null);

  const editable = checklistEditable(order.status);
  const accepted = order.status === "accepted";
  const shown = (region: FitRegion, server: ChecklistState): ChecklistState => pending[region] ?? server;
  const issues = order.firstFitChecklist.filter((entry) => shown(entry.region, entry.state) === "issue");
  const acceptReason =
    order.status === "correction_open"
      ? "A correction is open on this suit; the house will ask you to reassess the fit once it is done."
      : issues.length > 0
        ? `Your checklist notes an issue with ${issues.map((entry) => entry.label.toLowerCase()).join(", ")}. Ask the house to look at it, or mark it OK, before accepting the fit.`
        : null;

  async function change(region: FitRegion, state: ChecklistState) {
    setPending((prev) => ({ ...prev, [region]: state }));
    setSave({ kind: "saving" });
    try {
      await saveChecklist({ ...guestKeyArg, orderId: order._id, checklist: { [region]: state } });
      setSave({ kind: "saved" });
    } catch (caught) {
      setSave({ kind: "error", error: toClientError(caught) });
    } finally {
      setPending((prev) => {
        const next = { ...prev };
        delete next[region];
        return next;
      });
    }
  }

  async function accept() {
    setAcceptError(null);
    try {
      await acceptFit({ ...guestKeyArg, orderId: order._id });
    } catch (caught) {
      setAcceptError(toClientError(caught));
      throw caught;
    }
  }

  return (
    <AtelierSection
      id="first-fit"
      title="Delivery and first fit"
      description={
        accepted
          ? `You accepted the fit${order.fitAcceptedAt !== null ? ` on ${formatDate(order.fitAcceptedAt)}` : ""}. If something has changed since, ask the house for an alteration below.`
          : "Try the suit on against the specification and go through each region. Delivery is not a fitting: nothing closes this review but you."
      }
    >
      <div className="space-y-5">
        {save.kind !== "idle" ? (
          <StatusLine live tone={save.kind === "saved" ? "success" : save.kind === "error" ? "warning" : "neutral"}>
            {save.kind === "saving"
              ? "Saving…"
              : save.kind === "saved"
                ? "Saved to your commission"
                : "Could not save your answer"}
          </StatusLine>
        ) : null}
        {save.kind === "error" ? (
          <ErrorAlert title="The checklist was not saved" message={save.error.message} className="rounded-none" />
        ) : null}

        <ul className="divide-y divide-foreground/10 border-y border-foreground/15" aria-label="First-fit checklist">
          {order.firstFitChecklist.map((entry) => {
            const state = shown(entry.region, entry.state);
            const labelId = `${ids}-${entry.region}-label`;
            return (
              <li
                key={entry.region}
                className="grid gap-x-6 gap-y-2 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
              >
                <div className="min-w-0">
                  <p id={labelId} className="text-sm font-medium">
                    {entry.label}
                  </p>
                  <p className="text-xs text-muted-foreground">{STATE_WORDS[state]}</p>
                </div>
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                  {editable ? (
                    <RadioGroup
                      aria-labelledby={labelId}
                      value={state === "unchecked" ? "" : state}
                      onValueChange={(value) => void change(entry.region, value as ChecklistState)}
                      className="flex w-auto flex-row flex-wrap gap-x-5 gap-y-2"
                    >
                      <Label className="min-h-11 cursor-pointer font-normal">
                        <RadioGroupItem value="ok" aria-label={`${entry.label}: OK`} />
                        OK
                      </Label>
                      <Label className="min-h-11 cursor-pointer font-normal">
                        <RadioGroupItem value="issue" aria-label={`${entry.label}: issue`} />
                        Issue
                      </Label>
                    </RadioGroup>
                  ) : null}
                  {editable && state === "issue" ? (
                    <Button
                      variant="outline"
                      className="h-11 rounded-none px-4"
                      onClick={() => onRaiseIssue(entry.region)}
                    >
                      {entry.region === "detail_mismatch" ? "Report the detail" : "Request an alteration"}
                    </Button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>

        {accepted ? (
          <StatusLine tone="success" className="text-sm">
            Fit accepted{order.fitAcceptedAt !== null ? ` · ${formatDate(order.fitAcceptedAt)}` : ""}
          </StatusLine>
        ) : editable ? (
          <div className="space-y-3 border-t border-foreground/15 pt-5">
            <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Accepting the fit tells the house the suit is right. {HOUSE_POLICY.verified.alterations} Accepting does
              not waive that promise.
            </p>
            {acceptError ? (
              <ErrorAlert title="The fit was not accepted" message={acceptError.message} className="rounded-none" />
            ) : null}
            <div className="flex flex-wrap items-center gap-3">
              <ConfirmDialog
                trigger={
                  <Button className="h-11 rounded-none px-5" disabled={acceptReason !== null}>
                    The fit is right
                  </Button>
                }
                title="Accept the fit of this suit?"
                description="You are telling the house the suit fits as agreed. Your commission moves to “Fit accepted”."
                confirmLabel="Accept the fit"
                cancelLabel="Not yet"
                onConfirm={accept}
              >
                <div className="space-y-3 text-sm leading-relaxed">
                  <p>{HOUSE_POLICY.verified.alterations}</p>
                  <p>Accepting the fit does not waive that promise.</p>
                </div>
              </ConfirmDialog>
              {acceptReason ? <p className="max-w-xl text-xs leading-relaxed text-warning">{acceptReason}</p> : null}
            </div>
          </div>
        ) : null}
      </div>
    </AtelierSection>
  );
}
