import { defineHook } from "eve/hooks";
import { api, convex, convexErrorMessage, isClerkCaller, serviceArgs } from "../lib/convex";

/**
 * Stylist reasoning is free but rate limited (LIMITS.stylistMessagesPerDay). One turn is one
 * message, so the counter lives here rather than inside a tool the model may or may not call.
 *
 * Only RATE_LIMITED stops the turn — everything else is logged and ignored, so a Convex blip or a
 * local-dev principal with no user row never bricks the chat.
 */
export default defineHook({
  events: {
    async "turn.started"(_event, ctx) {
      if (!isClerkCaller(ctx)) return;

      try {
        await convex().mutation(api.agent.recordMessage, serviceArgs(ctx));
      } catch (error) {
        const { code, message } = convexErrorMessage(error);
        if (code === "RATE_LIMITED") throw new Error(message);
        console.warn("[fitcheck] could not record a stylist message", { code, message });
      }
    },
  },
});
