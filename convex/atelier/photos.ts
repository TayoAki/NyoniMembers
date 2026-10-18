import { v, type Infer } from "convex/values";
import { internalMutation, mutation, query } from "../_generated/server";
import {
  expirePhotos,
  finishDeletion as finishPhotoDeletion,
  getPhotoView,
  registerPhoto,
  removePhoto,
  toPhotoView,
} from "../model/atelier/photos";
import { vPhotoStatus, vPhotoValidation } from "../shared/atelier/validators";
import { requireActor, resolveActor } from "./access";
import { ownerArgs } from "./views";

/**
 * Atelier person photos (contract §5.4; journeys C08, C11). Thin wrappers: each resolves the actor (an
 * account, or a browser holding a guest key) and delegates to `convex/model/atelier/photos.ts`. A photo
 * is read back as a signed URL only; its storage id and its owner's guest key never leave the server.
 */

export const vPersonPhotoView = v.object({
  photoId: v.id("atelierPersonPhotos"),
  /** Signed, short-lived; null once the photo is being deleted. */
  url: v.union(v.string(), v.null()),
  width: v.number(),
  height: v.number(),
  status: vPhotoStatus,
  expiresAt: v.number(),
  consentAt: v.number(),
  consentVersion: v.string(),
  /** False when the consent text or the provider disclosure has changed since this photo was added (C11). */
  consentCurrent: v.boolean(),
  validation: vPhotoValidation,
});
export type PersonPhotoView = Infer<typeof vPersonPhotoView>;

export const generateUploadUrl = mutation({
  args: ownerArgs,
  returns: v.string(),
  handler: async (ctx, { guestKey }) => {
    await requireActor(ctx, guestKey);
    return ctx.storage.generateUploadUrl();
  },
});

/** Records a consented photo after checking the stored file; replaces the owner's previous one. */
export const register = mutation({
  args: {
    ...ownerArgs,
    storageId: v.id("_storage"),
    mimeType: v.string(),
    width: v.number(),
    height: v.number(),
    consentVersion: v.string(),
  },
  returns: vPersonPhotoView,
  handler: async (ctx, { guestKey, ...input }) => {
    const actor = await requireActor(ctx, guestKey);
    const photo = await registerPhoto(ctx, actor, input);
    return toPhotoView(ctx, photo);
  },
});

export const get = query({
  args: ownerArgs,
  returns: v.union(vPersonPhotoView, v.null()),
  handler: async (ctx, { guestKey }) => {
    const actor = await resolveActor(ctx, guestKey);
    if (!actor.user && !actor.guestKey) return null;
    return getPhotoView(ctx, actor);
  },
});

/** Removes the photo and everything made from it; a late preview result then has nothing to attach to. */
export const remove = mutation({
  args: { ...ownerArgs, photoId: v.id("atelierPersonPhotos") },
  returns: v.null(),
  handler: async (ctx, { guestKey, photoId }) => {
    const actor = await requireActor(ctx, guestKey);
    await removePhoto(ctx, actor, photoId);
    return null;
  },
});

/** Scheduled by `register` when it retires the previous photo: deletes the file and records the deletion. */
export const finishDeletion = internalMutation({
  args: { photoId: v.id("atelierPersonPhotos") },
  returns: v.boolean(),
  handler: async (ctx, { photoId }) => finishPhotoDeletion(ctx, photoId),
});

/** Cron (`convex/crons.ts`): retention expiry for photos and their results, and stuck deletions. */
export const expire = internalMutation({
  args: {},
  returns: v.object({ expired: v.number(), finished: v.number() }),
  handler: async (ctx) => expirePhotos(ctx),
});
