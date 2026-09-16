import type { FunctionReturnType } from "convex/server";
import { defineTool } from "eve/tools";
import { z } from "zod";
import { api, convex, serviceArgs, type Id } from "../lib/convex";
import { resolveThreadId } from "../lib/threads";

type Output = {
  threadId: Id<"threads">;
  saved: number;
  results: FunctionReturnType<typeof api.agent.composeOutfits>;
};

const itemId = z.string().min(1).describe("An item id from get_wardrobe.");

const slots = z.object({
  outerwear: itemId.optional(),
  top: itemId.optional(),
  bottom: itemId.optional(),
  dress: itemId.optional().describe("Replaces top and bottom; do not send all three."),
  shoes: itemId.optional(),
  accessories: z.array(itemId).max(4).describe("Accessories, bags and headwear. Pass [] for none."),
});

export default defineTool({
  description:
    "Save two or three outfit proposals so they appear as cards in the chat. Every id must come " +
    "from get_wardrobe. One item per slot; `dress` replaces `top` + `bottom`. The result echoes " +
    "each outfit with the items it resolved and a `problems` list — if an outfit has problems it " +
    "was not saved, so fix the picks and call this again before telling the user about it.",
  inputSchema: z.object({
    brief: z.string().min(1).describe("The request in one line, e.g. 'Smart dinner in Lisbon, warm evening'."),
    outfits: z
      .array(
        z.object({
          name: z.string().min(1).describe("Short and memorable, e.g. 'Navy and stone'."),
          slots,
          reasoning: z.string().min(1).describe("One or two sentences on the colour pairing and the layering."),
          occasion: z.string().optional(),
        }),
      )
      .min(1)
      .max(3),
  }),
  label: {
    start: ({ outfits }) => `Putting together ${outfits.length} ${outfits.length === 1 ? "outfit" : "outfits"}`,
    complete: (_input, output: Output) =>
      output.saved === output.results.length
        ? `Proposed ${output.saved} ${output.saved === 1 ? "outfit" : "outfits"}`
        : `Proposed ${output.saved} of ${output.results.length} outfits`,
  },
  async execute({ brief, outfits }, ctx): Promise<Output> {
    const threadId = await resolveThreadId(ctx);
    const results = await convex().mutation(api.agent.composeOutfits, {
      ...serviceArgs(ctx),
      threadId,
      brief,
      outfits: outfits.map((outfit) => ({
        name: outfit.name,
        occasion: outfit.occasion,
        reasoning: outfit.reasoning,
        slots: {
          outerwear: outfit.slots.outerwear as Id<"items"> | undefined,
          top: outfit.slots.top as Id<"items"> | undefined,
          bottom: outfit.slots.bottom as Id<"items"> | undefined,
          dress: outfit.slots.dress as Id<"items"> | undefined,
          shoes: outfit.slots.shoes as Id<"items"> | undefined,
          accessories: outfit.slots.accessories as Id<"items">[],
        },
      })),
    });

    return {
      threadId,
      saved: results.filter((result) => result.outfitId !== null).length,
      results,
    };
  },
});
