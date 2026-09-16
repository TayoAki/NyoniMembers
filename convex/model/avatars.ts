import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { assertOwner } from "../lib/auth";
import { appError } from "../lib/errors";
import { PLANS } from "../shared/credits";
import type { AvatarView } from "../views";

type Ctx = QueryCtx | MutationCtx;

export async function listForUser(ctx: Ctx, userId: Id<"users">): Promise<Doc<"avatars">[]> {
  const avatars = await ctx.db
    .query("avatars")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
  return avatars.sort((a, b) => Number(b.isDefault) - Number(a.isDefault) || a.createdAt - b.createdAt);
}

export async function toAvatarView(ctx: Ctx, avatar: Doc<"avatars">): Promise<AvatarView> {
  return {
    _id: avatar._id,
    label: avatar.label,
    isDefault: avatar.isDefault,
    url: await ctx.storage.getUrl(avatar.storageId),
    createdAt: avatar.createdAt,
  };
}

/** The avatar to render with: the requested one, or the user's default. Both must exist and be theirs. */
export async function resolveAvatar(
  ctx: Ctx,
  user: Doc<"users">,
  avatarId: Id<"avatars"> | undefined,
): Promise<Doc<"avatars">> {
  const wanted = avatarId ?? user.defaultAvatarId;
  if (!wanted) throw appError("ONBOARDING_REQUIRED", "Add a photo of yourself before rendering outfits.");
  const avatar = await ctx.db.get(wanted);
  return assertOwner(avatar, user, "avatar");
}

export async function createAvatar(
  ctx: MutationCtx,
  user: Doc<"users">,
  input: { storageId: Id<"_storage">; label?: string },
): Promise<Id<"avatars">> {
  const existing = await listForUser(ctx, user._id);
  const max = PLANS[user.plan].maxAvatars;
  if (existing.length >= max) {
    throw appError(
      "FEATURE_LOCKED",
      `Your plan allows ${max} avatar${max === 1 ? "" : "s"}. Remove one or upgrade to add more.`,
      { max, plan: user.plan },
    );
  }
  const isDefault = existing.length === 0;
  const avatarId = await ctx.db.insert("avatars", {
    userId: user._id,
    storageId: input.storageId,
    label: input.label?.trim() || `Photo ${existing.length + 1}`,
    isDefault,
    createdAt: Date.now(),
  });
  if (isDefault) await ctx.db.patch(user._id, { defaultAvatarId: avatarId });
  return avatarId;
}

export async function setDefaultAvatar(ctx: MutationCtx, user: Doc<"users">, avatarId: Id<"avatars">): Promise<void> {
  const avatar = assertOwner(await ctx.db.get(avatarId), user, "avatar");
  const all = await listForUser(ctx, user._id);
  for (const candidate of all) {
    const shouldBeDefault = candidate._id === avatar._id;
    if (candidate.isDefault !== shouldBeDefault) await ctx.db.patch(candidate._id, { isDefault: shouldBeDefault });
  }
  await ctx.db.patch(user._id, { defaultAvatarId: avatar._id });
}

export async function removeAvatar(ctx: MutationCtx, user: Doc<"users">, avatarId: Id<"avatars">): Promise<void> {
  const avatar = assertOwner(await ctx.db.get(avatarId), user, "avatar");
  const all = await listForUser(ctx, user._id);
  if (user.onboardedAt && all.length <= 1) {
    throw appError("INVALID_INPUT", "You need at least one photo of yourself. Add another before removing this one.");
  }
  await ctx.storage.delete(avatar.storageId);
  await ctx.db.delete("avatars", avatar._id);

  const remaining = all.filter((candidate) => candidate._id !== avatar._id);
  if (user.defaultAvatarId === avatar._id || avatar.isDefault) {
    const next = remaining[0];
    if (next) {
      if (!next.isDefault) await ctx.db.patch(next._id, { isDefault: true });
      await ctx.db.patch(user._id, { defaultAvatarId: next._id });
    } else {
      await ctx.db.patch(user._id, { defaultAvatarId: undefined });
    }
  }
}
