const fs = require("node:fs");
const path = require("node:path");

const { SUPPLEMENT_DISCOUNT_BPS } = require("./private-pricing");
const { cleanText, humanizeSlug, stripHtml, toPriceCents } = require("./wholesale-muay-thai");

const SUPPLEMENTS_CATALOG_PATH = path.join(process.cwd(), "data", "wholesale-supplements-catalog.json");

const WHOLESALE_SUPPLEMENTS_DISCOUNT_BPS = SUPPLEMENT_DISCOUNT_BPS;
const TRAINER_SUPPLEMENTS_DISCOUNT_BPS = 3000;

// Performance catalog brands. Every other brand belongs to Health Care.
const SUPPLEMENT_WHOLESALE_BRANDS = new Set([
  "optimum_nutrition",
  "muscletech",
  "animal_pak",
  "cellucor",
  "nutrabio",
  "myprotein",
  "musclepharm",
  "redcon1",
  "raw_nutrition",
  "ryse_supplements",
  "kaged",
  "jym",
  "pescience",
  "ghost_lifestyle",
  "glaxon",
  "gorilla_mind",
  "huge_supplements",
  "alpha_lion",
  "bucked_up",
  "black_magic_supps",
  "jacked_factory",
  "core_nutritionals",
  "bare_performance",
  "promix",
  "quest_nutrition",
  "transparent_labs",
  "nutrex",
  "swolverine",
]);

// store_department values eligible for this catalog (excludes gear, apparel, devices).
const SUPPLEMENT_DEPARTMENTS = new Set([
  "supplements",
  "sports_nutrition",
  "wellness_goals",
  "womens_wellness",
  "vitamins_health",
  "functional_foods",
]);

const COLLECTION_LABELS = {
  all_supplements: "Supplements",
  pre_workout: "Pre-Workout",
  protein: "Protein",
  creatine: "Creatine",
  amino_acids: "Amino Acids",
  recovery: "Recovery",
  mass_gainers: "Mass Gainers",
  energy_hydration: "Energy & Hydration",
  gut_health: "Gut Health",
  focus_mood: "Focus & Mood",
  weight_management: "Weight Management",
  longevity: "Longevity",
  sleep_stress: "Sleep & Stress",
  hair_skin_nails: "Hair, Skin & Nails",
  collagen_beauty: "Collagen & Beauty",
  hormone_support: "Hormone Support",
  menopause: "Menopause",
  prenatal_postnatal: "Prenatal & Postnatal",
  greens_superfoods: "Greens & Superfoods",
  adaptogens_herbals: "Adaptogens & Herbals",
  vitamins_minerals: "Vitamins & Minerals",
  multivitamins: "Multivitamins",
  joint_support: "Joint Support",
  omega_fish_oil: "Omega & Fish Oil",
  immune_support: "Immune Support",
  snacks: "Snacks",
  meal_replacement: "Meal Replacement",
  protein_bars: "Protein Bars",
  rtd_shakes: "RTD Shakes",
};

function deriveSupplementCategory(storeCollection) {
  const slug = String(storeCollection || "").trim().toLowerCase();
  return {
    slug: slug || "supplements",
    label: COLLECTION_LABELS[slug] || "Supplements",
  };
}

function supplementWholesalePriceCents(retailPriceCents) {
  if (!Number.isInteger(retailPriceCents) || retailPriceCents <= 0) return null;
  return Math.max(1, Math.round((retailPriceCents * (10000 - WHOLESALE_SUPPLEMENTS_DISCOUNT_BPS)) / 10000));
}

function supplementTrainerPriceCents(retailPriceCents) {
  if (!Number.isInteger(retailPriceCents) || retailPriceCents <= 0) return null;
  return Math.max(1, Math.round((retailPriceCents * (10000 - TRAINER_SUPPLEMENTS_DISCOUNT_BPS)) / 10000));
}

function isHealthCareSupplement(product) {
  return !SUPPLEMENT_WHOLESALE_BRANDS.has(String(product?.brand_slug || "").trim().toLowerCase());
}

function normalizeTextList(values) {
  return [...new Set((values || []).map((value) => stripHtml(value).trim()).filter(Boolean))];
}

function normalizeSupplementsCatalogProduct(product) {
  const retailPriceCents =
    Number.isInteger(product.retail_price_cents) && product.retail_price_cents > 0
      ? product.retail_price_cents
      : null;

  return {
    id: String(product.id || ""),
    brand_slug: String(product.brand_slug || "").trim(),
    brand: String(product.brand || humanizeSlug(product.brand_slug) || "").trim(),
    name: String(product.name || "").trim(),
    url: String(product.url || "").trim() || null,
    image_url: String(product.image_url || "").trim() || null,
    image_width: Number(product.image_width || 0) || null,
    image_height: Number(product.image_height || 0) || null,
    category_slug: String(product.category_slug || "").trim() || null,
    category_label: String(product.category_label || "").trim() || "Supplements",
    product_type: String(product.product_type || "").trim() || "Supplement",
    brand_origin: String(product.brand_origin || "USA").trim(),
    catalog_visibility: String(product.catalog_visibility || "wholesale").trim(),
    quote_enabled: product.quote_enabled !== false,
    available: Boolean(product.available),
    availability_status: String(product.availability_status || (product.available ? "Available" : "Out of stock")).trim(),
    retail_price_cents: retailPriceCents,
    wholesale_price_cents: supplementWholesalePriceCents(retailPriceCents),
    wholesale_discount_bps: WHOLESALE_SUPPLEMENTS_DISCOUNT_BPS,
    trainer_price_cents: supplementTrainerPriceCents(retailPriceCents),
    trainer_discount_bps: TRAINER_SUPPLEMENTS_DISCOUNT_BPS,
    sizes: Array.isArray(product.sizes) ? normalizeTextList(product.sizes) : [],
    colors: Array.isArray(product.colors) ? normalizeTextList(product.colors) : [],
    other_options: Array.isArray(product.other_options) ? normalizeTextList(product.other_options) : [],
    variant_count: Number(product.variant_count || 0) || 0,
  };
}

function loadSupplementsCatalogManifest() {
  if (!fs.existsSync(SUPPLEMENTS_CATALOG_PATH)) {
    return { generated_at: null, products: [] };
  }

  const manifest = JSON.parse(fs.readFileSync(SUPPLEMENTS_CATALOG_PATH, "utf8"));
  const products = Array.isArray(manifest.products) ? manifest.products.map(normalizeSupplementsCatalogProduct) : [];
  return {
    generated_at: manifest.generated_at || null,
    source_db: manifest.source_db || null,
    products,
  };
}

module.exports = {
  SUPPLEMENTS_CATALOG_PATH,
  SUPPLEMENT_WHOLESALE_BRANDS,
  SUPPLEMENT_DEPARTMENTS,
  WHOLESALE_SUPPLEMENTS_DISCOUNT_BPS,
  TRAINER_SUPPLEMENTS_DISCOUNT_BPS,
  cleanText,
  deriveSupplementCategory,
  isHealthCareSupplement,
  loadSupplementsCatalogManifest,
  normalizeSupplementsCatalogProduct,
  supplementTrainerPriceCents,
  supplementWholesalePriceCents,
  toPriceCents,
};
