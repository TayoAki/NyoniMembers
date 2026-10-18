import { v, type Infer } from "convex/values";
import { mutation, query } from "../_generated/server";
import {
  createShare,
  listSharesForDraft,
  revokeShare,
  sharedDesignByToken,
  toShareView,
} from "../model/atelier/shares";
import { vDescribedLine, vOccasion, vSuitSpec } from "../shared/atelier/validators";
import { requireDraftAccess, resolveActor } from "./access";
import { ownerArgs, vClothSummary } from "./views";

/**
 * Atelier shares: revocable read-only design links (contract §5.3; journey C13, screen S17). A share
 * exposes the design and the catalogue's words for it, never the owner, their photographs, previews or
 * measurements. The public read is by token only; everything else is the owner's.
 */

export const vShareView = v.object({
  _id: v.id("atelierShares"),
  /** The owner's own link; they may copy it again. */
  token: v.string(),
  audience: v.string(),
  expiresAt: v.number(),
  revokedAt: v.optional(v.number()),
  createdAt: v.number(),
  state: v.union(v.literal("active"), v.literal("expired"), v.literal("revoked")),
});
export type ShareView = Infer<typeof vShareView>;

/** What a recipient sees: the design, its lines and the cloth. Nothing that identifies the owner. */
export const vSharedDesignView = v.object({
  name: v.string(),
  spec: vSuitSpec,
  lines: v.array(vDescribedLine),
  cloth: v.union(vClothSummary, v.null()),
  occasion: v.optional(vOccasion),
  createdAt: v.number(),
  expiresAt: v.number(),
});
export type SharedDesignView = Infer<typeof vSharedDesignView>;

export const vSharedDesignResult = v.union(vSharedDesignView, v.object({ expired: v.literal(true) }), v.null());
export type SharedDesignResult = Infer<typeof vSharedDesignResult>;

/** The owner names the audience and how long the link stays open (at most ATELIER_LIMITS.shareMaxDays). */
export const create = mutation({
  args: { ...ownerArgs, draftId: v.id("atelierDrafts"), audience: v.string(), expiresInDays: v.number() },
  returns: v.object({ shareId: v.id("atelierShares"), token: v.string() }),
  handler: async (ctx, { guestKey, draftId, audience, expiresInDays }) => {
    const { draft, actor } = await requireDraftAccess(ctx, draftId, guestKey);
    return createShare(ctx, draft, actor, { audience, expiresInDays });
  },
});

/** Closes the link at once; a recipient who opens it afterwards sees that it has expired. */
export const revoke = mutation({
  args: { ...ownerArgs, shareId: v.id("atelierShares") },
  returns: v.null(),
  handler: async (ctx, { guestKey, shareId }) => {
    const actor = await resolveActor(ctx, guestKey);
    await revokeShare(ctx, shareId, actor);
    return null;
  },
});

/** The owner's links for one design, newest first, each with its state at `now` (defaults to the server clock). */
export const listForDraft = query({
  args: { ...ownerArgs, draftId: v.id("atelierDrafts"), now: v.optional(v.number()) },
  returns: v.array(vShareView),
  handler: async (ctx, { guestKey, draftId, now }) => {
    const { draft } = await requireDraftAccess(ctx, draftId, guestKey);
    const at = now ?? Date.now();
    return (await listSharesForDraft(ctx, draft._id)).map((share) => toShareView(share, at));
  },
});

/**
 * Public, S17. Null when the link never existed; `{ expired: true }` when it was revoked or has run out;
 * otherwise the design alone. No sign-in, no guest key, no owner data.
 */
export const getByToken = query({
  args: { token: v.string(), now: v.optional(v.number()) },
  returns: vSharedDesignResult,
  handler: async (ctx, { token, now }) => sharedDesignByToken(ctx, token, now ?? Date.now()),
});
