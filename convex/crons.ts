import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

/**
 * Scheduled Atelier maintenance. Each job is bounded and idempotent; what it changes is recorded on
 * the rows it touches (and audited where a client could notice), never silently.
 */
const crons = cronJobs();

/** Processing jobs past the timeout fail with a retry-able message; finished results past retention expire. */
crons.interval("atelier: expire preview jobs", { hours: 1 }, internal.atelier.previews.expireJobs, {});

/** Photographs past their retention date are deleted with the results made from them. */
crons.interval("atelier: expire photographs", { hours: 1 }, internal.atelier.photos.expire, {});

/** Unassigned cases past the service promise, and next actions past due, are escalated with a visible note. */
crons.interval("atelier: escalate overdue cases", { hours: 1 }, internal.atelier.cases.escalateOverdue, {});

/** Offered quotes past their expiry close with a message on the case; nothing is accepted against them. */
crons.interval("atelier: expire quotes", { hours: 1 }, internal.atelier.quotes.expire, {});

export default crons;
