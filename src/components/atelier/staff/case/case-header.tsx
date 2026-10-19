"use client";

import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { toast } from "sonner";
import { AtelierSection } from "@/components/atelier/common/atelier-section";
import { Mono } from "@/components/atelier/common/mono";
import { StatusLine } from "@/components/atelier/common/status-line";
import { OrderBook, OrderBookRow } from "@/components/atelier/common/order-book";
import { CASE_STATUS_TONES } from "@/components/atelier/staff/queue/queue-words";
import { ErrorAlert } from "@/components/common/error-alert";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useCurrentUser } from "@/hooks/use-current-user";
import { toClientError } from "@/lib/errors";
import { formatDate, formatDateTime } from "@/lib/format";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import type { StaffCaseView } from "@convex/atelier/cases";
import type { StaffStatus } from "@convex/atelier/staff";
import {
  CONTACT_CHANNEL_LABELS,
  CASE_PRIORITY_LABELS,
  CASE_STATUS_LABELS,
  type CaseStatus,
} from "@convex/shared/atelier/enums";
import { SHOWROOMS } from "@convex/shared/house";
import { CASE_TRANSITIONS } from "./case-words";
import { WordSelect } from "./word-select";

/**
 * The request's facts as an order book, each with its one action: status (legal transitions only),
 * owner (assign, transfer, or take it), the next action with its date, then the client's contact as they
 * gave it. Staff see the full contact; the client sees only their concierge's first name.
 */
export function RequestSection({ caseView, me }: { caseView: StaffCaseView; me: StaffStatus | null }) {
  const showroom = SHOWROOMS.find((entry) => entry.id === caseView.contact.preferredShowroom) ?? null;
  return (
    <AtelierSection
      id="request"
      title="Request"
      description="Status, owner and next action. Every change here is written to the audit log."
    >
      <OrderBook>
        <OrderBookRow
          label="Status"
          value={<StatusLine tone={CASE_STATUS_TONES[caseView.status]}>{caseView.statusLabel}</StatusLine>}
          note={caseView.closedAt !== null ? `Closed ${formatDateTime(caseView.closedAt)}.` : undefined}
          action={<StatusChange caseView={caseView} />}
        />
        <OrderBookRow
          label="Owner"
          value={caseView.ownerFirstName ?? "Unassigned"}
          tone={caseView.ownerFirstName === null ? "warning" : "default"}
          note={
            caseView.assignedAt !== null
              ? `Assigned ${formatDateTime(caseView.assignedAt)}.`
              : "The client reads “Received · awaiting a concierge” until someone takes it."
          }
          action={caseView.open ? <OwnerControl caseView={caseView} me={me} /> : undefined}
        />
        <OrderBookRow
          label="Next action"
          value={caseView.nextAction ?? "None set"}
          tone={caseView.nextAction ? "default" : "muted"}
          note={
            caseView.nextActionDueAt !== null
              ? `By ${formatDate(caseView.nextActionDueAt)}${caseView.overdue ? " · overdue" : ""}`
              : undefined
          }
          action={caseView.open ? <NextActionControl caseView={caseView} /> : undefined}
        />
        <OrderBookRow
          label="Priority"
          value={CASE_PRIORITY_LABELS[caseView.priority]}
          tone={caseView.priority === "high" ? "warning" : "default"}
          note={
            caseView.escalatedAt !== null
              ? `Escalated by the house's rule ${formatDateTime(caseView.escalatedAt)}.`
              : undefined
          }
        />
        <OrderBookRow
          label="Client"
          value={caseView.contact.name}
          note={
            <span className="flex flex-col gap-0.5">
              <a
                href={`mailto:${caseView.contact.email}`}
                className="underline underline-offset-4 hover:text-foreground"
              >
                {caseView.contact.email}
              </a>
              {caseView.contact.phone ? <span>{caseView.contact.phone}</span> : null}
              <span>
                Prefers {CONTACT_CHANNEL_LABELS[caseView.contact.channel].toLowerCase()}
                {showroom ? ` · ${showroom.city} showroom` : ""}
              </span>
            </span>
          }
        />
        {caseView.message ? (
          <OrderBookRow label="Their message" value={<span className="whitespace-pre-wrap">{caseView.message}</span>} />
        ) : null}
        {caseView.draftName ? (
          <OrderBookRow
            label="Design"
            value={caseView.draftName}
            code={caseView.draftRevision !== null ? `revision ${caseView.draftRevision}` : undefined}
            note="The client's live design; the submitted revision is below."
          />
        ) : null}
        {caseView.orderId ? (
          <OrderBookRow
            label="Commission"
            value="An accepted quote opened a commission on this request."
            code={caseView.orderId}
          />
        ) : null}
        <OrderBookRow
          label="Receipt"
          value={<Mono upper={false}>{caseView._id}</Mono>}
          note={<Mono upper={false}>submission {caseView.submissionKey}</Mono>}
        />
      </OrderBook>
    </AtelierSection>
  );
}

function StatusChange({ caseView }: { caseView: StaffCaseView }) {
  const setStatus = useMutation(api.atelier.cases.setStatus);
  const [next, setNext] = useState<CaseStatus | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const legal = CASE_TRANSITIONS[caseView.status];
  if (legal.length === 0) return null;

  const options = legal.map((status) => ({
    code: status,
    label: CASE_STATUS_LABELS[status],
    disabled: status === "assigned" && caseView.ownerStaffId === null,
    description: status === "assigned" && caseView.ownerStaffId === null ? "Assign a concierge first." : undefined,
  }));

  async function apply() {
    if (!next) return;
    setPending(true);
    setError(null);
    try {
      await setStatus({ caseId: caseView._id, status: next });
      toast.success(`Now “${CASE_STATUS_LABELS[next]}”.`);
      setNext(null);
    } catch (caught) {
      setError(toClientError(caught).message);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 sm:min-w-64">
      <div className="flex flex-wrap items-center gap-2">
        <WordSelect
          value={next}
          onValueChange={setNext}
          options={options}
          placeholder="Change status"
          aria-label="New status"
          className="w-56"
        />
        <Button variant="outline" size="sm" className="h-8" disabled={!next || pending} onClick={() => void apply()}>
          {pending ? <Spinner data-icon="inline-start" /> : null}
          Apply
        </Button>
      </div>
      {error ? <ErrorAlert title="The status did not change" message={error} /> : null}
    </div>
  );
}

function OwnerControl({ caseView, me }: { caseView: StaffCaseView; me: StaffStatus | null }) {
  const { user } = useCurrentUser();
  const assign = useMutation(api.atelier.cases.assign);
  const transfer = useMutation(api.atelier.cases.transfer);
  const isAdmin = me?.isAdmin ?? false;
  const staff = useQuery(api.atelier.staff.list, isAdmin ? {} : "skip");
  const [staffId, setStaffId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const transferring = caseView.ownerStaffId !== null;
  const mine = user !== null && caseView.ownerStaffId === user._id;

  async function run(targetId: Id<"users">) {
    setPending(true);
    setError(null);
    try {
      if (transferring) await transfer({ caseId: caseView._id, staffId: targetId, note: note.trim() });
      else await assign({ caseId: caseView._id, staffId: targetId });
      toast.success(
        transferring
          ? "Handed over. The conversation and design history stay."
          : "Assigned. The client now reads the owner's first name.",
      );
      setOpen(false);
      setStaffId(null);
      setNote("");
    } catch (caught) {
      setError(toClientError(caught).message);
    } finally {
      setPending(false);
    }
  }

  if (!open) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        {!mine && user ? (
          <Button variant="outline" size="sm" className="h-8" disabled={pending} onClick={() => void run(user._id)}>
            {pending ? <Spinner data-icon="inline-start" /> : null}
            {transferring ? "Take it over" : "Take this request"}
          </Button>
        ) : null}
        {isAdmin ? (
          <Button variant="ghost" size="sm" className="h-8" onClick={() => setOpen(true)}>
            {transferring ? "Transfer" : "Assign"}
          </Button>
        ) : null}
        {error ? <ErrorAlert title="The owner did not change" message={error} className="basis-full" /> : null}
      </div>
    );
  }

  const concierges = (staff ?? []).filter((member) => member.isAdmin || member.roles.includes("concierge"));
  const options = concierges.map((member) => ({
    code: member.userId as string,
    label: member.name,
    description: member.email ?? undefined,
    disabled: member.userId === caseView.ownerStaffId,
  }));

  return (
    <div className="flex w-full flex-col gap-3 sm:min-w-72">
      <Field>
        <FieldLabel htmlFor={`owner-${caseView._id}`}>{transferring ? "Transfer to" : "Assign to"}</FieldLabel>
        <FieldDescription>Only a concierge can own a request.</FieldDescription>
        {staff === undefined ? (
          <StatusLine live>Loading the staff list…</StatusLine>
        ) : (
          <WordSelect
            id={`owner-${caseView._id}`}
            value={staffId}
            onValueChange={setStaffId}
            options={options}
            placeholder="Choose a concierge"
          />
        )}
      </Field>
      {transferring ? (
        <Field>
          <FieldLabel htmlFor={`transfer-note-${caseView._id}`}>Handover note</FieldLabel>
          <FieldDescription>Goes to the audit log, not to the client.</FieldDescription>
          <Textarea
            id={`transfer-note-${caseView._id}`}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={2}
          />
        </Field>
      ) : null}
      {error ? <ErrorAlert title="The owner did not change" message={error} /> : null}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          className="h-8"
          disabled={pending || !staffId || (transferring && note.trim().length === 0)}
          onClick={() => staffId && void run(staffId as Id<"users">)}
        >
          {pending ? <Spinner data-icon="inline-start" /> : null}
          {transferring ? "Transfer" : "Assign"}
        </Button>
        <Button variant="ghost" size="sm" className="h-8" disabled={pending} onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

function NextActionControl({ caseView }: { caseView: StaffCaseView }) {
  const setNextAction = useMutation(api.atelier.cases.setNextAction);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(caseView.nextAction ?? "");
  const [due, setDue] = useState(caseView.nextActionDueAt !== null ? toDateInput(caseView.nextActionDueAt) : "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(clear = false) {
    setPending(true);
    setError(null);
    try {
      const dueAt = due ? endOfDay(due) : undefined;
      await setNextAction({
        caseId: caseView._id,
        nextAction: clear ? "" : text.trim(),
        ...(clear || dueAt === undefined ? {} : { dueAt }),
      });
      toast.success(clear ? "Next action cleared." : "Next action set.");
      setOpen(false);
      if (clear) {
        setText("");
        setDue("");
      }
    } catch (caught) {
      setError(toClientError(caught).message);
    } finally {
      setPending(false);
    }
  }

  if (!open) {
    return (
      <Button variant="outline" size="sm" className="h-8" onClick={() => setOpen(true)}>
        {caseView.nextAction ? "Change" : "Set next action"}
      </Button>
    );
  }

  return (
    <div className="flex w-full flex-col gap-3 sm:min-w-72">
      <Field>
        <FieldLabel htmlFor={`next-action-${caseView._id}`}>Next action</FieldLabel>
        <FieldDescription>
          What the house does next. Shown to the client as their request&rsquo;s next step.
        </FieldDescription>
        <Input
          id={`next-action-${caseView._id}`}
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Call to confirm the first fitting"
        />
      </Field>
      <Field>
        <FieldLabel htmlFor={`next-due-${caseView._id}`}>Due</FieldLabel>
        <FieldDescription>Past this date the request counts as overdue and is escalated once.</FieldDescription>
        <Input
          id={`next-due-${caseView._id}`}
          type="date"
          value={due}
          onChange={(event) => setDue(event.target.value)}
        />
      </Field>
      {error ? <ErrorAlert title="The next action was not saved" message={error} /> : null}
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" className="h-8" disabled={pending || text.trim().length === 0} onClick={() => void save()}>
          {pending ? <Spinner data-icon="inline-start" /> : null}
          Save
        </Button>
        {caseView.nextAction ? (
          <Button variant="ghost" size="sm" className="h-8" disabled={pending} onClick={() => void save(true)}>
            Clear
          </Button>
        ) : null}
        <Button variant="ghost" size="sm" className="h-8" disabled={pending} onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

function toDateInput(timestamp: number): string {
  const date = new Date(timestamp);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/** A date input names a day; the action is due by the end of it in the staff member's zone. */
function endOfDay(value: string): number | undefined {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return undefined;
  return new Date(year, month - 1, day, 23, 59, 59).getTime();
}
