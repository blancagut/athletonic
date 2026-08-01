import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  SUPPLEMENT_WHOLESALE_BRANDS,
  isNonSupplementCatalogProduct,
  normalizeSupplementSizeLabel,
} = require("../api/_lib/wholesale-supplements.js");

const root = process.cwd();
const dbPath = path.join(root, "output", "data", "products.db");
const manifestPath = path.join(root, "data", "wholesale-supplements-catalog.json");
const SIZE_NAME_RE = /size|weight|count|servings?|quantity|pack|amount/i;
const FLAVOR_NAME_RE = /flavor|flavour|taste/i;

const slug = (value) => String(value || "standard").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const cents = (value) => Math.round(Number(value || 0) * 100);
const listPrice = (variant) => {
  const price = Number(variant.price || 0);
  const compareAt = Number(variant.compare_at_price || 0);
  return compareAt > price ? compareAt : price;
};
const sqlList = (values) => [...values].map((value) => `'${String(value).replaceAll("'", "''")}'`).join(",");

function optionDefinitions(value) {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function inferWeight(value) {
  const match = String(value || "").match(/\b(\d+(?:\.\d+)?)\s*(lbs?|kg|oz|g)\b/i);
  return match ? normalizeSupplementSizeLabel(`${match[1]} ${match[2]}`) : "";
}

function cleanFlavor(value) {
  return String(value || "")
    .replace(/\s+\d+(?:\.\d+)?\s*(?:lbs?|kg|oz|g)\.?$/i, "")
    .trim();
}

const rows = JSON.parse(execFileSync("sqlite3", [
  "-readonly",
  "-json",
  dbPath,
  `select p.product_id, lower(p.brand) as brand_slug, p.name, p.options,
          v.variant_id, v.title, v.option1, v.option2, v.option3,
          v.price, v.compare_at_price, v.available
     from products p
     join variants v on v.product_row_id = p.id
    where p.excluded = 0
      and lower(p.brand) in (${sqlList(SUPPLEMENT_WHOLESALE_BRANDS)})`,
], { encoding: "utf8", maxBuffer: 128 * 1024 * 1024 }) || "[]");

const variantsByProduct = new Map();
for (const row of rows) {
  const key = `${row.brand_slug}::${row.product_id}`;
  if (!variantsByProduct.has(key)) variantsByProduct.set(key, []);
  variantsByProduct.get(key).push(row);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const rebuilt = [];
for (const product of manifest.products) {
  if (!SUPPLEMENT_WHOLESALE_BRANDS.has(product.brand_slug) || product.brand_slug === "optimum_nutrition") {
    rebuilt.push(product);
    continue;
  }

  const sourceVariants = variantsByProduct.get(`${product.brand_slug}::${product.id}`) || [];
  const activeVariants = sourceVariants.filter((variant) => Number(variant.available) === 1 && listPrice(variant) > 0);
  if (!activeVariants.length) continue;

  const definitions = optionDefinitions(activeVariants[0].options);
  const sizeIndex = definitions.findIndex((option) => SIZE_NAME_RE.test(String(option?.name || "")));
  const flavorIndex = definitions.findIndex((option) => FLAVOR_NAME_RE.test(String(option?.name || "")));
  const bySize = new Map();

  for (const variant of activeVariants) {
    const values = [variant.option1, variant.option2, variant.option3].map((value) => String(value || "").trim());
    let size = sizeIndex >= 0 ? normalizeSupplementSizeLabel(values[sizeIndex]) : "";
    if (!size) size = inferWeight(`${variant.title || ""} ${product.name || ""}`);
    const rawFlavor = flavorIndex >= 0 ? values[flavorIndex] : "";
    let flavor = cleanFlavor(rawFlavor);
    if (!flavor && sizeIndex < 0 && flavorIndex < 0 && !/^default/i.test(String(variant.title || ""))) {
      flavor = cleanFlavor(variant.title);
    }
    const groupKey = size || "Standard";
    if (!bySize.has(groupKey)) bySize.set(groupKey, []);
    bySize.get(groupKey).push({
      id: String(variant.variant_id),
      selected_options: {
        ...(flavor ? { Flavor: flavor } : {}),
        ...(size ? { Size: size } : {}),
      },
      retail_price_cents: cents(listPrice(variant)),
      available: true,
      image_url: product.image_url,
    });
  }

  for (const [size, variants] of bySize) {
    const uniqueVariants = [...new Map(variants.map((variant) => [JSON.stringify(variant.selected_options), variant])).values()];
    const hasSize = size !== "Standard";
    const nameHasSize = hasSize && inferWeight(product.name) === size;
    rebuilt.push({
      ...product,
      id: `${product.id}-${slug(size)}`,
      name: hasSize && !nameHasSize ? `${product.name} - ${size}` : product.name,
      available: true,
      availability_status: "Available",
      retail_price_cents: uniqueVariants[0].retail_price_cents,
      sizes: hasSize ? [size] : [],
      colors: [...new Set(uniqueVariants.map((variant) => variant.selected_options.Flavor).filter(Boolean))],
      other_options: [],
      variant_count: uniqueVariants.length,
      variants: uniqueVariants,
    });
  }
}

manifest.products = rebuilt.filter((product) => !isNonSupplementCatalogProduct(product)).sort((a, b) =>
  String(a.brand).localeCompare(String(b.brand), undefined, { sensitivity: "base" }) ||
  String(a.name).localeCompare(String(b.name), undefined, { sensitivity: "base", numeric: true })
);
manifest.generated_at = new Date().toISOString();
manifest.product_count = manifest.products.length;
manifest.priced_count = manifest.products.filter((product) => Number.isInteger(product.retail_price_cents)).length;
fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 1)}\n`);

const performanceRows = manifest.products.filter((product) => SUPPLEMENT_WHOLESALE_BRANDS.has(product.brand_slug));
console.log(`Published ${performanceRows.length} active size-specific performance rows.`);
