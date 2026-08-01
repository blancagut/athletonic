import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const manifestPath = path.join(root, "data", "wholesale-supplements-catalog.json");
const masterPath = path.join(root, "delete me", "optimum-nutrition-master-products.json");
const variantsPath = path.join(root, "delete me", "optimum-nutrition-master-variants.json");

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const products = JSON.parse(fs.readFileSync(masterPath, "utf8")).products;
const variants = JSON.parse(fs.readFileSync(variantsPath, "utf8")).variants;

const slug = (value) => String(value || "standard").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const cents = (value) => Math.round(Number(value || 0) * 100);
const listPrice = (variant) => variant.regular_price ?? variant.msrp ?? variant.source_price ?? variant.sale_price ?? 0;
const imageFor = (variant, product) => variant?.flavor_specific_image || variant?.size_specific_image || variant?.main_product_image || product.main_product_image;

const variantsByProduct = new Map();
for (const variant of variants) {
  const key = String(variant.parent_product_id);
  if (!variantsByProduct.has(key)) variantsByProduct.set(key, []);
  variantsByProduct.get(key).push(variant);
}

const optimumRows = [];
for (const product of products) {
  const productVariants = variantsByProduct.get(String(product.product_id)) || [];
  const bySize = new Map();
  for (const variant of productVariants) {
    const size = String(variant.exact_size || "Standard").trim();
    if (!bySize.has(size)) bySize.set(size, []);
    bySize.get(size).push(variant);
  }

  if (!bySize.size) bySize.set("Standard", []);
  for (const [size, sizeVariants] of bySize) {
    const activeVariants = sizeVariants.filter((variant) => variant.availability_status === "active");
    const defaultVariant = activeVariants[0] || sizeVariants[0];
    const mappedVariants = sizeVariants.map((variant) => ({
      id: String(variant.variant_id),
      selected_options: {
        ...(variant.exact_flavor_name ? { Flavor: variant.exact_flavor_name } : {}),
        ...(variant.exact_size ? { Size: variant.exact_size } : {}),
      },
      retail_price_cents: cents(listPrice(variant)),
      available: variant.availability_status === "active",
      image_url: imageFor(variant, product),
    }));

    optimumRows.push({
      id: `official-optimum-${product.product_handle}-${slug(size)}`,
      brand_slug: "optimum_nutrition",
      brand: "Optimum Nutrition",
      name: size === "Standard" ? product.official_product_name : `${product.official_product_name} - ${size}`,
      url: `/product/official-optimum-${product.product_handle}.html`,
      image_url: imageFor(defaultVariant, product),
      image_width: null,
      image_height: null,
      category_slug: product.product_category_slug || "supplements",
      category_label: product.product_category || "Supplements",
      product_type: product.product_type || "Supplement",
      brand_origin: "USA",
      catalog_visibility: "wholesale",
      quote_enabled: true,
      available: activeVariants.length > 0,
      availability_status: activeVariants.length > 0 ? "Available" : "Out of stock",
      retail_price_cents: defaultVariant ? cents(listPrice(defaultVariant)) : null,
      sizes: size === "Standard" ? [] : [size],
      colors: [...new Set(sizeVariants.map((variant) => variant.exact_flavor_name).filter(Boolean))],
      other_options: [],
      variant_count: mappedVariants.length || 1,
      variants: mappedVariants,
    });
  }
}

manifest.products = [
  ...manifest.products.filter((product) => product.brand_slug !== "optimum_nutrition"),
  ...optimumRows,
].sort((a, b) =>
  String(a.brand).localeCompare(String(b.brand), undefined, { sensitivity: "base" }) ||
  String(a.name).localeCompare(String(b.name), undefined, { sensitivity: "base", numeric: true })
);
manifest.generated_at = new Date().toISOString();
manifest.product_count = manifest.products.length;
manifest.priced_count = manifest.products.filter((product) => Number.isInteger(product.retail_price_cents)).length;

fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 1)}\n`);
console.log(`Published ${optimumRows.length} size-specific Optimum wholesale rows from ${variants.length} variants.`);
