/* ============================================================
 *  Shared i18n build helpers
 *
 *  Single source of truth for the Spanish dictionary lives in
 *  data/i18n-es.json. Both the client runtime (assets/i18n.js, via
 *  build-time injection between markers) and the static /es/ page
 *  generator consume it from here.
 *
 *  The build-time translator mirrors the runtime exactly: it only
 *  replaces a text node / attribute when its ENTIRE trimmed text
 *  equals a known English key. Long-form product copy is therefore
 *  never garbled.
 * ============================================================ */
import { readFileSync } from "node:fs";

const DICT_URL = new URL("../../data/i18n-es.json", import.meta.url);

export function loadEsDict() {
  return JSON.parse(readFileSync(DICT_URL, "utf8"));
}

/* ------------------------------------------------------------
 *  HTML entity helpers
 * ---------------------------------------------------------- */
const NAMED = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  "#39": "'",
  nbsp: "\u00a0",
};

export function decodeEntities(s) {
  return s.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g, (m, e) => {
    if (e[0] === "#") {
      const code =
        e[1] === "x" || e[1] === "X"
          ? parseInt(e.slice(2), 16)
          : parseInt(e.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return Object.prototype.hasOwnProperty.call(NAMED, e) ? NAMED[e] : m;
  });
}

/* Re-encode the minimal set used by the source pages (& < >). */
export function encodeText(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function encodeAttr(s, quote) {
  let out = encodeText(s);
  if (quote === '"') out = out.replace(/"/g, "&quot;");
  else out = out.replace(/'/g, "&#39;");
  return out;
}

/* ------------------------------------------------------------
 *  Build-time translator (exact whole-text-node + attribute)
 * ---------------------------------------------------------- */
const TRANSLATABLE_ATTRS = /(?<![\w-])(aria-label|placeholder|title)\s*=\s*("([^"]*)"|'([^']*)')/gi;
const SKIP_TEXT_TAGS = new Set(["script", "style", "textarea"]);

function translateAttrs(tag, dict) {
  return tag.replace(TRANSLATABLE_ATTRS, (m, name, _full, dq, sq) => {
    const isDouble = dq !== undefined;
    const raw = isDouble ? dq : sq;
    const quote = isDouble ? '"' : "'";
    const key = decodeEntities(raw).trim();
    if (Object.prototype.hasOwnProperty.call(dict, key)) {
      return `${name}=${quote}${encodeAttr(dict[key], quote)}${quote}`;
    }
    return m;
  });
}

function translateTextRun(text, dict) {
  const lead = text.match(/^\s*/)[0];
  const trail = text.match(/\s*$/)[0];
  const core = text.slice(lead.length, text.length - trail.length);
  if (!core) return text;
  const key = decodeEntities(core);
  if (Object.prototype.hasOwnProperty.call(dict, key)) {
    return lead + encodeText(dict[key]) + trail;
  }
  return text;
}

/**
 * Translate an HTML document string EN -> ES using exact matching.
 * Mirrors assets/i18n.js: only whole-text-nodes and the
 * aria-label / placeholder / title attributes are translated.
 */
export function translateHtml(html, dict) {
  let out = "";
  let i = 0;
  const n = html.length;
  let skipTag = null; // lowercase tag name we are inside (script/style/textarea)

  while (i < n) {
    const lt = html.indexOf("<", i);
    if (lt === -1) {
      out += skipTag ? html.slice(i) : translateTextRun(html.slice(i), dict);
      break;
    }
    if (lt > i) {
      const text = html.slice(i, lt);
      out += skipTag ? text : translateTextRun(text, dict);
      i = lt;
    }

    // Comment / CDATA / doctype handling
    if (html.startsWith("<!--", i)) {
      const end = html.indexOf("-->", i + 4);
      const stop = end === -1 ? n : end + 3;
      out += html.slice(i, stop);
      i = stop;
      continue;
    }

    // Scan to end of tag, respecting quoted attribute values
    let j = i + 1;
    let q = null;
    while (j < n) {
      const c = html[j];
      if (q) {
        if (c === q) q = null;
      } else if (c === '"' || c === "'") {
        q = c;
      } else if (c === ">") {
        break;
      }
      j++;
    }
    const tag = html.slice(i, Math.min(j + 1, n));
    i = j + 1;

    const nameMatch = tag.match(/^<\s*(\/?)([a-zA-Z][\w-]*)/);
    const closing = nameMatch ? nameMatch[1] === "/" : false;
    const tagName = nameMatch ? nameMatch[2].toLowerCase() : "";

    if (skipTag) {
      out += tag;
      if (closing && tagName === skipTag) skipTag = null;
      continue;
    }

    // Translate relevant attributes on normal (start) tags
    out += closing ? tag : translateAttrs(tag, dict);

    const selfClosed = /\/>$/.test(tag.trim());
    if (!closing && !selfClosed && SKIP_TEXT_TAGS.has(tagName)) {
      skipTag = tagName;
    }
  }
  return out;
}

/* ------------------------------------------------------------
 *  Link / asset URL localization for /es/ pages
 * ---------------------------------------------------------- */
const SKIP_URL = /^(https?:|\/\/|mailto:|tel:|data:|javascript:|#)/i;

function localizeOneUrl(u, baseDir) {
  if (!u || SKIP_URL.test(u)) return null;
  let resolved;
  try {
    resolved = new URL(u, "https://h" + baseDir);
  } catch {
    return null;
  }
  const path = resolved.pathname;
  const tail = resolved.search + resolved.hash;
  if (path === "/") return "/es/" + tail;
  if (/^\/pages\/[^/]+\.html$/.test(path)) return "/es" + path + tail;
  // Assets and English-only routes (product/*, /wholesale-application, css,
  // js, images, favicon, manifest) become absolute root paths so they load
  // regardless of the /es/ directory depth.
  return path + tail;
}

/**
 * Rewrite href/src/action attributes of an HTML string so the page can
 * live under /es/. baseDir is the directory of the SOURCE English page
 * (e.g. "/pages/" or "/").
 */
export function localizeUrls(html, baseDir) {
  return html.replace(
    /(\b(?:href|src|action)\s*=\s*)("([^"]*)"|'([^']*)')/gi,
    (m, lead, _full, dq, sq) => {
      const isDouble = dq !== undefined;
      const raw = isDouble ? dq : sq;
      const quote = isDouble ? '"' : "'";
      const next = localizeOneUrl(raw, baseDir);
      if (next === null) return m;
      return `${lead}${quote}${next}${quote}`;
    }
  );
}

/* ------------------------------------------------------------
 *  hreflang + canonical helpers
 * ---------------------------------------------------------- */
export function esPathFor(enPath) {
  if (enPath === "/" || enPath === "/index.html") return "/es/";
  return "/es" + enPath;
}

export function hreflangBlock(enPath, origin) {
  const esPath = esPathFor(enPath);
  const en = origin + enPath;
  const es = origin + esPath;
  return (
    `<!-- hreflang:start -->\n` +
    `    <link rel="alternate" hreflang="en" href="${en}" />\n` +
    `    <link rel="alternate" hreflang="es" href="${es}" />\n` +
    `    <link rel="alternate" hreflang="x-default" href="${en}" />\n` +
    `    <!-- hreflang:end -->`
  );
}

/**
 * Insert (or refresh) the reciprocal hreflang block in a document head.
 * Idempotent: replaces an existing block, otherwise inserts after the
 * canonical link (falling back to after </title>).
 */
export function injectHreflang(html, enPath, origin) {
  const block = hreflangBlock(enPath, origin);
  if (/<!-- hreflang:start -->[\s\S]*?<!-- hreflang:end -->/.test(html)) {
    return html.replace(
      /<!-- hreflang:start -->[\s\S]*?<!-- hreflang:end -->/,
      block
    );
  }
  const canonical = html.match(/<link rel="canonical"[^>]*\/>/);
  if (canonical) {
    return html.replace(canonical[0], canonical[0] + "\n    " + block);
  }
  return html.replace(/<\/title>/i, "</title>\n    " + block);
}

/**
 * Produce the Spanish /es/ HTML for an English source document.
 *  - translate chrome + category copy (exact match)
 *  - rewrite asset/link URLs for the /es/ tree
 *  - set <html lang="es">, self-canonical to the /es/ URL
 *  - ensure reciprocal hreflang
 */
export function toSpanishHtml(html, { enPath, baseDir, dict, origin }) {
  let out = translateHtml(html, dict);
  out = localizeUrls(out, baseDir);
  out = out.replace(/<html\b[^>]*\blang\s*=\s*"[^"]*"/i, (m) =>
    m.replace(/lang\s*=\s*"[^"]*"/i, 'lang="es"')
  );
  if (!/\blang\s*=\s*"/.test(out.slice(0, 200))) {
    out = out.replace(/<html\b/i, '<html lang="es"');
  }
  const esUrl = origin + esPathFor(enPath);
  out = out.replace(
    /<link rel="canonical"[^>]*\/>/,
    `<link rel="canonical" href="${esUrl}" />`
  );
  out = injectHreflang(out, enPath, origin);
  return out;
}
