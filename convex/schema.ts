import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import {
  vFeature,
  vItemAttributes,
  vItemStatus,
  vJobStatus,
  vJobStep,
  vJobType,
  vOutfitSlots,
  vPlanId,
  vPrefs,
  vRenderQuality,
  vReservation,
  vTokenUsage,
} from "./shared/validators";

export const EMBEDDING_DIMENSIONS = 1536;

export default defineSchema({
  users: defineTable({
    clerkId: v.string(),
    email: v.optional(v.string()),
    name: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    role: v.union(v.literal("user"), v.literal("admin")),
    plan: vPlanId,
    planPeriodEnd: v.optional(v.number()),
    features: v.array(vFeature),
    planCredits: v.number(),
    packCredits: v.number(),
    dailySpend: v.object({ dayKey: v.string(), credits: v.number() }),
    defaultAvatarId: v.optional(v.id("avatars")),
    onboardedAt: v.optional(v.number()),
    prefs: vPrefs,
    createdAt: v.number(),
  })
    .index("by_clerkId", ["clerkId"])
    .index("by_createdAt", ["createdAt"]),

  avatars: defineTable({
    userId: v.id("users"),
    storageId: v.id("_storage"),
    label: v.string(),
    isDefault: v.boolean(),
    createdAt: v.number(),
  }).index("by_user", ["userId"]),

  uploads: defineTable({
    userId: v.id("users"),
    batchId: v.string(),
    storageId: v.id("_storage"),
    fileName: v.string(),
    mimeType: v.string(),
    sizeBytes: v.number(),
    jobId: v.optional(v.id("jobs")),
    detectedCount: v.optional(v.number()),
    status: v.union(
      v.literal("queued"),
      v.literal("detecting"),
      v.literal("extracting"),
      v.literal("done"),
      v.literal("failed"),
      v.literal("partial"),
    ),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_batch", ["batchId"]),

  items: defineTable({
    userId: v.id("users"),
    uploadId: v.optional(v.id("uploads")),
    storageId: v.optional(v.id("_storage")),
    thumbStorageId: v.optional(v.id("_storage")),
    sourceBbox: v.optional(v.array(v.number())),
    ...vItemAttributes.fields,
    notes: v.optional(v.string()),
    searchText: v.string(),
    status: vItemStatus,
    wearCount: v.number(),
    lastWornAt: v.optional(v.number()),
    embedding: v.optional(v.array(v.float64())),
    duplicateOfId: v.optional(v.id("items")),
    usage: v.optional(vTokenUsage),
    costUsd: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user_status", ["userId", "status"])
    .index("by_user_category", ["userId", "category"])
    .index("by_upload", ["uploadId"])
    .index("by_createdAt", ["createdAt"])
    .searchIndex("search_text", { searchField: "searchText", filterFields: ["userId"] })
    .vectorIndex("by_embedding", {
      vectorField: "embedding",
      dimensions: EMBEDDING_DIMENSIONS,
      filterFields: ["userId"],
    }),

  outfits: defineTable({
    userId: v.id("users"),
    name: v.string(),
    slots: vOutfitSlots,
    occasion: v.optional(v.string()),
    brief: v.optional(v.string()),
    reasoning: v.optional(v.string()),
    source: v.union(v.literal("manual"), v.literal("agent")),
    threadId: v.optional(v.id("threads")),
    wornOn: v.array(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_thread", ["threadId"]),

  renders: defineTable({
    userId: v.id("users"),
    outfitId: v.id("outfits"),
    avatarId: v.id("avatars"),
    jobId: v.id("jobs"),
    storageId: v.optional(v.id("_storage")),
    quality: vRenderQuality,
    status: v.union(v.literal("pending"), v.literal("done"), v.literal("failed")),
    prompt: v.string(),
    usage: v.optional(vTokenUsage),
    costUsd: v.optional(v.number()),
    creditsCharged: v.number(),
    shareToken: v.optional(v.string()),
    error: v.optional(v.string()),
    createdAt: v.number(),
    completedAt: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_outfit", ["outfitId"])
    .index("by_job", ["jobId"])
    .index("by_shareToken", ["shareToken"])
    .index("by_createdAt", ["createdAt"]),

  jobs: defineTable({
    userId: v.id("users"),
    type: vJobType,
    status: vJobStatus,
    steps: v.array(vJobStep),
    progress: v.number(),
    reservation: vReservation,
    refunds: vReservation,
    workflowId: v.optional(v.string()),
    uploadId: v.optional(v.id("uploads")),
    outfitIds: v.optional(v.array(v.id("outfits"))),
    resultIds: v.array(v.string()),
    error: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
    completedAt: v.optional(v.number()),
  })
    .index("by_user_status", ["userId", "status"])
    .index("by_user", ["userId"])
    .index("by_workflowId", ["workflowId"])
    .index("by_status", ["status", "createdAt"]),

  creditLedger: defineTable({
    userId: v.id("users"),
    delta: v.number(),
    bucket: v.union(v.literal("plan"), v.literal("pack")),
    kind: v.union(
      v.literal("plan_grant"),
      v.literal("plan_reset"),
      v.literal("signup_bonus"),
      v.literal("topup"),
      v.literal("reserve"),
      v.literal("refund"),
      v.literal("admin"),
    ),
    jobId: v.optional(v.id("jobs")),
    ref: v.string(),
    note: v.optional(v.string()),
    balanceAfter: v.number(),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_ref", ["ref"])
    .index("by_createdAt", ["createdAt"]),

  threads: defineTable({
    userId: v.id("users"),
    title: v.string(),
    eveSessionId: v.optional(v.string()),
    streamIndex: v.optional(v.number()),
    lastMessageAt: v.number(),
    createdAt: v.number(),
  }).index("by_user", ["userId"]),

  proposals: defineTable({
    threadId: v.id("threads"),
    userId: v.id("users"),
    outfitId: v.id("outfits"),
    jobId: v.optional(v.id("jobs")),
    createdAt: v.number(),
  }).index("by_thread", ["threadId"]),

  systemCounters: defineTable({
    dayKey: v.string(),
    key: v.literal("credits_reserved"),
    value: v.number(),
  }).index("by_day_key", ["dayKey", "key"]),

  usageCounters: defineTable({
    userId: v.id("users"),
    dayKey: v.string(),
    counter: v.union(v.literal("detect"), v.literal("stylist")),
    count: v.number(),
  }).index("by_user_day_counter", ["userId", "dayKey", "counter"]),
});
