import { existsSync } from "node:fs";
import { registerHooks } from "node:module";
import { fileURLToPath } from "node:url";

/**
 * A fake Convex ctx for unit tests of the Atelier models: an in-memory db that honours the chained
 * query API (`withIndex` → `order` → `filter` → `take`/`first`/`unique`) by predicate, records every
 * insert and patch, and treats `undefined` in a patch as "remove the field", as Convex does.
 */

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

export const GUEST_KEY = "a".repeat(32);
export const OTHER_GUEST_KEY = "b".repeat(32);

export const guestActor = { user: null, guestKey: GUEST_KEY };
export const otherGuestActor = { user: null, guestKey: OTHER_GUEST_KEY };
export const accountUser = { _id: "users|1", role: "user", name: "Nia Okafor", createdAt: 1 };
export const accountActor = { user: accountUser, guestKey: null };
export const strangerUser = { _id: "users|2", role: "user", name: "Someone Else", createdAt: 1 };
export const strangerActor = { user: strangerUser, guestKey: null };

function stripUndefined(doc) {
  return Object.fromEntries(Object.entries(doc).filter(([, value]) => value !== undefined));
}

function resolve(operand, row) {
  return operand && typeof operand === "object" && "__field" in operand ? row[operand.__field] : operand;
}

function queryBuilder(source) {
  const predicates = [];
  let descending = false;
  const run = () => {
    const list = source().filter((row) => predicates.every((predicate) => predicate(row)));
    list.sort((a, b) => a._creationTime - b._creationTime);
    return descending ? list.reverse() : list;
  };
  const indexQuery = {
    eq(field, value) {
      predicates.push((row) => row[field] === value);
      return indexQuery;
    },
  };
  const filterQuery = {
    field: (name) => ({ __field: name }),
    eq: (a, b) => (row) => resolve(a, row) === resolve(b, row),
    neq: (a, b) => (row) => resolve(a, row) !== resolve(b, row),
  };
  const builder = {
    withIndex(_name, build) {
      if (build) build(indexQuery);
      return builder;
    },
    order(direction) {
      descending = direction === "desc";
      return builder;
    },
    filter(build) {
      predicates.push(build(filterQuery));
      return builder;
    },
    async take(n) {
      return run().slice(0, n);
    },
    async first() {
      return run()[0] ?? null;
    },
    async unique() {
      const rows = run();
      if (rows.length > 1) throw new Error("unique() matched more than one row");
      return rows[0] ?? null;
    },
    async collect() {
      return run();
    },
  };
  return builder;
}

export function fakeCtx() {
  const tables = new Map();
  const log = { inserts: [], patches: [] };
  let sequence = 0;
  const rows = (table) => {
    if (!tables.has(table)) tables.set(table, []);
    return tables.get(table);
  };
  const findRow = (id) => {
    for (const list of tables.values()) {
      const row = list.find((entry) => entry._id === id);
      if (row) return row;
    }
    return null;
  };
  const db = {
    async insert(table, doc) {
      sequence += 1;
      const _id = `${table}|${sequence}`;
      rows(table).push({ _id, _creationTime: sequence, ...structuredClone(stripUndefined(doc)) });
      log.inserts.push([table, _id, doc]);
      return _id;
    },
    async get(id) {
      const row = findRow(id);
      return row ? structuredClone(row) : null;
    },
    async patch(id, patch) {
      const row = findRow(id);
      if (!row) throw new Error(`patch of unknown row ${id}`);
      for (const [key, value] of Object.entries(patch)) {
        if (value === undefined) delete row[key];
        else row[key] = structuredClone(value);
      }
      log.patches.push([id, patch]);
    },
    async delete(table, id) {
      const list = rows(table);
      const index = list.findIndex((entry) => entry._id === id);
      if (index >= 0) list.splice(index, 1);
    },
    normalizeId(table, id) {
      return typeof id === "string" && id.startsWith(`${table}|`) ? id : null;
    },
    query(table) {
      return queryBuilder(() => rows(table).map((row) => structuredClone(row)));
    },
  };
  return {
    ctx: {
      db,
      storage: { getUrl: async () => null },
      auth: { getUserIdentity: async () => null },
    },
    log,
    tables,
    /** The live row (not a copy), for tests that need to tamper with stored state. */
    row: findRow,
    rowsOf: (table) => rows(table),
  };
}

export function isAppError(code) {
  return (error) => error?.data?.code === code;
}
