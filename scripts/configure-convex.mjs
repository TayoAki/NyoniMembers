#!/usr/bin/env node
/**
 * Configure the production Convex deployment in one go, from a machine with internet access.
 *
 *   CONVEX_DEPLOY_KEY='prod:good-donkey-546|…' \
 *   CLERK_SECRET_KEY='sk_test_…' \
 *   AGENT_SERVICE_KEY='…' \
 *   AI_GATEWAY_API_KEY='…' \                      # or OPENAI_API_KEY='sk-…'
 *   SITE_URL='https://<project>.vercel.app' \     # once Vercel has assigned the URL
 *   node scripts/configure-convex.mjs --deploy
 *
 * Sets the fixed values (Clerk issuer, daily spend cap) and every secret present in the
 * environment, skips the ones that are absent so it can be re-run as values arrive, and with
 * --deploy pushes the functions afterwards. Nothing is written to disk.
 */

import { spawnSync } from "node:child_process";

const FIXED = { CLERK_JWT_ISSUER_DOMAIN: "https://adjusted-giraffe-1581.clerk.accounts.dev" };
const FROM_ENV = ["CLERK_SECRET_KEY", "AGENT_SERVICE_KEY", "AI_GATEWAY_API_KEY", "OPENAI_API_KEY", "SITE_URL"];

if (!process.env.CONVEX_DEPLOY_KEY) {
  console.error("Set CONVEX_DEPLOY_KEY to the production deploy key from the Convex dashboard.");
  process.exit(1);
}

const values = { ...FIXED, MAX_DAILY_SPEND_USD: process.env.MAX_DAILY_SPEND_USD ?? "50" };
for (const name of FROM_ENV) if (process.env[name]) values[name] = process.env[name];

for (const [name, value] of Object.entries(values)) {
  console.log(`convex env set ${name}`);
  run(["convex", "env", "set", name, value]);
}

const skipped = FROM_ENV.filter((name) => !process.env[name]);
if (skipped.length > 0) console.log(`Not set (absent from the environment): ${skipped.join(", ")}`);
if (!process.env.AI_GATEWAY_API_KEY && !process.env.OPENAI_API_KEY) {
  console.log("Scanning, try-ons and the concierge need AI_GATEWAY_API_KEY or OPENAI_API_KEY on Convex.");
}

if (process.argv.includes("--deploy")) {
  console.log("convex deploy");
  run(["convex", "deploy", "--yes"]);
}

function run(args) {
  const result = spawnSync("pnpm", ["exec", ...args], {
    stdio: "inherit",
    env: process.env,
    shell: process.platform === "win32",
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
