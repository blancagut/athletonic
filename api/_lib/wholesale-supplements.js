const fs = require("node:fs");
const path = require("node:path");

const { SUPPLEMENT_DISCOUNT_BPS } = require("./private-pricing");
const { cleanText, humanizeSlug, stripHtml, toPriceCents } = require("./wholesale-muay-thai");

const SUPPLEMENTS_CATALOG_PATH = path.join(process.cwd(), "data", "wholesale-supplements-catalog.json");

const WHOLESALE_SUPPLEMENTS_DISCOUNT_BPS = SUPPLEMENT_DISCOUNT_BPS;

// Brands approved for the supplements / vitamins / beauty wholesale line sheet.
const SUPPLEMENT_WHOLESALE_BRANDS = new Set([
  // Sports nutrition
  "optimum_nutrition",
  "muscletech",
  "animal_pak",
  "cellucor",
  "musclepharm",
  "nutrex",
  "redcon1",
  "jym",
  "kaged",
  "raw_nutrition",
  "ryse_supplements",
  "gorilla_mind",
  "transparent_labs",
  "nutrabio",
  "jacked_factory",
  "pescience",
  "alpha_lion",
  "huge_supplements",
  "black_magic_supps",
  "bucked_up",
  "five_percent_nutrition",
  "core_nutritionals",
  "swolverine",
  "jocko_fuel",
  "bare_performance",
  "first_phorm",
  "ghost_lifestyle",
  "inno_supps",
  "glaxon",
  "myprotein",
  "performance_lab",
  "momentous",
  "true_nutrition",
  "naked_nutrition",
  "promix",
  "kion",
  // Everyday nutrition & functional foods
  "quest_nutrition",
  "orgain",
  "owyn",
  "soylent",
  "ample",
  "vega",
  "primal_kitchen",
  "vital_proteins",
  "dose_and_co",
  "truvani",
  "amazing_grass",
  "navitas_organics",
  "terrasoul_superfoods",
  "kos",
  "four_sigmatic",
  "mud_wtr",
  "magic_mind",
  // Hydration & energy
  "liquid_iv",
  "nuun",
  "skratch_labs",
  "drip_drop",
  "cure_hydration",
  // Vitamins & wellness
  "maryruth_organics",
  "goli",
  "olly",
  "ritual",
  "jshealth_vitamins",
  "codeage",
  "rae_wellness",
  "hilma",
  "nested_naturals",
  "nuzest",
  "further_food",
  "beekeepers_naturals",
  "armra",
  "cymbiotika",
  "needed",
  "perelel",
  "o_positiv",
  "love_wellness",
  "bloom_nutrition",
  "winged_wellness",
  // Longevity
  "tru_niagen",
  "elysium",
  "novos_labs",
  "renue_by_science",
  // Beauty & wellness
  "agent_nateur",
  "the_nue_co",
  "welleco",
  "moon_juice",
  "key_nutrients",
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
  cleanText,
  deriveSupplementCategory,
  loadSupplementsCatalogManifest,
  normalizeSupplementsCatalogProduct,
  supplementWholesalePriceCents,
  toPriceCents,
};
