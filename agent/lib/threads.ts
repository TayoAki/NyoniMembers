import type { SessionContext } from "eve/tools";
import { api, convex, serviceArgs, type Id } from "./convex";

/**
 * Every eve session maps to one `threads` row, so proposals and render jobs land where the chat UI
 * is already subscribed. `ctx.session.id` is the durable session id the browser also persists.
 */
export async function resolveThreadId(ctx: SessionContext): Promise<Id<"threads">> {
  return convex().mutation(api.agent.resolveThread, {
    ...serviceArgs(ctx),
    eveSessionId: ctx.session.id,
  });
}
