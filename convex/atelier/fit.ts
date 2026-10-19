import { v, type Infer } from "convex/values";
import { mutation, query } from "../_generated/server";
import { requireUser } from "../lib/auth";
import { appError } from "../lib/errors";
import {
  approveProfile,
  confirmReuse as confirmReuseOnDraft,
  latestProfileForUser,
  listProfilesForUser,
  listQueue,
  newestFirst,
  registerFitPhoto as registerPhoto,
  removeFitPhoto as removePhoto,
  requireOwnedPhoto,
  requireOwnedProfile,
  requestClarification as requestClarificationOnProfile,
  startRevision as startRevisionFrom,
  submitRemote as submitRemoteProfile,
  toProfileView,
  toReviewView,
  viewPhotosAsStaff,
} from "../model/atelier/fit";
import {
  vFitComfort,
  vFitPhotoPose,
  vFitProfileStatus,
  vFitProvenance,
  vPosture,
  vUnit,
} from "../shared/atelier/validators";
import { requireDraftAccess, requireStaff } from "./access";
import { ownerArgs } from "./views";

/**
 * Atelier fit profiles (contract §5.5; journeys C15–C17, O03; screens S19–S21, A03). Accounts only:
 * measurements never hang off a browser's bearer key. Values are stored in centimetres keyed by
 * `MEASUREMENT_FIELDS[].key`; the client converts and rounds, and approved values are snapped to the same
 * grid on the server. Nothing here approves anything on the
 * client's behalf: a profile is provisional until a fitter approves it, and an approved profile is
 * never edited in place. Thin wrappers; the rules live in `convex/model/atelier/fit.ts`.
 */

const vMeasurements = v.record(v.string(), v.number());

export const vFitPhotoView = v.object({
  photoId: v.id("atelierFitPhotos"),
  pose: vFitPhotoPose,
  /** A signed URL, or null when the file is gone. Never a storage id. */
  url: v.union(v.string(), v.null()),
  createdAt: v.number(),
});
export type FitPhotoView = Infer<typeof vFitPhotoView>;

export const vFitProfileView = v.object({
  _id: v.id("atelierFitProfiles"),
  version: v.number(),
  units: vUnit,
  /** As the client submitted them, in centimetres. */
  measurements: vMeasurements,
  /** As the fitter approved them; null until approved. */
  approvedValues: v.union(vMeasurements, v.null()),
  comfort: vFitComfort,
  posture: v.union(vPosture, v.null()),
  provenance: vFitProvenance,
  provenanceLabel: v.string(),
  notes: v.union(v.string(), v.null()),
  uncertainFields: v.array(v.string()),
  /** Fields outside the plausible range: for the fitter's attention, never a rejection. */
  implausible: v.array(v.string()),
  /** Required fields the sheet does not have yet; a profile cannot be approved while any remain. */
  missingRequired: v.array(v.string()),
  status: vFitProfileStatus,
  statusLabel: v.string(),
  clarification: v.union(v.string(), v.null()),
  reviewNote: v.union(v.string(), v.null()),
  reviewedAt: v.union(v.number(), v.null()),
  /** The fitter's first name only. */
  reviewer: v.union(v.string(), v.null()),
  supersedesId: v.union(v.id("atelierFitProfiles"), v.null()),
  createdAt: v.number(),
  updatedAt: v.number(),
  photos: v.array(vFitPhotoView),
});
export type FitProfileView = Infer<typeof vFitProfileView>;

/** One row of the fitter's queue (A03). */
export const vFitQueueItem = v.object({
  profileId: v.id("atelierFitProfiles"),
  version: v.number(),
  status: vFitProfileStatus,
  statusLabel: v.string(),
  clientName: v.string(),
  requestedAt: v.number(),
  updatedAt: v.number(),
  provenance: vFitProvenance,
  provenanceLabel: v.string(),
  uncertainFields: v.array(v.string()),
  implausible: v.array(v.string()),
  missingRequired: v.array(v.string()),
  photoCount: v.number(),
});
export type FitQueueItem = Infer<typeof vFitQueueItem>;

export const vFitHistoryEntry = v.object({
  profileId: v.id("atelierFitProfiles"),
  version: v.number(),
  status: vFitProfileStatus,
  statusLabel: v.string(),
  provenance: vFitProvenance,
  createdAt: v.number(),
  reviewedAt: v.union(v.number(), v.null()),
});
export type FitHistoryEntry = Infer<typeof vFitHistoryEntry>;

/**
 * The fitter's review of one version (A03). Photographs are listed without URLs: a query cannot record
 * that a member of the house looked at a client's photograph, so `staffPhotoUrls` (a mutation) does.
 */
export const vFitReviewView = v.object({
  profile: v.object({
    ...vFitProfileView.fields,
    photos: v.array(v.object({ photoId: v.id("atelierFitPhotos"), pose: vFitPhotoPose, createdAt: v.number() })),
  }),
  clientName: v.string(),
  history: v.array(vFitHistoryEntry),
  /** The client's approved profile this one would supersede, with the values the fitter settled on. */
  previousApproved: v.union(
    v.object({
      profileId: v.id("atelierFitProfiles"),
      version: v.number(),
      values: vMeasurements,
      reviewedAt: v.union(v.number(), v.null()),
    }),
    v.null(),
  ),
  /** Commissions the house has released against this exact version; none of its values may change. */
  releasedOrderIds: v.array(v.id("atelierOrders")),
});
export type FitReviewView = Infer<typeof vFitReviewView>;

/** The guided sheet as submitted from home (C17). Measurements arrive in centimetres. */
export const vFitSubmission = v.object({
  units: vUnit,
  measurements: vMeasurements,
  comfort: vFitComfort,
  posture: v.optional(vPosture),
  notes: v.optional(v.string()),
  /** Keys the client could not measure with confidence; a required key listed here may be absent. */
  uncertainFields: v.array(v.string()),
});
export type FitSubmission = Infer<typeof vFitSubmission>;

/** What a revision changes against its source; anything left out is carried over. `null` clears. */
export const vFitRevisionChanges = v.object({
  units: v.optional(vUnit),
  /** The whole sheet, when the client re-measured; replaces the source's values. */
  measurements: v.optional(vMeasurements),
  comfort: v.optional(vFitComfort),
  posture: v.optional(v.union(vPosture, v.null())),
  notes: v.optional(v.union(v.string(), v.null())),
  uncertainFields: v.optional(v.array(v.string())),
});
export type FitRevisionChanges = Infer<typeof vFitRevisionChanges>;

// ------------------------------------------------------------------------------------------------
// Client
// ------------------------------------------------------------------------------------------------

/** S20. The client's latest version that has not been superseded, or null before any submission. */
export const myProfile = query({
  args: {},
  returns: v.union(vFitProfileView, v.null()),
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const profile = await latestProfileForUser(ctx, user._id);
    return profile ? toProfileView(ctx, profile) : null;
  },
});

/** C16. Every version, newest first; approved history is kept, superseded versions included. */
export const listMyProfiles = query({
  args: {},
  returns: v.array(vFitProfileView),
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const profiles = newestFirst(await listProfilesForUser(ctx, user._id));
    return Promise.all(profiles.map((profile) => toProfileView(ctx, profile)));
  },
});

/**
 * C17. A new provisional version from the guided sheet, awaiting a fitter. Required fields must be
 * present unless named in `uncertainFields`; implausible values are flagged, never refused. Sending
 * the same sheet twice while it awaits review returns the version already submitted.
 */
export const submitRemote = mutation({
  args: vFitSubmission.fields,
  returns: v.id("atelierFitProfiles"),
  handler: async (ctx, submission) => {
    const user = await requireUser(ctx);
    return submitRemoteProfile(ctx, user, submission);
  },
});

/**
 * C16. A new provisional version prefilled from one of the client's versions (an approved one starts
 * from the values the fitter approved). The source is never edited; an approved source stays approved
 * until a fitter approves the revision, while a source still awaiting review is superseded by it.
 */
export const startRevision = mutation({
  args: { fromProfileId: v.id("atelierFitProfiles"), changes: v.optional(vFitRevisionChanges) },
  returns: v.id("atelierFitProfiles"),
  handler: async (ctx, { fromProfileId, changes }) => {
    const user = await requireUser(ctx);
    const source = await requireOwnedProfile(ctx, user, fromProfileId);
    return startRevisionFrom(ctx, user, source, changes);
  },
});

/**
 * C16, S20. Attaches an approved profile to a design. The design must already be on the account: a
 * guest key is accepted only so a browser-held design gets a truthful answer rather than "not found".
 */
export const confirmReuse = mutation({
  args: { ...ownerArgs, profileId: v.id("atelierFitProfiles"), draftId: v.id("atelierDrafts") },
  returns: v.null(),
  handler: async (ctx, { guestKey, profileId, draftId }) => {
    const user = await requireUser(ctx);
    const profile = await requireOwnedProfile(ctx, user, profileId);
    const { draft } = await requireDraftAccess(ctx, draftId, guestKey);
    if (draft.userId !== user._id) {
      throw appError("INVALID_STATE", "Save this design to your account before attaching your fit profile to it.");
    }
    await confirmReuseOnDraft(ctx, user, profile, draft);
    return null;
  },
});

/** C17. Where a posture photograph is sent before `registerFitPhoto` records it. */
export const generateFitPhotoUploadUrl = mutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    await requireUser(ctx);
    return ctx.storage.generateUploadUrl();
  },
});

/**
 * C17. Records a posture photograph against a version still awaiting review, with consent stamped now.
 * A second photograph of the same pose replaces the first. These photographs are for the fitter only
 * and are never reused for personal previews.
 */
export const registerFitPhoto = mutation({
  args: { profileId: v.id("atelierFitProfiles"), storageId: v.id("_storage"), pose: vFitPhotoPose },
  returns: v.id("atelierFitPhotos"),
  handler: async (ctx, { profileId, storageId, pose }) => {
    const user = await requireUser(ctx);
    const profile = await requireOwnedProfile(ctx, user, profileId);
    return registerPhoto(ctx, user, profile, storageId, pose);
  },
});

/** C11, S34. Removes the photograph and its file; allowed whatever the profile's status. */
export const removeFitPhoto = mutation({
  args: { photoId: v.id("atelierFitPhotos") },
  returns: v.null(),
  handler: async (ctx, { photoId }) => {
    const user = await requireUser(ctx);
    const photo = await requireOwnedPhoto(ctx, user, photoId);
    await removePhoto(ctx, user, photo);
    return null;
  },
});

// ------------------------------------------------------------------------------------------------
// Staff (fitter)
// ------------------------------------------------------------------------------------------------

/** A03. Versions awaiting a fitter: provisional and needs-clarification, oldest first. */
export const queue = query({
  args: {},
  returns: v.array(vFitQueueItem),
  handler: async (ctx) => {
    await requireStaff(ctx, "fitter");
    return listQueue(ctx);
  },
});

/** A03. One version with its history and the approved values it would supersede. Malformed id reads as null. */
export const staffGet = query({
  args: { profileId: v.string() },
  returns: v.union(vFitReviewView, v.null()),
  handler: async (ctx, { profileId }) => {
    await requireStaff(ctx, "fitter");
    const id = ctx.db.normalizeId("atelierFitProfiles", profileId);
    if (!id) return null;
    const profile = await ctx.db.get(id);
    return profile ? toReviewView(ctx, profile) : null;
  },
});

/** A03. Signed URLs for the client's posture photographs; every look is recorded (`photo.view`). */
export const staffPhotoUrls = mutation({
  args: { profileId: v.id("atelierFitProfiles") },
  returns: v.array(vFitPhotoView),
  handler: async (ctx, { profileId }) => {
    const staff = await requireStaff(ctx, "fitter");
    const profile = await ctx.db.get(profileId);
    if (!profile) throw appError("NOT_FOUND", "That fit profile doesn't exist.");
    return viewPhotosAsStaff(ctx, staff, profile);
  },
});

/**
 * O03. Approves a version with the values the fitter settled on and a note explaining any change. The
 * client's previous approved version becomes superseded; nothing is edited in place. A version a
 * released commission already references cannot be approved: approve a new version instead.
 */
export const approve = mutation({
  args: { profileId: v.id("atelierFitProfiles"), approvedValues: vMeasurements, reviewNote: v.string() },
  returns: v.null(),
  handler: async (ctx, { profileId, approvedValues, reviewNote }) => {
    const staff = await requireStaff(ctx, "fitter");
    const profile = await ctx.db.get(profileId);
    if (!profile) throw appError("NOT_FOUND", "That fit profile doesn't exist.");
    await approveProfile(ctx, staff, profile, approvedValues, reviewNote);
    return null;
  },
});

/** O03. Sends a question back to the client; the version waits as "A fitter has a question". */
export const requestClarification = mutation({
  args: { profileId: v.id("atelierFitProfiles"), clarification: v.string() },
  returns: v.null(),
  handler: async (ctx, { profileId, clarification }) => {
    const staff = await requireStaff(ctx, "fitter");
    const profile = await ctx.db.get(profileId);
    if (!profile) throw appError("NOT_FOUND", "That fit profile doesn't exist.");
    await requestClarificationOnProfile(ctx, staff, profile, clarification);
    return null;
  },
});
