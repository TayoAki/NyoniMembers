import assert from "node:assert/strict";
import test from "node:test";
import { accountActor, fakeCtx, guestActor, isAppError, otherGuestActor, strangerActor } from "./atelier-fake-ctx.mjs";

const drafts = await import("../convex/model/atelier/drafts.ts");
const shares = await import("../convex/model/atelier/shares.ts");
const { ATELIER_LIMITS, SHARE_STATES, SHARE_STATE_LABELS } = await import("../convex/shared/atelier/enums.ts");
const { LOOKS } = await import("../convex/shared/atelier/looks.ts");

const NOW = Date.UTC(2026, 9, 18, 12);
const DAY = 86_400_000;

async function draftFor(f, actor = guestActor) {
  const id = await drafts.createDraft(f.ctx, actor, { lookKey: LOOKS[0].key }, NOW);
  return f.ctx.db.get(id);
}

test("a share carries the design and nothing about its owner", async () => {
  const f = fakeCtx();
  const draft = await draftFor(f);
  const { shareId, token } = await shares.createShare(
    f.ctx,
    draft,
    guestActor,
    { audience: "  Partner ", expiresInDays: 7 },
    NOW,
  );
  assert.match(token, /^[a-f0-9]{32}$/);
  const row = await f.ctx.db.get(shareId);
  assert.equal(row.guestKey, guestActor.guestKey);
  assert.equal(row.audience, "Partner");
  assert.equal(row.expiresAt, NOW + 7 * DAY);
  assert.ok(f.rowsOf("atelierAuditLog").some((entry) => entry.action === "share.create" && entry.targetId === shareId));

  const view = await shares.sharedDesignByToken(f.ctx, token, NOW + DAY);
  assert.deepEqual(Object.keys(view).sort(), ["cloth", "createdAt", "expiresAt", "lines", "name", "occasion", "spec"]);
  assert.equal(view.name, draft.name);
  assert.deepEqual(view.spec, draft.spec);
  assert.equal(view.cloth.code, draft.spec.clothCode);
  assert.equal(view.expiresAt, NOW + 7 * DAY);
  assert.ok(view.lines.length > 10);
  const serialized = JSON.stringify(view);
  assert.ok(!serialized.includes(guestActor.guestKey) && !serialized.includes("users|"), "no owner identity leaks");
});

test("an unknown token is null; an expired or revoked one says so and shows nothing", async () => {
  const f = fakeCtx();
  const draft = await draftFor(f);
  assert.equal(await shares.sharedDesignByToken(f.ctx, "deadbeef", NOW), null);
  assert.equal(await shares.sharedDesignByToken(f.ctx, "", NOW), null);
  const { shareId, token } = await shares.createShare(
    f.ctx,
    draft,
    guestActor,
    { audience: "Groomsmen", expiresInDays: 3 },
    NOW,
  );
  assert.ok(await shares.sharedDesignByToken(f.ctx, token, NOW + 3 * DAY - 1));
  assert.deepEqual(await shares.sharedDesignByToken(f.ctx, token, NOW + 3 * DAY), { expired: true });

  const second = await shares.createShare(f.ctx, draft, guestActor, { audience: "Family", expiresInDays: 30 }, NOW);
  assert.ok(await shares.sharedDesignByToken(f.ctx, second.token, NOW + DAY));
  await shares.revokeShare(f.ctx, second.shareId, guestActor, NOW + 2 * DAY);
  assert.deepEqual(await shares.sharedDesignByToken(f.ctx, second.token, NOW + 2 * DAY), { expired: true });
  assert.equal((await f.ctx.db.get(second.shareId)).revokedAt, NOW + 2 * DAY);
  assert.ok(
    f.rowsOf("atelierAuditLog").some((entry) => entry.action === "share.revoke" && entry.targetId === second.shareId),
  );

  const writes = f.log.patches.length;
  await shares.revokeShare(f.ctx, second.shareId, guestActor, NOW + 3 * DAY);
  assert.equal(f.log.patches.length, writes, "revoking twice changes nothing");
  assert.equal((await f.ctx.db.get(shareId)).revokedAt, undefined, "the first link was not touched");
});

test("only the owner can revoke; a recipient holding the token cannot", async () => {
  const f = fakeCtx();
  const draft = await draftFor(f);
  const { shareId } = await shares.createShare(
    f.ctx,
    draft,
    guestActor,
    { audience: "Partner", expiresInDays: 7 },
    NOW,
  );
  await assert.rejects(shares.revokeShare(f.ctx, shareId, otherGuestActor, NOW), isAppError("NOT_FOUND"));
  await assert.rejects(shares.revokeShare(f.ctx, shareId, strangerActor, NOW), isAppError("NOT_FOUND"));
  await assert.rejects(
    shares.revokeShare(f.ctx, shareId, { user: null, guestKey: null }, NOW),
    isAppError("NOT_FOUND"),
  );
  await assert.rejects(shares.revokeShare(f.ctx, "atelierShares|999", guestActor, NOW), isAppError("NOT_FOUND"));
  assert.equal((await f.ctx.db.get(shareId)).revokedAt, undefined);
});

test("the audience and the expiry are bounded; an archived design is not shared", async () => {
  const f = fakeCtx();
  const draft = await draftFor(f, accountActor);
  await assert.rejects(
    shares.createShare(f.ctx, draft, accountActor, { audience: "", expiresInDays: 7 }, NOW),
    isAppError("INVALID_INPUT"),
  );
  await assert.rejects(
    shares.createShare(f.ctx, draft, accountActor, { audience: "x".repeat(81), expiresInDays: 7 }, NOW),
    isAppError("INVALID_INPUT"),
  );
  await assert.rejects(
    shares.createShare(f.ctx, draft, accountActor, { audience: "Partner", expiresInDays: 0 }, NOW),
    isAppError("INVALID_INPUT"),
  );
  await assert.rejects(
    shares.createShare(
      f.ctx,
      draft,
      accountActor,
      { audience: "Partner", expiresInDays: ATELIER_LIMITS.shareMaxDays + 1 },
      NOW,
    ),
    isAppError("INVALID_INPUT"),
  );
  await assert.rejects(
    shares.createShare(f.ctx, draft, accountActor, { audience: "Partner", expiresInDays: Number.NaN }, NOW),
    isAppError("INVALID_INPUT"),
  );
  assert.equal(f.rowsOf("atelierShares").length, 0);
  const ok = await shares.createShare(
    f.ctx,
    draft,
    accountActor,
    { audience: "Partner", expiresInDays: ATELIER_LIMITS.shareMaxDays },
    NOW,
  );
  assert.equal((await f.ctx.db.get(ok.shareId)).userId, accountActor.user._id);

  await drafts.archiveDraft(f.ctx, draft, accountActor, NOW);
  const archived = await f.ctx.db.get(draft._id);
  await assert.rejects(
    shares.createShare(f.ctx, archived, accountActor, { audience: "Partner", expiresInDays: 7 }, NOW),
    isAppError("INVALID_STATE"),
  );
  assert.deepEqual(
    await shares.sharedDesignByToken(f.ctx, ok.token, NOW + DAY),
    { expired: true },
    "an archived design's links read as expired",
  );
});

test("the owner's list names each link's state and revokeSharesForDraft closes them all", async () => {
  const f = fakeCtx();
  const draft = await draftFor(f);
  const a = await shares.createShare(f.ctx, draft, guestActor, { audience: "Partner", expiresInDays: 1 }, NOW);
  const b = await shares.createShare(f.ctx, draft, guestActor, { audience: "Family", expiresInDays: 10 }, NOW + 1);
  const c = await shares.createShare(f.ctx, draft, guestActor, { audience: "Best man", expiresInDays: 10 }, NOW + 2);
  await shares.revokeShare(f.ctx, c.shareId, guestActor, NOW + 3);
  const at = NOW + 2 * DAY;
  const list = (await shares.listSharesForDraft(f.ctx, draft._id)).map((share) => shares.toShareView(share, at));
  assert.deepEqual(
    list.map((view) => [view._id, view.state]),
    [
      [c.shareId, "revoked"],
      [b.shareId, "active"],
      [a.shareId, "expired"],
    ],
  );
  assert.equal(list[1].token, b.token, "the owner can copy their own link again");
  assert.ok(list.every((view) => !("guestKey" in view) && !("userId" in view)));

  assert.equal(
    await shares.revokeSharesForDraft(f.ctx, draft._id, at),
    2,
    "the expired and the live link are closed; the revoked one was already",
  );
  assert.equal(await shares.revokeSharesForDraft(f.ctx, draft._id, at), 0);
  assert.deepEqual(await shares.sharedDesignByToken(f.ctx, b.token, at), { expired: true });
});

test("a shared view follows the owner's edits but can never make them", async () => {
  const f = fakeCtx();
  const draft = await draftFor(f);
  const { token } = await shares.createShare(f.ctx, draft, guestActor, { audience: "Partner", expiresInDays: 7 }, NOW);
  const before = await shares.sharedDesignByToken(f.ctx, token, NOW);
  assert.equal(before.spec.jacket.lapel, "peak");
  await drafts.commitChange(f.ctx, draft, { jacket: { lapel: "notch" } }, false, NOW + 1);
  const after = await shares.sharedDesignByToken(f.ctx, token, NOW + 1);
  assert.equal(after.spec.jacket.lapel, "notch");
  assert.equal(typeof shares.sharedDesignByToken, "function");
  assert.equal(
    Object.keys(shares).some((name) => /commit|patch|edit|rename/i.test(name)),
    false,
    "the shares model exposes no edit",
  );
});

test("the review step's share words and audience limit are the server's own", async () => {
  assert.equal(ATELIER_LIMITS.shareAudienceMax, drafts.SHARE_AUDIENCE_MAX, "one limit for the form and the server");
  const f = fakeCtx();
  const draft = await draftFor(f);
  const longest = "x".repeat(ATELIER_LIMITS.shareAudienceMax);
  const open = await shares.createShare(f.ctx, draft, guestActor, { audience: longest, expiresInDays: 1 }, NOW);
  await assert.rejects(
    shares.createShare(f.ctx, draft, guestActor, { audience: `${longest}x`, expiresInDays: 1 }, NOW),
    isAppError("INVALID_INPUT"),
  );
  const revoked = await shares.createShare(f.ctx, draft, guestActor, { audience: "Partner", expiresInDays: 1 }, NOW);
  await shares.revokeShare(f.ctx, revoked.shareId, guestActor, NOW + 1);
  const states = new Set();
  for (const at of [NOW + 2, NOW + 2 * DAY]) {
    for (const share of await shares.listSharesForDraft(f.ctx, draft._id))
      states.add(shares.toShareView(share, at).state);
  }
  assert.deepEqual([...states].sort(), [...SHARE_STATES].sort(), "every state the owner's list reports");
  for (const state of SHARE_STATES) assert.ok(SHARE_STATE_LABELS[state], `a label for ${state}`);
  assert.ok(open.token.length > 0);
});
