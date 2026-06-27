/* ============================================================
 *  sync-i18n-dict.mjs
 *
 *  Regenerates the inline `var ES = {...}` block in assets/i18n.js
 *  from the single source of truth data/i18n-es.json, between the
 *  ES_DICT_START / ES_DICT_END markers. Keeping the dictionary inline
 *  (rather than fetched at runtime) avoids an extra request and the
 *  associated flash of untranslated content.
 *
 *  --check : verify the inline block is already in sync (exit 1 if not)
 *            without writing. Used by the test suite.
 *
 *  Run: npm run sync:i18n
 * ============================================================ */
import { readFileSync, writeFileSync } from "node:fs";

const I18N_PATH = new URL("../assets/i18n.js", import.meta.url);
const DICT_PATH = new URL("../data/i18n-es.json", import.meta.url);

function renderBlock(dict) {
  const lines = Object.keys(dict).map(
    (k) => `    ${JSON.stringify(k)}: ${JSON.stringify(dict[k])}`
  );
  return (
    `/* ES_DICT_START */\n` +
    `  var ES = {\n` +
    lines.join(",\n") +
    `\n  };\n` +
    `  /* ES_DICT_END */`
  );
}

const dict = JSON.parse(readFileSync(DICT_PATH, "utf8"));
const block = renderBlock(dict);
const src = readFileSync(I18N_PATH, "utf8");

const re = /\/\* ES_DICT_START \*\/[\s\S]*?\/\* ES_DICT_END \*\//;
if (!re.test(src)) {
  console.error("sync:i18n: ES_DICT markers not found in assets/i18n.js");
  process.exit(1);
}

const next = src.replace(re, block);
const check = process.argv.includes("--check");

if (check) {
  if (next !== src) {
    console.error(
      "sync:i18n: assets/i18n.js dictionary is OUT OF SYNC with data/i18n-es.json.\n" +
        "Run `npm run sync:i18n` and commit the result."
    );
    process.exit(1);
  }
  console.log("sync:i18n: in sync");
} else {
  if (next !== src) {
    writeFileSync(I18N_PATH, next);
    console.log(`sync:i18n: updated assets/i18n.js (${Object.keys(dict).length} keys)`);
  } else {
    console.log("sync:i18n: already in sync");
  }
}
