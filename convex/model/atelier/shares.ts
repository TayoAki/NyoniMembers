import type { Doc, Id } from "../../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../../_generated/server";
import { audit, ownerFieldsFor, randomToken, requireOwned, type Actor } from "../../atelier/access";
import type { SharedDesignResult, ShareView } from "../../atelier/shares";
import { appError } from "../../lib/errors";
import { ATELIER_LIMITS } from "../../shared/atelier/enums";
import { describeSpec } from "../../shared/atelier/spec";
import { clothSummary, specNames } from "./catalogue";
import { SHARE_AUDIENCE_MAX } from "./drafts";

type Ctx = QueryCtx | MutationCtx;
type Share = Doc<"atelierShares">;

/**
 * Read-only design links (C13, S17; contract §5.3). A share carries the design and the catalogue's words
 * for it, and nothing else: no contact, no photographs, no previews, no measurements, so revoking one
 * never has to claw anything private back (cross-cutting scenario 5). The token is the only key.
 */

const DAY_MS = 86_400_000;
/** Links a single design may have; the owner revokes old ones rather than piling up new ones. */
const SHARES_PER_DRAFT_MAX = 20;

export type CreateShareInput = { audience: string; expiresInDays: number };

export async function createShare(
  ctx: MutationCtx,
  draft: Doc<"atelierDrafts">,
  actor: Actor,
  input: CreateShareInput,
  now: number = Date.now(),
): Promise<{ shareId: Id<"atelierShares">; token: string }> {
  const owner = ownerFieldsFor(actor);
  if (draft.status === "archived") {
    throw appError("INVALID_STATE", "This design has been archived. Duplicate it to share it again.", {
      status: draft.status,
    });
  }
  const audience = input.audience.trim();
  if (audience.length === 0)
    throw appError("INVALID_INPUT", "Say who this link is for, so you can tell your links apart later.");
  if (audience.length > SHARE_AUDIENCE_MAX) {
    throw appError("INVALID_INPUT", `Keep the audience to ${SHARE_AUDIENCE_MAX} characters.`, {
      max: SHARE_AUDIENCE_MAX,
    });
  }
  const days = Math.trunc(input.expiresInDays);
  if (!Number.isFinite(days) || days < 1 || days > ATELIER_LIMITS.shareMaxDays) {
    throw appError("INVALID_INPUT", `A link can stay open for between 1 and ${ATELIER_LIMITS.shareMaxDays} days.`, {
      max: ATELIER_LIMITS.shareMaxDays,
    });
  }
  const existing = await listSharesForDraft(ctx, draft._id);
  if (existing.filter((share) => isLive(share, now)).length >= SHARES_PER_DRAFT_MAX) {
    throw appError(
      "INVALID_INPUT",
      `This design already has ${SHARES_PER_DRAFT_MAX} open links. Revoke one to make another.`,
      {
        max: SHARES_PER_DRAFT_MAX,
      },
    );
  }
  const token = randomToken();
  const shareId = await ctx.db.insert("atelierShares", {
    draftId: draft._id,
    token,
    ...owner,
    audience,
    expiresAt: now + days * DAY_MS,
    createdAt: now,
  });
  await audit(
    ctx,
    {
      actor,
      action: "share.create",
      targetTable: "atelierShares",
      targetId: shareId,
      meta: { draftId: draft._id, days },
    },
    now,
  );
  return { shareId, token };
}

/** Idempotent: revoking a revoked link changes nothing. The owner is checked, never the token's bearer. */
export async function revokeShare(
  ctx: MutationCtx,
  shareId: Id<"atelierShares">,
  actor: Actor,
  now: number = Date.now(),
): Promise<void> {
  const share = requireOwned(await ctx.db.get(shareId), actor, "link");
  if (share.revokedAt !== undefined) return;
  await ctx.db.patch(share._id, { revokedAt: now });
  await audit(
    ctx,
    {
      actor,
      action: "share.revoke",
      targetTable: "atelierShares",
      targetId: share._id,
      meta: { draftId: share.draftId },
    },
    now,
  );
}

/** Privacy (C27, O08) and deletion: every open link on a design is closed at once. Returns how many were. */
export async function revokeSharesForDraft(
  ctx: MutationCtx,
  draftId: Id<"atelierDrafts">,
  now: number = Date.now(),
): Promise<number> {
  const shares = await listSharesForDraft(ctx, draftId);
  let revoked = 0;
  for (const share of shares) {
    if (share.revokedAt !== undefined) continue;
    await ctx.db.patch(share._id, { revokedAt: now });
    revoked += 1;
  }
  return revoked;
}

export async function listSharesForDraft(ctx: Ctx, draftId: Id<"atelierDrafts">): Promise<Share[]> {
  return ctx.db
    .query("atelierShares")
    .withIndex("by_draft", (q) => q.eq("draftId", draftId))
    .order("desc")
    .take(SHARES_PER_DRAFT_MAX * 2);
}

export function isLive(share: Share, now: number): boolean {
  return share.revokedAt === undefined && share.expiresAt > now;
}

export function shareState(share: Share, now: number): ShareView["state"] {
  if (share.revokedAt !== undefined) return "revoked";
  if (share.expiresAt <= now) return "expired";
  return "active";
}

/** The owner's view of a link; the token is theirs to copy again. */
export function toShareView(share: Share, now: number): ShareView {
  return {
    _id: share._id,
    token: share.token,
    audience: share.audience,
    expiresAt: share.expiresAt,
    revokedAt: share.revokedAt,
    createdAt: share.createdAt,
    state: shareState(share, now),
  };
}

export async function findByToken(ctx: Ctx, token: string): Promise<Share | null> {
  if (!token) return null;
  return ctx.db
    .query("atelierShares")
    .withIndex("by_token", (q) => q.eq("token", token))
    .unique();
}

/**
 * S17. Null for a link that never existed; `{ expired: true }` for one that was revoked, has run out or
 * whose design was archived; otherwise the design alone. Nothing here can reach the owner's account,
 * photographs or measurements, and nothing here can change the owner's suit.
 */
export async function sharedDesignByToken(ctx: Ctx, token: string, now: number): Promise<SharedDesignResult> {
  const share = await findByToken(ctx, token);
  if (!share) return null;
  if (!isLive(share, now)) return { expired: true };
  const draft = await ctx.db.get(share.draftId);
  if (!draft || draft.status === "archived") return { expired: true };
  const [names, cloth] = await Promise.all([specNames(ctx, draft.spec), clothSummary(ctx, draft.spec.clothCode)]);
  return {
    name: draft.name,
    spec: draft.spec,
    lines: describeSpec(draft.spec, names),
    cloth,
    occasion: draft.occasion,
    createdAt: share.createdAt,
    expiresAt: share.expiresAt,
  };
}
