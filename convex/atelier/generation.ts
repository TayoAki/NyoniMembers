"use node";

import { v } from "convex/values";
import OpenAI, { toFile } from "openai";
import type { ImageEditParamsNonStreaming, ImagesResponse } from "openai/resources/images";
import { internal } from "../_generated/api";
import { internalAction } from "../_generated/server";
import { normalizeImageInput } from "../ai/image_input";
import { optionalEnv, requireEnv } from "../lib/env";
import { appError, isAppError } from "../lib/errors";
import { previewPrompt } from "../model/atelier/previews";
import type { TokenUsage } from "../shared/credits";

/**
 * Personal preview generation (contract §5.4, journey C09). The same provider path as `convex/ai/openai.ts`:
 * one client per container, `maxRetries: 0`, `gpt-image-2` edits with the photograph as the only image,
 * never `input_fidelity`. Node runtime only; every table read and write goes through
 * `internal.atelier.previews.*`, so a cancelled job or a removed photograph is honoured there, not here.
 *
 * ≈$0.03 and 30–50 s per preview at quality "medium". The client never sees provider text: failures are
 * translated into a short, human reason and the raw error is logged for preview operations.
 */

const IMAGE_MODEL = "gpt-image-2";
const REQUEST_TIMEOUT_MS = 5 * 60 * 1000;
const MAX_ERROR_CHARS = 240;

let cached: OpenAI | null = null;

function openai(): OpenAI {
  if (!cached) {
    const directKey = optionalEnv("OPENAI_API_KEY");
    cached = new OpenAI({
      apiKey: directKey ?? requireEnv("AI_GATEWAY_API_KEY"),
      ...(directKey ? {} : { baseURL: "https://ai-gateway.vercel.sh/v1" }),
      maxRetries: 0,
      timeout: REQUEST_TIMEOUT_MS,
    });
  }
  return cached;
}

function modelId(model: string): string {
  return optionalEnv("OPENAI_API_KEY") ? model : `openai/${model}`;
}

export const generatePersonalPreview = internalAction({
  args: { jobId: v.id("atelierPreviewJobs") },
  returns: v.null(),
  handler: async (ctx, { jobId }): Promise<null> => {
    const begun = await ctx.runMutation(internal.atelier.previews.beginJob, { jobId });
    if (!begun) return null;
    try {
      const context = await ctx.runQuery(internal.atelier.previews.generationContext, { jobId });
      const photo = await ctx.storage.get(context.photoStorageId);
      if (!photo) throw appError("NOT_FOUND", "The photograph is no longer available.");

      const bytes = await normalizeImageInput(photo, "photograph");
      const image = await toFile(bytes, "person.png", { type: "image/png" });
      const prompt = previewPrompt({ spec: context.spec, lines: context.lines, cloth: context.cloth });

      // `input_fidelity` is rejected by gpt-image-2 — do not add it here.
      const params: ImageEditParamsNonStreaming = {
        model: modelId(IMAGE_MODEL),
        image,
        prompt,
        size: "1024x1536",
        quality: "medium",
        background: "opaque",
        output_format: "png",
      };
      const response = await openai().images.edit(params);
      const { bytes: result, usage } = decodeImage(response);
      const resultStorageId = await ctx.storage.store(new Blob([result], { type: "image/png" }));
      await ctx.runMutation(internal.atelier.previews.completeJob, { jobId, resultStorageId, usage });
    } catch (error) {
      console.error(`atelier preview ${jobId} failed: ${rawErrorText(error)}`);
      await ctx.runMutation(internal.atelier.previews.failJob, { jobId, error: previewFailureText(error) });
    }
    return null;
  },
});

function decodeImage(response: ImagesResponse): { bytes: Uint8Array<ArrayBuffer>; usage: TokenUsage } {
  const encoded = response.data?.[0]?.b64_json;
  if (!encoded) throw appError("UPSTREAM_FAILED", "The image service returned no image.");
  const decoded = Buffer.from(encoded, "base64");
  // Copy into a plain ArrayBuffer-backed view: a Node Buffer can sit on a SharedArrayBuffer, which
  // neither `Blob` nor `ctx.storage.store` accepts.
  const bytes = new Uint8Array(decoded.byteLength);
  bytes.set(decoded);
  const usage = response.usage;
  return {
    bytes,
    usage: {
      inputTextTokens: usage?.input_tokens_details?.text_tokens ?? 0,
      inputImageTokens: usage?.input_tokens_details?.image_tokens ?? 0,
      outputTokens: usage?.output_tokens ?? 0,
    },
  };
}

/** What the client reads under "Could not finish": short, human, and never the provider's own words. */
export function previewFailureText(error: unknown): string {
  if (isAppError(error)) return error.data.message.slice(0, MAX_ERROR_CHARS);
  if (error instanceof OpenAI.APIConnectionTimeoutError) return "The preview took too long. You can try again.";
  if (error instanceof OpenAI.APIError) {
    const status = error.status;
    if (status === 429) return "The image service is busy right now. Try again in a few minutes.";
    if (status !== undefined && status >= 400 && status < 500) {
      const text = error.message.toLowerCase();
      if (
        text.includes("safety") ||
        text.includes("policy") ||
        text.includes("moderation") ||
        text.includes("rejected")
      ) {
        return "The image service declined this photograph. Try another full-length photograph in even light.";
      }
      return "The image service could not work from this photograph. Try another one, or continue with the studio illustration.";
    }
    return "The image service did not answer. You can try again in a few minutes.";
  }
  return "Could not finish this preview. You can try again, or continue with the studio illustration.";
}

/** For the logs only: the provider's status and message, bounded. */
function rawErrorText(error: unknown): string {
  if (isAppError(error)) return `${error.data.code}: ${error.data.message}`.slice(0, MAX_ERROR_CHARS);
  if (error instanceof OpenAI.APIError)
    return `OpenAI ${error.status ?? "error"}: ${error.message}`.slice(0, MAX_ERROR_CHARS);
  if (error instanceof Error) return error.message.slice(0, MAX_ERROR_CHARS);
  return String(error).slice(0, MAX_ERROR_CHARS);
}
