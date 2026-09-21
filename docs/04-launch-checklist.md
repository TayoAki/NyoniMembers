# Nyoni Members — launch checklist

_Everything needed to run, deploy and fill the app, in the order it is needed. Updated 21 September 2026. Secrets go in `.env.local`, the Vercel project and the Convex deployment, never in this repository._

---

## 1. Accounts and services

| Service                                           | Why                                                                                                              | What to do                                                                                                                                                                                                                                                                                                                                |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **GitHub**                                        | Source and deploys                                                                                               | Done: `TayoAki/NyoniMembers`, branch `claude/gallant-wozniak-adxpmm`. Merge to `main` when ready; Vercel deploys from it.                                                                                                                                                                                                                 |
| **Clerk** (app `app_3Jcb7C100ZAiBxHsh4KSKz5tqP3`) | Sign-in and sessions                                                                                             | Keys received. Add the JWT template named `convex` (audience `convex`, claim `public_metadata: "{{user.public_metadata}}"`). Enable email and, if wanted, phone/SMS sign-in. Set `publicMetadata.role = "admin"` on staff accounts. Later: a production instance on `members.nyonicouture.com` (needs DNS records on the house's domain). |
| **Convex**                                        | Database, file storage, workflows, the seeder                                                                    | Create a project and a production deployment (`pnpm exec convex dev --configure`, then `pnpm exec convex deploy`). Set the environment variables in section 2.                                                                                                                                                                            |
| **OpenAI**                                        | Photo scanning (gpt-5-mini), cutouts and previews (gpt-image-2), duplicate detection (text-embedding-3-small)    | An API key with access to those models and a funded balance. Set `MAX_DAILY_SPEND_USD` on Convex as the spend guard.                                                                                                                                                                                                                      |
| **Vercel**                                        | Hosts the Next.js app and the concierge agent (Eve); AI Gateway routes the concierge model (openai/gpt-5.4-mini) | Create the project by importing the GitHub repo. Enable AI Gateway on the team (the agent signs in with the project's OIDC token, no key needed on Vercel). Create an AI Gateway API key for local development only.                                                                                                                      |
| **WooCommerce** (nyonicouture.com)                | The catalogue that pre-equips every wardrobe; later, membership sync                                             | Store API is public: no key needed for the catalogue. For the later membership sync: a read-only REST key, the webhook secret, and the name of the membership plugin.                                                                                                                                                                     |
| **Domain**                                        | Member-facing URL                                                                                                | Decide the hostname (proposal: `members.nyonicouture.com`). The house adds a CNAME to Vercel and the Clerk production DNS records.                                                                                                                                                                                                        |

## 2. Environment variables

Three places. The CLI writes the first two Convex values; everything else is entered by hand.

| Variable                                                          | `.env.local` (dev)                 | Vercel project (prod)                             | Convex deployment                                                                                                           |
| ----------------------------------------------------------------- | ---------------------------------- | ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_CONVEX_URL`                                          | written by `convex dev`            | production deployment URL                         | —                                                                                                                           |
| `CONVEX_DEPLOYMENT`                                               | written by `convex dev`            | —                                                 | —                                                                                                                           |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`                               | the pk_test key                    | pk_test now, pk_live with the production instance | —                                                                                                                           |
| `CLERK_SECRET_KEY`                                                | the sk_test key                    | same                                              | same (still read by the plan refresh until the allowance phase)                                                             |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` and the three other redirect URLs | keep `.env.example` values         | same                                              | —                                                                                                                           |
| `CLERK_JWT_ISSUER_DOMAIN`                                         | —                                  | —                                                 | `https://adjusted-giraffe-1581.clerk.accounts.dev` (the dev instance; changes with the production instance)                 |
| `AGENT_SERVICE_KEY`                                               | `openssl rand -hex 32`             | same value                                        | same value                                                                                                                  |
| `AI_GATEWAY_API_KEY`                                              | required locally for the concierge | optional (OIDC covers it)                         | either this or `OPENAI_API_KEY`                                                                                             |
| `OPENAI_API_KEY`                                                  | —                                  | —                                                 | preferred for the image pipeline                                                                                            |
| `SITE_URL`                                                        | `http://localhost:3000`            | —                                                 | the app origin (`http://localhost:3000` in dev, `https://members…` in prod); the seeder resolves `/collection/*` against it |
| `MAX_DAILY_SPEND_USD`                                             | —                                  | —                                                 | e.g. `50`                                                                                                                   |

## 3. From the house

Data and assets:

- [ ] **Catalogue export**: run `node scripts/capture-nyoni.mjs --no-firecrawl` from any normal machine (writes `research/nyoni/woo-products.json`).
- [ ] **Product photos**: run `node scripts/build-collection.mjs --download` (fills `public/collection/` and regenerates `convex/shared/collection.ts`). Front-facing shots on a plain background preview best.
- [ ] **The default wardrobe**: all in-stock pieces (up to 60, the script default) or a curated capsule by slug.
- [ ] **Brand assets**: logo files, any brand guide, hero photography with rights. Optional: `FIRECRAWL_API_KEY=… node scripts/capture-nyoni.mjs` for screenshots and the branding capture.
- [ ] **Membership facts**: prices and rules for Signature, Prestige and Circle Elite (savings percentage, "qualifying orders", allowance rollover, what the allowance covers).
- [ ] **The cutter's measurement sheet**: the exact fields the house records, for the measurements phase.
- [ ] **Staff list and roles**: who sets memberships, who answers the concierge inbox, the response-time promise.
- [ ] **Square Appointments links** per showroom and service, for the fittings phase.
- [ ] **Policies**: privacy and terms text for the app (photos and measurements are personal data; consent copy needs sign-off).

Decisions:

- [x] Clerk for sign-in only; membership is a house-set status (done).
- [ ] App name: Nyoni Members (working title), Nyoni Circle, or Nyoni Atelier; and the hostname.
- [ ] Sign-in methods: email only, or email plus phone.
- [ ] Preview allowances per tier (replaces the credit meter): how many previews a Client, Signature, Prestige and Circle Elite member gets, and per what period.
- [ ] Hosting: Vercel (recommended, section 4).

## 4. Hosting: Vercel, with Railway as the alternative

**Recommendation: Vercel for the app.** Convex hosts the backend on its own cloud either way, so the only question is where Next.js and the concierge agent run.

Why Vercel for this codebase:

- The concierge runs on **Vercel Eve**. `next.config.ts` already wraps the app in `withEve`, which emits the agent as a managed Vercel service during the same build, with Vercel Workflow holding durable session state and the AI Gateway authenticated by the project's OIDC token. No extra services, keys or storage to run.
- `vercel.json` carries the verified build command; the Fitcheck base was tested end to end on this path (production build with the Eve service, real tool calls, health route).
- A URL on the first push (`<project>.vercel.app`) and a preview URL for every branch and pull request, so the house can review before anything reaches members.
- Next.js 16 is first-class there; image optimization and the proxy need no configuration.

What Railway would mean instead (it is possible, not free of work):

- Eve becomes a **self-hosted Node service**: `eve build` then `eve start` as a second Railway service, with `AI_GATEWAY_API_KEY` set because OIDC only exists on Vercel.
- Durable workflow state lives in `.eve/.workflow-data`, which must sit on a mounted volume (single instance) or move to the beta Postgres workflow adapter.
- The proxy must forward both `/eve/` and `/.well-known/workflow/` to that service, and the Next build needs `EVE_NEXT_PRODUCTION_ORIGIN` pointing at it.
- Preview environments and per-branch URLs need to be set up by hand.

Railway remains a fine home for anything that is plain Node later, such as a WooCommerce sync worker, but the app itself should go to Vercel.

## 5. To the first URL, in order

1. Push the branch (done) and merge or deploy it directly.
2. **Convex**: `pnpm exec convex dev --configure`, set the section 2 variables on the deployment, then `pnpm exec convex deploy` for production. This yields the deployment URL.
3. **Clerk**: add the `convex` JWT template; set your own account's `publicMetadata.role` to `admin`.
4. **Vercel**: import the GitHub repo, set the section 2 variables (production Convex URL, Clerk keys, `AGENT_SERVICE_KEY`, `SITE_URL`), enable AI Gateway, deploy. This yields the app URL; check `/eve/v1/health` on it.
5. Sign up, finish onboarding, confirm the collection seeds (pieces show as "awaiting photos" until step 6), preview a look, ask the concierge a question.
6. Run the catalogue and photo scripts (section 3), commit `public/collection/` and the regenerated collection file, push; the seeder fills wardrobes on the next seed.
7. In Admin → Membership, set the first members' tiers.

## 6. Still to build

- Tier-based preview allowances replacing the credit meter (needs the allowance decision above).
- Measurements profile with history and the staff editor.
- Commissions tracker and fittings (Square deep links first).
- Wedding parties, events and first-look drops.
- WooCommerce membership sync replacing the manual status.
