# Fitcheck

Photograph your clothes, get a digital wardrobe with every item cut out and tagged, build outfits, ask a stylist agent what to wear, and see yourself wearing it. Every image generation is metered in credits so the margin is protected by design; everything slow runs in the background and every step is visible in the UI.

`PLAN.md` is the build contract (screens, schema, credit rules, pipelines). `AGENTS.md` is how to work in the repo.

## Stack

Next.js 16 · React 19 · Tailwind v4 + shadcn/ui (Base UI) · Convex (data, files, durable workflows) · Clerk 7 (auth + Billing) · Stripe Checkout (credit packs) · OpenAI `gpt-image-2` + `gpt-5-mini` · Vercel eve (stylist agent) · Vercel.

## Requirements

- **Node 24+** (eve's dev server insists; `.nvmrc` is set) and pnpm 10.
- Accounts: Convex, Clerk (with Billing enabled), OpenAI, Stripe (test mode is fine), Vercel AI Gateway (or any AI SDK provider key for the stylist).

## First run

```bash
pnpm install
cp .env.example .env.local        # fill in the Next.js + eve values
npx convex dev                    # creates/links your Convex dev deployment, writes CONVEX_DEPLOYMENT + NEXT_PUBLIC_CONVEX_URL
```

Set the server secrets on the Convex deployment (they never live in `.env.local`):

```bash
npx convex env set CLERK_JWT_ISSUER_DOMAIN https://<your-app>.clerk.accounts.dev
npx convex env set CLERK_WEBHOOK_SIGNING_SECRET whsec_...
npx convex env set OPENAI_API_KEY sk-...
npx convex env set STRIPE_SECRET_KEY sk_test_...
npx convex env set STRIPE_WEBHOOK_SECRET whsec_...
npx convex env set AGENT_SERVICE_KEY <same value as .env.local>
npx convex env set SITE_URL http://localhost:3000
npx convex env set MAX_DAILY_SPEND_USD 50
```

Then, in two terminals:

```bash
npx convex dev   # pushes functions, tails logs
pnpm dev         # Next.js + the eve stylist on http://localhost:3000
```

### Clerk

1. Create a JWT template named **`convex`** (Clerk → JWT templates) — the Convex ↔ Clerk integration reads it.
2. Enable **Billing** and create plans with slugs `pro` and `plus`; add features `sharing`, `hq_renders`, `priority_queue` to match `convex/shared/credits.ts`.
3. Add a webhook endpoint at `https://<your-deployment>.convex.site/clerk-webhook` subscribed to `user.*`, `subscriptionItem.*` and `paymentAttempt.updated`; paste the signing secret into `CLERK_WEBHOOK_SIGNING_SECRET`.
4. Make yourself an admin with `publicMetadata: { "role": "admin" }` on your Clerk user (synced by the webhook).

### Stripe

Add a webhook endpoint at `https://<your-deployment>.convex.site/stripe-webhook` for `checkout.session.completed`. Packs are defined in `convex/shared/credits.ts`; prices are set on the Checkout Session, so nothing needs creating in the Stripe dashboard.

### eve (stylist)

`AI_GATEWAY_API_KEY` (or link the Vercel project for OIDC), `CLERK_SECRET_KEY`, `NEXT_PUBLIC_CONVEX_URL` and `AGENT_SERVICE_KEY` in `.env.local`. In `eve dev` without a Clerk session, set `AGENT_DEV_CLERK_USER_ID` to a real Clerk user id so tools have a wardrobe to read.

## Scripts

| Script                                    | What                                                                      |
| ----------------------------------------- | ------------------------------------------------------------------------- |
| `pnpm dev`                                | Next.js dev server; `withEve` boots the stylist beside it                 |
| `pnpm build` / `pnpm start`               | production build (run `npx eve build` first for a local production start) |
| `pnpm typecheck`                          | Next.js, Convex and agent projects                                        |
| `pnpm lint` / `pnpm format`               | eslint / prettier                                                         |
| `pnpm convex:dev` / `pnpm convex:codegen` | Convex dev loop / regenerate `convex/_generated`                          |

## Layout

```
agent/        eve stylist: instructions.md, tools/*.ts (start_renders is approval-gated), channels/eve.ts (Clerk bearer auth)
convex/       schema, shared constants, model/ (business logic), thin public functions, webhooks/, ai/ (OpenAI actions), workflows/
src/app       routes; every signed-in page calls requireSignedIn() (Clerk 7 resource-level auth)
src/components/common   PageHeader, EmptyState, JobStepper, ItemImage, CreditQuote, ConfirmDialog, OutfitCollage…
docs/reference          vendored Convex docs; .claude/skills has the Clerk + eve skills the code was written against
```

## Credits in one paragraph

One credit = one image generation (`CREDIT_COSTS`). Plans (Clerk Billing) reset `planCredits` every cycle via the `subscriptionItem.active` webhook; packs (Stripe Checkout) add `packCredits` that never expire. `convex/model/credits.ts` is the only module that moves credits: jobs reserve before calling OpenAI, settle what succeeded, and refund the rest, all keyed by unique ledger `ref`s so duplicate webhooks are no-ops. Measured costs at `quality: medium`: ≈$0.031 per extraction, ≈$0.033 per render.

## Local smoke test without a browser

`convex/dev/smoke.ts` has internal helpers to seed a user, upload a photo, run the ingest pipeline and render an outfit from the CLI (`npx convex run dev/smoke:seedUser '{"clerkId":"smoke"}'` …). They are `internal*` functions, so only the CLI/dashboard can call them.

## Known gaps

- HEIC uploads are rejected on purpose (gpt-image-2 doesn't accept them); iPhones should be set to "Most compatible" or photos converted first.
- Detection token costs are logged on the job step but not counted in admin COGS (fractions of a cent per photo).
- `admin.overview` scans the ledger/renders for the chosen window; fine for a small app, swap for `@convex-dev/aggregate` at scale.
