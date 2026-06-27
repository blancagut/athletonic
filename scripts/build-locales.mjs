/* ============================================================
 *  build-locales.mjs
 *
 *  Emits the Spanish (/es/) static layer for SEO:
 *   - /es/index.html and /es/pages/*.html with translated chrome +
 *     category copy, <html lang="es">, self-canonical, absolute asset
 *     paths, and /es/ internal links.
 *   - reciprocal hreflang (en <-> es <-> x-default) injected into the
 *     English sources AND the Spanish copies.
 *   - sitemap.xml rewritten to list both locales with xhtml:link
 *     alternates.
 *
 *  Product PDPs (product/*.html) stay English this phase and are not
 *  part of the locale set.
 *
 *  Run: npm run build:locales
 * ============================================================ */
import {
  readFileSync,
  writeFileSync,
  readdirSync,
  mkdirSync,
} from "node:fs";
import { fileURLToPath } from "node:url";
import { ATHLETONIC_SOURCE_OF_TRUTH } from "../src/source-of-truth/athletonic.mjs";
import { loadEsDict, toSpanishHtml, injectHreflang } from "./lib/i18n-shared.mjs";

const ROOT = new URL("../", import.meta.url);
const ORIGIN = `https://${ATHLETONIC_SOURCE_OF_TRUTH.marketplace.domain}`;
const dict = loadEsDict();

function abs(rel) {
  return fileURLToPath(new URL(rel, ROOT));
}

function ensureDir(rel) {
  mkdirSync(abs(rel), { recursive: true });
}

/* ------------------------------------------------------------
 *  1. Build the locale set: home + every static page
 * ---------------------------------------------------------- */
const targets = [{ src: "index.html", enPath: "/", baseDir: "/", out: "es/index.html" }];

for (const file of readdirSync(abs("pages")).sort()) {
  if (!file.endsWith(".html")) continue;
  targets.push({
    src: `pages/${file}`,
    enPath: `/pages/${file}`,
    baseDir: "/pages/",
    out: `es/pages/${file}`,
  });
}

ensureDir("es/pages");

let written = 0;
for (const t of targets) {
  const original = readFileSync(abs(t.src), "utf8");

  // Inject reciprocal hreflang into the English source (idempotent).
  const english = injectHreflang(original, t.enPath, ORIGIN);
  if (english !== original) writeFileSync(abs(t.src), english);

  // Emit the Spanish copy.
  const spanish = toSpanishHtml(english, {
    enPath: t.enPath,
    baseDir: t.baseDir,
    dict,
    origin: ORIGIN,
  });
  writeFileSync(abs(t.out), spanish);
  written++;
}

/* ------------------------------------------------------------
 *  2. Rewrite sitemap.xml with both locales + hreflang alternates
 * ---------------------------------------------------------- */
const sitemapPath = abs("sitemap.xml");
const sitemap = readFileSync(sitemapPath, "utf8");

const entries = [];
const seen = new Set();
const urlBlocks = sitemap.match(/<url>[\s\S]*?<\/url>/g) || [];
for (const block of urlBlocks) {
  const loc = (block.match(/<loc>([^<]+)<\/loc>/) || [])[1];
  if (!loc) continue;
  const trimmedLoc = loc.trim();
  // Idempotent: ignore any /es/ entries already present so re-runs don't
  // double-count or strip the English source set.
  if (trimmedLoc.startsWith(ORIGIN + "/es/")) continue;
  if (seen.has(trimmedLoc)) continue;
  seen.add(trimmedLoc);
  const lastmod = (block.match(/<lastmod>([^<]+)<\/lastmod>/) || [])[1];
  entries.push({ loc: trimmedLoc, lastmod: lastmod ? lastmod.trim() : null });
}

function esLocFor(loc) {
  const path = loc.slice(ORIGIN.length);
  if (path === "/" || path === "") return ORIGIN + "/es/";
  return ORIGIN + "/es" + path;
}

function urlBlock(loc, lastmod, enLoc, esLoc) {
  const lm = lastmod ? `\n    <lastmod>${lastmod}</lastmod>` : "";
  return (
    `  <url>\n` +
    `    <loc>${loc}</loc>${lm}\n` +
    `    <xhtml:link rel="alternate" hreflang="en" href="${enLoc}" />\n` +
    `    <xhtml:link rel="alternate" hreflang="es" href="${esLoc}" />\n` +
    `    <xhtml:link rel="alternate" hreflang="x-default" href="${enLoc}" />\n` +
    `  </url>`
  );
}

const blocks = [];
for (const e of entries) {
  const enLoc = e.loc;
  const esLoc = esLocFor(e.loc);
  blocks.push(urlBlock(enLoc, e.lastmod, enLoc, esLoc));
  blocks.push(urlBlock(esLoc, e.lastmod, enLoc, esLoc));
}

const newSitemap =
  `<?xml version="1.0" encoding="UTF-8"?>\n` +
  `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n` +
  `        xmlns:xhtml="http://www.w3.org/1999/xhtml">\n` +
  blocks.join("\n") +
  `\n</urlset>\n`;

writeFileSync(sitemapPath, newSitemap);

console.log(
  `build-locales: wrote ${written} /es/ pages; sitemap has ${entries.length} EN + ${entries.length} ES urls.`
);
