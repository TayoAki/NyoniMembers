import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { registerHooks } from "node:module";
import { fileURLToPath } from "node:url";
import test from "node:test";

registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch (error) {
      if (error.code !== "ERR_MODULE_NOT_FOUND" || !specifier.startsWith(".")) throw error;
      for (const extension of [".ts", ".js"]) {
        const candidate = new URL(`${specifier}${extension}`, context.parentURL);
        if (existsSync(fileURLToPath(candidate))) return nextResolve(candidate.href, context);
      }
      throw error;
    }
  },
});

const {
  CATALOGUE_TRANSITIONS,
  canTransition,
  changedSince,
  confirmShade,
  latestVersion,
  listEntries,
  normalizeCode,
  normalizeHex,
  publishVersion,
  setEntryStatus,
  setStock,
  sortBySortOrder,
  toStaffEntryViews,
  toVersionViews,
  upsertEntry,
} = await import("../convex/model/atelier/catalogue_staff.ts");
const { ensureCatalogueSeeded, listApproved, getEntry } = await import("../convex/model/atelier/catalogue.ts");
const { CLOTH_SEED } = await import("../convex/shared/atelier/cloths.ts");
const { BUTTON_SEED, LINING_SEED } = await import("../convex/shared/atelier/materials.ts");
const { CATALOGUE_STATUSES } = await import("../convex/shared/atelier/enums.ts");

/** Field order of the indexes the catalogue reads through (convex/schema.ts). */
const INDEXES = {
  by_version: ["version"],
  by_kind_status: ["kind", "status", "sortOrder"],
  by_kind_code: ["kind", "code"],
};

/** An in-memory stand-in for ctx.db: indexed reads, inserts, patches, and a log of every write. */
function fakeCtx() {
  const rows = new Map();
  const inserts = [];
  const patches = [];
  let counter = 0;

  function queryBuilder(table) {
    let constraints = [];
    let fields = [];
    let direction = "asc";
    const matching = () => {
      const docs = [...rows.values()].filter((doc) => doc.__table === table);
      const filtered = docs.filter((doc) => constraints.every(([field, value]) => doc[field] === value));
      filtered.sort((a, b) => {
        for (const field of fields) {
          if (a[field] < b[field]) return direction === "asc" ? -1 : 1;
          if (a[field] > b[field]) return direction === "asc" ? 1 : -1;
        }
        return 0;
      });
      return filtered.map(strip);
    };
    const builder = {
      withIndex(name, fn) {
        fields = INDEXES[name];
        assert.ok(fields, `unknown index ${name}`);
        if (fn) {
          const q = { eq: (field, value) => (constraints.push([field, value]), q) };
          fn(q);
        }
        return builder;
      },
      order(dir) {
        direction = dir;
        return builder;
      },
      async first() {
        return matching()[0] ?? null;
      },
      async unique() {
        const found = matching();
        assert.ok(found.length <= 1, "unique() found several rows");
        return found[0] ?? null;
      },
      async take(n) {
        return matching().slice(0, n);
      },
      async collect() {
        return matching();
      },
    };
    return builder;
  }

  function strip(doc) {
    const rest = { ...doc };
    delete rest.__table;
    return rest;
  }

  /** Stores a row under its own `_id` without logging it: fixtures, not writes under test. */
  function put(table, doc) {
    rows.set(doc._id, { __table: table, _creationTime: ++counter, ...doc });
  }

  const db = {
    async insert(table, doc) {
      const id = `${table}:${++counter}`;
      rows.set(id, { __table: table, _id: id, _creationTime: counter, ...doc });
      inserts.push([table, { ...doc }]);
      return id;
    },
    async get(id) {
      const doc = rows.get(id);
      return doc ? strip(doc) : null;
    },
    async patch(id, patch) {
      const doc = rows.get(id);
      assert.ok(doc, `patch of unknown ${id}`);
      patches.push([id, { ...patch }]);
      for (const [key, value] of Object.entries(patch)) {
        if (value === undefined) delete doc[key];
        else doc[key] = value;
      }
    },
    query: queryBuilder,
  };
  const ctx = {
    db,
    storage: { getUrl: async (storageId) => `https://files.example/${storageId}` },
    auth: { getUserIdentity: async () => null },
  };
  const auditRows = () => inserts.filter(([table]) => table === "atelierAuditLog").map(([, row]) => row);
  return { ctx, db, put, inserts, patches, auditRows, rows };
}

const STAFF = {
  _id: "users:ops",
  role: "user",
  staffRoles: ["operations"],
  name: "Ama Mensah",
  clerkId: "c1",
  createdAt: 1,
};
const FITTER = {
  _id: "users:fitter",
  role: "user",
  staffRoles: ["fitter", "operations"],
  name: "Kofi Boateng",
  clerkId: "c2",
  createdAt: 1,
};

async function seededFixture(now = 1_000) {
  const f = fakeCtx();
  f.put("users", STAFF);
  f.put("users", FITTER);
  const version = await ensureCatalogueSeeded(f.ctx, now);
  assert.equal(version, 1);
  f.inserts.length = 0;
  f.patches.length = 0;
  return f;
}

function clothInput(overrides = {}) {
  return {
    kind: "cloth",
    code: "house-navy-hopsack",
    name: "House navy hopsack",
    mill: "Vitale Barberis Canonico",
    description: "An open-weave navy for warm weather.",
    composition: "100% wool",
    weight: "summer",
    pattern: "solid",
    colour: "navy",
    hex: "#1f2740",
    season: ["spring", "summer", "summer"],
    occasions: ["business"],
    priceUsd: 1650,
    provenance: "Mill book received 18 October 2026.",
    ...overrides,
  };
}

test("the status machine: draft to approved to withdrawn, with a way back, and nothing else", () => {
  assert.deepEqual(Object.keys(CATALOGUE_TRANSITIONS).sort(), [...CATALOGUE_STATUSES].sort());
  assert.ok(canTransition("draft", "approved"));
  assert.ok(canTransition("draft", "withdrawn"));
  assert.ok(canTransition("approved", "withdrawn"));
  assert.ok(canTransition("withdrawn", "approved"));
  assert.ok(canTransition("withdrawn", "draft"));
  assert.equal(canTransition("approved", "draft"), false);
  for (const status of CATALOGUE_STATUSES) assert.equal(canTransition(status, status), false);
});

test("shades and codes are normalised, and bad ones are refused as input errors", () => {
  assert.equal(normalizeHex(" #1f2538 "), "#1F2538");
  for (const bad of ["1F2538", "#1F25", "#GGGGGG", "", "#1F2538FF"]) {
    assert.throws(
      () => normalizeHex(bad),
      (error) => error.data?.code === "INVALID_INPUT",
    );
  }
  assert.equal(normalizeCode("  Loro-Piana-365 "), "loro-piana-365");
  for (const bad of ["", "-leading", "has space", "under_score", "a".repeat(81)]) {
    assert.throws(
      () => normalizeCode(bad),
      (error) => error.data?.code === "INVALID_INPUT",
    );
  }
});

test("catalogue order is sortOrder then code, and changedSince is strictly after the publish", () => {
  const sorted = sortBySortOrder([
    { sortOrder: 2, code: "b" },
    { sortOrder: 1, code: "z" },
    { sortOrder: 2, code: "a" },
  ]);
  assert.deepEqual(
    sorted.map((row) => row.code),
    ["z", "a", "b"],
  );
  const entries = [{ updatedAt: 99 }, { updatedAt: 100 }, { updatedAt: 101 }];
  assert.deepEqual(changedSince(entries, 100), [{ updatedAt: 101 }]);
});

test("seeding publishes version 1 with every cloth, button and lining approved and unconfirmed", async () => {
  const f = await seededFixture(1_000);
  const latest = await latestVersion(f.ctx);
  assert.equal(latest.version, 1);
  assert.equal(latest.publishedAt, 1_000);
  const all = await listEntries(f.ctx);
  assert.equal(all.length, CLOTH_SEED.length + BUTTON_SEED.length + LINING_SEED.length);
  assert.ok(all.every((entry) => entry.status === "approved" && entry.shadeConfirmed === false && entry.version === 1));
  assert.deepEqual(changedSince(all, latest.publishedAt), []);
  const cloths = await listEntries(f.ctx, "cloth");
  assert.deepEqual(
    cloths.map((c) => c.code),
    sortBySortOrder(CLOTH_SEED).map((c) => c.code),
  );
});

test("upsert creates a draft entry with version 0, provenance and an audit row", async () => {
  const f = await seededFixture(1_000);
  const result = await upsertEntry(f.ctx, STAFF, clothInput(), 2_000);
  assert.equal(result.created, true);
  const entry = await f.db.get(result.id);
  assert.equal(entry.status, "draft");
  assert.equal(entry.version, 0);
  assert.equal(entry.shadeConfirmed, false);
  assert.equal(entry.hex, "#1F2740");
  assert.equal(entry.inStock, true);
  assert.equal(entry.sampleAvailable, false);
  assert.deepEqual(entry.season, ["spring", "summer"]);
  assert.equal(entry.sortOrder, Math.max(...CLOTH_SEED.map((c) => c.sortOrder)) + 1);
  assert.equal(entry.provenance, "Mill book received 18 October 2026.");
  assert.equal(entry.approvedBy, undefined);
  assert.equal(entry.createdAt, 2_000);
  assert.equal(entry.updatedAt, 2_000);
  assert.equal(
    (await listApproved(f.ctx, "cloth")).some((c) => c.code === "house-navy-hopsack"),
    false,
    "a draft entry is not offered to clients",
  );
  const audits = f.auditRows();
  assert.equal(audits.length, 1);
  assert.equal(audits[0].action, "catalogue.create");
  assert.equal(audits[0].actorKind, "staff");
  assert.equal(audits[0].actorUserId, STAFF._id);
  assert.equal(audits[0].targetId, result.id);
  assert.equal(audits[0].at, 2_000);
});

test("upsert refuses a new entry without provenance, a bad link or a negative price, and writes nothing", async () => {
  const f = await seededFixture(1_000);
  await assert.rejects(
    upsertEntry(f.ctx, STAFF, clothInput({ provenance: "  " }), 2_000),
    (error) => error.data?.code === "INVALID_INPUT" && error.data.details.field === "provenance",
  );
  await assert.rejects(
    upsertEntry(f.ctx, STAFF, clothInput({ productUrl: "nyonicouture.com/cloth" }), 2_000),
    (error) => error.data?.code === "INVALID_INPUT" && error.data.details.field === "productUrl",
  );
  await assert.rejects(
    upsertEntry(f.ctx, STAFF, clothInput({ priceUsd: -1 }), 2_000),
    (error) => error.data?.code === "INVALID_INPUT" && error.data.details.field === "priceUsd",
  );
  await assert.rejects(
    upsertEntry(f.ctx, STAFF, clothInput({ name: " " }), 2_000),
    (error) => error.data?.code === "INVALID_INPUT" && error.data.details.field === "name",
  );
  assert.deepEqual(f.inserts, []);
  assert.deepEqual(f.patches, []);
});

test("upsert by kind and code updates in place: status and approval survive, a new shade is unconfirmed again", async () => {
  const f = await seededFixture(1_000);
  const seeded = await getEntry(f.ctx, "cloth", CLOTH_SEED[0].code);
  await confirmShade(f.ctx, FITTER, seeded._id, seeded.hex, 1_500);
  f.inserts.length = 0;
  f.patches.length = 0;

  const unchangedShade = await upsertEntry(
    f.ctx,
    STAFF,
    clothInput({ code: CLOTH_SEED[0].code, hex: seeded.hex.toLowerCase(), mill: undefined, provenance: undefined }),
    2_000,
  );
  assert.deepEqual(unchangedShade, { id: seeded._id, created: false });
  let entry = await f.db.get(seeded._id);
  assert.equal(entry.status, "approved");
  assert.equal(entry.version, 1);
  assert.equal(entry.shadeConfirmed, true, "the same shade stays confirmed");
  assert.equal(entry.approvedBy, FITTER._id);
  assert.equal(entry.mill, undefined, "an omitted optional field is cleared");
  assert.equal(entry.provenance, seeded.provenance, "provenance is kept when not restated");
  assert.equal(entry.name, "House navy hopsack");
  assert.equal(entry.createdAt, 1_000);
  assert.equal(entry.updatedAt, 2_000);
  assert.equal(f.auditRows().at(-1).action, "catalogue.update");
  assert.equal(f.auditRows().at(-1).meta.shadeChanged, false);

  await upsertEntry(f.ctx, STAFF, clothInput({ code: CLOTH_SEED[0].code, hex: "#000000" }), 2_500);
  entry = await f.db.get(seeded._id);
  assert.equal(entry.hex, "#000000");
  assert.equal(entry.shadeConfirmed, false, "a changed shade must be confirmed again");
  assert.equal(f.auditRows().at(-1).meta.shadeChanged, true);
  assert.equal((await listEntries(f.ctx, "cloth")).length, CLOTH_SEED.length, "no second row was created");
});

test("approving records who and when; withdrawing touches only the entry; invalid moves write nothing", async () => {
  const f = await seededFixture(1_000);
  const { id } = await upsertEntry(f.ctx, STAFF, clothInput(), 2_000);
  f.inserts.length = 0;
  f.patches.length = 0;

  const approved = await setEntryStatus(f.ctx, STAFF, id, "approved", 3_000);
  assert.equal(approved.status, "approved");
  assert.equal(approved.approvedBy, STAFF._id);
  assert.equal(approved.approvedAt, 3_000);
  assert.equal(approved.updatedAt, 3_000);
  assert.ok(
    (await listApproved(f.ctx, "cloth")).some((c) => c._id === id),
    "an approved entry reaches clients",
  );
  assert.deepEqual(f.auditRows().at(-1).meta, {
    kind: "cloth",
    code: "house-navy-hopsack",
    from: "draft",
    to: "approved",
  });

  await assert.rejects(
    setEntryStatus(f.ctx, STAFF, id, "approved", 3_100),
    (error) => error.data?.code === "INVALID_STATE",
  );
  await assert.rejects(
    setEntryStatus(f.ctx, STAFF, id, "draft", 3_100),
    (error) => error.data?.code === "INVALID_STATE" && error.data.details.from === "approved",
  );
  const patchesBefore = f.patches.length;
  const insertsBefore = f.inserts.length;

  const withdrawn = await setEntryStatus(f.ctx, STAFF, id, "withdrawn", 4_000);
  assert.equal(withdrawn.status, "withdrawn");
  assert.equal(withdrawn.approvedBy, STAFF._id, "the approval record is history, not erased");
  const patchedIds = f.patches.slice(patchesBefore).map(([patchedId]) => patchedId);
  assert.deepEqual([...new Set(patchedIds)], [id], "withdrawing patches the entry and nothing else");
  assert.equal(f.inserts.slice(insertsBefore).filter(([table]) => table !== "atelierAuditLog").length, 0);
  assert.equal(
    (await listApproved(f.ctx, "cloth")).some((c) => c._id === id),
    false,
  );
  assert.ok(await getEntry(f.ctx, "cloth", "house-navy-hopsack"), "a withdrawn entry can still be named by code");

  await assert.rejects(
    setEntryStatus(f.ctx, STAFF, "atelierCatalogueEntries:999", "approved"),
    (error) => error.data?.code === "NOT_FOUND",
  );
});

test("confirming a shade records the fitter and refuses a malformed shade before reading anything", async () => {
  const f = await seededFixture(1_000);
  const seeded = await getEntry(f.ctx, "cloth", CLOTH_SEED[1].code);
  await assert.rejects(
    confirmShade(f.ctx, FITTER, seeded._id, "navy", 2_000),
    (error) => error.data?.code === "INVALID_INPUT",
  );
  assert.deepEqual(f.patches, []);

  const confirmed = await confirmShade(f.ctx, FITTER, seeded._id, "#1a2b3c", 2_000);
  assert.equal(confirmed.hex, "#1A2B3C");
  assert.equal(confirmed.shadeConfirmed, true);
  assert.equal(confirmed.approvedBy, FITTER._id);
  assert.equal(confirmed.approvedAt, 2_000);
  const audit = f.auditRows().at(-1);
  assert.equal(audit.action, "catalogue.shade");
  assert.deepEqual(audit.meta, { kind: "cloth", code: CLOTH_SEED[1].code, from: seeded.hex, to: "#1A2B3C" });
});

test("stock is recorded with an audit row, and recording what is already true writes nothing", async () => {
  const f = await seededFixture(1_000);
  const seeded = await getEntry(f.ctx, "cloth", CLOTH_SEED[2].code);
  const same = await setStock(
    f.ctx,
    STAFF,
    seeded._id,
    { inStock: seeded.inStock, sampleAvailable: seeded.sampleAvailable },
    2_000,
  );
  assert.equal(same.updatedAt, 1_000);
  assert.deepEqual(f.patches, []);
  assert.deepEqual(f.auditRows(), []);

  const changed = await setStock(f.ctx, STAFF, seeded._id, { inStock: false, sampleAvailable: true }, 2_000);
  assert.equal(changed.inStock, false);
  assert.equal(changed.sampleAvailable, true);
  assert.equal(changed.status, "approved", "out of stock is not withdrawn: the client sees it and re-confirms");
  assert.equal(changed.updatedAt, 2_000);
  assert.equal(f.auditRows().at(-1).action, "catalogue.stock");
  assert.equal(f.auditRows().at(-1).meta.wasInStock, true);
});

test("publishing stamps only what changed, bumps the version once, and refuses an empty publish", async () => {
  const f = await seededFixture(1_000);
  await assert.rejects(
    publishVersion(f.ctx, STAFF, "Nothing new", 1_500),
    (error) => error.data?.code === "INVALID_STATE" && error.data.details.version === 1,
  );
  await assert.rejects(publishVersion(f.ctx, STAFF, "   ", 1_500), (error) => error.data?.code === "INVALID_INPUT");
  assert.equal((await latestVersion(f.ctx)).version, 1);

  const { id } = await upsertEntry(f.ctx, STAFF, clothInput(), 2_000);
  await setEntryStatus(f.ctx, STAFF, id, "approved", 2_100);
  const seeded = await getEntry(f.ctx, "cloth", CLOTH_SEED[0].code);
  await setStock(f.ctx, STAFF, seeded._id, { inStock: false, sampleAvailable: true }, 2_200);
  f.inserts.length = 0;
  f.patches.length = 0;

  const result = await publishVersion(f.ctx, STAFF, "  Added the navy hopsack; the 365 book is out of stock.  ", 3_000);
  assert.deepEqual(result, { version: 2, publishedAt: 3_000, stamped: 2 });
  const latest = await latestVersion(f.ctx);
  assert.equal(latest.version, 2);
  assert.equal(latest.publishedBy, STAFF._id);
  assert.equal(latest.note, "Added the navy hopsack; the 365 book is out of stock.");
  assert.equal((await f.db.get(id)).version, 2);
  assert.equal((await f.db.get(seeded._id)).version, 2);
  const untouched = await getEntry(f.ctx, "cloth", CLOTH_SEED[3].code);
  assert.equal(untouched.version, 1);
  assert.equal(untouched.updatedAt, 1_000);
  const stampPatches = f.patches.filter(([, patch]) => "version" in patch);
  assert.equal(stampPatches.length, 2);
  assert.ok(
    stampPatches.every(([, patch]) => !("updatedAt" in patch)),
    "stamping is the publish, not an edit",
  );
  const audit = f.auditRows().at(-1);
  assert.equal(audit.action, "catalogue.publish");
  assert.equal(audit.targetTable, "atelierCatalogueVersions");
  assert.deepEqual([...audit.meta.stamped].sort(), ["cloth:house-navy-hopsack", `cloth:${CLOTH_SEED[0].code}`].sort());

  await assert.rejects(publishVersion(f.ctx, STAFF, "Again", 3_100), (error) => error.data?.code === "INVALID_STATE");
  assert.equal((await latestVersion(f.ctx)).version, 2);
});

test("publishing on a deployment that was never seeded is the seed, credited to the staff member", async () => {
  const f = fakeCtx();
  const result = await publishVersion(f.ctx, STAFF, "First publish", 5_000);
  const total = CLOTH_SEED.length + BUTTON_SEED.length + LINING_SEED.length;
  assert.deepEqual(result, { version: 1, publishedAt: 5_000, stamped: total });
  const latest = await latestVersion(f.ctx);
  assert.equal(latest.version, 1);
  assert.equal(latest.publishedBy, STAFF._id);
  assert.equal((await listEntries(f.ctx)).length, total);
  assert.equal(f.auditRows().at(-1).meta.seeded, true);
});

test("staff views carry provenance, the approver's name and the pending-publish flag; versions mark the current one", async () => {
  const f = await seededFixture(1_000);
  const seeded = await getEntry(f.ctx, "cloth", CLOTH_SEED[0].code);
  await f.db.patch(seeded._id, { swatchStorageId: "storage:swatch1" });
  await confirmShade(f.ctx, FITTER, seeded._id, "#101010", 2_000);

  const latest = await latestVersion(f.ctx);
  const views = await toStaffEntryViews(f.ctx, await listEntries(f.ctx, "cloth"), latest);
  const confirmed = views.find((view) => view.code === CLOTH_SEED[0].code);
  assert.equal(confirmed.pendingPublish, true);
  assert.equal(confirmed.approvedByName, FITTER.name);
  assert.equal(confirmed.approvedAt, 2_000);
  assert.equal(confirmed.provenance.length > 0, true);
  assert.equal(confirmed.swatchUrl, "https://files.example/storage:swatch1");
  assert.equal("swatchStorageId" in confirmed, false, "storage ids never leave the server");
  assert.equal("guestKey" in confirmed, false);
  const other = views.find((view) => view.code === CLOTH_SEED[1].code);
  assert.equal(other.pendingPublish, false);
  assert.equal(other.approvedBy, null);
  assert.equal(other.approvedByName, null);

  await publishVersion(f.ctx, STAFF, "Confirmed the 365 shade", 3_000);
  const versionRows = [await latestVersion(f.ctx), latest];
  const versionViews = await toVersionViews(f.ctx, versionRows, 2);
  assert.deepEqual(
    versionViews.map((view) => [view.version, view.isCurrent, view.publishedByName]),
    [
      [2, true, STAFF.name],
      [1, false, null],
    ],
  );
});
