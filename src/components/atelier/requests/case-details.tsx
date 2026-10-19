"use client";

import Link from "next/link";
import { AtelierSection } from "@/components/atelier/common/atelier-section";
import { OrderBook, OrderBookRow } from "@/components/atelier/common/order-book";
import { CHANNEL_WORDS } from "@/components/atelier/requests/case-words";
import { formatDateTime } from "@/lib/format";
import { routes } from "@/lib/routes";
import type { CaseView } from "@convex/atelier/cases";
import { SHOWROOMS } from "@convex/shared/house";

const SAMPLE_PENDING_NOTE = "A concierge will confirm when it ships.";

/** What the client sent, as the house holds it: their words, the sample or fitting it carries, and their contact details. */
export function CaseDetails({ request }: { request: CaseView }) {
  const { contact, sample, appointment } = request;
  const showroom = contact.preferredShowroom
    ? SHOWROOMS.find((entry) => entry.id === contact.preferredShowroom)
    : undefined;
  const appointmentShowroom = appointment ? SHOWROOMS.find((entry) => entry.id === appointment.showroomId) : undefined;
  return (
    <AtelierSection id="request-details" title="Your request" description="What you sent, as the house holds it.">
      <OrderBook aria-label="Your request">
        <OrderBookRow label="Kind" value={request.kindLabel} />
        {request.message ? (
          <OrderBookRow label="Your message" value={<span className="whitespace-pre-line">{request.message}</span>} />
        ) : null}
        {sample ? (
          <>
            <OrderBookRow
              label="Cloth sample"
              value={sample.clothName ?? sample.clothCode}
              code={sample.clothCode}
              note={sample.state === "requested" || sample.state === "accepted" ? SAMPLE_PENDING_NOTE : null}
            />
            <OrderBookRow label="Sample status" value={sample.stateLabel} />
            <OrderBookRow
              label="Ship to"
              value={
                <span className="flex flex-col gap-0.5">
                  <span>{sample.address.line1}</span>
                  {sample.address.line2 ? <span>{sample.address.line2}</span> : null}
                  <span>
                    {sample.address.city}, {sample.address.region} {sample.address.postalCode}
                  </span>
                  <span>{sample.address.country}</span>
                </span>
              }
            />
          </>
        ) : null}
        {appointment ? (
          <OrderBookRow
            label="Fitting"
            value={
              <Link href={routes.atelier.fitting(appointment.appointmentId)} className="underline underline-offset-4">
                {appointment.serviceLabel} · {appointment.statusLabel}
              </Link>
            }
            note={
              appointment.showroomId === "virtual"
                ? "By video. The time, when confirmed, is on the fitting itself."
                : `${appointmentShowroom?.city ?? appointment.showroomId} showroom. The time, when confirmed, is on the fitting itself.`
            }
          />
        ) : null}
        <OrderBookRow label="Name" value={contact.name} />
        <OrderBookRow label="Email" value={contact.email} />
        {contact.phone ? <OrderBookRow label="Phone" value={contact.phone} /> : null}
        {showroom ? <OrderBookRow label="Preferred showroom" value={showroom.city} note={showroom.address} /> : null}
        <OrderBookRow label="Reach me by" value={CHANNEL_WORDS[contact.channel]} />
        <OrderBookRow label="Sent" value={formatDateTime(request.createdAt)} code={request._id} />
      </OrderBook>
    </AtelierSection>
  );
}
