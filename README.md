# Nyoni Members

The private members app for [Nyoni Couture](https://nyonicouture.com), the bespoke menswear house founded by Nyonisela Sioh in Charlotte, NC. Members keep their measurements and fit history here, follow each commission from consultation to collection, book fittings, see their annual suit allowance, and style their Nyoni pieces on their own photo with a concierge to hand.

The app is planned on the architecture of the open Fitcheck AI wardrobe project (Next.js 16, Convex, Clerk, Vercel Eve, OpenAI). See the licence note in the plan before importing that code.

## Status

Brief and planning stage. Nothing runs yet.

## Documents

| File | What it is |
| --- | --- |
| [docs/01-brand-brief.md](docs/01-brand-brief.md) | Nyoni Couture brand brief: house, voice, services, membership programme, catalogue, visual direction, service gaps |
| [docs/02-luxury-membership-research.md](docs/02-luxury-membership-research.md) | How luxury membership, clienteling, measurement tracking and the bespoke commission lifecycle work |
| [docs/03-nyoni-members-app-plan.md](docs/03-nyoni-members-app-plan.md) | Product concept, feature map from Fitcheck, tiers and entitlements, data model, routes, design system, content pipeline, roadmap, open questions |
| [research/nyoni/catalogue-snapshot.json](research/nyoni/catalogue-snapshot.json) | Structured list of the site's products and price bands as indexed on 21 Sep 2026 |
| [scripts/capture-nyoni.mjs](scripts/capture-nyoni.mjs) | Pulls the live site (Firecrawl) and the WooCommerce catalogue into `research/nyoni/` |

## Capture the live site

The research environment could not reach nyonicouture.com, so screenshots, colours, fonts and product images still need to be captured from a normal machine:

```bash
# pages, branding, screenshots and the WooCommerce catalogue
FIRECRAWL_API_KEY=fc-... node scripts/capture-nyoni.mjs --images

# catalogue only, no key needed
node scripts/capture-nyoni.mjs --no-firecrawl
```

Requires Node 20 or newer. Output lands in `research/nyoni/`.

## Next steps

1. Review the three documents and answer the open questions in the plan (name, billing source, licence, tier prices).
2. Run the capture script and confirm or replace the proposed palette and type.
3. Start Phase 1 of the roadmap.
