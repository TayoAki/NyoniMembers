import type { Id } from "../../_generated/dataModel";
import type { MutationCtx } from "../../_generated/server";
import type { Owned } from "../../atelier/access";
import type { NotificationChannel } from "../../shared/atelier/enums";

/**
 * Notification records. Nothing is sent yet: a row is `queued` and stays so until a sender marks it
 * `sent`, `delivered` or `failed`. The UI therefore never claims an email went out; the in-app case is
 * the source of truth (contract §0).
 */
export type NotificationInput = {
  owner: Owned;
  caseId?: Id<"atelierCases">;
  channel: NotificationChannel;
  to: string;
  subject: string;
  body: string;
};

export async function queueNotification(
  ctx: MutationCtx,
  input: NotificationInput,
  now: number = Date.now(),
): Promise<Id<"atelierNotifications">> {
  return ctx.db.insert("atelierNotifications", {
    ...input.owner,
    caseId: input.caseId,
    channel: input.channel,
    to: input.to,
    subject: input.subject,
    body: input.body,
    status: "queued",
    createdAt: now,
  });
}
