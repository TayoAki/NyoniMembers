import { internal } from "../../_generated/api";
import type { Doc, Id } from "../../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../../_generated/server";
import { audit, ownerFieldsFor, requireOwned, type Actor, type Owned } from "../../atelier/access";
import type { PersonPhotoView } from "../../atelier/photos";
import { appError } from "../../lib/errors";
import { ATELIER_LIMITS } from "../../shared/atelier/enums";
import { CONSENT_VERSION, PROVIDER_DISCLOSURE_VERSION } from "../../shared/atelier/policy";

type Ctx = QueryCtx | MutationCtx;
type Photo = Doc<"atelierPersonPhotos">;
type Job = Doc<"atelierPreviewJobs">;

/**
 * The consented full-length photograph behind a personal preview (contract §5.4; journeys C08, C11;
 * scenario 4). One active photograph per owner; it is the only input the preview ever dresses, so
 * everything made from it goes when it goes: queued and processing jobs are cancelled, finished results
 * are expired and their files deleted, and a result that arrives late finds no photograph to attach to.
 */

export const DAY_MS = 86_400_000;
export const ACCEPTED_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
/** Below this on the shorter edge the preview is still made, but the client is told it may be soft. */
export const SOFT_PHOTO_EDGE_PX = 1000;
/** How many of an owner's rows one pass reads; an owner has one active photograph and a daily handful of jobs. */
const OWNER_SCAN = 200;
const EXPIRE_BATCH = 50;

export type PhotoValidation = { ok: boolean; reasons: string[] };

export type PhotoFacts = {
  mimeType: string;
  /** Bytes as stored, or null when the file could not be found. */
  sizeBytes: number | null;
  width: number;
  height: number;
};

/**
 * What the house can verify from the file itself. Blocking reasons set `ok: false`; an acceptable photo
 * may still carry an advisory reason. Blur, several people and a hidden face or feet cannot be judged
 * here and are left to the client's own eye and the retake guidance in `PHOTO_CONSENT`.
 */
export function validatePhoto(facts: PhotoFacts): PhotoValidation {
  const reasons: string[] = [];
  const mime = facts.mimeType.toLowerCase();
  if (!(ACCEPTED_PHOTO_TYPES as readonly string[]).includes(mime)) {
    reasons.push("That file is not a JPEG, PNG or WebP photograph. Export it as one of those and try again.");
  }
  if (facts.sizeBytes === null) {
    reasons.push("The photograph did not finish arriving. Please add it again.");
  } else if (facts.sizeBytes <= 0) {
    reasons.push("The file is empty. Please choose the photograph again.");
  } else if (facts.sizeBytes > ATELIER_LIMITS.maxPhotoBytes) {
    reasons.push(
      `The photograph is larger than ${Math.round(ATELIER_LIMITS.maxPhotoBytes / (1024 * 1024))} MB. A smaller export of the same photograph works.`,
    );
  }
  const edges = [facts.width, facts.height];
  if (edges.some((edge) => !Number.isFinite(edge) || edge <= 0)) {
    reasons.push("The photograph's dimensions could not be read. Please choose it again.");
  } else {
    if (Math.min(...edges) < ATELIER_LIMITS.minPhotoEdgePx) {
      reasons.push(
        `The photograph is too small to work from: at least ${ATELIER_LIMITS.minPhotoEdgePx} pixels on each side.`,
      );
    }
    if (Math.max(...edges) > ATELIER_LIMITS.maxPhotoEdgePx) {
      reasons.push(`The photograph is too large on one side: at most ${ATELIER_LIMITS.maxPhotoEdgePx} pixels.`);
    }
    if (facts.height <= facts.width) {
      reasons.push("The photograph is wider than it is tall. A full-length portrait, head to shoes, works best.");
    }
  }
  if (reasons.length > 0) return { ok: false, reasons };
  if (Math.min(...edges) < SOFT_PHOTO_EDGE_PX) {
    return { ok: true, reasons: ["A higher-resolution photograph would give a crisper preview."] };
  }
  return { ok: true, reasons: [] };
}

export type RegisterPhotoInput = {
  storageId: Id<"_storage">;
  mimeType: string;
  width: number;
  height: number;
  consentVersion: string;
};

function ownerOf(doc: Owned): Owned {
  return doc.userId !== undefined ? { userId: doc.userId } : { guestKey: doc.guestKey };
}

function ownerPhotos(ctx: Ctx, owner: Owned, status: Photo["status"]) {
  const userId = owner.userId;
  if (userId !== undefined) {
    return ctx.db.query("atelierPersonPhotos").withIndex("by_user", (q) => q.eq("userId", userId).eq("status", status));
  }
  const guestKey = owner.guestKey;
  return ctx.db
    .query("atelierPersonPhotos")
    .withIndex("by_guestKey", (q) => q.eq("guestKey", guestKey).eq("status", status));
}

function ownerJobs(ctx: Ctx, owner: Owned) {
  const userId = owner.userId;
  if (userId !== undefined) {
    return ctx.db.query("atelierPreviewJobs").withIndex("by_user", (q) => q.eq("userId", userId));
  }
  const guestKey = owner.guestKey;
  return ctx.db.query("atelierPreviewJobs").withIndex("by_guestKey", (q) => q.eq("guestKey", guestKey));
}

function ownerDrafts(ctx: Ctx, owner: Owned) {
  const userId = owner.userId;
  if (userId !== undefined) {
    return ctx.db.query("atelierDrafts").withIndex("by_user", (q) => q.eq("userId", userId));
  }
  const guestKey = owner.guestKey;
  return ctx.db.query("atelierDrafts").withIndex("by_guestKey", (q) => q.eq("guestKey", guestKey));
}

/** The photograph the owner can be dressed in right now, newest first should two ever coexist. */
export async function findActivePhoto(ctx: Ctx, actor: Actor): Promise<Photo | null> {
  if (!actor.user && !actor.guestKey) return null;
  return ownerPhotos(ctx, ownerFieldsFor(actor), "active").order("desc").first();
}

/** Deletes a stored file if it is still there; a file already gone is not an error. */
export async function deleteFile(ctx: MutationCtx, storageId: Id<"_storage">): Promise<boolean> {
  const stored = await ctx.db.system.get("_storage", storageId);
  if (!stored) return false;
  await ctx.storage.delete(storageId);
  return true;
}

export async function toPhotoView(ctx: Ctx, photo: Photo): Promise<PersonPhotoView> {
  return {
    photoId: photo._id,
    url: photo.status === "active" ? await ctx.storage.getUrl(photo.storageId) : null,
    width: photo.width,
    height: photo.height,
    status: photo.status,
    expiresAt: photo.expiresAt,
    consentAt: photo.consentAt,
    consentVersion: photo.consentVersion,
    consentCurrent:
      photo.consentVersion === CONSENT_VERSION && photo.providerDisclosureVersion === PROVIDER_DISCLOSURE_VERSION,
    validation: photo.validation,
  };
}

/** The active photograph, or one still being deleted so the client sees "Deleting" rather than nothing. */
export async function getPhotoView(ctx: Ctx, actor: Actor): Promise<PersonPhotoView | null> {
  const active = await findActivePhoto(ctx, actor);
  if (active) return toPhotoView(ctx, active);
  const pending = await ownerPhotos(ctx, ownerFieldsFor(actor), "pending_deletion").order("desc").first();
  return pending ? toPhotoView(ctx, pending) : null;
}

/**
 * Stores a consented photograph after checking the stored bytes, not the client's claims. A previous
 * active photograph is retired (C11 "Replace"): its jobs are cancelled, its results expire, and its file
 * is deleted on the scheduler so the client sees pending deletion rather than a false receipt.
 */
export async function registerPhoto(
  ctx: MutationCtx,
  actor: Actor,
  input: RegisterPhotoInput,
  now: number = Date.now(),
): Promise<Photo> {
  const owner = ownerFieldsFor(actor);
  if (input.consentVersion !== CONSENT_VERSION) {
    throw appError(
      "INVALID_INPUT",
      "The photo terms have changed. Please read and accept the current version before adding a photograph.",
      { consentVersion: CONSENT_VERSION },
    );
  }
  const stored = await ctx.db.system.get("_storage", input.storageId);
  const validation = validatePhoto({
    mimeType: stored?.contentType ?? input.mimeType,
    sizeBytes: stored?.size ?? null,
    width: input.width,
    height: input.height,
  });
  if (!validation.ok) {
    if (stored) await ctx.storage.delete(input.storageId);
    throw appError("INVALID_INPUT", validation.reasons[0] ?? "That photograph cannot be used.", {
      reasons: validation.reasons,
    });
  }

  const previous = await ownerPhotos(ctx, owner, "active").take(OWNER_SCAN);
  for (const photo of previous) await retirePhoto(ctx, photo, { actor, action: "photo.replace", mode: "scheduled" }, now);

  const photoId = await ctx.db.insert("atelierPersonPhotos", {
    ...owner,
    storageId: input.storageId,
    mimeType: stored?.contentType ?? input.mimeType,
    width: input.width,
    height: input.height,
    consentVersion: input.consentVersion,
    consentAt: now,
    providerDisclosureVersion: PROVIDER_DISCLOSURE_VERSION,
    status: "active",
    expiresAt: now + ATELIER_LIMITS.previewResultDays * DAY_MS,
    validation,
    createdAt: now,
  });

  const drafts = await ownerDrafts(ctx, owner).take(ATELIER_LIMITS.draftsPerOwner);
  for (const draft of drafts) {
    if (draft.personPhotoId !== photoId) await ctx.db.patch(draft._id, { personPhotoId: photoId });
  }

  await audit(ctx, {
    actor,
    action: "photo.register",
    targetTable: "atelierPersonPhotos",
    targetId: photoId,
    meta: { consentVersion: input.consentVersion, providerDisclosureVersion: PROVIDER_DISCLOSURE_VERSION, replaced: previous.length },
  }, now);

  const photo = await ctx.db.get(photoId);
  if (!photo) throw new Error("Photo insert failed");
  return photo;
}

/**
 * Takes every job made from this photograph out of play: queued and processing jobs are cancelled (a late
 * completion then finds `cancelledAt` and discards its file), finished results expire and their files go.
 */
export async function retireJobsForPhoto(
  ctx: MutationCtx,
  photo: Photo,
  now: number,
): Promise<{ cancelled: number; expired: number }> {
  const owner = ownerOf(photo);
  if (owner.userId === undefined && owner.guestKey === undefined) return { cancelled: 0, expired: 0 };
  const jobs = await ownerJobs(ctx, owner).order("desc").take(OWNER_SCAN);
  let cancelled = 0;
  let expired = 0;
  for (const job of jobs) {
    if (job.personPhotoId !== photo._id) continue;
    if (job.status === "queued" || job.status === "processing") {
      await ctx.db.patch(job._id, {
        status: "cancelled",
        cancelledAt: now,
        error: "The photograph was removed before this preview finished.",
      });
      cancelled += 1;
    } else if (job.status === "done") {
      await expireJobResult(ctx, job, now);
      expired += 1;
    }
  }
  return { cancelled, expired };
}

/** A finished result past its time or without its photograph: the file goes, the design stays. */
export async function expireJobResult(ctx: MutationCtx, job: Job, now: number): Promise<void> {
  if (job.resultStorageId) await deleteFile(ctx, job.resultStorageId);
  await ctx.db.patch(job._id, { status: "expired", resultStorageId: undefined, expiresAt: now });
}

type RetireOptions = {
  actor: Actor | null;
  action: "photo.remove" | "photo.replace" | "photo.expire";
  /** `now` deletes the file in this transaction; `scheduled` marks pending deletion and finishes on the scheduler. */
  mode: "now" | "scheduled";
};

export async function retirePhoto(ctx: MutationCtx, photo: Photo, options: RetireOptions, now: number): Promise<void> {
  if (photo.status === "deleted") return;
  const retired = await retireJobsForPhoto(ctx, photo, now);
  const drafts = await ownerDrafts(ctx, ownerOf(photo)).take(ATELIER_LIMITS.draftsPerOwner);
  for (const draft of drafts) {
    if (draft.personPhotoId === photo._id) await ctx.db.patch(draft._id, { personPhotoId: undefined });
  }
  if (options.mode === "now") {
    await deleteFile(ctx, photo.storageId);
    await ctx.db.patch(photo._id, { status: "deleted", deletedAt: now });
  } else {
    await ctx.db.patch(photo._id, { status: "pending_deletion" });
    await ctx.scheduler.runAfter(0, internal.atelier.photos.finishDeletion, { photoId: photo._id });
  }
  await audit(ctx, {
    actor: options.actor,
    action: options.action,
    targetTable: "atelierPersonPhotos",
    targetId: photo._id,
    meta: { ...retired, mode: options.mode },
  }, now);
}

/** C11 "Remove": the photograph and everything made from it go now; running twice is harmless. */
export async function removePhoto(
  ctx: MutationCtx,
  actor: Actor,
  photoId: Id<"atelierPersonPhotos">,
  now: number = Date.now(),
): Promise<void> {
  const photo = requireOwned(await ctx.db.get(photoId), actor, "photograph");
  if (photo.status === "deleted") return;
  await retirePhoto(ctx, photo, { actor, action: "photo.remove", mode: "now" }, now);
}

/** The scheduled half of a replacement: deletes the file and records the deletion. */
export async function finishDeletion(ctx: MutationCtx, photoId: Id<"atelierPersonPhotos">, now: number = Date.now()): Promise<boolean> {
  const photo = await ctx.db.get(photoId);
  if (!photo || photo.status === "deleted") return false;
  await retireJobsForPhoto(ctx, photo, now);
  await deleteFile(ctx, photo.storageId);
  await ctx.db.patch(photo._id, { status: "deleted", deletedAt: now });
  return true;
}

/** Cron: photographs past their retention are deleted with their results; stuck deletions are finished. */
export async function expirePhotos(ctx: MutationCtx, now: number = Date.now()): Promise<{ expired: number; finished: number }> {
  const due = await ctx.db
    .query("atelierPersonPhotos")
    .withIndex("by_status_expiresAt", (q) => q.eq("status", "active").lte("expiresAt", now))
    .take(EXPIRE_BATCH);
  for (const photo of due) await retirePhoto(ctx, photo, { actor: null, action: "photo.expire", mode: "now" }, now);

  const stuck = await ctx.db
    .query("atelierPersonPhotos")
    .withIndex("by_status_expiresAt", (q) => q.eq("status", "pending_deletion"))
    .take(EXPIRE_BATCH);
  let finished = 0;
  for (const photo of stuck) {
    if (await finishDeletion(ctx, photo._id, now)) finished += 1;
  }
  return { expired: due.length, finished };
}
