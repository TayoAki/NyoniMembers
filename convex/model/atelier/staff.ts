import type { Doc, Id } from "../../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../../_generated/server";
import { audit, clientDisplayName, requireStaff, staffRolesOf } from "../../atelier/access";
import type { AuditEntry, StaffMember, StaffStatus } from "../../atelier/staff";
import { appError } from "../../lib/errors";
import { STAFF_ROLES, type StaffRole } from "../../shared/atelier/enums";

type Ctx = QueryCtx | MutationCtx;
type User = Doc<"users">;
type AuditRow = Doc<"atelierAuditLog">;

/**
 * Staff roles and the audit log (contract §5.13; O08, A08). An admin holds every role implicitly and is
 * the only one who grants roles; `requireStaff` enforces the roles everywhere else. The audit log is
 * append-only: nothing here edits or deletes an entry.
 */

export const AUDIT_LIMIT_DEFAULT = 50;
export const AUDIT_LIMIT_MAX = 200;
/** Accounts read when listing staff; the house's team is a few dozen people among a few thousand clients. */
export const USERS_READ_MAX = 2000;

export function isStaffRole(value: string): value is StaffRole {
  return (STAFF_ROLES as readonly string[]).includes(value);
}

/** Unknown roles are refused; duplicates collapse; the result keeps STAFF_ROLES' order. */
export function normalizeRoles(roles: readonly string[]): StaffRole[] {
  for (const role of roles) {
    if (!isStaffRole(role)) {
      throw appError("INVALID_INPUT", `"${role}" is not a role the house uses.`, { role, roles: [...STAFF_ROLES] });
    }
  }
  return STAFF_ROLES.filter((role) => roles.includes(role));
}

export function staffStatusFor(user: User): StaffStatus {
  const roles = [...staffRolesOf(user)];
  const isAdmin = user.role === "admin";
  return { roles, isAdmin, isStaff: isAdmin || roles.length > 0 };
}

export function isStaffMember(user: User): boolean {
  return user.role === "admin" || staffRolesOf(user).length > 0;
}

export function toStaffMember(user: User): StaffMember {
  return {
    userId: user._id,
    name: user.name?.trim() || "Unnamed account",
    email: user.email ?? null,
    roles: [...staffRolesOf(user)],
    isAdmin: user.role === "admin",
  };
}

/** The staff gate plus the admin check: roles are granted by admins alone. */
export async function requireAdminStaff(ctx: Ctx): Promise<User> {
  const user = await requireStaff(ctx);
  if (user.role !== "admin") throw appError("FORBIDDEN", "Admins only.");
  return user;
}

/** Admins and role holders, oldest account first. Read through the creation index, bounded. */
export async function listStaff(ctx: Ctx): Promise<StaffMember[]> {
  const users = await ctx.db.query("users").withIndex("by_createdAt").order("asc").take(USERS_READ_MAX);
  return users.filter(isStaffMember).map(toStaffMember);
}

export async function setStaffRoles(
  ctx: MutationCtx,
  admin: User,
  userId: Id<"users">,
  roles: readonly string[],
  now: number = Date.now(),
): Promise<StaffMember> {
  const target = await ctx.db.get(userId);
  if (!target) throw appError("NOT_FOUND", "That account doesn't exist.");
  const next = normalizeRoles(roles);
  const before = [...staffRolesOf(target)];
  const unchanged = before.length === next.length && before.every((role, index) => role === next[index]);
  if (!unchanged) {
    // An empty list removes the field rather than leaving an empty array behind.
    await ctx.db.patch(target._id, { staffRoles: next.length > 0 ? next : undefined });
    await audit(
      ctx,
      {
        actor: admin,
        actorKind: "staff",
        action: "staff.setRoles",
        targetTable: "users",
        targetId: target._id,
        meta: { before, after: next },
      },
      now,
    );
  }
  const updated = await ctx.db.get(target._id);
  return toStaffMember(updated ?? { ...target, staffRoles: next.length > 0 ? next : undefined });
}

export type AuditFilter = { targetTable?: string; targetId?: string; limit?: number };

export function clampAuditLimit(limit: number | undefined): number {
  if (limit === undefined || !Number.isFinite(limit)) return AUDIT_LIMIT_DEFAULT;
  return Math.min(AUDIT_LIMIT_MAX, Math.max(1, Math.trunc(limit)));
}

async function readAudit(ctx: Ctx, filter: AuditFilter, limit: number): Promise<AuditRow[]> {
  const table = filter.targetTable?.trim();
  const id = filter.targetId?.trim();
  if (id && !table) throw appError("INVALID_INPUT", "Name the table the record belongs to as well as its id.");
  if (table && id) {
    return ctx.db
      .query("atelierAuditLog")
      .withIndex("by_target", (q) => q.eq("targetTable", table).eq("targetId", id))
      .order("desc")
      .take(limit);
  }
  if (table) {
    return ctx.db
      .query("atelierAuditLog")
      .withIndex("by_target", (q) => q.eq("targetTable", table))
      .order("desc")
      .take(limit);
  }
  return ctx.db.query("atelierAuditLog").withIndex("by_at").order("desc").take(limit);
}

/** Entries newest first, each naming its actor by first name only. */
export async function listAudit(ctx: Ctx, filter: AuditFilter): Promise<AuditEntry[]> {
  const rows = await readAudit(ctx, filter, clampAuditLimit(filter.limit));
  const actors = new Map<Id<"users">, User | null>();
  for (const row of rows) {
    if (row.actorUserId && !actors.has(row.actorUserId)) actors.set(row.actorUserId, await ctx.db.get(row.actorUserId));
  }
  return rows.map((row) => ({
    _id: row._id,
    at: row.at,
    action: row.action,
    actorKind: row.actorKind,
    actorName: actorNameFor(row, row.actorUserId ? (actors.get(row.actorUserId) ?? null) : null),
    actorUserId: row.actorUserId,
    targetTable: row.targetTable,
    targetId: row.targetId,
    meta: row.meta,
  }));
}

function actorNameFor(row: Pick<AuditRow, "actorKind" | "actorUserId">, user: User | null): string {
  if (row.actorKind === "system" && !row.actorUserId) return "System";
  return clientDisplayName(user);
}
