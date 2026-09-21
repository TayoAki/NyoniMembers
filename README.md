# Nyoni Members

The private members app for [Nyoni Couture](https://nyonicouture.com), the bespoke menswear house founded by Nyonisela Sioh in Charlotte, NC, with showrooms in Atlanta and Houston. Every member's wardrobe starts with the Nyoni collection, so they can build a look, preview it on their own photo and ask the concierge what to wear before they have photographed a single garment of their own. Measurements, commissions, fittings and the membership allowance follow in the next phases.

Built on the Fitcheck AI wardrobe architecture (Next.js 16, React 19, Convex, Clerk, Vercel Eve, OpenAI), imported with the author's permission at commit `174105f`.

## Status

Phase 1 of the plan is under way on this branch:

- Rebrand: wordmark, Bodoni Moda / Manrope / IBM Plex Mono, ivory and onyx tokens with a brass accent, private sign-in front door, nav and copy in the house's voice, the concierge persona.
- Membership as a house-set status: tiers, the Membership page with benefits and concierge contacts, and a staff form in Admin. Clerk Billing and its plans page are gone.
- Suits as a first-class garment: a `suit` category and outfit slot for two-piece, three-piece and tuxedo, with suit-aware try-on prompts.
- The Nyoni collection seeder: every member's wardrobe is filled automatically after onboarding (`convex/collection.ts`), and "Add the Nyoni collection" in the wardrobe restores it.
- Menswear-only onboarding.

Still to do from the plan: tier-based preview allowances replacing the credit meter, measurements, commissions and fittings, the staff console. The catalogue (775 products) and the live site's branding were captured through Firecrawl on 21 September; product photography is being pulled the same way.

## Documents

| File                                                                             | What it is                                                                                                                            |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| [docs/01-brand-brief.md](docs/01-brand-brief.md)                                 | Brand brief: house, voice and copy deck, services, membership programme, catalogue, visual direction                                  |
| [docs/02-luxury-membership-research.md](docs/02-luxury-membership-research.md)   | How luxury membership, clienteling, measurement tracking and the bespoke commission lifecycle work                                    |
| [docs/03-nyoni-members-app-plan.md](docs/03-nyoni-members-app-plan.md)           | Concept, feature map, tiers and entitlements, data model, routes, design system, content pipeline, roadmap                            |
| [docs/04-launch-checklist.md](docs/04-launch-checklist.md)                       | Everything needed to run, deploy and fill the app: accounts, environment variables, data from the house, hosting, order of operations |
| [research/nyoni/catalogue-snapshot.json](research/nyoni/catalogue-snapshot.json) | The store's products and price bands as indexed on 21 Sep 2026                                                                        |
| [AGENTS.md](AGENTS.md) and [DESIGN.md](DESIGN.md)                                | Working rules and design direction for anyone (or any agent) changing the code                                                        |

## Run it locally

Requirements: Node 24 or newer, pnpm 10.28.0 (`corepack enable`), a Clerk application, a Convex project, and an OpenAI key or Vercel AI Gateway key.

```bash
pnpm install --frozen-lockfile
cp .env.example .env.local                 # fill in the Clerk keys, AI_GATEWAY_API_KEY and AGENT_SERVICE_KEY
pnpm exec convex dev --configure           # links Convex and writes its URL into .env.local

# on the Convex deployment (dashboard or CLI)
pnpm exec convex env set CLERK_JWT_ISSUER_DOMAIN https://your-app.clerk.accounts.dev
pnpm exec convex env set CLERK_SECRET_KEY sk_test_...
pnpm exec convex env set AGENT_SERVICE_KEY <same value as .env.local>
pnpm exec convex env set OPENAI_API_KEY sk-...   # or AI_GATEWAY_API_KEY
pnpm exec convex env set SITE_URL http://localhost:3000
pnpm exec convex env set MAX_DAILY_SPEND_USD 50

pnpm convex:dev      # terminal 1: database, functions, workflows
pnpm dev             # terminal 2: Next.js plus the concierge agent
```

Clerk needs its Convex JWT template (audience `convex`). Clerk Billing is not used: membership is a status the house sets (see below). The full environment reference is in `.env.example`.

### Clerk

The project is linked to Clerk application `app_3Jcb7C100ZAiBxHsh4KSKz5tqP3`. From a machine with normal internet access:

```bash
npm install -g clerk          # or: pnpm install -g clerk
clerk auth login              # completes in the browser
clerk init --app app_3Jcb7C100ZAiBxHsh4KSKz5tqP3   # writes the publishable and secret keys to .env.local
clerk doctor
```

The SDK, provider, proxy and sign-in/sign-up routes are already in place, so `clerk init` mainly supplies the keys. Then, in the Clerk dashboard, add the JWT template named `convex` (audience `convex`, and `public_metadata: "{{user.public_metadata}}"` for staff roles) and set `CLERK_JWT_ISSUER_DOMAIN` on the Convex deployment.

### Membership status

Memberships are sold by the house, not the app. A member's tier lives on their record (`users.membership`: Signature, Prestige, Circle Elite, or Client for everyone else) and is set by staff in Admin → Membership by looking the account up by email. Members see their tier, its benefits and the concierge contacts on the Membership page. A WooCommerce sync can replace the manual step later without changing the model.

Checks: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm format:check`.

## Deploy (no custom domain yet)

**Status, 21 September 2026.** Done on the production Convex deployment `good-donkey-546`: `CLERK_JWT_ISSUER_DOMAIN`, `CLERK_SECRET_KEY`, `AGENT_SERVICE_KEY` and `MAX_DAILY_SPEND_USD` are set (over the deployment's HTTP API; the CLI cannot be used from the build sandbox). Done in Clerk: the `convex` JWT template now carries the `public_metadata` claim. Still to do: an AI key on Convex (`AI_GATEWAY_API_KEY` or `OPENAI_API_KEY`), the Vercel import (which deploys the functions), then `SITE_URL` on Convex and the admin role on the first staff account.

The app lives on the URL Vercel assigns (`<project>.vercel.app`) until the house has a domain; Clerk stays on its development instance, which works on any hostname. Convex has two deployments: development `accomplished-lemur-843` and production `good-donkey-546` (US East). The Vercel build deploys the Convex functions to production itself (`vercel.json` runs `convex deploy --cmd …`), so no local CLI is needed.

1. **Convex production deployment (`good-donkey-546`)**: generate a _production_ deploy key in the dashboard (Settings → Deploy keys; also used in step 2), then set the variables below either in the dashboard (Settings → Environment variables) or in one command with `scripts/configure-convex.mjs`, which reads them from your shell and can deploy the functions with `--deploy`:

   | Variable                  | Value                                                                                      |
   | ------------------------- | ------------------------------------------------------------------------------------------ |
   | `CLERK_JWT_ISSUER_DOMAIN` | `https://adjusted-giraffe-1581.clerk.accounts.dev`                                         |
   | `CLERK_SECRET_KEY`        | the sk_test key                                                                            |
   | `AGENT_SERVICE_KEY`       | `openssl rand -hex 32` (same value as in Vercel)                                           |
   | `AI_GATEWAY_API_KEY`      | an AI Gateway key from the Vercel dashboard (or `OPENAI_API_KEY` with a direct OpenAI key) |
   | `SITE_URL`                | the app URL once step 2 has run, e.g. `https://nyoni-members.vercel.app`                   |
   | `MAX_DAILY_SPEND_USD`     | `50`                                                                                       |

2. **Vercel** → Add New Project → import `TayoAki/NyoniMembers` (branch `claude/gallant-wozniak-adxpmm` or `main` after merging) → Environment variables:

   | Variable                            | Value                                 |
   | ----------------------------------- | ------------------------------------- |
   | `CONVEX_DEPLOY_KEY`                 | the production deploy key from step 1 |
   | `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | the pk_test key                       |
   | `CLERK_SECRET_KEY`                  | the sk_test key                       |
   | `AGENT_SERVICE_KEY`                 | same value as on Convex               |

   Deploy. The build pushes Convex functions, injects `NEXT_PUBLIC_CONVEX_URL`, builds Next.js and the concierge service. Enable AI Gateway on the Vercel team; the concierge signs in with the project's OIDC token. Check `https://<project>.vercel.app/eve/v1/health`.

3. **Clerk dashboard** → JWT templates → new template named `convex` with audience `convex` and claim `public_metadata: "{{user.public_metadata}}"`. Users → your account → public metadata `{"role":"admin"}`.

4. Go back to Convex and set `SITE_URL` to the Vercel URL. Sign up in the app, finish onboarding, open Membership and Admin → Membership.

**OpenRouter.** Not a drop-in for the image pipeline: cutouts and try-ons use OpenAI's image-edit endpoint with gpt-image-2, which OpenRouter does not expose (it has its own image API with a different request shape), and the concierge is routed through the Vercel AI Gateway. Use an AI Gateway key or a direct OpenAI key on Convex. Rotate any key that has been pasted into a chat or ticket once setup is done.

## Collection images

The seeder fetches each piece's `image` through `SITE_URL`. Until the store's photography is in `public/collection/`, pieces are skipped and reported as "awaiting photos". From a machine with normal internet access:

```bash
node scripts/capture-nyoni.mjs --no-firecrawl        # WooCommerce Store API export → research/nyoni/woo-products.json
node scripts/build-collection.mjs --download          # regenerates convex/shared/collection.ts and saves images to public/collection/
pnpm format && pnpm typecheck
```

Add `FIRECRAWL_API_KEY=fc-...` to the first command to also capture page markdown, full-page screenshots and the branding format for the design pass.

## What the house needs to provide

- WooCommerce: read access to the Store API (public by default), or a read-only REST key if it is disabled, plus which plugin sells the memberships.
- Product photography rights confirmed for in-app use (the images are the house's own).
- Membership prices and rules for Signature, Prestige and Circle Elite.
- Logo files and any brand guide, so the proposed palette and type can be confirmed or replaced.
- Clerk, Convex, Vercel and OpenAI or AI Gateway accounts for the deployment.
