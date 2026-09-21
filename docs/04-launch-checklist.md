# Nyoni Members — launch checklist

_Everything needed to run, deploy and fill the app, in the order it is needed. Updated 21 September 2026. Secrets go in `.env.local`, the Vercel project and the Convex deployment, never in this repository._

---

## 1. Accounts and services

| Service                                           | Why                                                                                                              | What to do                                                                                                                                                                                                                                                                             |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **GitHub**                                        | Source and deploys                                                                                               | Done: `TayoAki/NyoniMembers`, branch `claude/gallant-wozniak-adxpmm`. Merge to `main` when ready; Vercel deploys from it.                                                                                                                                                              |
| **Clerk** (app `app_3Jcb7C100ZAiBxHsh4KSKz5tqP3`) | Sign-in and sessions                                                                                             | Keys in place; the `convex` JWT template carries the `public_metadata` claim. Still to do: `publicMetadata.role = "admin"` on the first staff account after it signs up; enable phone sign-in if wanted; later a production instance on a custom domain.                               |
| **Convex**                                        | Database, file storage, workflows, the seeder                                                                    | Done: project with development deployment `accomplished-lemur-843` and production `good-donkey-546` (US East, not yet deployed). Generate a production deploy key for Vercel; set the environment variables in section 2 on `good-donkey-546`. The Vercel build deploys the functions. |
| **OpenAI**                                        | Photo scanning (gpt-5-mini), cutouts and previews (gpt-image-2), duplicate detection (text-embedding-3-small)    | An API key with access to those models and a funded balance. Set `MAX_DAILY_SPEND_USD` on Convex as the spend guard.                                                                                                                                                                   |
| **Vercel**                                        | Hosts the Next.js app and the concierge agent (Eve); AI Gateway routes the concierge model (openai/gpt-5.4-mini) | Create the project by importing the GitHub repo. Enable AI Gateway on the team (the agent signs in with the project's OIDC token, no key needed on Vercel). Create an AI Gateway API key for local development only.                                                                   |
| **WooCommerce** (nyonicouture.com)                | The catalogue that pre-equips every wardrobe; later, membership sync                                             | Store API is public: no key needed for the catalogue. For the later membership sync: a read-only REST key, the webhook secret, and the name of the membership plugin.                                                                                                                  |
| **Domain**                                        | Member-facing URL                                                                                                | Decided: none for now; the app uses the Vercel-assigned `<project>.vercel.app` URL and Clerk stays on its development instance. Later: `members.nyonicouture.com` with a CNAME to Vercel and the Clerk production DNS records.                                                         |

## 2. Environment variables

Three places. The CLI writes the first two Convex values; everything else is entered by hand.

| Variable                                                          | `.env.local` (dev)                            | Vercel project (prod)                                          | Convex deployment                                                                                                                               |
| ----------------------------------------------------------------- | --------------------------------------------- | -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_CONVEX_URL`                                          | `https://accomplished-lemur-843.convex.cloud` | injected by the build (`https://good-donkey-546.convex.cloud`) | —                                                                                                                                               |
| `CONVEX_DEPLOYMENT`                                               | `dev:accomplished-lemur-843`                  | —                                                              | —                                                                                                                                               |
| `CONVEX_DEPLOY_KEY`                                               | —                                             | production deploy key from the Convex dashboard                | —                                                                                                                                               |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`                               | the pk_test key                               | pk_test now, pk_live with the production instance              | —                                                                                                                                               |
| `CLERK_SECRET_KEY`                                                | the sk_test key                               | same                                                           | same (still read by the plan refresh until the allowance phase)                                                                                 |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` and the three other redirect URLs | keep `.env.example` values                    | same                                                           | —                                                                                                                                               |
| `CLERK_JWT_ISSUER_DOMAIN`                                         | —                                             | —                                                              | `https://adjusted-giraffe-1581.clerk.accounts.dev` (the dev instance; changes with the production instance)                                     |
| `AGENT_SERVICE_KEY`                                               | `openssl rand -hex 32`                        | same value                                                     | same value                                                                                                                                      |
| `AI_GATEWAY_API_KEY`                                              | required locally for the concierge            | optional (OIDC covers it)                                      | either this or `OPENAI_API_KEY`                                                                                                                 |
| `OPENAI_API_KEY`                                                  | —                                             | —                                                              | preferred for the image pipeline                                                                                                                |
| `SITE_URL`                                                        | `http://localhost:3000`                       | —                                                              | the app origin (`http://localhost:3000` in dev, the `https://<project>.vercel.app` URL in prod); the seeder resolves `/collection/*` against it |
| `MAX_DAILY_SPEND_USD`                                             | —                                             | —                                                              | e.g. `50`                                                                                                                                       |

## 3. From the house

Data and assets:

- [x] **Catalogue export**: done through Firecrawl (the store's bot challenge blocks plain requests): 775 products, 595 with photos, in `research/nyoni/woo-products.json`.
- [x] **Product photos**: 50 pieces pulled through Jetpack's image CDN into `public/collection/` as 1400px WebP (`scripts/fetch-collection-images.mjs`); the collection points at them.
- [ ] **The default wardrobe**: all in-stock pieces (up to 60, the script default) or a curated capsule by slug.
- [x] **Brand assets**: palette, type, sizes and logo URL captured from the live site (`research/nyoni/branding.json`, screenshots in `research/nyoni/pages/`); the app tokens now use them. Still wanted: hero photography with rights.
- [x] **Membership facts**: The Nyoni Circle, US$549 / 749 / 949 a year, one made-to-measure suit each year in a rising Nyoni Fabric grade, privileges per tier, prorated upgrades. In `convex/shared/membership.ts` and the brand brief.
- [ ] **The cutter's measurement sheet**: the exact fields the house records, for the measurements phase.
- [ ] **Staff list and roles**: who sets memberships, who answers the concierge inbox, the response-time promise.
- [ ] **Square Appointments links** per showroom and service, for the fittings phase.
- [ ] **Policies**: privacy and terms text for the app (photos and measurements are personal data; consent copy needs sign-off).

Decisions:

- [x] Clerk for sign-in only; membership is a house-set status (done).
- [ ] App name: Nyoni Members (working title), Nyoni Circle, or Nyoni Atelier; and the hostname.
- [ ] Sign-in methods: email only, or email plus phone.
- [ ] Preview allowances per tier (replaces the credit meter): how many previews a Client, Signature, Prestige and Circle Elite member gets, and per what period.
- [x] Hosting: Vercel, on the assigned `vercel.app` URL until there is a domain.
- [x] AI provider: a Vercel AI Gateway key (or a direct OpenAI key) on Convex. OpenRouter cannot serve the image pipeline (no OpenAI-compatible image-edit endpoint) and the concierge already routes through the Gateway.

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

1. Push the branch (done).
2. **Convex** (`good-donkey-546`): generate a production deploy key; set the section 2 variables on the deployment.
3. **Vercel**: import the GitHub repo, set `CONVEX_DEPLOY_KEY`, the two Clerk keys and `AGENT_SERVICE_KEY`, enable AI Gateway, deploy. The build deploys Convex and the app together and yields the app URL; check `/eve/v1/health` on it, then set `SITE_URL` on Convex to that URL.
4. **Clerk**: add the `convex` JWT template; set your own account's `publicMetadata.role` to `admin`.
5. Sign up, finish onboarding, confirm the collection seeds (pieces show as "awaiting photos" until step 6), preview a look, ask the concierge a question.
6. Run the catalogue and photo scripts (section 3), commit `public/collection/` and the regenerated collection file, push; the seeder fills wardrobes on the next seed.
7. In Admin → Membership, set the first members' tiers.

## 6. Still to build

- Tier-based preview allowances replacing the credit meter (needs the allowance decision above).
- Measurements profile with history and the staff editor.
- Commissions tracker and fittings (Square deep links first).
- Wedding parties, events and first-look drops.
- WooCommerce membership sync replacing the manual status.
