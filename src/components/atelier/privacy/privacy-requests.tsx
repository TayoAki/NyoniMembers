"use client";

import { AtelierSection } from "@/components/atelier/common/atelier-section";
import { PrivacyRequestItem } from "@/components/atelier/privacy/privacy-request-item";
import { PROVIDER_WAIT_SENTENCE } from "@/components/atelier/privacy/privacy-words";
import type { Id } from "@convex/_generated/dataModel";
import type { PrivacyRequestSummary } from "@convex/atelier/privacy";

type Props = {
  requests: PrivacyRequestSummary[];
  ownerArgs: { guestKey?: string } | "skip";
  focusId: Id<"atelierPrivacyRequests"> | null;
};

/** S34 · Your requests: every export or removal this browser or account has asked for, newest first. */
export function PrivacyRequests({ requests, ownerArgs, focusId }: Props) {
  return (
    <AtelierSection
      id="privacy-requests"
      title="Your requests"
      description={`Each request to export or remove your data, with its steps as they actually ran. ${PROVIDER_WAIT_SENTENCE}`}
    >
      {requests.length === 0 ? (
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          No privacy requests yet. Each one you make is recorded here with its steps, and stays on record after it
          completes.
        </p>
      ) : (
        <ul className="divide-y divide-foreground/10 border-y border-foreground/15" aria-label="Your privacy requests">
          {requests.map((request) => (
            <PrivacyRequestItem
              key={request._id}
              summary={request}
              ownerArgs={ownerArgs}
              focused={request._id === focusId}
            />
          ))}
        </ul>
      )}
    </AtelierSection>
  );
}
