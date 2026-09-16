import { ConvexHttpClient } from "convex/browser";
import type { SessionContext } from "eve/tools";

export { api } from "../../convex/_generated/api";
export type { Id } from "../../convex/_generated/dataModel";

/**
 * One HTTP client for the deployment the Next app talks to. Every call goes through
 * `convex/agent.ts`, whose functions take `{ serviceKey, clerkUserId }` and are scoped to that
 * user by `requireServiceKey` — the agent never gets an unscoped handle on the database.
 */
let client: ConvexHttpClient | undefined;

export function convex(): ConvexHttpClient {
  if (!client) client = new ConvexHttpClient(requiredEnv("NEXT_PUBLIC_CONVEX_URL"));
  return client;
}

export type ServiceArgs = { serviceKey: string; clerkUserId: string };

/**
 * The caller of the current turn, re-derived from the verified channel principal.
 * Approval is a gate, not authorization: executors call this rather than trusting tool input.
 */
export function serviceArgs(ctx: SessionContext): ServiceArgs {
  return { serviceKey: requiredEnv("AGENT_SERVICE_KEY"), clerkUserId: clerkUserId(ctx) };
}

export function clerkUserId(ctx: SessionContext): string {
  const current = ctx.session.auth.current;
  if (!current) throw new Error("This tool needs a signed-in user; the session has no caller.");

  const attribute = current.attributes.clerkUserId;
  if (typeof attribute === "string" && attribute.length > 0) return attribute;

  // `eve dev` authenticates a synthetic `local-dev` principal. Point it at a real row with
  // AGENT_DEV_CLERK_USER_ID so the tools have something to read locally.
  if (current.authenticator === "local-dev") {
    const override = process.env.AGENT_DEV_CLERK_USER_ID;
    if (override && override.length > 0) return override;
  }

  return current.principalId;
}

/** True for a caller eve authenticated through Clerk, as opposed to a local-dev principal. */
export function isClerkCaller(ctx: SessionContext): boolean {
  return ctx.session.auth.current?.authenticator === "clerk";
}

export function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.length === 0) throw new Error(`Missing ${name}. Set it in .env.local.`);
  return value;
}

/** `convex/lib/errors.ts` throws ConvexError with `{ code, message }`; unwrap it for the model. */
export function convexErrorMessage(error: unknown): { code: string; message: string } {
  const data = (error as { data?: unknown } | null)?.data;
  if (data && typeof data === "object" && "code" in data && "message" in data) {
    const { code, message } = data as { code: unknown; message: unknown };
    if (typeof code === "string" && typeof message === "string") return { code, message };
  }
  if (error instanceof Error) return { code: "UNKNOWN", message: error.message };
  return { code: "UNKNOWN", message: "Something went wrong talking to Fitcheck." };
}
