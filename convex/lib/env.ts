export const SERVER_ENV_KEYS = [
  "CLERK_JWT_ISSUER_DOMAIN",
  "CLERK_WEBHOOK_SIGNING_SECRET",
  "OPENAI_API_KEY",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "AGENT_SERVICE_KEY",
  "SITE_URL",
  "MAX_DAILY_SPEND_USD",
] as const;

export type ServerEnvKey = (typeof SERVER_ENV_KEYS)[number];

/** Read a required server env var, failing loudly with the variable name so misconfiguration is obvious. */
export function requireEnv(key: ServerEnvKey): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(
      `Missing environment variable ${key}. Set it in the Convex dashboard (Settings → Environment Variables).`,
    );
  }
  return value;
}

export function optionalEnv(key: ServerEnvKey): string | undefined {
  return process.env[key] || undefined;
}

export function envNumber(key: ServerEnvKey, fallback: number): number {
  const raw = optionalEnv(key);
  const parsed = raw === undefined ? Number.NaN : Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}
