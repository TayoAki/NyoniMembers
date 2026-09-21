#!/usr/bin/env node
/**
 * Capture Nyoni Couture brand material and catalogue for the members app.
 *
 * Runs from a machine with normal internet access (the research sandbox could not reach the site).
 *
 *   FIRECRAWL_API_KEY=fc-... node scripts/capture-nyoni.mjs            # pages + branding + screenshots + catalogue
 *   node scripts/capture-nyoni.mjs --no-firecrawl                       # catalogue only (WooCommerce Store API, no key needed)
 *   node scripts/capture-nyoni.mjs --images                             # also download product images
 *
 * Output goes to research/nyoni/:
 *   map.json                 every URL Firecrawl found on the site
 *   pages/<slug>.md          markdown of each key page
 *   pages/<slug>.png         full-page screenshot of each key page
 *   branding.json            colours, fonts and logo as detected by Firecrawl's branding format (if supported)
 *   woo-products.json        WooCommerce Store API products (public endpoint)
 *   woo-categories.json      WooCommerce Store API categories
 *   images/<id>-<n>.<ext>    product images (with --images)
 *
 * Node 20+ only; no dependencies.
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const SITE = "https://nyonicouture.com";
const FIRECRAWL = "https://api.firecrawl.dev/v2";
const OUT = path.resolve("research/nyoni");
const args = new Set(process.argv.slice(2));
const wantImages = args.has("--images");
const useFirecrawl = !args.has("--no-firecrawl") && Boolean(process.env.FIRECRAWL_API_KEY);

const KEY_PAGES = [
  ["home", "/"],
  ["about-us", "/about-us/"],
  ["membership", "/membership/"],
  ["made-to-measure", "/made-to-measure/"],
  ["size-guide", "/size-guide/"],
  ["virtual-appointment", "/virtual-appointment/"],
  ["reserve-in-store", "/reserve-in-store/"],
  ["shop", "/shop/"],
  ["contact-us", "/contact-us/"],
  ["refund-policies", "/refund-policies/"],
  ["terms-and-conditions", "/terms-and-conditions/"],
];

async function main() {
  await mkdir(path.join(OUT, "pages"), { recursive: true });
  if (useFirecrawl) await captureWithFirecrawl();
  else console.log("Firecrawl skipped (no FIRECRAWL_API_KEY or --no-firecrawl).");
  await captureWooCommerce();
  console.log(`Done. Output in ${OUT}`);
}

async function firecrawl(endpoint, body) {
  const res = await fetch(`${FIRECRAWL}${endpoint}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.FIRECRAWL_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.success === false) {
    throw new Error(`Firecrawl ${endpoint} failed (${res.status}): ${json.error ?? JSON.stringify(json).slice(0, 200)}`);
  }
  return json;
}

async function captureWithFirecrawl() {
  console.log("Firecrawl: mapping site…");
  const map = await firecrawl("/map", { url: SITE, limit: 1000 });
  await writeFile(path.join(OUT, "map.json"), JSON.stringify(map, null, 2));
  console.log(`  ${map.links?.length ?? 0} URLs`);

  for (const [slug, route] of KEY_PAGES) {
    const url = `${SITE}${route}`;
    console.log(`Firecrawl: scraping ${url}`);
    const formats = ["markdown", "links", { type: "screenshot", fullPage: true }];
    if (slug === "home") formats.push("branding");
    let result;
    try {
      result = await firecrawl("/scrape", { url, formats, onlyMainContent: false, waitFor: 1500 });
    } catch (error) {
      if (slug === "home" && String(error).includes("branding")) {
        console.log("  branding format not supported by this API version; retrying without it");
        result = await firecrawl("/scrape", { url, formats: formats.filter((f) => f !== "branding"), onlyMainContent: false });
      } else {
        console.warn(`  skipped: ${error.message}`);
        continue;
      }
    }
    const data = result.data ?? result;
    if (data.markdown) await writeFile(path.join(OUT, "pages", `${slug}.md`), data.markdown);
    if (data.links) await writeFile(path.join(OUT, "pages", `${slug}.links.json`), JSON.stringify(data.links, null, 2));
    if (data.screenshot) await saveScreenshot(slug, data.screenshot);
    if (data.branding) await writeFile(path.join(OUT, "branding.json"), JSON.stringify(data.branding, null, 2));
  }
}

async function saveScreenshot(slug, screenshot) {
  const file = path.join(OUT, "pages", `${slug}.png`);
  if (screenshot.startsWith("http")) {
    const res = await fetch(screenshot);
    await writeFile(file, Buffer.from(await res.arrayBuffer()));
  } else {
    await writeFile(file, Buffer.from(screenshot.replace(/^data:image\/\w+;base64,/, ""), "base64"));
  }
}

async function captureWooCommerce() {
  console.log("WooCommerce Store API: fetching categories and products…");
  const categories = await getJson(`${SITE}/wp-json/wc/store/v1/products/categories?per_page=100`);
  await writeFile(path.join(OUT, "woo-categories.json"), JSON.stringify(categories, null, 2));
  console.log(`  ${categories.length} categories`);

  const products = [];
  for (let page = 1; page <= 50; page++) {
    const batch = await getJson(`${SITE}/wp-json/wc/store/v1/products?per_page=100&page=${page}`);
    if (!Array.isArray(batch) || batch.length === 0) break;
    products.push(...batch);
    if (batch.length < 100) break;
  }
  const slim = products.map((p) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    permalink: p.permalink,
    categories: (p.categories ?? []).map((c) => c.slug),
    tags: (p.tags ?? []).map((t) => t.slug),
    priceUsd: p.prices ? Number(p.prices.price) / 10 ** (p.prices.currency_minor_unit ?? 2) : undefined,
    onSale: p.on_sale,
    inStock: p.is_in_stock,
    shortDescription: stripHtml(p.short_description),
    description: stripHtml(p.description),
    attributes: (p.attributes ?? []).map((a) => ({ name: a.name, terms: (a.terms ?? []).map((t) => t.name) })),
    images: (p.images ?? []).map((i) => ({ id: i.id, src: i.src, alt: i.alt })),
  }));
  await writeFile(path.join(OUT, "woo-products.json"), JSON.stringify(slim, null, 2));
  console.log(`  ${slim.length} products`);

  if (wantImages) {
    await mkdir(path.join(OUT, "images"), { recursive: true });
    let n = 0;
    for (const p of slim) {
      for (const [i, img] of p.images.entries()) {
        const ext = (new URL(img.src).pathname.split(".").pop() || "jpg").toLowerCase();
        const res = await fetch(img.src);
        if (!res.ok) continue;
        await writeFile(path.join(OUT, "images", `${p.id}-${i}.${ext}`), Buffer.from(await res.arrayBuffer()));
        n++;
      }
    }
    console.log(`  ${n} images downloaded`);
  }
}

async function getJson(url) {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}. If the Store API is disabled, use /wp-json/wc/v3/products with a read-only consumer key instead.`);
  return res.json();
}

function stripHtml(html) {
  return String(html ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
