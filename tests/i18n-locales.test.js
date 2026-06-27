import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  loadEsDict,
  translateHtml,
  localizeUrls,
  toSpanishHtml,
  injectHreflang,
  esPathFor,
} from "../scripts/lib/i18n-shared.mjs";

const dict = loadEsDict();
const ORIGIN = "https://athletonic.com";

test("dictionary loads with entries", () => {
  assert.ok(Object.keys(dict).length > 100);
  assert.equal(dict["Protein"], "Proteína");
});

test("translateHtml replaces whole text nodes only", () => {
  const out = translateHtml("<h2>Protein</h2>", dict);
  assert.equal(out, "<h2>Proteína</h2>");

  // Partial / unknown text is never touched.
  const keep = translateHtml("<p>Protein powder blend for athletes</p>", dict);
  assert.equal(keep, "<p>Protein powder blend for athletes</p>");
});

test("translateHtml decodes and re-encodes ampersand entities", () => {
  const out = translateHtml("<h4>Recovery &amp; Sleep</h4>", dict);
  assert.equal(out, "<h4>Recuperación y sueño</h4>");
});

test("translateHtml translates aria-label/placeholder/title only", () => {
  const out = translateHtml('<button aria-label="Open cart">x</button>', dict);
  assert.match(out, /aria-label="Abrir carrito"/);

  // data-* and other attributes are left intact.
  const data = translateHtml('<i data-search="Protein"></i>', dict);
  assert.equal(data, '<i data-search="Protein"></i>');
});

test("translateHtml skips script and style content", () => {
  const out = translateHtml("<script>var x = 'Protein';</script>", dict);
  assert.equal(out, "<script>var x = 'Protein';</script>");
});

test("localizeUrls rewrites assets to absolute and pages to /es/", () => {
  const out = localizeUrls(
    '<a href="../pages/protein.html"></a><img src="../assets/logo.png"><a href="../"></a><script src="../assets/cart.js"></script><a href="../product/1.html"></a>',
    "/pages/"
  );
  assert.match(out, /href="\/es\/pages\/protein\.html"/);
  assert.match(out, /src="\/assets\/logo\.png"/);
  assert.match(out, /href="\/es\/"/);
  assert.match(out, /src="\/assets\/cart\.js"/);
  // Product pages stay English (absolute root, not /es/).
  assert.match(out, /href="\/product\/1\.html"/);
});

test("localizeUrls leaves external and anchor links alone", () => {
  const out = localizeUrls(
    '<a href="https://x.com"></a><a href="#top"></a><a href="mailto:a@b.com"></a>',
    "/pages/"
  );
  assert.match(out, /href="https:\/\/x\.com"/);
  assert.match(out, /href="#top"/);
  assert.match(out, /href="mailto:a@b\.com"/);
});

test("esPathFor maps home and pages", () => {
  assert.equal(esPathFor("/"), "/es/");
  assert.equal(esPathFor("/index.html"), "/es/");
  assert.equal(esPathFor("/pages/protein.html"), "/es/pages/protein.html");
});

test("injectHreflang is idempotent", () => {
  const html =
    '<head><link rel="canonical" href="https://athletonic.com/pages/protein.html" /></head>';
  const once = injectHreflang(html, "/pages/protein.html", ORIGIN);
  const twice = injectHreflang(once, "/pages/protein.html", ORIGIN);
  assert.equal(once, twice);
  assert.equal((once.match(/hreflang:start/g) || []).length, 1);
  assert.match(once, /hreflang="x-default" href="https:\/\/athletonic\.com\/pages\/protein\.html"/);
});

test("toSpanishHtml produces a valid /es/ document", () => {
  const html =
    '<!doctype html><html lang="en"><head>' +
    '<link rel="canonical" href="https://athletonic.com/pages/protein.html" />' +
    "</head><body><h2>Protein</h2>" +
    '<a class="brand" href="../" aria-label="Athletonic home"></a>' +
    "</body></html>";
  const out = toSpanishHtml(html, {
    enPath: "/pages/protein.html",
    baseDir: "/pages/",
    dict,
    origin: ORIGIN,
  });
  assert.match(out, /<html lang="es">/);
  assert.match(out, /<link rel="canonical" href="https:\/\/athletonic\.com\/es\/pages\/protein\.html" \/>/);
  assert.match(out, /<h2>Proteína<\/h2>/);
  assert.match(out, /aria-label="Inicio de Athletonic"/);
  assert.match(out, /href="\/es\/"/);
  assert.match(out, /hreflang="es"/);
});

test("inline i18n.js dictionary stays in sync with JSON", () => {
  const src = readFileSync(new URL("../assets/i18n.js", import.meta.url), "utf8");
  const block = src.match(/\/\* ES_DICT_START \*\/[\s\S]*?\/\* ES_DICT_END \*\//);
  assert.ok(block, "ES_DICT markers present");
  for (const [k, v] of Object.entries(dict)) {
    assert.ok(
      block[0].includes(JSON.stringify(k) + ": " + JSON.stringify(v)),
      `i18n.js missing entry for ${JSON.stringify(k)} — run npm run sync:i18n`
    );
  }
});
