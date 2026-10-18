/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as admin from "../admin.js";
import type * as agent from "../agent.js";
import type * as ai_colours from "../ai/colours.js";
import type * as ai_image_input from "../ai/image_input.js";
import type * as ai_openai from "../ai/openai.js";
import type * as ai_pipeline from "../ai/pipeline.js";
import type * as ai_prompts from "../ai/prompts.js";
import type * as atelier_access from "../atelier/access.js";
import type * as atelier_appointments from "../atelier/appointments.js";
import type * as atelier_benefits from "../atelier/benefits.js";
import type * as atelier_cases from "../atelier/cases.js";
import type * as atelier_catalogue from "../atelier/catalogue.js";
import type * as atelier_corrections from "../atelier/corrections.js";
import type * as atelier_drafts from "../atelier/drafts.js";
import type * as atelier_fit from "../atelier/fit.js";
import type * as atelier_generation from "../atelier/generation.js";
import type * as atelier_groups from "../atelier/groups.js";
import type * as atelier_notifications from "../atelier/notifications.js";
import type * as atelier_orders from "../atelier/orders.js";
import type * as atelier_photos from "../atelier/photos.js";
import type * as atelier_previews from "../atelier/previews.js";
import type * as atelier_privacy from "../atelier/privacy.js";
import type * as atelier_quotes from "../atelier/quotes.js";
import type * as atelier_shares from "../atelier/shares.js";
import type * as atelier_staff from "../atelier/staff.js";
import type * as atelier_views from "../atelier/views.js";
import type * as avatars from "../avatars.js";
import type * as collection from "../collection.js";
import type * as credits from "../credits.js";
import type * as crons from "../crons.js";
import type * as dev_atelier_fixtures from "../dev/atelier_fixtures.js";
import type * as dev_smoke from "../dev/smoke.js";
import type * as http from "../http.js";
import type * as items from "../items.js";
import type * as jobs from "../jobs.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_env from "../lib/env.js";
import type * as lib_errors from "../lib/errors.js";
import type * as model_admin from "../model/admin.js";
import type * as model_atelier_appointments from "../model/atelier/appointments.js";
import type * as model_atelier_benefits from "../model/atelier/benefits.js";
import type * as model_atelier_case_core from "../model/atelier/case_core.js";
import type * as model_atelier_cases from "../model/atelier/cases.js";
import type * as model_atelier_catalogue from "../model/atelier/catalogue.js";
import type * as model_atelier_catalogue_staff from "../model/atelier/catalogue_staff.js";
import type * as model_atelier_drafts from "../model/atelier/drafts.js";
import type * as model_atelier_fit from "../model/atelier/fit.js";
import type * as model_atelier_notifications from "../model/atelier/notifications.js";
import type * as model_atelier_orders from "../model/atelier/orders.js";
import type * as model_atelier_photos from "../model/atelier/photos.js";
import type * as model_atelier_previews from "../model/atelier/previews.js";
import type * as model_atelier_revisions from "../model/atelier/revisions.js";
import type * as model_atelier_shares from "../model/atelier/shares.js";
import type * as model_avatars from "../model/avatars.js";
import type * as model_collection from "../model/collection.js";
import type * as model_credits from "../model/credits.js";
import type * as model_items from "../model/items.js";
import type * as model_jobs from "../model/jobs.js";
import type * as model_outfits from "../model/outfits.js";
import type * as model_renders from "../model/renders.js";
import type * as model_stats from "../model/stats.js";
import type * as model_threads from "../model/threads.js";
import type * as model_uploads from "../model/uploads.js";
import type * as model_users from "../model/users.js";
import type * as outfits from "../outfits.js";
import type * as renders from "../renders.js";
import type * as shared_atelier_cloths from "../shared/atelier/cloths.js";
import type * as shared_atelier_enums from "../shared/atelier/enums.js";
import type * as shared_atelier_looks from "../shared/atelier/looks.js";
import type * as shared_atelier_materials from "../shared/atelier/materials.js";
import type * as shared_atelier_measurements from "../shared/atelier/measurements.js";
import type * as shared_atelier_policy from "../shared/atelier/policy.js";
import type * as shared_atelier_spec from "../shared/atelier/spec.js";
import type * as shared_atelier_validators from "../shared/atelier/validators.js";
import type * as shared_collection from "../shared/collection.js";
import type * as shared_credits from "../shared/credits.js";
import type * as shared_house from "../shared/house.js";
import type * as shared_jobs from "../shared/jobs.js";
import type * as shared_membership from "../shared/membership.js";
import type * as shared_validators from "../shared/validators.js";
import type * as shared_wardrobe from "../shared/wardrobe.js";
import type * as subscriptions from "../subscriptions.js";
import type * as threads from "../threads.js";
import type * as uploads from "../uploads.js";
import type * as users from "../users.js";
import type * as views from "../views.js";
import type * as workflows_ingest from "../workflows/ingest.js";
import type * as workflows_manager from "../workflows/manager.js";
import type * as workflows_render from "../workflows/render.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  admin: typeof admin;
  agent: typeof agent;
  "ai/colours": typeof ai_colours;
  "ai/image_input": typeof ai_image_input;
  "ai/openai": typeof ai_openai;
  "ai/pipeline": typeof ai_pipeline;
  "ai/prompts": typeof ai_prompts;
  "atelier/access": typeof atelier_access;
  "atelier/appointments": typeof atelier_appointments;
  "atelier/benefits": typeof atelier_benefits;
  "atelier/cases": typeof atelier_cases;
  "atelier/catalogue": typeof atelier_catalogue;
  "atelier/corrections": typeof atelier_corrections;
  "atelier/drafts": typeof atelier_drafts;
  "atelier/fit": typeof atelier_fit;
  "atelier/generation": typeof atelier_generation;
  "atelier/groups": typeof atelier_groups;
  "atelier/notifications": typeof atelier_notifications;
  "atelier/orders": typeof atelier_orders;
  "atelier/photos": typeof atelier_photos;
  "atelier/previews": typeof atelier_previews;
  "atelier/privacy": typeof atelier_privacy;
  "atelier/quotes": typeof atelier_quotes;
  "atelier/shares": typeof atelier_shares;
  "atelier/staff": typeof atelier_staff;
  "atelier/views": typeof atelier_views;
  avatars: typeof avatars;
  collection: typeof collection;
  credits: typeof credits;
  crons: typeof crons;
  "dev/atelier_fixtures": typeof dev_atelier_fixtures;
  "dev/smoke": typeof dev_smoke;
  http: typeof http;
  items: typeof items;
  jobs: typeof jobs;
  "lib/auth": typeof lib_auth;
  "lib/env": typeof lib_env;
  "lib/errors": typeof lib_errors;
  "model/admin": typeof model_admin;
  "model/atelier/appointments": typeof model_atelier_appointments;
  "model/atelier/benefits": typeof model_atelier_benefits;
  "model/atelier/case_core": typeof model_atelier_case_core;
  "model/atelier/cases": typeof model_atelier_cases;
  "model/atelier/catalogue": typeof model_atelier_catalogue;
  "model/atelier/catalogue_staff": typeof model_atelier_catalogue_staff;
  "model/atelier/drafts": typeof model_atelier_drafts;
  "model/atelier/fit": typeof model_atelier_fit;
  "model/atelier/notifications": typeof model_atelier_notifications;
  "model/atelier/orders": typeof model_atelier_orders;
  "model/atelier/photos": typeof model_atelier_photos;
  "model/atelier/previews": typeof model_atelier_previews;
  "model/atelier/revisions": typeof model_atelier_revisions;
  "model/atelier/shares": typeof model_atelier_shares;
  "model/avatars": typeof model_avatars;
  "model/collection": typeof model_collection;
  "model/credits": typeof model_credits;
  "model/items": typeof model_items;
  "model/jobs": typeof model_jobs;
  "model/outfits": typeof model_outfits;
  "model/renders": typeof model_renders;
  "model/stats": typeof model_stats;
  "model/threads": typeof model_threads;
  "model/uploads": typeof model_uploads;
  "model/users": typeof model_users;
  outfits: typeof outfits;
  renders: typeof renders;
  "shared/atelier/cloths": typeof shared_atelier_cloths;
  "shared/atelier/enums": typeof shared_atelier_enums;
  "shared/atelier/looks": typeof shared_atelier_looks;
  "shared/atelier/materials": typeof shared_atelier_materials;
  "shared/atelier/measurements": typeof shared_atelier_measurements;
  "shared/atelier/policy": typeof shared_atelier_policy;
  "shared/atelier/spec": typeof shared_atelier_spec;
  "shared/atelier/validators": typeof shared_atelier_validators;
  "shared/collection": typeof shared_collection;
  "shared/credits": typeof shared_credits;
  "shared/house": typeof shared_house;
  "shared/jobs": typeof shared_jobs;
  "shared/membership": typeof shared_membership;
  "shared/validators": typeof shared_validators;
  "shared/wardrobe": typeof shared_wardrobe;
  subscriptions: typeof subscriptions;
  threads: typeof threads;
  uploads: typeof uploads;
  users: typeof users;
  views: typeof views;
  "workflows/ingest": typeof workflows_ingest;
  "workflows/manager": typeof workflows_manager;
  "workflows/render": typeof workflows_render;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  workflow: import("@convex-dev/workflow/_generated/component.js").ComponentApi<"workflow">;
};
