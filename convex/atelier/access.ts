import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { getCurrentUser } from "../lib/auth";
import { appError } from "../lib/errors";
import { roleFromClerkMetadata } from "../model/users";
import type { AuditActorKind, StaffRole } from "../shared/atelier/enums";

type Ctx = QueryCtx | MutationCtx;

/**
 * Who is asking. A guest is a browser holding a bearer `guestKey`; a client is a signed-in user. Both
 * can own Atelier rows (`userId` or `guestKey`); staff are users with roles. Never return a guest key
 * from a query: it is the only thing standing between a guest and their draft.
 */
export type Actor = { user: Doc<"users"> | null; guestKey: string | null };

const GUEST_KEY_PATTERN = /^[a-f0-9]{32}$/;

export function isValidGuestKey(value: unknown): value is string {
  return typeof value === "string" && GUEST_KEY_PATTERN.test(value);
}

export async function resolveActor(ctx: Ctx, guestKey?: string | null): Promise<Actor> {
  const user = await getCurrentUser(ctx);
  return { user, guestKey: isValidGuestKey(guestKey) ? guestKey : null };
}

/** An actor that can own something: a user or a valid guest key. Throws UNAUTHENTICATED otherwise. */
export async function requireActor(ctx: Ctx, guestKey?: string | null): Promise<Actor> {
  const actor = await resolveActor(ctx, guestKey);
  if (!actor.user && !actor.guestKey) {
    throw appError("UNAUTHENTICATED", "Sign in, or let this browser keep a draft for you, to continue.");
  }
  return actor;
}

export type Owned = { userId?: Id<"users">; guestKey?: string };

export function isOwner(doc: Owned, actor: Actor): boolean {
  if (actor.user && doc.userId && doc.userId === actor.user._id) return true;
  if (actor.guestKey && doc.guestKey && doc.guestKey === actor.guestKey) return true;
  return false;
}

/** The ownership fields to stamp on a new row for this actor: the account when signed in, else the guest key. */
export function ownerFieldsFor(actor: Actor): Owned {
  if (actor.user) return { userId: actor.user._id };
  if (actor.guestKey) return { guestKey: actor.guestKey };
  throw appError("UNAUTHENTICATED", "Sign in, or let this browser keep a draft for you, to continue.");
}

export function requireOwned<T extends Owned>(doc: T | null | undefined, actor: Actor, what = "design"): T {
  if (!doc || !isOwner(doc, actor)) throw appError("NOT_FOUND", `That ${what} doesn't exist.`);
  return doc;
}

export async function requireDraftAccess(
  ctx: Ctx,
  draftId: Id<"atelierDrafts">,
  guestKey?: string | null,
): Promise<{ draft: Doc<"atelierDrafts">; actor: Actor }> {
  const actor = await resolveActor(ctx, guestKey);
  const draft = requireOwned(await ctx.db.get(draftId), actor, "design");
  return { draft, actor };
}

export function staffRolesOf(user: Doc<"users">): readonly StaffRole[] {
  return user.staffRoles ?? [];
}

/** One role, or any of several (a shade may be confirmed by a fitter or by operations). */
export type StaffRoleRequirement = StaffRole | readonly StaffRole[];

export function hasStaffRole(user: Doc<"users">, role?: StaffRoleRequirement): boolean {
  if (user.role === "admin") return true;
  const held = staffRolesOf(user);
  if (!role) return held.length > 0;
  const wanted = typeof role === "string" ? [role] : role;
  return wanted.some((candidate) => held.includes(candidate));
}

/**
 * Staff gate. An admin (role in Convex and in the Clerk session, as `requireAdmin` checks) holds every
 * role; anyone else needs one of the named roles in `users.staffRoles`. Throws FORBIDDEN.
 */
export async function requireStaff(ctx: Ctx, role?: StaffRoleRequirement): Promise<Doc<"users">> {
  const user = await getCurrentUser(ctx);
  if (!user) throw appError("UNAUTHENTICATED", "Sign in to continue.");
  if (user.role === "admin") {
    const identity = await ctx.auth.getUserIdentity();
    const current = roleFromClerkMetadata(identity?.public_metadata ?? identity?.metadata);
    if (current === "admin") return user;
  }
  if (!hasStaffRole(user, role)) {
    const wanted = role === undefined ? [] : typeof role === "string" ? [role] : [...role];
    const names = wanted.map((candidate) => candidate.replace("_", " ")).join(" or ");
    throw appError("FORBIDDEN", names ? `This needs the ${names} role.` : "Staff only.");
  }
  return user;
}

export type AuditInput = {
  actor: Actor | Doc<"users"> | null;
  actorKind?: AuditActorKind;
  action: string;
  targetTable: string;
  targetId: string;
  meta?: Record<string, unknown>;
};

/** Every staff action and every read of a client's private image lands here (O06, O08). */
export async function audit(ctx: MutationCtx, input: AuditInput, now: number = Date.now()): Promise<void> {
  const user = input.actor && "user" in input.actor ? input.actor.user : input.actor;
  const actorKind: AuditActorKind = input.actorKind ?? (user ? (hasStaffRole(user) ? "staff" : "client") : "system");
  await ctx.db.insert("atelierAuditLog", {
    actorUserId: user?._id,
    actorKind,
    action: input.action,
    targetTable: input.targetTable,
    targetId: input.targetId,
    ...(input.meta ? { meta: input.meta } : {}),
    at: now,
  });
}

/** 32 hex characters from the platform's CSPRNG; used for guest keys, share tokens and invite tokens. */
export function randomToken(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** Only the first name reaches a client: the house's people are named, not exposed. */
export function staffDisplayName(user: Doc<"users"> | null | undefined): string | null {
  if (!user) return null;
  const first = user.name?.trim().split(/\s+/)[0];
  return first || "Your concierge";
}

/** The same first-name rule for a client in a staff view; a guest or a nameless account reads "Client". */
export function clientDisplayName(user: Doc<"users"> | null | undefined): string {
  const first = user?.name?.trim().split(/\s+/)[0];
  return first || "Client";
}
