import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { optionalEnv } from "../lib/env";
import { dayKey, PACKS, PLANS, type PackDefinition, type PlanId } from "../shared/credits";
import { JOB_STATUSES, type JobStatus } from "../shared/jobs";

const DAY_MS = 24 * 60 * 60 * 1000;

export type AdminWindow = 1 | 7 | 30;

export type AdminOverview = {
  days: AdminWindow;
  users: number;
  newUsers: number;
  creditsSold: number;
  creditsGranted: number;
  creditsSpent: number;
  creditsRefunded: number;
  revenueUsd: number;
  cogsUsd: number;
  grossMarginPct: number;
  rendersDone: number;
  itemsExtracted: number;
  jobsFailed: number;
  jobsRunning: number;
  todayCreditsReserved: number;
  dailySpendCapUsd: number | null;
};

/**
 * Money in vs. money out. Everything comes from the ledger (credits) and the stored per-image
 * token costs (COGS); nothing is estimated from list prices except plan revenue, which the ledger
 * only records by plan name.
 */
export async function overview(ctx: QueryCtx, days: AdminWindow, now: number): Promise<AdminOverview> {
  const since = now - days * DAY_MS;

  const allUsers = await ctx.db.query("users").withIndex("by_createdAt").collect();
  const ledger = await ctx.db
    .query("creditLedger")
    .withIndex("by_createdAt", (q) => q.gte("createdAt", since))
    .collect();
  const renders = await ctx.db
    .query("renders")
    .withIndex("by_createdAt", (q) => q.gte("createdAt", since))
    .collect();
  const items = await ctx.db
    .query("items")
    .withIndex("by_createdAt", (q) => q.gte("createdAt", since))
    .collect();

  let creditsSold = 0;
  let creditsGranted = 0;
  let creditsSpent = 0;
  let creditsRefunded = 0;
  let revenueUsd = 0;
  for (const line of ledger) {
    switch (line.kind) {
      case "topup":
        creditsSold += line.delta;
        revenueUsd += packRevenueUsd(line);
        break;
      case "plan_grant":
        creditsGranted += line.delta;
        revenueUsd += planRevenueUsd(line);
        break;
      case "signup_bonus":
        creditsGranted += line.delta;
        break;
      case "reserve":
        creditsSpent += -line.delta;
        break;
      case "refund":
        creditsRefunded += line.delta;
        break;
      default:
        break;
    }
  }

  const cogsUsd =
    renders.reduce((sum, render) => sum + (render.costUsd ?? 0), 0) +
    items.reduce((sum, item) => sum + (item.costUsd ?? 0), 0);

  const failedJobs = await ctx.db
    .query("jobs")
    .withIndex("by_status", (q) => q.eq("status", "failed").gte("createdAt", since))
    .collect();
  const jobsRunning = await countActiveJobs(ctx);

  const counter = await ctx.db
    .query("systemCounters")
    .withIndex("by_day_key", (q) => q.eq("dayKey", dayKey(now)).eq("key", "credits_reserved"))
    .unique();

  const capRaw = optionalEnv("MAX_DAILY_SPEND_USD");
  const cap = capRaw === undefined ? Number.NaN : Number(capRaw);

  return {
    days,
    users: allUsers.length,
    newUsers: allUsers.filter((user) => user.createdAt >= since).length,
    creditsSold,
    creditsGranted,
    creditsSpent,
    creditsRefunded,
    revenueUsd: round2(revenueUsd),
    cogsUsd: round2(cogsUsd),
    grossMarginPct: revenueUsd > 0 ? round2(((revenueUsd - cogsUsd) / revenueUsd) * 100) : 0,
    rendersDone: renders.filter((render) => render.status === "done").length,
    itemsExtracted: items.filter((item) => item.status === "ready").length,
    jobsFailed: failedJobs.length,
    jobsRunning,
    todayCreditsReserved: counter?.value ?? 0,
    dailySpendCapUsd: Number.isFinite(cap) ? cap : null,
  };
}

export async function countActiveJobs(ctx: QueryCtx): Promise<number> {
  const active: readonly JobStatus[] = ["queued", "running"];
  const lists = await Promise.all(
    active.map((status) =>
      ctx.db
        .query("jobs")
        .withIndex("by_status", (q) => q.eq("status", status))
        .collect(),
    ),
  );
  return lists.reduce((sum, list) => sum + list.length, 0);
}

export type AdminJobRow = { job: Doc<"jobs">; userEmail?: string; userName?: string };

export async function recentJobs(
  ctx: QueryCtx,
  filter: "failed" | "partial" | "running" | undefined,
  limit: number,
): Promise<AdminJobRow[]> {
  const statuses: readonly JobStatus[] =
    filter === "running" ? ["queued", "running"] : filter ? [filter] : JOB_STATUSES;
  const lists = await Promise.all(
    statuses.map((status) =>
      ctx.db
        .query("jobs")
        .withIndex("by_status", (q) => q.eq("status", status))
        .order("desc")
        .take(limit),
    ),
  );
  const jobs = lists
    .flat()
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, limit);

  const users = await hydrateUsers(
    ctx,
    jobs.map((job) => job.userId),
  );
  return jobs.map((job) => {
    const user = users.get(job.userId);
    return { job, userEmail: user?.email, userName: user?.name };
  });
}

export type TopSpender = {
  userId: Id<"users">;
  email?: string;
  name?: string;
  plan: string;
  creditsSpent: number;
  cogsUsd: number;
};

export async function topSpenders(ctx: QueryCtx, days: AdminWindow, limit: number, now: number): Promise<TopSpender[]> {
  const since = now - days * DAY_MS;
  const ledger = await ctx.db
    .query("creditLedger")
    .withIndex("by_createdAt", (q) => q.gte("createdAt", since))
    .collect();
  const renders = await ctx.db
    .query("renders")
    .withIndex("by_createdAt", (q) => q.gte("createdAt", since))
    .collect();
  const items = await ctx.db
    .query("items")
    .withIndex("by_createdAt", (q) => q.gte("createdAt", since))
    .collect();

  const spent = new Map<Id<"users">, number>();
  for (const line of ledger) {
    if (line.kind !== "reserve") continue;
    spent.set(line.userId, (spent.get(line.userId) ?? 0) + -line.delta);
  }
  const cogs = new Map<Id<"users">, number>();
  for (const render of renders) cogs.set(render.userId, (cogs.get(render.userId) ?? 0) + (render.costUsd ?? 0));
  for (const item of items) cogs.set(item.userId, (cogs.get(item.userId) ?? 0) + (item.costUsd ?? 0));

  const ranked = [...spent.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit);
  const users = await hydrateUsers(
    ctx,
    ranked.map(([userId]) => userId),
  );
  return ranked.map(([userId, creditsSpent]) => {
    const user = users.get(userId);
    return {
      userId,
      email: user?.email,
      name: user?.name,
      plan: user?.plan ?? "free",
      creditsSpent,
      cogsUsd: round2(cogs.get(userId) ?? 0),
    };
  });
}

async function hydrateUsers(ctx: QueryCtx, userIds: Id<"users">[]): Promise<Map<Id<"users">, Doc<"users">>> {
  const unique = [...new Set(userIds)];
  const docs = await Promise.all(unique.map((userId) => ctx.db.get(userId)));
  const map = new Map<Id<"users">, Doc<"users">>();
  for (const doc of docs) if (doc) map.set(doc._id, doc);
  return map;
}

/** Packs are identified by the note the Stripe webhook writes, falling back to the credit amount. */
function packRevenueUsd(line: Doc<"creditLedger">): number {
  const packs = Object.values(PACKS) as PackDefinition[];
  const byNote = line.note ? packs.find((pack) => line.note?.includes(pack.name)) : undefined;
  const pack = byNote ?? packs.find((candidate) => candidate.credits === line.delta);
  return pack?.priceUsd ?? 0;
}

/** The ledger only records the plan by name ("Pro allowance"), so revenue comes from the list price. */
function planRevenueUsd(line: Doc<"creditLedger">): number {
  const planIds = Object.keys(PLANS) as PlanId[];
  const plan = planIds.find((id) => line.note?.startsWith(PLANS[id].name));
  return plan ? PLANS[plan].priceUsd : 0;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
