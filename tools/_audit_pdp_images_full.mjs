// Read-only FULL sweep: for EVERY published PDP (product/<id>.html that exists),
// verify rendered thumbnails >= deduped non-blocked DB images. Reports only the
// products where a PDP drops images that exist in the DB.
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

// Pull every (product_row_id, url) once, stream-grouped.
const raw = execFileSync(
  "sqlite3",
  ["-noheader", "-separator", "\t", DB,
   "SELECT product_row_id, url FROM images WHERE url IS NOT NULL ORDER BY product_row_id;"],
  { encoding: "utf8", maxBuffer: 1024 * 1024 * 512 }
);

const dedupByProduct = new Map(); // id -> Set(keys)
for (const line of raw.split("\n")) {
  if (!line) continue;
  const tab = line.indexOf("\t");
  if (tab < 0) continue;
  const id = line.slice(0, tab);
  const url = line.slice(tab + 1);
  if (isBlockedImage(url)) continue;
  const k = imageKey(url);
  if (!k) continue;
  let set = dedupByProduct.get(id);
  if (!set) { set = new Set(); dedupByProduct.set(id, set); }
  set.add(k);
}

let checked = 0;
let mismatches = [];
for (const [id, keys] of dedupByProduct) {
  const file = `product/${id}.html`;
  if (!existsSync(file)) continue; // unpublished -> no PDP, out of scope
  checked++;
  const htmlText = readFileSync(file, "utf8");
  const rendered = (htmlText.match(/data-pdp-thumb/g) || []).length;
  const mainPresent = /id="pdp-main-image"/.test(htmlText);
  const renderedEffective = rendered === 0 && mainPresent ? 1 : rendered;
  if (renderedEffective < keys.size) {
    mismatches.push({ id, db: keys.size, rendered: renderedEffective });
  }
}

console.log(`Published PDPs checked: ${checked}`);
console.log(`Products where rendered < DB deduped images: ${mismatches.length}`);
if (mismatches.length) {
  mismatches.sort((a, b) => (b.db - b.rendered) - (a.db - a.rendered));
  console.log("\nid\tDB(deduped)\trendered");
  for (const m of mismatches.slice(0, 50)) {
    console.log(`${m.id}\t${m.db}\t${m.rendered}`);
  }
}
process.exit(mismatches.length ? 1 : 0);
