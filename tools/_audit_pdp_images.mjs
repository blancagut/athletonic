// Read-only audit: verify each generated PDP renders every non-blocked, deduped
// DB image. Replicates the generator's imageKey() + isBlockedImage() logic.
import { execFileSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";

const DB = "output/data/products.db";
const blockedImageFragments = ["no-image", "placeholder", "missing-image"];

function imageKey(url) {
  return String(url ?? "")
    .split("?")[0]
    .replace(/_[0-9]+x[0-9]+(?=\.)/i, "")
    .replace(/_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?=\.)/gi, "")
    .toLowerCase();
}
function isBlockedImage(url) {
  const n = String(url ?? "").toLowerCase();
  return blockedImageFragments.some((f) => n.includes(f));
}
function sql(q) {
  return execFileSync("sqlite3", ["-noheader", "-separator", "\t", DB, q], {
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 64,
  });
}

// Sample: 1509 + 20 random PUBLISHED products (PDP exists) among those with the
// highest image counts. Unpublished products (not in the search index) have no
// PDP by design and are out of scope for a "missing photos on a page" audit.
const candidates = sql(
  "SELECT product_row_id FROM images GROUP BY product_row_id HAVING COUNT(*) >= 15;"
)
  .trim()
  .split("\n")
  .map((s) => Number(s.trim()))
  .filter(Boolean)
  .filter((id) => existsSync(`product/${id}.html`));

// deterministic-ish shuffle
const sample = new Set([1509]);
const pool = [...candidates];
for (let i = pool.length - 1; i > 0; i--) {
  const j = Math.floor(Math.random() * (i + 1));
  [pool[i], pool[j]] = [pool[j], pool[i]];
}
for (const id of pool) {
  if (sample.size >= 21) break;
  sample.add(id);
}

const ids = [...sample];
const rows = [];
let mismatches = 0;
for (const id of ids) {
  const urls = sql(
    `SELECT url FROM images WHERE product_row_id=${id} AND url IS NOT NULL;`
  )
    .trim()
    .split("\n")
    .filter(Boolean);
  const keys = new Set();
  for (const u of urls) {
    if (isBlockedImage(u)) continue;
    const k = imageKey(u);
    if (k) keys.add(k);
  }
  const dbDeduped = keys.size;

  const file = `product/${id}.html`;
  let rendered = 0;
  let mainPresent = false;
  if (existsSync(file)) {
    const htmlText = readFileSync(file, "utf8");
    rendered = (htmlText.match(/data-pdp-thumb/g) || []).length;
    mainPresent = /id="pdp-main-image"/.test(htmlText);
  }
  // single-image PDPs render the main image but no thumb strip
  const renderedEffective = rendered === 0 && mainPresent ? 1 : rendered;
  const ok = renderedEffective >= dbDeduped;
  if (!ok) mismatches++;
  rows.push({ id, dbDeduped, rendered: renderedEffective, status: ok ? "OK" : "MISMATCH" });
}

rows.sort((a, b) => b.dbDeduped - a.dbDeduped);
console.log("id\tDB(deduped)\trenderedThumbs\tstatus");
for (const r of rows) {
  console.log(`${r.id}\t${r.dbDeduped}\t${r.rendered}\t${r.status}`);
}
console.log(`\nSamples: ${rows.length}  Mismatches: ${mismatches}`);
process.exit(mismatches > 0 ? 1 : 0);
