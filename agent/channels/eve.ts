import { verifyToken } from "@clerk/backend";
import { extractBearerToken, localDev, withAuthChallenges, type AuthFn } from "eve/channels/auth";
import { eveChannel } from "eve/channels/eve";

/**
 * Route auth for the browser. The chat UI sends the signed-in user's Clerk session token as a
 * bearer; we verify it against Clerk and carry the Clerk user id forward as the session principal,
 * which every tool re-reads from `ctx.session.auth.current` before touching Convex.
 *
 * Returning `null` (no bearer, or an unverifiable one) falls through to `localDev()`, so
 * `eve dev` still works without a Clerk session.
 */
function clerkAuth(): AuthFn<Request> {
  return withAuthChallenges(
    async (request: Request) => {
      const token = extractBearerToken(request.headers.get("authorization"));
      if (!token) return null;

      const secretKey = process.env.CLERK_SECRET_KEY;
      if (!secretKey) return null;

      try {
        const payload = await verifyToken(token, { secretKey });
        return {
          attributes: { clerkUserId: payload.sub },
          authenticator: "clerk",
          issuer: payload.iss,
          principalId: payload.sub,
          principalType: "user",
          subject: payload.sub,
        };
      } catch {
        return null;
      }
    },
    [{ scheme: "Bearer" }],
  );
}

export default eveChannel({
  auth: [clerkAuth(), localDev()],
});
