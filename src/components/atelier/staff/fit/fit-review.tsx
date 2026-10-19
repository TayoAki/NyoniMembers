"use client";

import { useQuery } from "convex/react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { useState } from "react";
import { AtelierSection } from "@/components/atelier/common/atelier-section";
import { Mono } from "@/components/atelier/common/mono";
import { OrderBook, OrderBookRow } from "@/components/atelier/common/order-book";
import { StatusLine } from "@/components/atelier/common/status-line";
import { StaffRoleGate, StaffShell } from "@/components/atelier/staff/staff-shell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate, formatDateTime, pluralize } from "@/lib/format";
import { routes } from "@/lib/routes";
import { api } from "@convex/_generated/api";
import type { FitReviewView } from "@convex/atelier/fit";
import { FIT_PROVENANCE_LABELS } from "@convex/shared/atelier/enums";
import {
  JACKET_COMFORT_LABELS,
  MOVEMENT_LABELS,
  POSTURE_LABELS,
  TROUSER_COMFORT_LABELS,
} from "@convex/shared/atelier/measurements";
import { FitActions } from "./fit-actions";
import { FitPhotos } from "./fit-photos";
import { FitReviewSkeleton } from "./fit-skeleton";
import { FIT_STATUS_TONES, flagWords, isPendingFit } from "./fit-words";
import { initialFitterValues, MeasurementReview, parseFitterValues } from "./measurement-review";
import { MEASUREMENT_FIELDS } from "@convex/shared/atelier/measurements";

const REQUIRED_KEYS = MEASUREMENT_FIELDS.filter((field) => field.required).map((field) => field.key);

/** A03 detail (O03). `staffGet` reads a malformed or unknown id as null, which becomes the segment's not-found page. */
export function FitReview({ profileId }: { profileId: string }) {
  return (
    <StaffRoleGate
      role="fitter"
      fallback={
        <StaffShell title="Fit profile">
          <FitReviewSkeleton />
        </StaffShell>
      }
    >
      <FitReviewLoader profileId={profileId} />
    </StaffRoleGate>
  );
}

function FitReviewLoader({ profileId }: { profileId: string }) {
  const view = useQuery(api.atelier.fit.staffGet, { profileId });
  if (view === undefined) {
    return (
      <StaffShell title="Fit profile">
        <FitReviewSkeleton />
      </StaffShell>
    );
  }
  if (view === null) notFound();
  return <FitReviewPage view={view} />;
}

/** Pure composition: give it the review view and it renders deterministically. */
export function FitReviewPage({ view }: { view: FitReviewView }) {
  const { profile } = view;
  const [values, setValues] = useState<Record<string, string>>(() => initialFitterValues(profile));
  const released = view.releasedOrderIds.length > 0;
  const pending = isPendingFit(profile.status);
  const editable = pending && !released;
  const parsed = parseFitterValues(values, profile.units, REQUIRED_KEYS);
  const flags = flagWords(profile);

  return (
    <StaffShell
      title={`${view.clientName} · fit profile v${profile.version}`}
      description={`${profile.statusLabel} · ${profile.provenanceLabel} · submitted ${formatDate(profile.createdAt)}.`}
    >
      <div className="space-y-2">
        {released ? (
          <Alert className="rounded-sm">
            <AlertTitle>Cut against by a released commission</AlertTitle>
            <AlertDescription>
              <span>
                {pluralize(view.releasedOrderIds.length, "commission")} went to the cutter with these exact values, so
                none of them may change here. To correct the fit the client submits a new version, or the house opens a
                correction on the commission.
              </span>
              <span className="flex flex-wrap gap-x-3">
                {view.releasedOrderIds.map((orderId) => (
                  <Link
                    key={orderId}
                    href={routes.staffAtelier.order(orderId)}
                    className="underline underline-offset-4"
                  >
                    <Mono upper={false}>{orderId}</Mono>
                  </Link>
                ))}
              </span>
            </AlertDescription>
          </Alert>
        ) : null}

        <AtelierSection
          id="standing"
          title="Standing"
          description="What the client reads, and where this version sits in their history."
        >
          <OrderBook>
            <OrderBookRow
              label="Status"
              value={<StatusLine tone={FIT_STATUS_TONES[profile.status]}>{profile.statusLabel}</StatusLine>}
            />
            <OrderBookRow label="Provenance" value={profile.provenanceLabel} code={profile.provenance} />
            <OrderBookRow
              label="Units"
              value={profile.units === "cm" ? "Measured in centimetres" : "Measured in inches"}
              note="Stored in centimetres; shown in both."
            />
            <OrderBookRow label="Submitted" value={formatDateTime(profile.createdAt)} />
            {profile.supersedesId ? (
              <OrderBookRow label="Revises" value="An earlier version" code={profile.supersedesId} />
            ) : null}
            <OrderBookRow
              label="For your attention"
              value={flags.length === 0 ? "Nothing flagged" : flags.join(" · ")}
              tone={flags.length === 0 ? "muted" : "warning"}
            />
            {profile.clarification ? (
              <OrderBookRow
                label="Question asked"
                value={<span className="whitespace-pre-wrap">{profile.clarification}</span>}
                note="The client reads this until they answer with a new version."
              />
            ) : null}
            {profile.reviewNote ? (
              <OrderBookRow
                label="Review note"
                value={<span className="whitespace-pre-wrap">{profile.reviewNote}</span>}
              />
            ) : null}
            {profile.reviewedAt !== null ? (
              <OrderBookRow
                label="Reviewed"
                value={`${profile.reviewer ?? "A fitter"} · ${formatDateTime(profile.reviewedAt)}`}
              />
            ) : null}
            {view.previousApproved ? (
              <OrderBookRow
                label="Would supersede"
                value={`Approved version ${view.previousApproved.version}`}
                note={
                  view.previousApproved.reviewedAt !== null
                    ? `Approved ${formatDate(view.previousApproved.reviewedAt)}; its values are shown beside each measurement.`
                    : undefined
                }
                action={
                  <Link
                    href={routes.staffAtelier.fitProfile(view.previousApproved.profileId)}
                    className="text-sm underline underline-offset-4"
                  >
                    Open v{view.previousApproved.version}
                  </Link>
                }
              />
            ) : null}
          </OrderBook>
        </AtelierSection>

        <AtelierSection
          id="measurements"
          title="Measurement sheet"
          description={
            editable
              ? "The client's values with the fitter's value beside each. Change only what you can explain; the note below goes to the client."
              : "The client's values and, where a fitter settled on something different, the fitter's value."
          }
        >
          <MeasurementReview
            profile={profile}
            previousApproved={view.previousApproved}
            values={values}
            onChange={(key, value) => setValues((current) => ({ ...current, [key]: value }))}
            editable={editable}
          />
        </AtelierSection>

        <AtelierSection
          id="comfort"
          title="Comfort, movement and posture"
          description="How the client wants the suit to feel and what they will do in it."
        >
          <OrderBook>
            <OrderBookRow
              label="Jacket"
              value={JACKET_COMFORT_LABELS[profile.comfort.jacket]}
              code={profile.comfort.jacket}
            />
            <OrderBookRow
              label="Trousers"
              value={TROUSER_COMFORT_LABELS[profile.comfort.trousers]}
              code={profile.comfort.trousers}
            />
            <OrderBookRow
              label="Movement"
              value={
                profile.comfort.movement.length === 0
                  ? "Nothing in particular"
                  : profile.comfort.movement.map((movement) => MOVEMENT_LABELS[movement]).join(", ")
              }
              tone={profile.comfort.movement.length === 0 ? "muted" : "default"}
            />
            <OrderBookRow
              label="Posture"
              value={profile.posture ? POSTURE_LABELS[profile.posture] : "Not stated"}
              tone={profile.posture ? "default" : "muted"}
              code={profile.posture ?? null}
            />
            {profile.notes ? (
              <OrderBookRow
                label="Client's notes"
                value={<span className="whitespace-pre-wrap">{profile.notes}</span>}
              />
            ) : null}
          </OrderBook>
        </AtelierSection>

        <AtelierSection
          id="photographs"
          title="Posture photographs"
          description="Private to the fitter. Each look is recorded."
        >
          <FitPhotos profileId={profile._id} photos={profile.photos} />
        </AtelierSection>

        <AtelierSection
          id="decision"
          title="Decision"
          description={
            editable
              ? "One of two outcomes. Both are audited under your name."
              : released
                ? "No decision can be taken on a version a released commission was cut against."
                : `This version is “${profile.statusLabel}”; only a version awaiting review can be decided.`
          }
        >
          {editable ? <FitActions profileId={profile._id} version={profile.version} parsed={parsed} /> : null}
        </AtelierSection>

        <AtelierSection
          id="history"
          title="History"
          description="Every version this client has sent, newest first. Superseded versions are kept."
        >
          <div className="-mx-4 sm:mx-0">
            <Table className="min-w-[36rem]">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Version</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Provenance</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Reviewed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {view.history.map((entry) => {
                  const current = entry.profileId === profile._id;
                  return (
                    <TableRow key={entry.profileId} className="align-top">
                      <TableCell className="font-medium">
                        {current ? (
                          <span>
                            v{entry.version} <span className="text-xs text-muted-foreground">(this page)</span>
                          </span>
                        ) : (
                          <Link
                            href={routes.staffAtelier.fitProfile(entry.profileId)}
                            className="underline-offset-4 hover:underline"
                          >
                            v{entry.version}
                          </Link>
                        )}
                      </TableCell>
                      <TableCell>
                        <StatusLine tone={FIT_STATUS_TONES[entry.status]}>{entry.statusLabel}</StatusLine>
                      </TableCell>
                      <TableCell className="whitespace-normal">{FIT_PROVENANCE_LABELS[entry.provenance]}</TableCell>
                      <TableCell>
                        <Mono upper={false} className="text-[11px] text-foreground/80">
                          {formatDate(entry.createdAt)}
                        </Mono>
                      </TableCell>
                      <TableCell>
                        <Mono upper={false} className="text-[11px] text-foreground/80">
                          {entry.reviewedAt !== null ? formatDate(entry.reviewedAt) : "—"}
                        </Mono>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </AtelierSection>
      </div>
    </StaffShell>
  );
}
