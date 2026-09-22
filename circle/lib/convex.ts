import { ConvexReactClient } from "convex/react";
import { makeFunctionReference } from "convex/server";
import { convexUrl, isBackendLive } from "./config";

/**
 * The client for the house's Convex deployment — the same one the web app uses, so a member's
 * wardrobe, looks and previews are one set of rows whichever way they reach them.
 *
 * Functions are referenced by name rather than through `convex/_generated/api`: that module lives
 * in the other package, and Metro resolves from this project's root only. The wrappers below are
 * the whole surface Circle uses, and each one states the types its Convex counterpart validates.
 */
export const convex = isBackendLive
  ? new ConvexReactClient(convexUrl, { unsavedChangesWarning: false })
  : null;

export type Membership = {
  tier: "client" | "signature" | "prestige" | "circle_elite";
  status: "active" | "lapsed";
  since?: number;
  renewsAt?: number;
};

export type Me = {
  _id: string;
  clerkId: string;
  email?: string;
  name?: string;
  imageUrl?: string;
  role: "user" | "admin";
  onboardedAt?: number;
  membership: Membership;
  createdAt: number;
};

export type ItemView = {
  _id: string;
  name: string;
  category: "suit" | "top" | "bottom" | "outerwear" | "shoes" | "accessory";
  subcategory: string;
  colours: string[];
  pattern: string;
  material: string;
  formality: string;
  description: string;
  status: "ready" | "extracting" | "needsCredits" | "failed" | "hidden";
  wearCount: number;
  lastWornAt?: number;
  /** Signed URL of the cutout, null while the extraction is still running or it failed. */
  url: string | null;
  createdAt: number;
};

export type SeedResult = { added: number; removed: number; skipped: number };

export const api = {
  users: {
    me: makeFunctionReference<"query", Record<string, never>, Me | null>("users:me"),
    ensure: makeFunctionReference<"mutation", Record<string, never>, string>("users:ensure"),
  },
  items: {
    list: makeFunctionReference<"query", { status?: string; category?: string }, ItemView[]>("items:list"),
  },
  collection: {
    /** Seeds the Nyoni capsule into the member's wardrobe, and retires anything no longer in it. */
    seed: makeFunctionReference<"action", Record<string, never>, SeedResult>("collection:seed"),
  },
};
