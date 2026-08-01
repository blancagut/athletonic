import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { humanizeSlug, stripHtml, toPriceCents } = require("../api/_lib/wholesale-muay-thai.js");
const {
  SUPPLEMENT_WHOLESALE_BRANDS,
  SUPPLEMENT_DEPARTMENTS,
  deriveSupplementCategory,
} = require("../api/_lib/wholesale-supplements.js");

const ROOT = process.cwd();
const DB_PATH = path.join(ROOT, "output", "data", "products.db");
const OUTPUT_PATH = path.join(ROOT, "data", "wholesale-supplements-catalog.json");

const BRAND_LABEL_OVERRIDES = {
  optimum_nutrition: "Optimum Nutrition",
  muscletech: "MuscleTech",
  animal_pak: "Animal",
  musclepharm: "MusclePharm",
  nutrabio: "NutraBio",
  pescience: "PEScience",
  jym: "JYM",
  kos: "KOS",
  owyn: "OWYN",
  mud_wtr: "MUD\\WTR",
  o_positiv: "O Positiv",
  jshealth_vitamins: "JSHealth Vitamins",
  maryruth_organics: "MaryRuth Organics",
  liquid_iv: "Liquid I.V.",
  drip_drop: "DripDrop",
  rtd_shakes: "RTD Shakes",
  tru_niagen: "Tru Niagen",
  welleco: "WelleCo",
  the_nue_co: "The Nue Co.",
  five_percent_nutrition: "5% Nutrition",
  bare_performance: "Bare Performance Nutrition",
  ryse_supplements: "RYSE",
  jocko_fuel: "Jocko Fuel",
  beekeepers_naturals: "Beekeeper's Naturals",
  renue_by_science: "Renue By Science",
  novos_labs: "NOVOS Labs",
};

function brandLabel(slug) {
  return BRAND_LABEL_OVERRIDES[slug] || humanizeSlug(slug);
}

function runSql(sql) {
  const output = execFileSync("sqlite3", ["-readonly", "-json", DB_PATH, sql], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  }).trim();
  return output ? JSON.parse(output) : [];
}

function sqlList(values) {
  return [...values].map((value) => `'${String(value).replace(/'/g, "''")}'`).join(", ");
}

function buildCandidateSql() {
  return `
    select
      p.id as row_id,
      p.product_id,
      p.brand,
      p.name,
      p.available,
      p.url,
      p.store_department,
      p.store_collection,
      p.options,
      p.price,
      p.currency,
      (
        select i.url from images i
        where i.product_row_id = p.id
        order by i.position asc limit 1
      ) as image_url,
      (
        select i.width from images i
        where i.product_row_id = p.id
        order by i.position asc limit 1
      ) as image_width,
      (
        select i.height from images i
        where i.product_row_id = p.id
        order by i.position asc limit 1
      ) as image_height
    from products p
    where p.excluded = 0
      and p.available = 1
      and lower(coalesce(p.store_department, '')) in (${sqlList(SUPPLEMENT_DEPARTMENTS)})
      and coalesce(
        (
          select i.url from images i
          where i.product_row_id = p.id
          order by i.position asc limit 1
        ),
        ''
      ) != '';
  `;
}

const FLAVOR_NAME_RE = /flavor|flavour|taste/i;
const SIZE_NAME_RE = /size|weight|count|servings?|quantity|pack|amount/i;

function parseOptionGroups(optionsJson) {
  const groups = { sizes: [], flavors: [], other: [] };
  let parsed = [];
  try {
    parsed = JSON.parse(optionsJson || "[]");
  } catch {
    return groups;
  }
  if (!Array.isArray(parsed)) return groups;

  for (const group of parsed) {
    if (!group || typeof group !== "object") continue;
    const name = String(group.name || "").trim();
    const values = Array.isArray(group.values)
      ? [...new Set(group.values.map((value) => stripHtml(value).trim()).filter(Boolean))]
      : [];
    if (!values.length) continue;
    if (values.length === 1 && /^default title$/i.test(values[0])) continue;

    if (FLAVOR_NAME_RE.test(name)) groups.flavors.push(...values);
    else if (SIZE_NAME_RE.test(name)) groups.sizes.push(...values);
    else groups.other.push(...values);
  }

  groups.sizes = [...new Set(groups.sizes)];
  groups.flavors = [...new Set(groups.flavors)];
  groups.other = [...new Set(groups.other)];
  return groups;
}

function main() {
  const rows = runSql(buildCandidateSql());
  const products = [];
  const seen = new Set();

  for (const row of rows) {
    const id = String(row.product_id || "").trim();
    const brandSlug = String(row.brand || "").trim().toLowerCase();
    if (!id || seen.has(`${brandSlug}::${id}`)) continue;
    seen.add(`${brandSlug}::${id}`);

    const name = stripHtml(row.name || "").trim();
    if (!name) continue;
    if (brandSlug === "alpha_lion" && /^mystery gift$/i.test(name)) continue;

    const category = deriveSupplementCategory(row.store_collection);
    const options = parseOptionGroups(row.options);
    const variantCount = Math.max(options.sizes.length, 1) * Math.max(options.flavors.length, 1);

    products.push({
      id,
      brand_slug: brandSlug,
      brand: brandLabel(brandSlug),
      name,
      url: String(row.url || "").trim() || null,
      image_url: String(row.image_url || "").trim(),
      image_width: Number(row.image_width || 0) || null,
      image_height: Number(row.image_height || 0) || null,
      category_slug: category.slug,
      category_label: category.label,
      product_type: category.label,
      brand_origin: "USA",
      catalog_visibility: "wholesale",
      quote_enabled: true,
      available: Boolean(Number(row.available)),
      availability_status: Number(row.available) ? "Available" : "Out of stock",
      retail_price_cents: toPriceCents(row.price, row.currency),
      sizes: options.sizes,
      colors: options.flavors,
      other_options: options.other,
      variant_count: variantCount,
    });
  }

  products.sort((a, b) => {
    const brandCompare = a.brand.localeCompare(b.brand, undefined, { sensitivity: "base" });
    if (brandCompare !== 0) return brandCompare;
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  });

  const pricedCount = products.filter((product) => Number.isInteger(product.retail_price_cents)).length;
  const manifest = {
    generated_at: new Date().toISOString(),
    source_db: path.relative(ROOT, DB_PATH),
    product_count: products.length,
    priced_count: pricedCount,
    products,
  };

  fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(manifest, null, 1)}\n`);
  console.log(`Wrote ${products.length} products (${pricedCount} priced) to ${path.relative(ROOT, OUTPUT_PATH)}`);

  const byBrand = new Map();
  for (const product of products) {
    byBrand.set(product.brand, (byBrand.get(product.brand) || 0) + 1);
  }
  console.log(`Brands: ${byBrand.size}`);
}

main();
