// Deterministic audit: extract embedded PDP gallery + variant data and assert a
// lightweight sample of variant selections still resolves to the intended image.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const SAMPLE_CASES = {
  "product/443.html": [
    { selectedOptions: { Flavor: "Tangerine" } },
    { selectedOptions: { Flavor: "Blue Raspberry" } },
    { selectedOptions: { Flavor: "Sour Watermelon" } },
  ],
  "product/480.html": [
    { selectedOptions: { Flavor: "Blue Raspberry" } },
    { selectedOptions: { Flavor: "Sour Watermelon" } },
    { selectedOptions: { Flavor: "Champion Mentality" } },
  ],
  "product/109.html": [
    { selectedOptions: { Flavor: "Red Gummy Fish" } },
    { selectedOptions: { Flavor: "Blue Raspberry" } },
    { selectedOptions: { Flavor: "Mouthwatering Watermelon" } },
  ],
  "product/1509.html": [
    { selectedOptions: { Flavor: "Double Rich Chocolate", Size: "2 lb" } },
    { selectedOptions: { Flavor: "Extreme Milk Chocolate", Size: "5 lb" } },
    { selectedOptions: { Flavor: "Vanilla Ice Cream", Size: "2 lb" } },
  ],
};

function parseJsonAssignment(htmlText, variableName) {
  const escapedName = variableName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = htmlText.match(new RegExp(`var ${escapedName} = (\\[[\\s\\S]*?\\]);`));
  assert.ok(match, `${variableName} not found`);
  return JSON.parse(match[1].replace(/\\u003c/g, "<"));
}

function parseVariantSelectOrder(htmlText) {
  const order = [];
  const selectRe =
    /<select\b[^>]*data-pdp-variant\b[^>]*data-variant-name="([^"]+)"[^>]*>/gi;
  let match;
  while ((match = selectRe.exec(htmlText))) {
    order.push(match[1]);
  }
  return order;
}

function variantValueGroup(value) {
  const words = String(value == null ? "" : value).toLowerCase().match(/[a-z0-9]+/g) || [];
  return { compact: words.join(""), words: words.filter((w) => w.length >= 3) };
}
function pickVariantImage(galleryImages, values) {
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

function resolveVariant(variantPricing, selectedOptions) {
  return variantPricing.find((variant) =>
    Object.entries(selectedOptions).every(
      ([name, value]) => variant.selected_options && variant.selected_options[name] === value
    )
  );
}

const requestedFile = process.argv[2];
const files = requestedFile
  ? [requestedFile]
  : Object.keys(SAMPLE_CASES);

let failures = 0;
for (const file of files) {
  const htmlText = readFileSync(file, "utf8");
  const galleryImages = parseJsonAssignment(htmlText, "galleryImages");
  const variantPricing = parseJsonAssignment(htmlText, "variantPricing");
  const selectOrder = parseVariantSelectOrder(htmlText);
  const cases = SAMPLE_CASES[file];

  if (!cases) {
    console.error(`No deterministic audit cases configured for ${file}`);
    failures++;
    continue;
  }

  console.log(`\n${file} (${galleryImages.length} gallery images)`);
  for (const auditCase of cases) {
    try {
      const variant = resolveVariant(variantPricing, auditCase.selectedOptions);
      assert.ok(variant, `variant not found for ${JSON.stringify(auditCase.selectedOptions)}`);
      assert.ok(variant.image_url, `variant has no image for ${JSON.stringify(auditCase.selectedOptions)}`);
      const selectedValues = selectOrder
        .map((name) => auditCase.selectedOptions[name])
        .filter(Boolean);
      const actual = pickVariantImage(galleryImages, selectedValues);
      assert.equal(
        actual,
        variant.image_url,
        `${path.basename(file)} ${JSON.stringify(auditCase.selectedOptions)} resolved ${actual} instead of ${variant.image_url}`
      );
      console.log(`PASS ${JSON.stringify(auditCase.selectedOptions)} -> ${path.basename(actual)}`);
    } catch (error) {
      failures++;
      console.error(`FAIL ${file} ${JSON.stringify(auditCase.selectedOptions)}\n${error.message}`);
    }
  }
}

if (failures > 0) {
  process.exitCode = 1;
}
