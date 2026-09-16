/**
 * The single source of truth for the credit meter. One credit = one image generation.
 * Text-only work (detect, tag, embed, stylist reasoning, weather) is free and rate-limited.
 */

export const RENDER_QUALITIES = ["standard", "hq"] as const;
export type RenderQuality = (typeof RENDER_QUALITIES)[number];

export const CREDIT_COSTS = {
  extractItem: 1,
  render: { standard: 1, hq: 3 } satisfies Record<RenderQuality, number>,
} as const;

export const PLAN_IDS = ["free", "pro", "plus"] as const;
export type PlanId = (typeof PLAN_IDS)[number];

export const FEATURES = ["sharing", "hq_renders", "priority_queue"] as const;
export type Feature = (typeof FEATURES)[number];

export type PlanDefinition = {
  id: PlanId;
  name: string;
  priceUsd: number;
  /** Credits granted on every successful billing cycle (0 for free). */
  monthlyCredits: number;
  /** One-off credits granted when the user signs up (free only). */
  signupCredits: number;
  maxAvatars: number;
  features: readonly Feature[];
  blurb: string;
};

export const PLANS: Record<PlanId, PlanDefinition> = {
  free: {
    id: "free",
    name: "Free",
    priceUsd: 0,
    monthlyCredits: 0,
    signupCredits: 25,
    maxAvatars: 1,
    features: [],
    blurb: "Wardrobe, outfit builder and the stylist. 25 credits to try renders.",
  },
  pro: {
    id: "pro",
    name: "Pro",
    priceUsd: 9.99,
    monthlyCredits: 150,
    signupCredits: 0,
    maxAvatars: 2,
    features: ["sharing"],
    blurb: "150 credits a month, sharing, two avatars.",
  },
  plus: {
    id: "plus",
    name: "Plus",
    priceUsd: 19.99,
    monthlyCredits: 300,
    signupCredits: 0,
    maxAvatars: 5,
    features: ["sharing", "hq_renders", "priority_queue"],
    blurb: "300 credits a month, HQ renders, five avatars, priority queue.",
  },
};

export const PACK_IDS = ["s", "m", "l"] as const;
export type PackId = (typeof PACK_IDS)[number];

export type PackDefinition = { id: PackId; name: string; credits: number; priceUsd: number };

export const PACKS: Record<PackId, PackDefinition> = {
  s: { id: "s", name: "Starter pack", credits: 50, priceUsd: 4.99 },
  m: { id: "m", name: "Regular pack", credits: 120, priceUsd: 9.99 },
  l: { id: "l", name: "Big pack", credits: 300, priceUsd: 19.99 },
};

export const LIMITS = {
  dailyCreditCap: 150,
  maxRunningJobsPerUser: 3,
  maxRendersPerRequest: 4,
  maxOutfitsPerRenderRequest: 3,
  maxPhotosPerUpload: 50,
  maxItemsPerPhoto: 12,
  lowBalanceThreshold: 10,
  detectCallsPerDay: 200,
  stylistMessagesPerDay: 100,
  duplicateCosineThreshold: 0.92,
} as const;

/** Measured unit economics, used only for admin estimates; real COGS comes from token usage. */
export const UNIT_ECONOMICS = {
  cogsUsdPerCredit: 0.033,
  openaiPricingUsdPerMillion: { textIn: 2.5, imageIn: 4, imageOut: 15 },
  processingFee: { percent: 0.036, fixedUsd: 0.3 },
} as const;

export type TokenUsage = { inputTextTokens: number; inputImageTokens: number; outputTokens: number };

export function usageToUsd(usage: TokenUsage): number {
  const p = UNIT_ECONOMICS.openaiPricingUsdPerMillion;
  return (
    (usage.inputTextTokens * p.textIn + usage.inputImageTokens * p.imageIn + usage.outputTokens * p.imageOut) /
    1_000_000
  );
}

export function renderCreditCost(quality: RenderQuality, count: number, outfits = 1): number {
  return CREDIT_COSTS.render[quality] * count * outfits;
}

export function extractionCreditCost(itemCount: number): number {
  return CREDIT_COSTS.extractItem * itemCount;
}

export function isPlanId(value: string): value is PlanId {
  return (PLAN_IDS as readonly string[]).includes(value);
}

export function isPackId(value: string): value is PackId {
  return (PACK_IDS as readonly string[]).includes(value);
}

export function planHasFeature(plan: PlanId, feature: Feature): boolean {
  return PLANS[plan].features.includes(feature);
}

/** Day key in UTC used for daily caps: "2026-09-16". */
export function dayKey(now: number = Date.now()): string {
  return new Date(now).toISOString().slice(0, 10);
}
