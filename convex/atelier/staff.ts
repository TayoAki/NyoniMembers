import { v, type Infer } from "convex/values";
import { query, mutation } from "../_generated/server";
import { getCurrentUser } from "../lib/auth";
import { listAudit, listStaff, requireAdminStaff, setStaffRoles, staffStatusFor } from "../model/atelier/staff";
import { vAuditActorKind, vStaffRole } from "../shared/atelier/validators";
import { requireStaff } from "./access";

/**
 * Staff administration for the Atelier (contract §5.13; journey O08, surface A08): who holds which
 * role, and the audit log of what the house's people did. Roles are set only by an admin and every
 * change is itself audited.
 */

export const vStaffStatus = v.object({
  roles: v.array(vStaffRole),
  isAdmin: v.boolean(),
  /** An admin or anyone holding at least one role. */
  isStaff: v.boolean(),
});
export type StaffStatus = Infer<typeof vStaffStatus>;

export const vStaffMember = v.object({
  userId: v.id("users"),
  name: v.string(),
  email: v.union(v.string(), v.null()),
  roles: v.array(vStaffRole),
  isAdmin: v.boolean(),
});
export type StaffMember = Infer<typeof vStaffMember>;

export const vAuditEntry = v.object({
  _id: v.id("atelierAuditLog"),
  at: v.number(),
  action: v.string(),
  actorKind: vAuditActorKind,
  /** First name only; "System" for an automated step; "Client" for a guest or a nameless account. */
  actorName: v.string(),
  actorUserId: v.optional(v.id("users")),
  targetTable: v.string(),
  targetId: v.string(),
  meta: v.optional(v.record(v.string(), v.any())),
});
export type AuditEntry = Infer<typeof vAuditEntry>;

/** The signed-in person's standing with the house; null when signed out. */
export const me = query({
  args: {},
  returns: v.union(vStaffStatus, v.null()),
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    return user ? staffStatusFor(user) : null;
  },
});

/** Every admin and everyone holding a role. Admin only. */
export const list = query({
  args: {},
  returns: v.array(vStaffMember),
  handler: async (ctx) => {
    await requireAdminStaff(ctx);
    return listStaff(ctx);
  },
});

/** Replaces a person's roles. Admin only; audited as `staff.setRoles` with the roles before and after. */
export const setRoles = mutation({
  args: { userId: v.id("users"), roles: v.array(v.string()) },
  returns: vStaffMember,
  handler: async (ctx, { userId, roles }) => {
    const admin = await requireAdminStaff(ctx);
    return setStaffRoles(ctx, admin, userId, roles);
  },
});

/**
 * The audit log, newest first. Both `targetTable` and `targetId` narrow it to one record; `targetTable`
 * alone to one table. Admins and the privacy role read it; at most 200 rows a call.
 */
export const auditLog = query({
  args: { targetTable: v.optional(v.string()), targetId: v.optional(v.string()), limit: v.optional(v.number()) },
  returns: v.array(vAuditEntry),
  handler: async (ctx, args) => {
    await requireStaff(ctx, "privacy");
    return listAudit(ctx, args);
  },
});
