# Fitcheck — Build Plan

AI wardrobe: photograph your clothes, get every item cut out and tagged into a digital wardrobe, build outfits, ask a stylist agent what to wear, and see yourself wearing it. Every image generation is metered in credits so the margin is protected by design. Everything slow runs in the background and every step is visible in the UI.

Working title: **Fitcheck**. Package name `fitcheck`.

---

## 1. Stack (pinned by `package.json`)

| Layer         | Choice                                                                                                                                      | Why                                                                                                                                      |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| App           | Next.js 16 (App Router, `src/`, Turbopack), React 19, TypeScript strict                                                                     | Standard. Read `node_modules/next/dist/docs/` before using any Next API — this version differs from training data.                       |
| UI            | Tailwind v4 + shadcn/ui (`base-nova`, neutral), lucide icons, `motion/react`, `sonner`, `next-themes`                                       | Clean, modern, dark mode, no bespoke design system.                                                                                      |
| Auth + plans  | Clerk 7 (`@clerk/nextjs`, `@clerk/backend`), Clerk Billing (`<PricingTable />`, `has()`, `<Protect>`), Clerk webhooks (svix)                | Identity and subscription plans. Clerk Billing has **no metered billing**, so credits live in Convex.                                    |
| Data + jobs   | Convex 1.45 (DB, file storage, realtime queries, HTTP actions), `@convex-dev/workflow`                                                      | Durable pipelines with retries and reactive status; the progress UI is just a subscription.                                              |
| AI            | OpenAI SDK 7: `gpt-image-2` (extract cutouts, try-on renders), `gpt-5-mini` (vision detect + tag), `text-embedding-3-small` (search/dedupe) | Measured: extraction $0.031/item, render $0.029–0.033/image at `quality: medium`, 30–50 s each.                                          |
| Stylist agent | Vercel eve 0.56 (`withEve` in `next.config.ts`, `agent/` dir, `useEveAgent` from `eve/react`)                                               | Durable sessions, native approval gate on the one tool that spends credits, Clerk-verified channel auth. Docs: `node_modules/eve/docs/`. |
| Payments      | Clerk Billing for plans; Stripe Checkout for one-off credit packs (Stripe SDK 22)                                                           | Clerk Billing has no one-off purchases.                                                                                                  |
| Env           | `@t3-oss/env-nextjs` + zod 4                                                                                                                | Typed, validated env on both sides.                                                                                                      |

Reference material vendored for agents: `.claude/skills/clerk-*`, `.claude/skills/eve`, `docs/reference/convex_*.md`, `docs/reference/convex_rules.txt`, `node_modules/eve/docs/`, `node_modules/next/dist/docs/`.

---

## 2. Directory layout

```
agent/                      eve agent (stylist)
  agent.ts                  defineAgent({ model })
  instructions.md           always-on persona + rules
  channels/eve.ts           eveChannel({ auth: [clerkAuth(), localDev()] })
  tools/*.ts                one defineTool per file; filename = tool name
  skills/*.md               colour-pairing, dress-codes (loaded on demand)
  lib/convex.ts             service client for Convex (agent.* functions)
convex/
  schema.ts                 all tables (section 4)
  convex.config.ts          workflow component
  auth.config.ts            Clerk JWT issuer
  http.ts                   /clerk-webhook, /stripe-webhook
  shared/                   isomorphic constants + types (imported by src/ and agent/ too)
    credits.ts              CREDIT_COSTS, PLANS, PACKS, LIMITS, pricing math
    wardrobe.ts             CATEGORIES, SLOTS, SEASONS, FORMALITY, PATTERNS…
    validators.ts           convex validators derived from shared enums
  lib/                      server-only helpers used by functions
    auth.ts                 requireUser(ctx), requireAdmin(ctx), requireServiceKey(args)
    errors.ts               appError(code, message) → ConvexError with a typed code
  model/                    business logic on ctx (no validators, no exports of Convex functions)
    users.ts credits.ts jobs.ts items.ts outfits.ts renders.ts avatars.ts threads.ts uploads.ts
  users.ts avatars.ts uploads.ts items.ts jobs.ts outfits.ts renders.ts credits.ts billing.ts admin.ts agent.ts threads.ts
  webhooks/clerk.ts webhooks/stripe.ts
  ai/openai.ts ai/prompts.ts ai/colours.ts ai/embeddings.ts     ("use node" actions)
  workflows/manager.ts workflows/ingest.ts workflows/render.ts
docs/reference/             vendored docs (read-only)
src/
  app/                      routes (section 3)
  components/ui/            shadcn (generated; do not hand-edit)
  components/common/        EmptyState, PageHeader, CreditBadge, CreditQuote, JobStepper, ItemImage, ItemTile, ConfirmDialog, LoadingGrid…
  components/layout/        AppShell, AppSidebar, Topbar, MobileNav
  components/providers/     ClerkConvexProvider, ThemeProvider
  components/<feature>/     wardrobe/ upload/ outfits/ renders/ stylist/ billing/ settings/ admin/ onboarding/
  hooks/                    use-current-user, use-credits, use-active-jobs, use-items
  lib/                      env.ts, format.ts, routes.ts, utils.ts
  proxy.ts                  clerkMiddleware (Next 16 name for middleware)
```

Path aliases: `@/*` → `src/*`, `@convex/*` → `convex/*` (for `@convex/_generated/api` and `@convex/shared/*`).

---

## 3. Screens and flows

Every screen has: a loading state (skeleton matching the final layout), an empty state (`Empty` component with one primary action), an error state (toast + inline `Alert` where the user can retry), and works at phone width.

| Route                                 | Screen               | Key behaviour                                                                                                                                                                                                                                                                                                               |
| ------------------------------------- | -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`                                   | Landing (public)     | Hero, three-step explainer, pricing summary, sign-in CTA. Redirect signed-in users to `/wardrobe`.                                                                                                                                                                                                                          |
| `/sign-in`, `/sign-up`                | Clerk                | Catch-all routes, centered, themed.                                                                                                                                                                                                                                                                                         |
| `/onboarding`                         | Avatar setup         | Upload 1–3 photos (tips overlay), pick default, presentation + fit prefs. Gate: `(app)` layout redirects here until `users.onboardedAt` is set.                                                                                                                                                                             |
| `/add`                                | Add clothes          | Dropzone (1–50 photos, jpg/png/heic/webp). Each file becomes a tile with a live stepper: Uploaded → Detecting → Found n → Extracting k/n → Tagging → Ready. Credit quote appears after detection. Partial runs when credits run out with one-tap "Resume" after top-up. Duplicates flagged, not merged.                     |
| `/wardrobe`                           | Wardrobe grid        | Transparent cutouts on soft cards. Filters: category, colour, season, formality; text search; sort newest / most worn / never worn. Bulk select → hide / delete / change category. Skeleton grid while loading.                                                                                                             |
| `/wardrobe/[itemId]`                  | Item detail          | Large cutout, editable attributes (form), colour swatches from pixels, wear history, "outfits with this", re-extract, hide, delete.                                                                                                                                                                                         |
| `/outfits`                            | Outfits list         | Cards with item collage; worn dates; "New outfit".                                                                                                                                                                                                                                                                          |
| `/outfits/new`, `/outfits/[outfitId]` | Outfit builder       | Slots: outerwear, top, bottom (or dress), shoes, accessories. Tap slot → picker sheet filtered to category. Save. "Render on me" sheet: avatar picker, count 1–4, standard/HQ (HQ gated by plan feature), live credit quote, confirm. Renders appear in place as each completes; regenerate single render; mark worn today. |
| `/stylist`, `/stylist/[threadId]`     | Stylist chat (eve)   | Thread list + chat. Brief → outfit proposal cards (item collage + one-line reasoning) → approval card for renders with the credit cost on the button → renders stream into the thread. `ask_question` prompts render as option buttons. Resumes on reload.                                                                  |
| `/lookbook`                           | Renders gallery      | All renders, filter by outfit, share/unshare, download, delete.                                                                                                                                                                                                                                                             |
| `/share/[token]`                      | Public render page   | No auth. Render + item strip + "made with Fitcheck". 404 when revoked.                                                                                                                                                                                                                                                      |
| `/billing`                            | Billing              | Clerk `<PricingTable />`, current plan, plan credits + pack credits, renews-on date, pack purchase buttons (Stripe Checkout), ledger table (paginated). Low-balance nudge lives in the topbar `CreditBadge`.                                                                                                                |
| `/settings`                           | Settings             | Avatars (add/remove/default), preferences, theme, delete all data (confirm dialog → purges storage).                                                                                                                                                                                                                        |
| `/admin`                              | Admin (role `admin`) | Today/7d/30d: credits sold vs credits spent, real COGS from render/extraction token usage, gross margin, active jobs, failed jobs with retry/refund, per-user top spenders, daily spend vs `MAX_DAILY_SPEND_USD`.                                                                                                           |

Global: topbar shows `CreditBadge` (plan + pack credits, tooltip breakdown, low-balance state at ≤10, click → billing); an "Activity" popover lists running jobs with progress; toasts on job completion/failure.

---

## 4. Data model (Convex)

All docs carry `userId: Id<"users">` except `users`. Timestamps are `number` (ms). Enums come from `convex/shared/*` so the client, the agent and the DB agree.

```
users         clerkId (idx by_clerkId), email?, name?, imageUrl?, role: "user"|"admin",
              plan: "free"|"pro"|"plus", planPeriodEnd?, features: string[],
              planCredits: number, packCredits: number,          // balance = plan + pack
              dailySpend: { dayKey: "YYYY-MM-DD", credits: number },
              defaultAvatarId?: Id<avatars>, onboardedAt?,
              prefs: { presentation: "masculine"|"feminine"|"neutral", fit: "slim"|"regular"|"relaxed",
                       avoidColours: string[], homeCity?: string },
              createdAt
avatars       userId (idx by_user), storageId, label, isDefault, createdAt
uploads       userId (idx by_user), batchId, storageId, fileName, mimeType, sizeBytes, jobId?,
              detectedCount?, status: "queued"|"detecting"|"extracting"|"done"|"failed"|"partial", createdAt
items         userId, uploadId?, storageId (cutout png), thumbStorageId?, sourceBbox?: number[4],
              name, category, subcategory, colours: { primary, secondary: string[], hex: string[] },
              pattern, material, season: string[], formality, fit?, brand?, notes?,
              description (one sentence, used for embeddings + agent context), searchText,
              status: "extracting"|"ready"|"failed"|"hidden"|"needsCredits",
              wearCount, lastWornAt?, embedding?: number[1536], duplicateOfId?, createdAt, updatedAt
              idx by_user_status [userId,status], by_user_category [userId,category], by_upload
              searchIndex search_text { searchField: searchText, filterFields: [userId] }
              vectorIndex by_embedding { vectorField: embedding, dimensions: 1536, filterFields: [userId] }
outfits       userId (idx by_user), name, slots: { outerwear?, top?, bottom?, dress?, shoes?, accessories: Id[] },
              occasion?, brief?, source: "manual"|"agent", threadId?, wornOn: number[], createdAt, updatedAt
renders       userId (idx by_user), outfitId (idx by_outfit), avatarId, jobId (idx by_job), storageId?,
              quality: "standard"|"hq", status: "pending"|"done"|"failed", prompt,
              usage?: { inputTextTokens, inputImageTokens, outputTokens }, costUsd?, creditsCharged,
              shareToken? (idx by_shareToken), error?, createdAt, completedAt?
jobs          userId, type: "ingest"|"render", status: "queued"|"running"|"done"|"partial"|"failed"|"cancelled",
              steps: [{ key, label, status: "pending"|"running"|"done"|"failed"|"skipped", startedAt?, finishedAt?, error?, meta? }],
              progress: number 0..1, reservation: { plan: number, pack: number }, creditsRefunded: number,
              workflowId?, uploadId?, outfitIds?: Id[], resultIds: string[], error?, createdAt, updatedAt, completedAt?
              idx by_user_status [userId,status], by_user, by_workflowId
creditLedger  userId (idx by_user), delta, bucket: "plan"|"pack", kind: "plan_grant"|"plan_reset"|"signup_bonus"|
              "topup"|"reserve"|"refund"|"admin", jobId?, ref (idx by_ref, unique), note?, balanceAfter, createdAt
threads       userId (idx by_user), title, eveSessionId?, streamIndex?, lastMessageAt, createdAt
proposals     threadId (idx by_thread), userId, outfitId, jobId?, createdAt
```

Extraction/tagging vocab (`convex/shared/wardrobe.ts`): categories `top | bottom | outerwear | dress | shoes | accessory | bag | headwear`; slots map categories → builder slots; seasons `spring | summer | autumn | winter`; formality `casual | smart-casual | formal`.

---

## 5. Credits (the meter)

**Rule: one credit = one image generation.** Text-only work (detect, tag, embed, stylist reasoning, weather) is free and rate-limited.

| Action                                | Credits | Our cost (measured)                       |
| ------------------------------------- | ------- | ----------------------------------------- |
| Detect + tag a photo                  | 0       | ≈ $0.002                                  |
| Extract one item                      | 1       | $0.031                                    |
| Render one image, standard (`medium`) | 1       | $0.029–0.033                              |
| Render one image, HQ (`high`)         | 3       | ≈ $0.09 (estimate; measure before launch) |

Plans (Clerk Billing slugs `free`, `pro`, `plus`) and packs (Stripe Checkout) — from `convex/shared/credits.ts`:

| Plan / pack    | Price                  | Credits                  | Features                                     |
| -------------- | ---------------------- | ------------------------ | -------------------------------------------- |
| free           | $0                     | 25 once (`signup_bonus`) | wardrobe, builder, stylist, 1 avatar         |
| pro            | $9.99/mo               | 150 / cycle              | `sharing`, 2 avatars                         |
| plus           | $19.99/mo              | 300 / cycle              | `sharing`, `hq_renders`, 5 avatars, priority |
| pack S / M / L | $4.99 / $9.99 / $19.99 | 50 / 120 / 300           | never expire                                 |

Ledger mechanics (`convex/model/credits.ts`, all inside mutations, atomic):

- Two buckets on the user: `planCredits` (reset to the allowance on every `subscriptionItem.active`, i.e. each successful renewal) and `packCredits` (never expire). Spend plan first, then pack. `balance = planCredits + packCredits`.
- **reserve(user, amount, jobId)** → takes `min(amount, balance, dailyRemaining)`; writes one `reserve` line per bucket touched; returns `{ granted, shortfall, reservation }`. Job stores `reservation`.
- **refund(job, amount)** → returns credits to the buckets in reverse order of consumption (pack first, then plan), writes `refund` lines, bumps `job.creditsRefunded`.
- **grantPlan(user, plan, ref)** → sets `planCredits` to the allowance (writes `plan_reset` for the discarded remainder, then `plan_grant`). Idempotent by `ref` = Clerk event id.
- **topup(user, credits, ref)** → adds to `packCredits`. Idempotent by `ref` = Stripe checkout session id.
- Every ledger line has a unique `ref`; `by_ref` index makes duplicate webhook deliveries no-ops.
- Guardrails (`LIMITS`): daily cap 150 credits/user, max 3 running jobs/user, max 4 renders per request, global `MAX_DAILY_SPEND_USD` kill switch checked in reserve, 200 detect calls/day, 100 stylist messages/day.
- Feature gates: `users.features` (synced from Clerk Billing webhooks) checked in the mutation **and** in the UI via `has({ feature })` / `<Protect>`. Quantities are always checked against the ledger.

Nothing outside `convex/model/credits.ts` touches `planCredits`, `packCredits` or `creditLedger`.

---

## 6. Background pipelines (Convex Workflow component)

Every long operation is a `jobs` row + a durable workflow. Steps write to `jobs.steps` through `model/jobs.setStep`, the browser subscribes to `jobs.get` / `jobs.listActive`, and the UI renders whatever the job says.

**Ingest** (`workflows/ingest.ts`, one per upload):

1. `detect` — `ai/openai.detectItems` (gpt-5-mini vision → JSON array with bbox, category, colours, pattern, material, season, formality, description). Free. Step meta: `{ found }`.
2. `reserve` — `credits.reserve(found)`; items beyond `granted` are inserted with status `needsCredits`.
3. `extract:<n>` (parallel via the workflow pool, max 3 running jobs per user) — `ai/openai.extractItem` (gpt-image-2 edit, transparent png, falls back to opaque on the preview-flag error) → store cutout → insert item `ready` → `ai/colours.dominant` hex swatches → `ai/embeddings.embedItem` → duplicate check (vector search, cosine > 0.92 → `duplicateOfId`).
4. `finalize` — `onComplete`: refund failed extractions, set upload/job status (`done` | `partial` | `failed`), toast via job status.

**Render** (`workflows/render.ts`, one per request):

1. `reserve` — happens in `renders.start` mutation before the workflow starts (quote = count × cost × outfits). Rejects with `INSUFFICIENT_CREDITS` and the shortfall.
2. `render:<n>` (parallel) — `ai/openai.renderOutfit` with avatar + all garment cutouts as references, one prompt; store result; patch `renders` row with usage + `costUsd`.
3. `finalize` — refund failures, mark job.

Retries: actions `{ maxAttempts: 3, initialBackoffMs: 2000, base: 2 }`. Step keys are stable strings the UI maps to labels via `convex/shared/jobs.ts`.

Measured latency is 30–50 s per image: the UI never blocks; show an ETA from the running average of recent steps.

---

## 7. Stylist agent (eve)

- `agent/agent.ts`: `defineAgent({ model: "openai/gpt-5.4-mini" })` (AI Gateway string; `AI_GATEWAY_API_KEY` locally).
- `agent/channels/eve.ts`: `eveChannel({ auth: [clerkAuth(), localDev()] })`. `clerkAuth` is an `AuthFn` that verifies a Clerk bearer token (`verifyToken` from `@clerk/backend`) and returns `{ principalId: clerkUserId, principalType: "user", authenticator: "clerk", attributes: { clerkUserId } }`. The browser passes `headers: async () => ({ authorization: \`Bearer ${await getToken()}\` })`to`useEveAgent`.
- Tools call Convex through `agent/lib/convex.ts`: `ConvexHttpClient` + `api.agent.*` functions that take `{ serviceKey, clerkUserId, ... }`, verified by `requireServiceKey` and scoped to that user. Approval is a gate, not authorization: executors re-derive the user from `ctx.session.auth.current`.
- Tools: `get_wardrobe`, `get_weather` (Open-Meteo geocoding + forecast, no key), `compose_outfits` (validates ids, one per slot, writes `outfits` with `source: "agent"` + `proposals`), `quote_renders`, `start_renders` (`approval: always()`; policy denies with a reason when balance < quote; executor calls `api.agent.startRenders`), `save_outfit`, `gap_analysis`. Built-in sandbox/file tools are disabled for this agent.
- `agent/instructions.md`: stylist persona; only use wardrobe items; respect occasion/weather/prefs; explain briefly; propose before rendering; always quote before `start_renders`; use `ask_question` when a missing detail changes the answer.
- UI: `useEveAgent({ initialSession, resume: true, headers })`; messages rendered from `agent.data.messages`; tool parts render as outfit cards (`compose_outfits` output) and render-job cards (subscribe to `jobs.get` by `jobId`); pending `approval-requested` parts render the credit card and call `agent.respond`. `threads` in Convex store `eveSessionId`/`streamIndex` via `onSessionChange`.

---

## 8. Environment variables

`.env.example` documents all of these; `src/lib/env.ts` validates the Next side.

| Where                   | Name                                                                                                                                                                                                                                                                    | Purpose             |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| Next                    | `NEXT_PUBLIC_CONVEX_URL`, `CONVEX_DEPLOYMENT`                                                                                                                                                                                                                           | Convex client / CLI |
| Next                    | `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in`, `NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up`, `NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/wardrobe`, `NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/onboarding` | Clerk               |
| Convex dashboard        | `CLERK_JWT_ISSUER_DOMAIN`, `CLERK_WEBHOOK_SIGNING_SECRET`, `OPENAI_API_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `AGENT_SERVICE_KEY`, `SITE_URL`, `MAX_DAILY_SPEND_USD`                                                                                       | server secrets      |
| eve (same `.env.local`) | `AI_GATEWAY_API_KEY`, `CLERK_SECRET_KEY`, `NEXT_PUBLIC_CONVEX_URL`, `AGENT_SERVICE_KEY`                                                                                                                                                                                 | agent runtime       |

Clerk setup: JWT template named `convex` (Convex ↔ Clerk docs), Billing plans `pro` and `plus` with features `sharing`, `hq_renders`, webhooks → `<convex-site-url>/clerk-webhook` for `user.*`, `subscriptionItem.*`, `paymentAttempt.updated`. Stripe webhook → `<convex-site-url>/stripe-webhook` for `checkout.session.completed`.

---

## 9. Build phases and ownership

| Phase           | Owner   | Output                                                                                                                               |
| --------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| 0 Scaffold      | lead    | Next app, shadcn, deps, vendored docs, this plan, `AGENTS.md`                                                                        |
| 1 Foundation    | lead    | schema, config, shared constants, `lib/auth`, `model/credits`, `model/jobs`, providers, app shell, common components, env, proxy     |
| 2a Backend data | agent A | `model/*` (rest), `users/avatars/uploads/items/jobs/outfits/renders/credits/billing/admin/threads/agent.ts`, `webhooks/*`, `http.ts` |
| 2b Pipelines    | agent B | `ai/*`, `workflows/*`                                                                                                                |
| 2c Frontend I   | agent C | onboarding, add-clothes stepper UI, wardrobe grid + item detail                                                                      |
| 2d Frontend II  | agent D | outfit builder, render sheet, outfits, lookbook, share page                                                                          |
| 2e Frontend III | agent E | billing, settings, admin, landing page                                                                                               |
| 2f Stylist      | agent F | `agent/*`, `next.config.ts` withEve, stylist routes + components                                                                     |
| 3 Integration   | lead    | codegen, `tsc`, `eslint`, `next build`, review, fixes                                                                                |
| 4 Sync          | lead    | commit to the Mac folder, install deps, README                                                                                       |

Agents in phase 2 own disjoint files. Anything shared they need (a new common component, a new shared constant) goes in their own feature folder unless it clearly belongs in `common/` or `shared/`, in which case they add it and note it in their final report so the lead can dedupe.

---

## 10. Verification checklist

- `pnpm typecheck` (root `tsc --noEmit` incl. `convex/`), `pnpm lint`, `pnpm build` pass.
- `npx convex codegen` regenerates `convex/_generated` cleanly.
- Every route renders a loading skeleton, an empty state and an error state.
- No component reads `planCredits`/`packCredits` except through `credits.balance`; no function outside `model/credits.ts` writes the ledger.
- Every Convex function has argument validators and checks `requireUser`/`requireAdmin`/`requireServiceKey`.
- Webhook handlers are idempotent (ledger `ref`), verify signatures, and return 200 on duplicates.
- Approval-gated tool is the only path to `renders.start` from the agent.
- Secrets never reach the client bundle (`NEXT_PUBLIC_` only for URLs and publishable keys).
