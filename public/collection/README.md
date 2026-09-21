Product photography for the Nyoni capsule, one WebP per collection key, pulled from the store
through Jetpack's image CDN and resized to 1400px:

NODE_USE_ENV_PROXY=1 node scripts/fetch-collection-images.mjs # after build-collection.mjs (remote URLs)
node scripts/build-collection.mjs --local # points the capsule at these files

The seeder resolves /collection/<key>.webp against SITE_URL.
