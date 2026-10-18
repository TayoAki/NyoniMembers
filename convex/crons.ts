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

export default crons;
