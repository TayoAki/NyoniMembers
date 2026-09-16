"use node";

import { v, type Infer } from "convex/values";
import OpenAI, { toFile } from "openai";
import type { ImageEditParamsNonStreaming, ImagesResponse } from "openai/resources/images";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { internalAction, type ActionCtx } from "../_generated/server";
import { requireEnv } from "../lib/env";
import { appError, isAppError } from "../lib/errors";
import { EMBEDDING_DIMENSIONS } from "../schema";
import { LIMITS, type TokenUsage } from "../shared/credits";
import { INGEST_STEPS } from "../shared/jobs";
import { vDetectedItem } from "../shared/validators";
import { FORMALITY, isCategory, SEASONS, type Formality, type Season, type Slot } from "../shared/wardrobe";
import { dominantHex } from "./colours";
import { detectionInstructions, extractionPrompt, renderPrompt } from "./prompts";

/**
 * Every OpenAI call the app makes. Actions only: they read and write through `ai/pipeline.ts` so a
 * retried attempt can never leave a half-written item or render behind.
 *
 * Measured at quality "medium": ≈$0.031 per extraction, ≈$0.030 per render, 30–50 s each.
 * `gpt-image-2` rejects `input_fidelity` — it is never sent. `background: "transparent"` is a
 * preview flag on that model, so a 4xx from it is retried once as `opaque`.
 */

const DETECT_MODEL = "gpt-5-mini";
const IMAGE_MODEL = "gpt-image-2";
const EMBED_MODEL = "text-embedding-3-small";

/** The images endpoint accepts at most 16 reference images: the avatar plus 15 garments. */
const MAX_REFERENCE_IMAGES = 16;
/** Long enough for a slow render, short enough to fail inside the action's own budget. */
const REQUEST_TIMEOUT_MS = 5 * 60 * 1000;
const MAX_ERROR_CHARS = 240;

/** What gpt-image-2 accepts as a reference image. */
const IMAGE_EXTENSIONS: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
};

/** Accepted at upload but not by the image model; fail with something the user can act on. */
const UNSUPPORTED_IMAGE_TYPES = new Set(["image/heic", "image/heif"]);

export type DetectedItem = Infer<typeof vDetectedItem>;

let cached: OpenAI | null = null;

/** One client per container. `maxRetries: 0` — retries are the workflow's job, and they are visible. */
function openai(): OpenAI {
  if (!cached) {
    cached = new OpenAI({ apiKey: requireEnv("OPENAI_API_KEY"), maxRetries: 0, timeout: REQUEST_TIMEOUT_MS });
  }
  return cached;
}

/**
 * gpt-5-mini reads one photo and returns every wearable item in it with attributes and a bbox.
 * Free (text tokens only); the token counts land in the detect step's meta.
 */
export const detectItems = internalAction({
  args: { uploadId: v.id("uploads"), jobId: v.id("jobs") },
  returns: v.array(vDetectedItem),
  handler: async (ctx, args): Promise<DetectedItem[]> => {
    try {
      const photo = await ctx.runQuery(internal.ai.pipeline.uploadPhoto, { uploadId: args.uploadId });
      // Inline the bytes: storage URLs are signed and, on a local deployment, unreachable from OpenAI.
      const imageUrl = await storageDataUrl(ctx, photo.storageId, photo.mimeType);
      const { instructions, schema } = detectionInstructions();
      const response = await openai().responses.create({
        model: DETECT_MODEL,
        input: [
          {
            role: "user",
            content: [
              { type: "input_text", text: instructions },
              { type: "input_image", image_url: imageUrl, detail: "high" },
            ],
          },
        ],
        text: { format: { type: "json_schema", name: "detected_items", schema, strict: true } },
      });

      const items = parseDetectedItems(response.output_text);
      await ctx.runMutation(internal.ai.pipeline.markStep, {
        jobId: args.jobId,
        key: INGEST_STEPS.detect,
        status: "running",
        meta: {
          model: DETECT_MODEL,
          inputTextTokens: response.usage?.input_tokens ?? 0,
          outputTokens: response.usage?.output_tokens ?? 0,
        },
      });
      return items;
    } catch (error) {
      await ctx.runMutation(internal.ai.pipeline.markStep, {
        jobId: args.jobId,
        key: INGEST_STEPS.detect,
        status: "failed",
        error: errorText(error),
      });
      throw error;
    }
  },
});

/**
 * One item: cut it out of its source photo, store the PNG, read its swatches, embed it and flag it
 * as a duplicate of an existing item when the vectors all but match.
 */
export const extractItem = internalAction({
  args: { itemId: v.id("items"), jobId: v.id("jobs"), stepKey: v.string() },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    await ctx.runMutation(internal.ai.pipeline.markStep, {
      jobId: args.jobId,
      key: args.stepKey,
      status: "running",
    });
    try {
      const item = await ctx.runQuery(internal.ai.pipeline.extractContext, { itemId: args.itemId });
      const photo = await ctx.storage.get(item.photoStorageId);
      if (!photo) throw appError("NOT_FOUND", "The source photo for this item is gone.");

      const response = await editWithTransparency({
        image: await toImageFile(photo, "photo"),
        prompt: extractionPrompt(item.description),
        size: "1024x1024",
        quality: "medium",
      });
      const { bytes, usage } = decodeImage(response);
      const storageId = await ctx.storage.store(pngBlob(bytes));
      const hex = dominantHex(bytes, 3);

      const embedding = await embedText(embeddingInput(item, hex));
      const matches = await ctx.vectorSearch("items", "by_embedding", {
        vector: embedding,
        limit: 4,
        filter: (q) => q.eq("userId", item.userId),
      });
      const candidates = matches
        .filter((match) => match._id !== args.itemId && match._score >= LIMITS.duplicateCosineThreshold)
        .map((match) => match._id);
      const ready =
        candidates.length > 0 ? await ctx.runQuery(internal.ai.pipeline.readyItemIds, { itemIds: candidates }) : [];
      const duplicateOfId = candidates.find((candidate) => ready.includes(candidate));

      await ctx.runMutation(internal.ai.pipeline.itemReady, {
        itemId: args.itemId,
        jobId: args.jobId,
        stepKey: args.stepKey,
        storageId,
        hex,
        usage,
        embedding,
        duplicateOfId,
      });
      return null;
    } catch (error) {
      await ctx.runMutation(internal.ai.pipeline.itemFailed, {
        itemId: args.itemId,
        jobId: args.jobId,
        stepKey: args.stepKey,
        error: errorText(error),
      });
      throw error;
    }
  },
});

/** One try-on image: the avatar plus every garment cutout as references, one prompt. */
export const renderImage = internalAction({
  args: { renderId: v.id("renders"), jobId: v.id("jobs"), stepKey: v.string() },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    await ctx.runMutation(internal.ai.pipeline.markStep, {
      jobId: args.jobId,
      key: args.stepKey,
      status: "running",
    });
    let prompt = "";
    try {
      const context = await ctx.runQuery(internal.ai.pipeline.renderContext, { renderId: args.renderId });
      const avatar = await ctx.storage.get(context.avatarStorageId);
      if (!avatar) throw appError("NOT_FOUND", "That avatar photo is gone.");

      const garments = context.garments.slice(0, MAX_REFERENCE_IMAGES - 1);
      const blobs = await Promise.all(garments.map((garment) => ctx.storage.get(garment.storageId)));
      const wearable = garments.filter((_, index) => blobs[index] !== null);
      if (wearable.length === 0) throw appError("NOT_FOUND", "None of this outfit's cutouts are available.");

      const files = await Promise.all([
        toImageFile(avatar, "person"),
        ...blobs
          .filter((blob): blob is Blob => blob !== null)
          .map((blob, index) => toImageFile(blob, `garment-${index + 1}`)),
      ]);

      prompt = renderPrompt({
        garments: wearable.map((garment) => ({ name: garment.name, slot: garment.slot })),
        presentation: context.prefs.presentation,
        fit: context.prefs.fit,
        hasOuterwear: wearable.some((garment) => garment.slot === "outerwear"),
        missingSlots: missingSlots(wearable.map((garment) => garment.slot)),
      });

      const response = await editImage({
        image: files,
        prompt,
        size: "1024x1536",
        quality: context.quality === "hq" ? "high" : "medium",
      });
      const { bytes, usage } = decodeImage(response);
      const storageId = await ctx.storage.store(pngBlob(bytes));

      await ctx.runMutation(internal.ai.pipeline.renderDone, {
        renderId: args.renderId,
        jobId: args.jobId,
        stepKey: args.stepKey,
        storageId,
        prompt,
        usage,
      });
      return null;
    } catch (error) {
      await ctx.runMutation(internal.ai.pipeline.renderFailed, {
        renderId: args.renderId,
        jobId: args.jobId,
        stepKey: args.stepKey,
        error: errorText(error),
      });
      throw error;
    }
  },
});

type EditRequest = {
  image: ImageEditParamsNonStreaming["image"];
  prompt: string;
  size: "1024x1024" | "1024x1536";
  quality: "medium" | "high";
  background?: "transparent" | "opaque";
};

async function editImage(request: EditRequest): Promise<ImagesResponse> {
  // `input_fidelity` is rejected by gpt-image-2 — do not add it here.
  const params: ImageEditParamsNonStreaming = {
    model: IMAGE_MODEL,
    image: request.image,
    prompt: request.prompt,
    size: request.size,
    quality: request.quality,
    output_format: "png",
  };
  if (request.background) params.background = request.background;
  return openai().images.edit(params);
}

/**
 * Transparent backgrounds are a preview flag on gpt-image-2: when the account or snapshot doesn't
 * have it the request 4xxs, so redo the same edit opaque rather than failing the item.
 */
async function editWithTransparency(request: Omit<EditRequest, "background">): Promise<ImagesResponse> {
  try {
    return await editImage({ ...request, background: "transparent" });
  } catch (error) {
    if (!isClientError(error)) throw error;
    return editImage({ ...request, background: "opaque" });
  }
}

function isClientError(error: unknown): boolean {
  return (
    error instanceof OpenAI.APIError && typeof error.status === "number" && error.status >= 400 && error.status < 500
  );
}

function decodeImage(response: ImagesResponse): { bytes: Uint8Array<ArrayBuffer>; usage: TokenUsage } {
  const encoded = response.data?.[0]?.b64_json;
  if (!encoded) throw appError("UPSTREAM_FAILED", "The image model returned no image.");
  const decoded = Buffer.from(encoded, "base64");
  // Copy into a plain ArrayBuffer-backed view: a Node Buffer can sit on a SharedArrayBuffer, which
  // neither `Blob` nor `ctx.storage.store` accepts.
  const bytes = new Uint8Array(decoded.byteLength);
  bytes.set(decoded);
  return { bytes, usage: imageUsage(response.usage) };
}

/** Reads a stored file and returns it as a data URL for models that accept inline images. */
async function storageDataUrl(ctx: ActionCtx, storageId: Id<"_storage">, mimeType: string): Promise<string> {
  const blob = await ctx.storage.get(storageId);
  if (!blob) throw appError("NOT_FOUND", "The uploaded photo is no longer available.");
  const base64 = Buffer.from(await blob.arrayBuffer()).toString("base64");
  return `data:${mimeType || "image/png"};base64,${base64}`;
}

function pngBlob(bytes: Uint8Array<ArrayBuffer>): Blob {
  return new Blob([bytes], { type: "image/png" });
}

function imageUsage(usage: ImagesResponse["usage"]): TokenUsage {
  return {
    inputTextTokens: usage?.input_tokens_details?.text_tokens ?? 0,
    inputImageTokens: usage?.input_tokens_details?.image_tokens ?? 0,
    outputTokens: usage?.output_tokens ?? 0,
  };
}

/**
 * Wraps a stored blob for the images endpoint. Convex keeps the upload's content type, so the
 * filename and the bytes always agree; HEIC is rejected here rather than as an opaque OpenAI 400.
 */
async function toImageFile(blob: Blob, name: string): Promise<File> {
  if (UNSUPPORTED_IMAGE_TYPES.has(blob.type)) {
    throw appError("INVALID_INPUT", "HEIC photos can't be used yet — re-upload this one as JPEG or PNG.");
  }
  const type = IMAGE_EXTENSIONS[blob.type] ? blob.type : "image/png";
  return toFile(blob, `${name}.${IMAGE_EXTENSIONS[type] ?? "png"}`, { type });
}

async function embedText(input: string): Promise<number[]> {
  const response = await openai().embeddings.create({
    model: EMBED_MODEL,
    input,
    dimensions: EMBEDDING_DIMENSIONS,
  });
  const vector = response.data[0]?.embedding;
  if (!vector) throw appError("UPSTREAM_FAILED", "Could not embed this item.");
  return vector;
}

type EmbeddingSource = {
  name: string;
  category: string;
  subcategory: string;
  material: string;
  pattern: string;
  description: string;
  colours: { primary: string; secondary: string[] };
};

function embeddingInput(item: EmbeddingSource, hex: string[]): string {
  return [
    item.name,
    item.category,
    item.subcategory,
    item.colours.primary,
    ...item.colours.secondary,
    ...hex,
    item.pattern,
    item.material,
    item.description,
  ]
    .filter((part) => part.length > 0)
    .join(" · ");
}

/** Core slots the outfit leaves empty, so the prompt can tell the model what to improvise. */
function missingSlots(slots: Slot[]): Slot[] {
  const present = new Set(slots);
  const missing: Slot[] = [];
  if (!present.has("dress")) {
    if (!present.has("top")) missing.push("top");
    if (!present.has("bottom")) missing.push("bottom");
  }
  if (!present.has("shoes")) missing.push("shoes");
  return missing;
}

function parseDetectedItems(raw: string): DetectedItem[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw appError("UPSTREAM_FAILED", "The vision model returned something that isn't JSON.");
  }
  const list = isRecord(parsed) && Array.isArray(parsed.items) ? parsed.items : [];
  return list
    .slice(0, LIMITS.maxItemsPerPhoto)
    .filter(isRecord)
    .map(coerceDetectedItem)
    .filter((item) => item.name.length > 0 && item.description.length > 0);
}

function coerceDetectedItem(raw: Record<string, unknown>): DetectedItem {
  const colours = isRecord(raw.colours) ? raw.colours : {};
  const category = asString(raw.category).toLowerCase();
  return {
    name: asString(raw.name).slice(0, 120),
    category: isCategory(category) ? category : "accessory",
    subcategory: asString(raw.subcategory).slice(0, 80),
    colours: {
      primary: asString(colours.primary).slice(0, 40) || "unknown",
      secondary: asStringArray(colours.secondary, 6).map((colour) => colour.slice(0, 40)),
      hex: [],
    },
    pattern: asString(raw.pattern).slice(0, 60) || "solid",
    material: asString(raw.material_guess ?? raw.material).slice(0, 60) || "unknown",
    season: asSeasons(raw.season),
    formality: asFormality(raw.formality),
    description: asString(raw.description).slice(0, 400),
    bbox: asBbox(raw.bbox),
  };
}

function asSeasons(value: unknown): Season[] {
  const seasons = asStringArray(value, SEASONS.length)
    .map((season) => season.toLowerCase())
    .filter((season): season is Season => (SEASONS as readonly string[]).includes(season));
  const unique = [...new Set(seasons)];
  return unique.length > 0 ? unique : [...SEASONS];
}

function asFormality(value: unknown): Formality {
  const formality = asString(value).toLowerCase();
  return (FORMALITY as readonly string[]).includes(formality) ? (formality as Formality) : "casual";
}

/** [x0, y0, x1, y1] as 0–1 fractions; anything else falls back to the whole frame. */
function asBbox(value: unknown): number[] {
  if (!Array.isArray(value) || value.length !== 4) return [0, 0, 1, 1];
  const box = value.map((part) =>
    typeof part === "number" && Number.isFinite(part) ? Math.min(1, Math.max(0, part)) : Number.NaN,
  );
  if (box.some((part) => Number.isNaN(part))) return [0, 0, 1, 1];
  return box;
}

function asStringArray(value: unknown, limit: number): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((part): part is string => typeof part === "string" && part.trim().length > 0).slice(0, limit);
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** A short, human-readable reason for the job stepper — never a stack trace. */
function errorText(error: unknown): string {
  if (isAppError(error)) return error.data.message.slice(0, MAX_ERROR_CHARS);
  if (error instanceof OpenAI.APIError) {
    return `OpenAI ${error.status ?? "error"}: ${error.message}`.slice(0, MAX_ERROR_CHARS);
  }
  if (error instanceof Error) return error.message.slice(0, MAX_ERROR_CHARS);
  return String(error).slice(0, MAX_ERROR_CHARS);
}
