import { cronJobs } from "convex/server";

/**
 * Scheduled Atelier maintenance: preview job expiry, photo retention, overdue case escalation and quote
 * expiry. The staff build step registers the jobs here once their internal functions exist.
 */
const crons = cronJobs();

export default crons;
