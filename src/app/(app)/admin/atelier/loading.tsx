import { QueueSkeleton } from "@/components/atelier/staff/queue/queue-skeleton";
import { QUEUE_DESCRIPTION, QUEUE_TITLE } from "@/components/atelier/staff/queue/queue-words";
import { StaffShell } from "@/components/atelier/staff/staff-shell";

export default function Loading() {
  return (
    <StaffShell title={QUEUE_TITLE} description={QUEUE_DESCRIPTION}>
      <QueueSkeleton />
    </StaffShell>
  );
}
