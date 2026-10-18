import { v, type Infer } from "convex/values";
import { mutation, query } from "../_generated/server";
import { appError } from "../lib/errors";
import {
  applyLook as applyLookToDraft,
  archiveDraft,
  commitChange,
  createDraft,
  duplicateDraft,
  findAccessible,
  linkDraft,
  listMine as listMineDrafts,
  renameDraft,
  setFitRoute as setDraftFitRoute,
  setOccasion as setDraftOccasion,
  setShortlist as setDraftShortlist,
  setStage as setDraftStage,
  toDraftExport,
  toDraftView,
} from "../model/atelier/drafts";
import {
  vConflict,
  vDescribedLine,
  vDraftStatus,
  vFitProfileStatus,
  vFitRoute,
  vOccasion,
  vPreviewStatus,
  vSpecPatch,
  vStudioStep,
  vSuitSpec,
} from "../shared/atelier/validators";
import { requireActor, requireDraftAccess, resolveActor } from "./access";
import { ownerArgs, vClothSummary, vDraftWarning } from "./views";

/**
 * Atelier drafts: the working design (contract §5.2). Thin wrappers: each resolves the actor (an
 * account, or a browser holding a guest key), checks it owns the draft and delegates to
 * `convex/model/atelier/drafts.ts`. Nothing here submits; that is `cases.submit`.
 */

export const vPreviewSummary = v.object({
  jobId: v.id("atelierPreviewJobs"),
  status: vPreviewStatus,
  specHash: v.string(),
  /** False when the design has moved on since this preview was made: "Shows a previous design". */
  isCurrent: v.boolean(),
});

export const vFitProfileSummary = v.object({ version: v.number(), status: vFitProfileStatus });

export const vDraftView = v.object({
  _id: v.id("atelierDrafts"),
  name: v.string(),
  occasion: v.optional(vOccasion),
  eventDate: v.optional(v.number()),
  intendedUse: v.optional(v.string()),
  spec: vSuitSpec,
  shortlist: v.array(v.string()),
  stage: vStudioStep,
  completedSteps: v.array(vStudioStep),
  revision: v.number(),
  specHash: v.string(),
  status: vDraftStatus,
  catalogueVersion: v.number(),
  lookKey: v.optional(v.string()),
  sourceOrderId: v.optional(v.id("atelierOrders")),
  cloth: v.union(vClothSummary, v.null()),
  shortlistCloths: v.array(vClothSummary),
  warnings: v.array(vDraftWarning),
  hasPhoto: v.boolean(),
  currentPreview: v.union(vPreviewSummary, v.null()),
  fitRoute: v.union(vFitRoute, v.null()),
  fitProfile: v.union(vFitProfileSummary, v.null()),
  /** The order-book lines: label, value and production id per decision. */
  lines: v.array(vDescribedLine),
  /** When the draft last reached the server; the client says "Saved to this browser" or "Saved to your account". */
  savedAt: v.number(),
  ownedByAccount: v.boolean(),
  createdAt: v.number(),
  updatedAt: v.number(),
});
export type DraftView = Infer<typeof vDraftView>;

export const vDraftSummary = v.object({
  _id: v.id("atelierDrafts"),
  name: v.string(),
  occasion: v.optional(vOccasion),
  eventDate: v.optional(v.number()),
  stage: vStudioStep,
  status: vDraftStatus,
  revision: v.number(),
  /** One line: "Two-piece · peak lapel · Loro Piana 365 Super 130's". */
  summary: v.string(),
  cloth: v.union(vClothSummary, v.null()),
  lookKey: v.optional(v.string()),
  sourceOrderId: v.optional(v.id("atelierOrders")),
  updatedAt: v.number(),
  savedAt: v.number(),
  ownedByAccount: v.boolean(),
  /** A guest draft this browser holds while the viewer is signed in: the link screen offers it (S16). */
  linkable: v.boolean(),
});
export type DraftSummary = Infer<typeof vDraftSummary>;

export const vCommitResult = v.object({
  revision: v.number(),
  /** Fields the dependency engine moved beyond what was asked; empty when the change stood alone. */
  conflicts: v.array(vConflict),
  /** The spec as written, or as proposed when `applied` is false. */
  spec: vSuitSpec,
  applied: v.boolean(),
});
export type CommitResult = Infer<typeof vCommitResult>;

export const vDraftExport = v.object({
  name: v.string(),
  spec: vSuitSpec,
  lines: v.array(vDescribedLine),
  revision: v.number(),
  specHash: v.string(),
  /** Always null from the server: the client stamps the moment it prints or downloads. */
  exportedAt: v.null(),
});
export type DraftExport = Infer<typeof vDraftExport>;

const draftArgs = { ...ownerArgs, draftId: v.id("atelierDrafts") };

/** C01, C02. A guest must pass a guestKey; a look, when named, fills the design and names the draft. */
export const create = mutation({
  args: { ...ownerArgs, lookKey: v.optional(v.string()), occasion: v.optional(vOccasion) },
  returns: v.id("atelierDrafts"),
  handler: async (ctx, { guestKey, lookKey, occasion }) => {
    const actor = await requireActor(ctx, guestKey);
    return createDraft(ctx, actor, { lookKey, occasion });
  },
});

/**
 * The studio's one read. A malformed, unknown or foreign id is null, never an error. `now` lets the
 * client decide how often time-based warnings (event readiness) refresh; it defaults to the server clock.
 */
export const get = query({
  args: { ...ownerArgs, draftId: v.string(), now: v.optional(v.number()) },
  returns: v.union(vDraftView, v.null()),
  handler: async (ctx, { guestKey, draftId, now }) => {
    const id = ctx.db.normalizeId("atelierDrafts", draftId);
    if (!id) return null;
    const actor = await resolveActor(ctx, guestKey);
    const draft = await findAccessible(ctx, id, actor);
    return draft ? toDraftView(ctx, draft, now ?? Date.now()) : null;
  },
});

/** S15, S16: newest first; a signed-out browser without a guest key simply has none. */
export const listMine = query({
  args: ownerArgs,
  returns: v.array(vDraftSummary),
  handler: async (ctx, { guestKey }) => {
    const actor = await resolveActor(ctx, guestKey);
    if (!actor.user && !actor.guestKey) return [];
    return listMineDrafts(ctx, actor);
  },
});

/**
 * S07/S08. Runs the dependency engine; when it had to move other fields and the client has not accepted
 * that, the conflicts and proposed spec come back and nothing is written. An empty patch is a no-op
 * even on a submitted draft; any other change to a submitted or archived draft is INVALID_STATE.
 */
export const commit = mutation({
  args: { ...draftArgs, patch: vSpecPatch, acceptedConflicts: v.boolean() },
  returns: vCommitResult,
  handler: async (ctx, { guestKey, draftId, patch, acceptedConflicts }) => {
    const { draft } = await requireDraftAccess(ctx, draftId, guestKey);
    return commitChange(ctx, draft, patch, acceptedConflicts);
  },
});

/** C02. Occasion, optional event date and intended use; the date drives event readiness warnings. */
export const setOccasion = mutation({
  args: { ...draftArgs, occasion: vOccasion, eventDate: v.optional(v.number()), intendedUse: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, { guestKey, draftId, occasion, eventDate, intendedUse }) => {
    const { draft } = await requireDraftAccess(ctx, draftId, guestKey);
    await setDraftOccasion(ctx, draft, { occasion, eventDate, intendedUse });
    return null;
  },
});

/** C05. Replaces the shortlist (at most ATELIER_LIMITS.shortlistMax codes, each a catalogue cloth). */
export const setShortlist = mutation({
  args: { ...draftArgs, clothCodes: v.array(v.string()) },
  returns: v.array(v.string()),
  handler: async (ctx, { guestKey, draftId, clothCodes }) => {
    const { draft } = await requireDraftAccess(ctx, draftId, guestKey);
    return setDraftShortlist(ctx, draft, clothCodes);
  },
});

export const setStage = mutation({
  args: { ...draftArgs, step: vStudioStep },
  returns: v.null(),
  handler: async (ctx, { guestKey, draftId, step }) => {
    const { draft } = await requireDraftAccess(ctx, draftId, guestKey);
    await setDraftStage(ctx, draft, step);
    return null;
  },
});

/** C15. A preference, not an appointment and not a fit profile. */
export const setFitRoute = mutation({
  args: { ...draftArgs, fitRoute: vFitRoute },
  returns: v.null(),
  handler: async (ctx, { guestKey, draftId, fitRoute }) => {
    const { draft } = await requireDraftAccess(ctx, draftId, guestKey);
    await setDraftFitRoute(ctx, draft, fitRoute);
    return null;
  },
});

export const rename = mutation({
  args: { ...draftArgs, name: v.string() },
  returns: v.null(),
  handler: async (ctx, { guestKey, draftId, name }) => {
    const { draft } = await requireDraftAccess(ctx, draftId, guestKey);
    await renameDraft(ctx, draft, name);
    return null;
  },
});

export const archive = mutation({
  args: draftArgs,
  returns: v.null(),
  handler: async (ctx, { guestKey, draftId }) => {
    const { draft, actor } = await requireDraftAccess(ctx, draftId, guestKey);
    await archiveDraft(ctx, draft, actor);
    return null;
  },
});

/** C02. Replaces the design with a recommended look; the client confirmed before calling (S02). */
export const applyLook = mutation({
  args: { ...draftArgs, lookKey: v.string() },
  returns: vCommitResult,
  handler: async (ctx, { guestKey, draftId, lookKey }) => {
    const { draft } = await requireDraftAccess(ctx, draftId, guestKey);
    return applyLookToDraft(ctx, draft, lookKey);
  },
});

/** C26. A new draft from this one (and, for a reorder, the commission it came from); history stays. */
export const duplicate = mutation({
  args: { ...draftArgs, sourceOrderId: v.optional(v.id("atelierOrders")) },
  returns: v.id("atelierDrafts"),
  handler: async (ctx, { guestKey, draftId, sourceOrderId }) => {
    const { draft, actor } = await requireDraftAccess(ctx, draftId, guestKey);
    return duplicateDraft(ctx, actor, draft, sourceOrderId);
  },
});

/**
 * C13, S16. Signed-in only. Moves a guest draft, with its photographs, previews, requests, fittings,
 * commissions and links, to the account. The guest key must be the one the draft was made with.
 */
export const link = mutation({
  args: { draftId: v.id("atelierDrafts"), guestKey: v.string() },
  returns: v.null(),
  handler: async (ctx, { draftId, guestKey }) => {
    const actor = await resolveActor(ctx, guestKey);
    if (!actor.user) throw appError("UNAUTHENTICATED", "Sign in to save this design to your account.");
    if (!actor.guestKey) throw appError("INVALID_INPUT", "This browser's key for the design is missing or malformed.");
    await linkDraft(ctx, actor.user, draftId, actor.guestKey);
    return null;
  },
});

/** C12, C19. The design as a record for download or print; `exportedAt` is stamped by the client. */
export const exportJson = query({
  args: { ...ownerArgs, draftId: v.string() },
  returns: v.union(vDraftExport, v.null()),
  handler: async (ctx, { guestKey, draftId }) => {
    const id = ctx.db.normalizeId("atelierDrafts", draftId);
    if (!id) return null;
    const actor = await resolveActor(ctx, guestKey);
    const draft = await findAccessible(ctx, id, actor);
    return draft ? toDraftExport(ctx, draft) : null;
  },
});
