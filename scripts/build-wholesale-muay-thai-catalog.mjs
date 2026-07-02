import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  APPROVED_WHOLESALE_BRANDS,
  buildWholesaleProductRecord,
  cleanText,
  deriveCategoryLabel,
  deriveProductType,
  humanizeSlug,
  normalizeWholesaleSizes,
  scoreWholesaleProduct,
  stripHtml,
  toPriceCents,
} = require("../api/_lib/wholesale-muay-thai.js");

const ROOT = process.cwd();
const DB_PATH = path.join(ROOT, "output", "data", "products.db");
const OUTPUT_PATH = path.join(ROOT, "data", "wholesale-muay-thai-catalog.json");

const OFFICIAL_SOURCES = [
  { brandSlug: "boon", brandLabel: "Boon", file: path.join(ROOT, "data", "boon-products.json") },
  { brandSlug: "topking", brandLabel: "Top King", file: path.join(ROOT, "data", "topking-products.json") },
  { brandSlug: "yokkao", brandLabel: "YOKKAO", file: path.join(ROOT, "data", "yokkao-products.json") },
  { brandSlug: "primo", brandLabel: "Primo", file: path.join(ROOT, "data", "primo-products.json") },
];

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function runSql(sql) {
  const output = execFileSync("sqlite3", ["-readonly", "-json", DB_PATH, sql], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  }).trim();
  return output ? JSON.parse(output) : [];
}

function buildCandidateSql() {
  const brandList = [...APPROVED_WHOLESALE_BRANDS]
    .map((brand) => `'${brand.replace(/'/g, "''")}'`)
    .join(", ");

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
      p.description_html,
      p.options,
      p.price,
      p.currency,
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

function stockStatusToAvailable(value) {
  const normalized = cleanText(value);
  if (!normalized) return true;
  return !/\b(out of stock|sold out|unavailable|disabled)\b/.test(normalized);
}

function buildOfficialProducts() {
  const products = [];

  for (const source of OFFICIAL_SOURCES) {
    if (!fs.existsSync(source.file)) continue;
    let sourceProducts = [];
    try {
      sourceProducts = JSON.parse(fs.readFileSync(source.file, "utf8"));
    } catch {
      continue;
    }

    for (const row of sourceProducts) {
      const images = Array.isArray(row.images) ? row.images.map((url) => String(url || "").trim()).filter(Boolean) : [];
      if (!images.length) continue;

      const pseudoRow = {
        product_id: row.sku || row.product_url || row.product_name,
        brand: source.brandSlug,
        brand_label: source.brandLabel,
        name: row.product_name,
        category: row.category,
        tags: "",
        description_html: row.full_description || row.short_description || "",
        available: stockStatusToAvailable(row.stock_status) ? 1 : 0,
        url: row.product_url,
        store_department: "sports_gear",
        store_collection: "fight_gear",
        category_normalized: "official_thai_fight_gear",
        image_url: images[0],
        image_width: null,
        image_height: null,
      };

      if (!shouldIncludeProduct(pseudoRow, [{ url: images[0] }], [])) continue;

      const idToken = slugify(row.sku || row.product_name || row.product_url);
      if (!idToken) continue;
      const id = `official-${source.brandSlug}-${idToken}`;
      const localUrl = `/product/${id}.html`;
      // Never link to the official brand stores: local PDP or nothing.
      const productUrl = fs.existsSync(path.join(ROOT, "product", `${id}.html`))
        ? localUrl
        : null;
      const text = [
        row.product_name,
        row.category,
        row.sku,
        source.brandLabel,
      ]
        .map((value) => cleanText(value))
        .filter(Boolean)
        .join(" ");
      const productType = deriveProductType(text);
      const sizes = Array.isArray(row.available_sizes) ? row.available_sizes : [];
      const colors = Array.isArray(row.available_colors) ? row.available_colors : [];
      const variants = Array.isArray(row.available_variants) ? row.available_variants : [];

      products.push({
        id,
        brand_slug: source.brandSlug,
        brand: source.brandLabel,
        name: stripHtml(row.product_name || "").trim(),
        url: productUrl,
        external_url: null,
        image_url: images[0],
        image_width: null,
        image_height: null,
        category_slug: "official_thai_fight_gear",
        category_label: deriveCategoryLabel(productType),
        product_type: productType,
        brand_origin: "Thailand",
        catalog_visibility: "wholesale",
        quote_enabled: true,
        available: stockStatusToAvailable(row.stock_status),
        availability_status: stockStatusToAvailable(row.stock_status) ? "Available" : "Out of stock",
        retail_price_cents: toPriceCents(row.price, row.currency),
        sizes: normalizeWholesaleSizes(
          {
            brand: source.brandSlug,
            brand_slug: source.brandSlug,
            name: row.product_name,
            category: row.category,
          },
          productType,
          sizes
        ),
        colors: [...new Set(colors.map((value) => stripHtml(value).trim()).filter(Boolean))],
        other_options: [],
        variant_count: variants.length || Math.max(sizes.length, colors.length, 1),
      });
    }
  }

  return products;
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
        description_html: row.description_html,
        available: Number(row.available),
        url: row.url,
        store_department: row.store_department,
        store_collection: row.store_collection,
        category_normalized: row.category_normalized,
        options: row.options,
        price: row.price,
        currency: row.currency,
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
      retail_price_cents: product.retail_price_cents,
      sizes: product.sizes,
      colors: product.colors,
      other_options: product.other_options,
      variant_count: variants.length,
    };
  });

  products.push(...buildOfficialProducts());

  const productByKey = new Map();
  for (const product of products) {
    const key = `${product.brand_slug}::${product.id}`;
    if (!productByKey.has(key)) productByKey.set(key, product);
  }
  const dedupedProducts = [...productByKey.values()];

  dedupedProducts.sort((a, b) => {
    const brandCompare = a.brand.localeCompare(b.brand, undefined, { sensitivity: "base" });
    if (brandCompare !== 0) return brandCompare;
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  });

  const manifest = {
    generated_at: new Date().toISOString(),
    sources: [
      path.relative(ROOT, DB_PATH),
      ...OFFICIAL_SOURCES.filter((source) => fs.existsSync(source.file)).map((source) => path.relative(ROOT, source.file)),
    ],
    product_count: dedupedProducts.length,
    products: dedupedProducts,
  };

  fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(manifest, null, 2)}\n`);
  process.stdout.write(`Wrote ${dedupedProducts.length} wholesale products to ${OUTPUT_PATH}\n`);
}

main();
