import { defineTool } from "eve/tools";
import type { ApprovalStatus } from "eve/tools/approval";
import { z } from "zod";
import { RENDER_QUALITIES } from "../../convex/shared/credits";
import { api, convex, convexErrorMessage, serviceArgs, type Id } from "../lib/convex";
import { resolveThreadId } from "../lib/threads";

const inputSchema = z.object({
  outfitIds: z.array(z.string().min(1)).min(1).max(3).describe("Outfit ids returned by compose_outfits."),
  perOutfit: z.number().int().min(1).max(4).describe("Images per outfit."),
  quality: z.enum(RENDER_QUALITIES),
});

export default defineTool({
  description:
    "Render the chosen outfits on the user's avatar. This spends credits, so it stops for the " +
    "user's approval before it runs — quote_renders first and say the cost out loud. Returns the " +
    "job id; the images stream into the chat on their own, so do not claim they are ready.",
  inputSchema,
  label: {
    start: ({ outfitIds, perOutfit, quality }) =>
      `Render ${outfitIds.length * perOutfit} ${quality === "hq" ? "HQ " : ""}images`,
  },
  /**
   * The gate, not the authorization: it refuses outright when the quote cannot be paid, so the user
   * is never shown an approval card for a spend that would fail. The executor re-derives the user.
   */
  async approval(ctx): Promise<ApprovalStatus> {
    const input = ctx.toolInput;
    if (!input) return { type: "denied", reason: "The render request was missing its arguments." };

    try {
      const quote = await convex().query(api.agent.quoteRenders, {
        ...serviceArgs(ctx),
        outfitIds: input.outfitIds as Id<"outfits">[],
        perOutfit: input.perOutfit,
        quality: input.quality,
      });
      if (!quote.canAfford) {
        return {
          type: "denied",
          reason:
            `That would cost ${quote.credits} credits and only ${quote.available} are available today ` +
            `(short by ${quote.shortfall}). Offer fewer images or standard quality instead of HQ.`,
        };
      }
    } catch (error) {
      const { message } = convexErrorMessage(error);
      return { type: "denied", reason: message };
    }

    return "user-approval";
  },
  async execute({ outfitIds, perOutfit, quality }, ctx) {
    const threadId = await resolveThreadId(ctx);
    const { jobId, renderIds } = await convex().mutation(api.agent.startRenders, {
      ...serviceArgs(ctx),
      threadId,
      outfitIds: outfitIds as Id<"outfits">[],
      perOutfit,
      quality,
    });

    return {
      jobId,
      renderIds,
      images: renderIds.length,
      status: "started" as const,
      note: "The images appear in the chat as each one finishes. Say it is running; do not describe the results.",
    };
  },
});
