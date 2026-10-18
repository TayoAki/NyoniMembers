import { v, type Infer } from "convex/values";
import { query } from "../_generated/server";
import { vNotificationChannel, vNotificationStatus } from "../shared/atelier/validators";
import { requireStaff } from "./access";

/**
 * Atelier notifications (contract §5.13). Records, not sends: a row is `queued` until a sender marks it
 * otherwise, so the case detail can show staff exactly what the client has and has not been told. The
 * queue helper itself is `queueNotification` in `convex/model/atelier/notifications.ts`.
 */

export const NOTIFICATIONS_MAX = 100;

export const vNotificationView = v.object({
  _id: v.id("atelierNotifications"),
  channel: vNotificationChannel,
  to: v.string(),
  subject: v.string(),
  body: v.string(),
  status: vNotificationStatus,
  providerRef: v.union(v.string(), v.null()),
  error: v.union(v.string(), v.null()),
  createdAt: v.number(),
  sentAt: v.union(v.number(), v.null()),
});
export type NotificationView = Infer<typeof vNotificationView>;

/** Staff only: every message record for a case, newest first, with its real delivery state. */
export const listForCase = query({
  args: { caseId: v.id("atelierCases") },
  returns: v.array(vNotificationView),
  handler: async (ctx, { caseId }) => {
    await requireStaff(ctx, "concierge");
    const rows = await ctx.db
      .query("atelierNotifications")
      .withIndex("by_case", (q) => q.eq("caseId", caseId))
      .order("desc")
      .take(NOTIFICATIONS_MAX);
    return rows.map((row) => ({
      _id: row._id,
      channel: row.channel,
      to: row.to,
      subject: row.subject,
      body: row.body,
      status: row.status,
      providerRef: row.providerRef ?? null,
      error: row.error ?? null,
      createdAt: row.createdAt,
      sentAt: row.sentAt ?? null,
    }));
  },
});
