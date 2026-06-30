import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  buildWholesaleProductRecord,
  humanizeSlug,
  scoreWholesaleProduct,
  stripHtml,
} = require("../api/_lib/wholesale-muay-thai.js");

const ROOT = process.cwd();
const DB_PATH = path.join(ROOT, "output", "data", "products.db");
const OUTPUT_PATH = path.join(ROOT, "data", "wholesale-muay-thai-catalog.json");

const THAI_BRANDS = [
  "fairtex",
  "raja_boxing",
  "twins_special",
  "windy",
  "topking",
  "top king",
  "king pro",
  "sks",
  "thaismai",
];

function runSql(sql) {
  const output = execFileSync("sqlite3", ["-json", DB_PATH, sql], {
    encoding: "utf8",
    maxBuffer: 24 * 1024 * 1024,
  }).trim();
  return output ? JSON.parse(output) : [];
}

function buildCandidateSql() {
  const brandList = THAI_BRANDS.map((brand) => `'${brand.replace(/'/g, "''")}'`).join(", ");

  return `
    select
      p.id as row_id,
      p.product_id,
      p.brand,
      p.name,
      p.category,
      p.tags,
      p.available,
      p.url,
      p.store_department,
      p.store_collection,
      p.category_normalized,
      p.options,
      (
        select i.url
        from images i
        where i.product_row_id = p.id
        order by i.position asc
        limit 1
      ) as image_url,
      (
        select i.width
        from images i
        where i.product_row_id = p.id
        order by i.position asc
        limit 1
      ) as image_width,
      (
        select i.height
        from images i
        where i.product_row_id = p.id
        order by i.position asc
        limit 1
      ) as image_height
    from products p
    where p.excluded = 0
      and coalesce(
        (
          select i.url
          from images i
          where i.product_row_id = p.id
          order by i.position asc
          limit 1
        ),
        ''
      ) != ''
      and (
        lower(p.brand) in (${brandList})
        or lower(coalesce(p.store_collection, '')) = 'fight_gear'
      );
  `;
}

function shouldIncludeProduct(row, images, variants) {
  const { score } = scoreWholesaleProduct(row, images, variants);
  return score >= 4;
}

function parseVariants(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  try {
    return JSON.parse(value);
  } catch {
    return [];
  }
}

function main() {
  const rows = runSql(buildCandidateSql());
  const shortlisted = [];

  for (const row of rows) {
    const images = row.image_url
      ? [
          {
            url: String(row.image_url || "").trim(),
            width: Number(row.image_width || 0) || null,
            height: Number(row.image_height || 0) || null,
        },
      ]
      : [];

    if (!shouldIncludeProduct(row, images, [])) continue;
    shortlisted.push({ row, images });
  }

  const shortlistedIds = shortlisted.map(({ row }) => Number(row.row_id)).filter(Number.isFinite);
  const variantsByProductRowId = new Map();

  if (shortlistedIds.length) {
    const variantRows = runSql(`
      select
        v.product_row_id,
        v.variant_id,
        v.title,
        v.sku,
        v.option1,
        v.option2,
        v.option3,
        v.available
      from variants v
      where v.product_row_id in (${shortlistedIds.join(", ")});
    `);

    for (const variantRow of variantRows) {
      const productRowId = Number(variantRow.product_row_id);
      if (!variantsByProductRowId.has(productRowId)) {
        variantsByProductRowId.set(productRowId, []);
      }
      variantsByProductRowId.get(productRowId).push({
        variant_id: String(variantRow.variant_id || "").trim(),
        title: stripHtml(variantRow.title || "").trim(),
        sku: variantRow.sku ? String(variantRow.sku) : null,
        option1: stripHtml(variantRow.option1 || "").trim() || null,
        option2: stripHtml(variantRow.option2 || "").trim() || null,
        option3: stripHtml(variantRow.option3 || "").trim() || null,
        available: Boolean(Number(variantRow.available)),
      });
    }
  }

  const products = shortlisted.map(({ row, images }) => {
    const variants = variantsByProductRowId.get(Number(row.row_id)) || [];
    const product = buildWholesaleProductRecord(
      {
        product_id: row.product_id,
        brand: row.brand,
        brand_label: humanizeSlug(row.brand),
        name: row.name,
        category: row.category,
        tags: row.tags,
        available: Number(row.available),
        url: row.url,
        store_department: row.store_department,
        store_collection: row.store_collection,
        category_normalized: row.category_normalized,
        options: row.options,
        image_url: row.image_url,
        image_width: row.image_width,
        image_height: row.image_height,
      },
      variants,
      images
    );
    return {
      id: product.id,
      brand_slug: product.brand_slug,
      brand: product.brand,
      name: product.name,
      url: product.url,
      image_url: product.image_url,
      image_width: product.image_width,
      image_height: product.image_height,
      category_slug: product.category_slug,
      category_label: product.category_label,
      product_type: product.product_type,
      brand_origin: product.brand_origin,
      catalog_visibility: product.catalog_visibility,
      quote_enabled: product.quote_enabled,
      available: product.available,
      availability_status: product.availability_status,
      sizes: product.sizes,
      colors: product.colors,
      other_options: product.other_options,
      variant_count: variants.length,
    };
  });

  products.sort((a, b) => {
    const brandCompare = a.brand.localeCompare(b.brand, undefined, { sensitivity: "base" });
    if (brandCompare !== 0) return brandCompare;
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  });

  const manifest = {
    generated_at: new Date().toISOString(),
    source_db: path.relative(ROOT, DB_PATH),
    product_count: products.length,
    products,
  };

  fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(manifest, null, 2)}\n`);
  process.stdout.write(`Wrote ${products.length} wholesale products to ${OUTPUT_PATH}\n`);
}

main();
