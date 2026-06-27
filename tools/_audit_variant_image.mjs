// Read-only: extract the embedded gallery metadata from a generated PDP and
// simulate the client-side pickVariantImage() to verify variant -> image match.
import { readFileSync } from "node:fs";

const file = process.argv[2] || "product/1509.html";
const htmlText = readFileSync(file, "utf8");

const m = htmlText.match(/var galleryImages = (\[[\s\S]*?\]);/);
if (!m) { console.error("galleryImages not found"); process.exit(2); }
const galleryImages = JSON.parse(m[1].replace(/\\u003c/g, "<"));

function variantValueGroup(value) {
  const words = String(value == null ? "" : value).toLowerCase().match(/[a-z0-9]+/g) || [];
  return { compact: words.join(""), words: words.filter((w) => w.length >= 3) };
}
function pickVariantImage(values) {
  if (!galleryImages.length) return null;
  const groups = values.map(variantValueGroup).filter((g) => g.compact);
  if (!groups.length) return null;
  let best = null, bestScore = 0;
  galleryImages.forEach((img) => {
    const blob = img.t || "";
    if (!blob) return;
    let score = 0;
    groups.forEach((group) => {
      if (group.compact && blob.indexOf(group.compact) !== -1) { score += 2; return; }
      const wordHit = group.words.some((w) => w.length >= 3 && blob.indexOf(w) !== -1);
      if (wordHit) score += 1;
    });
    if (score > bestScore) { bestScore = score; best = img.src; }
  });
  return bestScore > 0 ? best : null;
}

console.log("galleryImages count:", galleryImages.length);
const tests = [
  ["Extreme Milk Chocolate", "5 lb"],
  ["Extreme Milk Chocolate", "2 lb"],
  ["Double Rich Chocolate", "5 lb"],
  ["Vanilla Ice Cream", "1 lb"],
];
for (const t of tests) {
  const src = pickVariantImage(t);
  console.log(`\n[${t.join(" + ")}] ->`, src ? src.split("/").pop() : "(default / no match -> keeps current)");
}

// Show which gallery tokens contain the EXTMILKCHOC / 5LB signals
console.log("\n-- images whose token carries milk-chocolate signal --");
galleryImages
  .filter((g) => /extmilkchoc|extrememilkchocolate|milkchoc/.test(g.t || ""))
  .slice(0, 10)
  .forEach((g) => console.log(g.src.split("/").pop(), "| token:", g.t));
