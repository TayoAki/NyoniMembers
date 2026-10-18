import type { Doc, Id } from "../../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../../_generated/server";
import { audit, staffDisplayName } from "../../atelier/access";
import type {
  FitHistoryEntry,
  FitPhotoView,
  FitProfileView,
  FitQueueItem,
  FitReviewView,
  FitRevisionChanges,
  FitSubmission,
} from "../../atelier/fit";
import { appError } from "../../lib/errors";
import {
  ATELIER_LIMITS,
  FIT_PROFILE_STATUS_LABELS,
  FIT_PROVENANCE_LABELS,
  type FitPhotoPose,
  type FitProfileStatus,
  type FitProvenance,
  type OrderStatus,
} from "../../shared/atelier/enums";
import {
  implausibleFields,
  measurementField,
  missingRequiredFields,
  type Unit,
} from "../../shared/atelier/measurements";

type Ctx = QueryCtx | MutationCtx;
type Profile = Doc<"atelierFitProfiles">;
type FitPhoto = Doc<"atelierFitPhotos">;
type Order = Doc<"atelierOrders">;
type User = Doc<"users">;
type Measurements = Record<string, number>;

/**
 * Fit profiles (contract §5.5; C15–C17, O03). The state machine, from SCREENS-AND-STATES.md:
 *
 *   provisional ──▶ needs_clarification ──▶ approved ──▶ superseded
 *        │                   │                  ▲
 *        └───────────────────┴──────────────────┘ (a fitter approves)
 *   provisional / needs_clarification ──▶ superseded (the client submits a newer version)
 *
 * Every submission is a new version; no version's measurements are ever rewritten. A client has at most
 * one version awaiting review, and at most one approved version. A version a released commission
 * references cannot have its values or review outcome changed: the house approves a new version instead,
 * and the commission keeps the exact version it was released against (O03).
 */

/** Versions read per client; a profile is revised a few times a year. */
const PROFILE_HISTORY_MAX = 50;
const QUEUE_MAX = 100;
/** Commissions read per client when checking whether a version is on a released one. */
const ORDERS_PER_CLIENT_MAX = 100;
const PHOTOS_PER_PROFILE_MAX = 12;
export const FIT_TEXT_MAX = 2000;

const PENDING_STATUSES: readonly FitProfileStatus[] = ["provisional", "needs_clarification"];
/** A commission in these statuses has not been released to the cutter. */
const UNRELEASED_ORDER_STATUSES: readonly OrderStatus[] = ["preflight", "cancelled"];

export function isPending(profile: Pick<Profile, "status">): boolean {
  return PENDING_STATUSES.includes(profile.status);
}

// ------------------------------------------------------------------------------------------------
// Reads
// ------------------------------------------------------------------------------------------------

export async function listProfilesForUser(ctx: Ctx, userId: Id<"users">): Promise<Profile[]> {
  return ctx.db
    .query("atelierFitProfiles")
    .withIndex("by_user_version", (q) => q.eq("userId", userId))
    .order("desc")
    .take(PROFILE_HISTORY_MAX);
}

export function newestFirst(profiles: readonly Profile[]): Profile[] {
  return [...profiles].sort((a, b) => b.version - a.version);
}

/** The version the client lives with: the newest that has not been superseded. */
export function currentProfile(profiles: readonly Profile[]): Profile | null {
  return newestFirst(profiles).find((profile) => profile.status !== "superseded") ?? null;
}

export async function latestProfileForUser(ctx: Ctx, userId: Id<"users">): Promise<Profile | null> {
  return currentProfile(await listProfilesForUser(ctx, userId));
}

export function nextVersion(profiles: readonly Profile[]): number {
  return profiles.reduce((max, profile) => Math.max(max, profile.version), 0) + 1;
}

/** The client's own profile, or "not found": another client's version is never acknowledged. */
export async function requireOwnedProfile(ctx: Ctx, user: User, profileId: Id<"atelierFitProfiles">): Promise<Profile> {
  const profile = await ctx.db.get(profileId);
  if (!profile || profile.userId !== user._id) throw appError("NOT_FOUND", "That fit profile doesn't exist.");
  return profile;
}

export async function requireOwnedPhoto(ctx: Ctx, user: User, photoId: Id<"atelierFitPhotos">): Promise<FitPhoto> {
  const photo = await ctx.db.get(photoId);
  if (!photo || photo.userId !== user._id) throw appError("NOT_FOUND", "That photograph doesn't exist.");
  return photo;
}

export async function activePhotos(ctx: Ctx, profileId: Id<"atelierFitProfiles">): Promise<FitPhoto[]> {
  return ctx.db
    .query("atelierFitPhotos")
    .withIndex("by_profile", (q) => q.eq("profileId", profileId))
    .filter((q) => q.eq(q.field("status"), "active"))
    .take(PHOTOS_PER_PROFILE_MAX);
}

async function toPhotoView(ctx: Ctx, photo: FitPhoto): Promise<FitPhotoView> {
  return {
    photoId: photo._id,
    pose: photo.pose,
    url: await ctx.storage.getUrl(photo.storageId),
    createdAt: photo.createdAt,
  };
}

export async function toProfileView(ctx: Ctx, profile: Profile): Promise<FitProfileView> {
  const [reviewer, photos] = await Promise.all([
    profile.reviewerId ? ctx.db.get(profile.reviewerId) : Promise.resolve(null),
    activePhotos(ctx, profile._id),
  ]);
  return {
    _id: profile._id,
    version: profile.version,
    units: profile.units,
    measurements: profile.measurements,
    approvedValues: profile.approvedValues ?? null,
    comfort: profile.comfort,
    posture: profile.posture ?? null,
    provenance: profile.provenance,
    provenanceLabel: FIT_PROVENANCE_LABELS[profile.provenance],
    notes: profile.notes ?? null,
    uncertainFields: profile.uncertainFields,
    implausible: implausibleFields(profile.measurements),
    missingRequired: missingRequiredFields(profile.measurements),
    status: profile.status,
    statusLabel: FIT_PROFILE_STATUS_LABELS[profile.status],
    clarification: profile.clarification ?? null,
    reviewNote: profile.reviewNote ?? null,
    reviewedAt: profile.reviewedAt ?? null,
    reviewer: staffDisplayName(reviewer),
    supersedesId: profile.supersedesId ?? null,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
    photos: await Promise.all(photos.map((photo) => toPhotoView(ctx, photo))),
  };
}

/** Only a first name reaches a fitter's queue; the review view names the client the same way. */
export function clientFirstName(user: User | null | undefined): string {
  const first = user?.name?.trim().split(/\s+/)[0];
  return first || "Client";
}

// ------------------------------------------------------------------------------------------------
// Validation
// ------------------------------------------------------------------------------------------------

/** Keys must be on the sheet and values must be real lengths; plausibility is flagged elsewhere, never refused. */
export function validateMeasurements(measurements: Measurements): Measurements {
  const unknown = Object.keys(measurements).filter((key) => !measurementField(key));
  if (unknown.length > 0) {
    throw appError("INVALID_INPUT", `The measurement sheet has no field called ${unknown.join(", ")}.`, {
      unknownKeys: unknown,
    });
  }
  for (const [key, value] of Object.entries(measurements)) {
    if (!Number.isFinite(value) || value <= 0) {
      const label = measurementField(key)?.label ?? key;
      throw appError("INVALID_INPUT", `${label} needs a measurement greater than zero.`, { field: key });
    }
  }
  return measurements;
}

export function validateUncertainFields(fields: readonly string[]): string[] {
  const unique = [...new Set(fields.map((key) => key.trim()).filter(Boolean))];
  const unknown = unique.filter((key) => !measurementField(key));
  if (unknown.length > 0) {
    throw appError("INVALID_INPUT", `The measurement sheet has no field called ${unknown.join(", ")}.`, {
      unknownKeys: unknown,
    });
  }
  return unique;
}

/** A required field may be absent only when the client has said they are unsure of it (C17). */
export function requireCompleteOrFlagged(measurements: Measurements, uncertainFields: readonly string[]): void {
  const missing = missingRequiredFields(measurements).filter((key) => !uncertainFields.includes(key));
  if (missing.length > 0) {
    const labels = missing.map((key) => measurementField(key)?.label ?? key);
    throw appError(
      "INVALID_INPUT",
      `${labels.join(", ")} ${missing.length === 1 ? "is" : "are"} still needed. Enter the value, or mark it as one you are unsure of so a fitter can help.`,
      { missing },
    );
  }
}

function cleanText(value: string | null | undefined, what: string): string | undefined {
  if (value === undefined || value === null) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (trimmed.length > FIT_TEXT_MAX) {
    throw appError("INVALID_INPUT", `Keep ${what} under ${FIT_TEXT_MAX} characters.`, { max: FIT_TEXT_MAX });
  }
  return trimmed;
}

export function sameMeasurements(a: Measurements, b: Measurements): boolean {
  const keysA = Object.keys(a).sort();
  const keysB = Object.keys(b).sort();
  return keysA.length === keysB.length && keysA.every((key, i) => key === keysB[i] && a[key] === b[key]);
}

/** Keys whose value differs, or that only one side has. */
export function changedKeys(before: Measurements, after: Measurements): string[] {
  return [...new Set([...Object.keys(before), ...Object.keys(after)])]
    .filter((key) => before[key] !== after[key])
    .sort();
}

type VersionFields = {
  units: Unit;
  measurements: Measurements;
  comfort: Profile["comfort"];
  posture: Profile["posture"];
  notes: string | undefined;
  uncertainFields: string[];
  provenance: FitProvenance;
};

type Fingerprintable = Pick<Profile, "units" | "measurements" | "comfort" | "uncertainFields"> & {
  posture?: Profile["posture"];
  notes?: string;
};

/** What makes two sheets the same submission; a retry on poor connectivity hashes alike. */
function fingerprint(fields: Fingerprintable): string {
  return JSON.stringify({
    units: fields.units,
    measurements: Object.fromEntries(Object.entries(fields.measurements).sort(([a], [b]) => a.localeCompare(b))),
    comfort: {
      jacket: fields.comfort.jacket,
      trousers: fields.comfort.trousers,
      movement: [...fields.comfort.movement].sort(),
    },
    posture: fields.posture ?? null,
    notes: fields.notes ?? null,
    uncertainFields: [...fields.uncertainFields].sort(),
  });
}

// ------------------------------------------------------------------------------------------------
// Client writes
// ------------------------------------------------------------------------------------------------

/**
 * Inserts the next version and supersedes any version of the client's still awaiting review: the
 * newest submission is the one a fitter should look at. Approved versions are left alone here.
 */
async function createVersion(
  ctx: MutationCtx,
  user: User,
  profiles: readonly Profile[],
  fields: VersionFields,
  now: number,
): Promise<Id<"atelierFitProfiles">> {
  const version = nextVersion(profiles);
  for (const pending of profiles.filter(isPending)) {
    await ctx.db.patch(pending._id, { status: "superseded", updatedAt: now });
    await audit(
      ctx,
      {
        actor: user,
        actorKind: "client",
        action: "fit.supersede",
        targetTable: "atelierFitProfiles",
        targetId: pending._id,
        meta: { byVersion: version, reason: "newer_submission" },
      },
      now,
    );
  }
  return ctx.db.insert("atelierFitProfiles", {
    userId: user._id,
    version,
    units: fields.units,
    measurements: fields.measurements,
    comfort: fields.comfort,
    ...(fields.posture ? { posture: fields.posture } : {}),
    provenance: fields.provenance,
    ...(fields.notes ? { notes: fields.notes } : {}),
    uncertainFields: fields.uncertainFields,
    status: "provisional",
    createdAt: now,
    updatedAt: now,
  });
}

/**
 * C17. The guided sheet becomes the next provisional version. Submitting an identical sheet while the
 * previous one still awaits review returns that version: a retry on poor connectivity is one submission.
 */
export async function submitRemote(
  ctx: MutationCtx,
  user: User,
  input: FitSubmission,
  now: number = Date.now(),
): Promise<Id<"atelierFitProfiles">> {
  const measurements = validateMeasurements(input.measurements);
  const uncertainFields = validateUncertainFields(input.uncertainFields);
  requireCompleteOrFlagged(measurements, uncertainFields);
  const fields: Omit<VersionFields, "provenance"> = {
    units: input.units,
    measurements,
    comfort: input.comfort,
    posture: input.posture,
    notes: cleanText(input.notes, "your notes"),
    uncertainFields,
  };
  const profiles = await listProfilesForUser(ctx, user._id);
  const pending = profiles.find((profile) => profile.status === "provisional");
  if (pending && fingerprint(pending) === fingerprint(fields)) return pending._id;

  const id = await createVersion(ctx, user, profiles, { ...fields, provenance: "remote_guided" }, now);
  await audit(
    ctx,
    {
      actor: user,
      actorKind: "client",
      action: "fit.submit",
      targetTable: "atelierFitProfiles",
      targetId: id,
      meta: {
        version: nextVersion(profiles),
        provenance: "remote_guided",
        implausible: implausibleFields(measurements),
        uncertainFields,
        missingRequired: missingRequiredFields(measurements),
      },
    },
    now,
  );
  return id;
}

/**
 * C16. A new provisional version from one of the client's own versions. The starting values of an
 * approved source are the ones the fitter approved. Provenance follows the measurements: a re-measured
 * sheet is `remote_guided`; a revision that only changes comfort keeps the source's provenance.
 */
export async function startRevision(
  ctx: MutationCtx,
  user: User,
  source: Profile,
  changes: FitRevisionChanges | undefined,
  now: number = Date.now(),
): Promise<Id<"atelierFitProfiles">> {
  if (source.userId !== user._id) throw appError("NOT_FOUND", "That fit profile doesn't exist.");
  const baseMeasurements = source.approvedValues ?? source.measurements;
  const measurements = changes?.measurements ? validateMeasurements(changes.measurements) : baseMeasurements;
  const remeasured = changes?.measurements !== undefined && !sameMeasurements(baseMeasurements, measurements);
  const uncertainFields =
    changes?.uncertainFields !== undefined
      ? validateUncertainFields(changes.uncertainFields)
      : changes?.measurements !== undefined || !isPending(source)
        ? []
        : source.uncertainFields;
  requireCompleteOrFlagged(measurements, uncertainFields);
  const fields: VersionFields = {
    units: changes?.units ?? source.units,
    measurements,
    comfort: changes?.comfort ?? source.comfort,
    posture: changes?.posture === undefined ? source.posture : (changes.posture ?? undefined),
    notes: changes?.notes === undefined ? source.notes : cleanText(changes.notes, "your notes"),
    uncertainFields,
    provenance: remeasured ? "remote_guided" : source.provenance,
  };
  const profiles = await listProfilesForUser(ctx, user._id);
  const id = await createVersion(ctx, user, profiles, fields, now);
  await audit(
    ctx,
    {
      actor: user,
      actorKind: "client",
      action: "fit.revise",
      targetTable: "atelierFitProfiles",
      targetId: id,
      meta: {
        version: nextVersion(profiles),
        fromProfileId: source._id,
        fromVersion: source.version,
        changedMeasurements: changedKeys(baseMeasurements, measurements),
        provenance: fields.provenance,
      },
    },
    now,
  );
  return id;
}

/**
 * C16, S20. Links an approved version to a design the client is still working on. The caller has
 * checked the design is the client's own; the design's `fitProfile` summary then names this version.
 */
export async function confirmReuse(
  ctx: MutationCtx,
  user: User,
  profile: Profile,
  draft: Doc<"atelierDrafts">,
  now: number = Date.now(),
): Promise<void> {
  if (profile.userId !== user._id) throw appError("NOT_FOUND", "That fit profile doesn't exist.");
  if (profile.status !== "approved") {
    throw appError(
      "INVALID_STATE",
      `Only a profile a fitter has approved can be attached to a design. Version ${profile.version} is ${FIT_PROFILE_STATUS_LABELS[profile.status].toLowerCase()}.`,
      { status: profile.status },
    );
  }
  if (draft.status !== "draft") {
    throw appError(
      "INVALID_STATE",
      "This design has been sent to the house; its fit profile is settled with your concierge.",
      {
        status: draft.status,
      },
    );
  }
  if (draft.fitProfileId === profile._id) return;
  await ctx.db.patch(draft._id, { fitProfileId: profile._id, updatedAt: now, lastSavedAt: now });
  await audit(
    ctx,
    {
      actor: user,
      actorKind: "client",
      action: "fit.reuse",
      targetTable: "atelierDrafts",
      targetId: draft._id,
      meta: { profileId: profile._id, version: profile.version },
    },
    now,
  );
}

// ------------------------------------------------------------------------------------------------
// Posture photographs
// ------------------------------------------------------------------------------------------------

async function retirePhoto(ctx: MutationCtx, photo: FitPhoto): Promise<void> {
  await ctx.storage.delete(photo.storageId);
  await ctx.db.patch(photo._id, { status: "deleted" });
}

/**
 * C17. A photograph joins a version still awaiting review; consent is stamped now. One per pose: a
 * replacement retires the earlier file. The file must have arrived, be an image and be within the limit.
 */
export async function registerFitPhoto(
  ctx: MutationCtx,
  user: User,
  profile: Profile,
  storageId: Id<"_storage">,
  pose: FitPhotoPose,
  now: number = Date.now(),
): Promise<Id<"atelierFitPhotos">> {
  if (profile.userId !== user._id) throw appError("NOT_FOUND", "That fit profile doesn't exist.");
  if (!isPending(profile)) {
    throw appError(
      "INVALID_STATE",
      "Photographs join a profile while a fitter is reviewing it. Start a revision to add one.",
      { status: profile.status },
    );
  }
  const file = await ctx.db.system.get(storageId);
  if (!file) throw appError("INVALID_INPUT", "The photograph did not arrive. Try again.");
  if (!file.contentType?.startsWith("image/")) throw appError("INVALID_INPUT", "Only a photograph can be added here.");
  if (file.size > ATELIER_LIMITS.maxPhotoBytes) {
    throw appError(
      "INVALID_INPUT",
      `That photograph is larger than ${Math.round(ATELIER_LIMITS.maxPhotoBytes / (1024 * 1024))} MB.`,
    );
  }
  const existing = (await activePhotos(ctx, profile._id)).filter((photo) => photo.pose === pose);
  for (const photo of existing) await retirePhoto(ctx, photo);
  const id = await ctx.db.insert("atelierFitPhotos", {
    userId: user._id,
    profileId: profile._id,
    storageId,
    pose,
    consentAt: now,
    status: "active",
    createdAt: now,
  });
  await ctx.db.patch(profile._id, { updatedAt: now });
  await audit(
    ctx,
    {
      actor: user,
      actorKind: "client",
      action: "fit.photo.add",
      targetTable: "atelierFitPhotos",
      targetId: id,
      meta: { profileId: profile._id, pose, replaced: existing.map((photo) => photo._id) },
    },
    now,
  );
  return id;
}

/** C11. The client may take a photograph back at any time; the file goes with the record's status. */
export async function removeFitPhoto(
  ctx: MutationCtx,
  user: User,
  photo: FitPhoto,
  now: number = Date.now(),
): Promise<void> {
  if (photo.userId !== user._id) throw appError("NOT_FOUND", "That photograph doesn't exist.");
  if (photo.status === "deleted") return;
  await retirePhoto(ctx, photo);
  await audit(
    ctx,
    {
      actor: user,
      actorKind: "client",
      action: "fit.photo.remove",
      targetTable: "atelierFitPhotos",
      targetId: photo._id,
      meta: { profileId: photo.profileId, pose: photo.pose },
    },
    now,
  );
}

// ------------------------------------------------------------------------------------------------
// Released commissions
// ------------------------------------------------------------------------------------------------

export function isReleasedOrder(order: Pick<Order, "status" | "releasedAt">): boolean {
  return order.releasedAt !== undefined || !UNRELEASED_ORDER_STATUSES.includes(order.status);
}

/** Released commissions of the client that name this exact version. */
export async function releasedOrdersFor(ctx: Ctx, profile: Profile): Promise<Order[]> {
  const orders = await ctx.db
    .query("atelierOrders")
    .withIndex("by_user", (q) => q.eq("userId", profile.userId))
    .order("desc")
    .take(ORDERS_PER_CLIENT_MAX);
  return orders.filter((order) => order.fitProfileId === profile._id && isReleasedOrder(order));
}

/** O03: production already released requires a new version, not an edit of the one it was cut against. */
export async function assertNotOnReleasedOrder(ctx: Ctx, profile: Profile): Promise<void> {
  const released = await releasedOrdersFor(ctx, profile);
  if (released.length > 0) {
    throw appError(
      "INVALID_STATE",
      `Version ${profile.version} is on a commission the house has released and cannot change. Approve a new version instead.`,
      { orderIds: released.map((order) => order._id) },
    );
  }
}

// ------------------------------------------------------------------------------------------------
// Staff
// ------------------------------------------------------------------------------------------------

async function toQueueItem(ctx: Ctx, profile: Profile): Promise<FitQueueItem> {
  const [client, photos] = await Promise.all([ctx.db.get(profile.userId), activePhotos(ctx, profile._id)]);
  return {
    profileId: profile._id,
    version: profile.version,
    status: profile.status,
    statusLabel: FIT_PROFILE_STATUS_LABELS[profile.status],
    clientName: clientFirstName(client),
    requestedAt: profile.createdAt,
    updatedAt: profile.updatedAt,
    provenance: profile.provenance,
    provenanceLabel: FIT_PROVENANCE_LABELS[profile.provenance],
    uncertainFields: profile.uncertainFields,
    implausible: implausibleFields(profile.measurements),
    missingRequired: missingRequiredFields(profile.measurements),
    photoCount: photos.length,
  };
}

/** A03. Everything awaiting a fitter, oldest first, so nobody waits behind a newer submission. */
export async function listQueue(ctx: Ctx): Promise<FitQueueItem[]> {
  const pages = await Promise.all(
    PENDING_STATUSES.map((status) =>
      ctx.db
        .query("atelierFitProfiles")
        .withIndex("by_status", (q) => q.eq("status", status))
        .order("asc")
        .take(QUEUE_MAX),
    ),
  );
  const rows = pages.flat().sort((a, b) => a.createdAt - b.createdAt);
  return Promise.all(rows.map((profile) => toQueueItem(ctx, profile)));
}

function toHistoryEntry(profile: Profile): FitHistoryEntry {
  return {
    profileId: profile._id,
    version: profile.version,
    status: profile.status,
    statusLabel: FIT_PROFILE_STATUS_LABELS[profile.status],
    provenance: profile.provenance,
    createdAt: profile.createdAt,
    reviewedAt: profile.reviewedAt ?? null,
  };
}

/** The client's approved version other than this one, if any: what an approval here would supersede. */
export function approvedOther(profiles: readonly Profile[], profile: Profile): Profile | null {
  return newestFirst(profiles).find((other) => other.status === "approved" && other._id !== profile._id) ?? null;
}

export async function toReviewView(ctx: Ctx, profile: Profile): Promise<FitReviewView> {
  const [client, history, released, view] = await Promise.all([
    ctx.db.get(profile.userId),
    listProfilesForUser(ctx, profile.userId),
    releasedOrdersFor(ctx, profile),
    toProfileView(ctx, profile),
  ]);
  const previous = approvedOther(history, profile);
  return {
    profile: { ...view, photos: view.photos.map(({ photoId, pose, createdAt }) => ({ photoId, pose, createdAt })) },
    clientName: clientFirstName(client),
    history: newestFirst(history).map(toHistoryEntry),
    previousApproved: previous
      ? {
          profileId: previous._id,
          version: previous.version,
          values: previous.approvedValues ?? previous.measurements,
          reviewedAt: previous.reviewedAt ?? null,
        }
      : null,
    releasedOrderIds: released.map((order) => order._id),
  };
}

/** A03. Each look at a client's photograph is recorded before the URL leaves the house. */
export async function viewPhotosAsStaff(
  ctx: MutationCtx,
  staff: User,
  profile: Profile,
  now: number = Date.now(),
): Promise<FitPhotoView[]> {
  const photos = await activePhotos(ctx, profile._id);
  for (const photo of photos) {
    await audit(
      ctx,
      {
        actor: staff,
        actorKind: "staff",
        action: "photo.view",
        targetTable: "atelierFitPhotos",
        targetId: photo._id,
        meta: { profileId: profile._id, pose: photo.pose },
      },
      now,
    );
  }
  return Promise.all(photos.map((photo) => toPhotoView(ctx, photo)));
}

function requirePending(profile: Profile, verb: string): void {
  if (isPending(profile)) return;
  const label = FIT_PROFILE_STATUS_LABELS[profile.status].toLowerCase();
  throw appError(
    "INVALID_STATE",
    profile.status === "approved"
      ? `Version ${profile.version} is already approved. To change it, ${verb} a new version.`
      : `Version ${profile.version} is ${label}; the client has a newer version to review.`,
    { status: profile.status },
  );
}

/**
 * O03. Approves a pending version with the values the fitter settled on. Incomplete data cannot become
 * approved; a changed value must come with a note so the client can see the difference. The client's
 * previous approved version becomes superseded and this one points at it. Nothing is edited in place.
 */
export async function approveProfile(
  ctx: MutationCtx,
  staff: User,
  profile: Profile,
  approvedValues: Measurements,
  reviewNote: string,
  now: number = Date.now(),
): Promise<void> {
  requirePending(profile, "approve");
  await assertNotOnReleasedOrder(ctx, profile);
  const values = validateMeasurements(approvedValues);
  const missing = missingRequiredFields(values);
  if (missing.length > 0) {
    const labels = missing.map((key) => measurementField(key)?.label ?? key);
    throw appError("INVALID_INPUT", `A profile cannot be approved without ${labels.join(", ")}.`, { missing });
  }
  const changed = changedKeys(profile.measurements, values);
  const note = cleanText(reviewNote, "the review note");
  if (changed.length > 0 && !note) {
    throw appError("INVALID_INPUT", "Explain the values you changed so the client can see the difference.", {
      changed,
    });
  }
  const history = await listProfilesForUser(ctx, profile.userId);
  const previous = approvedOther(history, profile);
  for (const old of history.filter((other) => other.status === "approved" && other._id !== profile._id)) {
    await ctx.db.patch(old._id, { status: "superseded", updatedAt: now });
    await audit(
      ctx,
      {
        actor: staff,
        actorKind: "staff",
        action: "fit.supersede",
        targetTable: "atelierFitProfiles",
        targetId: old._id,
        meta: { byProfileId: profile._id, byVersion: profile.version, reason: "newer_approval" },
      },
      now,
    );
  }
  await ctx.db.patch(profile._id, {
    status: "approved",
    approvedValues: values,
    reviewNote: note,
    reviewerId: staff._id,
    reviewedAt: now,
    clarification: undefined,
    supersedesId: previous?._id,
    updatedAt: now,
  });
  await audit(
    ctx,
    {
      actor: staff,
      actorKind: "staff",
      action: "fit.approve",
      targetTable: "atelierFitProfiles",
      targetId: profile._id,
      meta: {
        version: profile.version,
        changed,
        implausible: implausibleFields(values),
        supersedes: previous?._id ?? null,
      },
    },
    now,
  );
}

/** O03. The version waits as "A fitter has a question" until the client revises it. */
export async function requestClarification(
  ctx: MutationCtx,
  staff: User,
  profile: Profile,
  clarification: string,
  now: number = Date.now(),
): Promise<void> {
  requirePending(profile, "ask the client for");
  await assertNotOnReleasedOrder(ctx, profile);
  const question = cleanText(clarification, "the question");
  if (!question) throw appError("INVALID_INPUT", "Write the question the client should answer.");
  await ctx.db.patch(profile._id, {
    status: "needs_clarification",
    clarification: question,
    reviewerId: staff._id,
    updatedAt: now,
  });
  await audit(
    ctx,
    {
      actor: staff,
      actorKind: "staff",
      action: "fit.request_clarification",
      targetTable: "atelierFitProfiles",
      targetId: profile._id,
      meta: { version: profile.version, from: profile.status },
    },
    now,
  );
}
