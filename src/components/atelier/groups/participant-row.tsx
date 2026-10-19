"use client";

import { useMutation } from "convex/react";
import { designWords, fitWords, PARTICIPANT_TONES } from "@/components/atelier/groups/group-words";
import { StatusLine } from "@/components/atelier/common/status-line";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import { api } from "@convex/_generated/api";
import type { GroupParticipantView } from "@convex/atelier/groups";
import type { GroupStatus } from "@convex/shared/atelier/enums";

/**
 * One participant as the organizer may see them: name, status, and the two readiness facts only when the
 * participant chose to share them. Nothing else about them reaches this row.
 */
export function ParticipantRow({
  participant,
  groupStatus,
}: {
  participant: GroupParticipantView;
  groupStatus: GroupStatus;
}) {
  const remove = useMutation(api.atelier.groups.removeParticipant);
  const declined = participant.status === "declined";
  const ordered = participant.status === "ordered";
  const closed = groupStatus === "closed";

  return (
    <li className="grid gap-4 py-4 lg:grid-cols-[1fr_auto] lg:items-start lg:gap-8">
      <div className="min-w-0 space-y-2">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h3 className="text-base font-medium">{participant.name}</h3>
          <StatusLine tone={PARTICIPANT_TONES[participant.status]}>{participant.statusLabel}</StatusLine>
        </div>
        {!declined ? (
          <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-[minmax(6rem,8rem)_1fr]">
            <dt className="text-xs font-medium tracking-wide text-muted-foreground">Design</dt>
            <dd>{designWords(participant)}</dd>
            <dt className="text-xs font-medium tracking-wide text-muted-foreground">Fit</dt>
            <dd>{fitWords(participant)}</dd>
          </dl>
        ) : null}
        <p className="text-xs text-muted-foreground">
          Invited {formatDate(participant.invitedAt)}
          {participant.joinedAt ? ` · Joined ${formatDate(participant.joinedAt)}` : ""}
        </p>
        {ordered ? (
          <p className="text-xs text-muted-foreground">
            Has placed a commission with the house, so they stay on the house&rsquo;s record. Speak to your concierge.
          </p>
        ) : null}
      </div>
      {!declined ? (
        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          <ConfirmDialog
            trigger={
              <Button variant="outline" className="h-11 rounded-none px-5" disabled={ordered || closed}>
                Remove
              </Button>
            }
            title={`Remove ${participant.name} from the group?`}
            description="They are marked declined here and their invitation link stops working. A design they have already made stays theirs; nothing about them is sent to the house by this."
            confirmLabel="Remove"
            destructive
            onConfirm={() => remove({ participantId: participant.participantId })}
          />
        </div>
      ) : null}
    </li>
  );
}
