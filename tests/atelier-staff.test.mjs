import assert from "node:assert/strict";
import test from "node:test";
import { fakeCtx, isAppError } from "./atelier-fake-ctx.mjs";

const staff = await import("../convex/model/atelier/staff.ts");
const { audit } = await import("../convex/atelier/access.ts");
const { STAFF_ROLES } = await import("../convex/shared/atelier/enums.ts");

const NOW = Date.UTC(2026, 9, 18, 12);

async function setup() {
  const f = fakeCtx();
  let created = 0;
  const insertUser = async (doc) => {
    created += 1;
    return f.ctx.db.get(
      await f.ctx.db.insert("users", { clerkId: `clerk_${created}`, role: "user", createdAt: created, ...doc }),
    );
  };
  const admin = await insertUser({ name: "Nyoni House", email: "house@example.com", role: "admin" });
  const concierge = await insertUser({ name: "Adaeze Nwosu", email: "adaeze@example.com", staffRoles: ["concierge"] });
  const client = await insertUser({ name: "Kwame Mensah", email: "kwame@example.com" });
  const nameless = await insertUser({ email: "nameless@example.com" });
  return { f, admin, concierge, client, nameless, insertUser };
}

test("roles are validated against STAFF_ROLES, deduplicated and kept in the house's order", () => {
  assert.deepEqual(staff.normalizeRoles([]), []);
  assert.deepEqual(staff.normalizeRoles(["privacy", "concierge", "privacy"]), ["concierge", "privacy"]);
  assert.deepEqual(staff.normalizeRoles([...STAFF_ROLES].reverse()), [...STAFF_ROLES]);
  for (const bad of ["admin", "Concierge", "preview-ops", "", "owner"]) {
    assert.throws(() => staff.normalizeRoles([bad]), isAppError("INVALID_INPUT"), bad);
  }
});

test("me(): an admin is staff with every door open; a role holder is staff; a client is neither", async () => {
  const { admin, concierge, client } = await setup();
  assert.deepEqual(staff.staffStatusFor(admin), { roles: [], isAdmin: true, isStaff: true });
  assert.deepEqual(staff.staffStatusFor(concierge), { roles: ["concierge"], isAdmin: false, isStaff: true });
  assert.deepEqual(staff.staffStatusFor(client), { roles: [], isAdmin: false, isStaff: false });
});

test("setRoles replaces the roles, refuses unknown ones, audits the change and clears an empty list", async () => {
  const { f, admin, concierge, client, nameless } = await setup();

  await assert.rejects(
    staff.setStaffRoles(f.ctx, admin, client._id, ["concierge", "owner"], NOW),
    isAppError("INVALID_INPUT"),
  );
  assert.equal((await f.ctx.db.get(client._id)).staffRoles, undefined, "nothing changes when any role is unknown");
  assert.equal(f.rowsOf("atelierAuditLog").length, 0);

  const granted = await staff.setStaffRoles(f.ctx, admin, client._id, ["fitter", "concierge", "fitter"], NOW);
  assert.deepEqual(granted, {
    userId: client._id,
    name: "Kwame Mensah",
    email: "kwame@example.com",
    roles: ["concierge", "fitter"],
    isAdmin: false,
  });
  assert.deepEqual((await f.ctx.db.get(client._id)).staffRoles, ["concierge", "fitter"]);
  const [entry] = f.rowsOf("atelierAuditLog");
  assert.equal(entry.action, "staff.setRoles");
  assert.equal(entry.actorUserId, admin._id);
  assert.equal(entry.actorKind, "staff");
  assert.equal(entry.targetTable, "users");
  assert.equal(entry.targetId, client._id);
  assert.deepEqual(entry.meta, { before: [], after: ["concierge", "fitter"] });
  assert.equal(entry.at, NOW);

  // The same roles again write nothing; a different set writes once more.
  await staff.setStaffRoles(f.ctx, admin, client._id, ["concierge", "fitter"], NOW + 1);
  assert.equal(f.rowsOf("atelierAuditLog").length, 1);
  const cleared = await staff.setStaffRoles(f.ctx, admin, concierge._id, [], NOW + 2);
  assert.deepEqual(cleared.roles, []);
  assert.equal((await f.ctx.db.get(concierge._id)).staffRoles, undefined, "an empty list removes the field");
  assert.deepEqual(f.rowsOf("atelierAuditLog")[1].meta, { before: ["concierge"], after: [] });

  await assert.rejects(staff.setStaffRoles(f.ctx, admin, "users|999", ["privacy"], NOW), isAppError("NOT_FOUND"));
  assert.equal((await staff.setStaffRoles(f.ctx, admin, nameless._id, ["privacy"], NOW)).name, "Unnamed account");
});

test("list() names admins and role holders and nobody else", async () => {
  const { f, admin, concierge, client, nameless } = await setup();
  const listed = await staff.listStaff(f.ctx);
  assert.deepEqual(
    listed.map((member) => [member.userId, member.roles, member.isAdmin]),
    [
      [admin._id, [], true],
      [concierge._id, ["concierge"], false],
    ],
  );
  await staff.setStaffRoles(f.ctx, admin, nameless._id, ["privacy"], NOW);
  const after = await staff.listStaff(f.ctx);
  assert.deepEqual(
    after.map((member) => member.userId),
    [admin._id, concierge._id, nameless._id],
  );
  assert.ok(!after.some((member) => member.userId === client._id));
  assert.ok(staff.isStaffMember(admin) && staff.isStaffMember(concierge) && !staff.isStaffMember(client));
});

test("auditLog: bounded, newest first, narrowed by target, actors by first name only", async () => {
  const { f, admin, concierge, client } = await setup();
  assert.equal(staff.clampAuditLimit(undefined), staff.AUDIT_LIMIT_DEFAULT);
  assert.equal(staff.clampAuditLimit(0), 1);
  assert.equal(staff.clampAuditLimit(-5), 1);
  assert.equal(staff.clampAuditLimit(5000), staff.AUDIT_LIMIT_MAX);
  assert.equal(staff.clampAuditLimit(12.9), 12);
  assert.equal(staff.clampAuditLimit(Number.NaN), staff.AUDIT_LIMIT_DEFAULT);

  for (let i = 0; i < 5; i += 1) {
    await audit(
      f.ctx,
      { actor: concierge, action: `case.step${i}`, targetTable: "atelierCases", targetId: "atelierCases|1" },
      NOW + i,
    );
  }
  await audit(
    f.ctx,
    {
      actor: { user: client, guestKey: null },
      action: "share.create",
      targetTable: "atelierShares",
      targetId: "atelierShares|1",
      meta: { days: 7 },
    },
    NOW + 10,
  );
  await audit(
    f.ctx,
    { actor: null, action: "previews.expire", targetTable: "atelierPreviewJobs", targetId: "atelierPreviewJobs|1" },
    NOW + 11,
  );
  // A guest acts as a client; the groups model says so explicitly because `audit` alone cannot tell a guest from the system.
  await audit(
    f.ctx,
    {
      actor: { user: null, guestKey: "c".repeat(32) },
      actorKind: "client",
      action: "group.join",
      targetTable: "atelierGroupParticipants",
      targetId: "p|1",
    },
    NOW + 12,
  );
  await staff.setStaffRoles(f.ctx, admin, client._id, ["finance"], NOW + 20);

  const all = await staff.listAudit(f.ctx, {});
  assert.equal(all.length, 9);
  assert.deepEqual(
    all.map((entry) => entry.at),
    [NOW + 20, NOW + 12, NOW + 11, NOW + 10, NOW + 4, NOW + 3, NOW + 2, NOW + 1, NOW],
  );
  assert.deepEqual(
    all.slice(0, 4).map((entry) => [entry.action, entry.actorKind, entry.actorName]),
    [
      ["staff.setRoles", "staff", "Nyoni"],
      ["group.join", "client", "Client"],
      ["previews.expire", "system", "System"],
      ["share.create", "client", "Kwame"],
    ],
  );
  assert.equal(all[4].actorName, "Adaeze");
  assert.deepEqual(all[3].meta, { days: 7 });
  const serialized = JSON.stringify(all);
  assert.ok(!serialized.includes("example.com") && !serialized.includes("c".repeat(32)), "no email, no guest key");
  assert.deepEqual(Object.keys(all[0]).sort(), [
    "_id",
    "action",
    "actorKind",
    "actorName",
    "actorUserId",
    "at",
    "meta",
    "targetId",
    "targetTable",
  ]);

  assert.equal((await staff.listAudit(f.ctx, { limit: 3 })).length, 3);
  const oneRecord = await staff.listAudit(f.ctx, { targetTable: "atelierCases", targetId: "atelierCases|1" });
  assert.deepEqual(
    oneRecord.map((entry) => entry.action),
    ["case.step4", "case.step3", "case.step2", "case.step1", "case.step0"],
  );
  const oneTable = await staff.listAudit(f.ctx, { targetTable: "users", limit: 200 });
  assert.deepEqual(
    oneTable.map((entry) => entry.action),
    ["staff.setRoles"],
  );
  assert.deepEqual(await staff.listAudit(f.ctx, { targetTable: "atelierCases", targetId: "atelierCases|2" }), []);
  await assert.rejects(staff.listAudit(f.ctx, { targetId: "atelierCases|1" }), isAppError("INVALID_INPUT"));
});
