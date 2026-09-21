Product photography for the Nyoni collection goes here, one file per collection key
(for example nyoni-armada-suit.webp). Populate it with:

node scripts/capture-nyoni.mjs --no-firecrawl
node scripts/build-collection.mjs --download

Until these files exist the seeder skips the pieces and reports them as awaiting photos.
