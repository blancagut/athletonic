import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { ATHLETONIC_SOURCE_OF_TRUTH } from "../src/source-of-truth/athletonic.mjs";

const SUPABASE_PUBLIC_URL = "https://spdvsaozvdcvztinsuex.supabase.co";
const SUPABASE_PUBLIC_KEY = "sb_publishable_OI_aEjYX0fB4tp7Ui2bk5A_001Jga0T";
const DB_PATH = ATHLETONIC_SOURCE_OF_TRUTH.sourcePolicy.productDataSource;
const brandNames = Object.fromEntries(
  ATHLETONIC_SOURCE_OF_TRUTH.brands.map((brand) => [brand.slug, brand.name])
);
const allowedBrands = ATHLETONIC_SOURCE_OF_TRUTH.brands.map((brand) => brand.slug);
const officialBrandDomains = Object.fromEntries(
  ATHLETONIC_SOURCE_OF_TRUTH.brands.map((brand) => [
    brand.slug,
    brand.officialDomains,
  ])
);
const blockedSourceDomains = new Set(
  ATHLETONIC_SOURCE_OF_TRUTH.sourcePolicy.blockedSourceDomains
);
const excludedBrands = [
  "soccer_post",
  "soccer_zone_usa",
  "golaco_kits",
  "soccer90",
  "fifa_store",
  "azteca_soccer",
  "football_town",
];

const forbiddenNameFilters = [
  "soccer",
  "football",
  "futbol",
  "cleat",
  "jersey",
  "gift card",
  "package protection",
  "returns protection",
  "sample",
  "tester",
  "test product",
  "dented",
  "free gifts",
  "welcome gift",
  "free welcome",
  "prepaid",
  "tool",
  "drill",
  "saw",
  "wrench",
];

const imagePenaltyFragments = [
  "back",
  "alt-image",
  "alt_image",
  "comparison",
  "benefits",
  "usage",
  "ingredient",
  "callout",
  "callouts",
  "breakdown",
  "nutrition-panel",
  "nutritional-panel",
  "supplement-facts",
  "supplement_facts",
  "nfp",
  "sfp",
  "label",
  "how-to",
  "how_to",
];

const blockedImageFragments = ["no-image", "placeholder", "missing-image"];

const displayOnlyFragments = [
  "front",
  "hero",
  "pdp",
  "buybox",
  "buy-box",
  "thumbnail",
  "plp",
];

const sections = [
  {
    id: "protein",
    eyebrow: "Sports nutrition",
    title: "Protein best sellers",
    description: "Whey, plant protein, meal shakes, and recovery protein.",
    label: "Protein",
    where:
      "p.store_department = 'sports_nutrition' and p.store_collection = 'protein'",
    nameIncludes: ["protein", "whey", "isolate", "casein", "mass gainer"],
    nameExcludes: [
      "bundle",
      "stack",
      "pack",
      "2x",
      "2 x",
      "nl -",
      "panel",
      "nfp",
      "creatine",
      "créatine",
    ],
    maxPrice: 180,
  },
  {
    id: "creatine",
    eyebrow: "Strength",
    title: "Creatine shelf",
    description: "Creatine powders, capsules, chews, and stack bundles.",
    label: "Creatine",
    where:
      "p.store_department = 'sports_nutrition' and p.store_collection = 'creatine'",
    nameIncludes: ["creatine"],
    nameExcludes: [
      "whey protein",
      "mass gainer",
      "bundle",
      "stack",
      "pack",
      "frother",
      "offer",
      "bottles of",
    ],
    maxPrice: 130,
  },
  {
    id: "pre-workout",
    eyebrow: "Energy",
    title: "Pre-workout",
    description: "Performance blends, pump formulas, and training energy.",
    label: "Pre-workout",
    where:
      "p.store_department = 'sports_nutrition' and p.store_collection = 'pre_workout'",
    nameIncludes: [
      "pre-workout",
      "pre workout",
      "preworkout",
      "amped",
      "legend",
      "gorilla mode",
      "nitric",
      "pump",
      "stim",
      "glycerol",
    ],
    nameExcludes: ["whey", "protein", "cinnabon", "bundle", "stack"],
    maxPrice: 120,
  },
  {
    id: "hydration",
    eyebrow: "Daily performance",
    title: "Hydration & electrolytes",
    description: "Hydration mixes, electrolyte sticks, and functional drinks.",
    label: "Hydration",
    where:
      "p.store_collection = 'energy_hydration' and (p.brand in ('liquid_iv','nuun','skratch_labs','drip_drop','cure_hydration','bare_performance','alpha_lion','naked_nutrition') or lower(p.name) like '%hydration%' or lower(p.name) like '%electrolyte%')",
    nameIncludes: [
      "hydration",
      "electrolyte",
      "drink mix",
      "multiplier",
      "amin.o",
      "amino energy",
      "nuun",
    ],
    nameExcludes: ["welcome", "starter kit", "bundle", "offer", "stack", "15% off"],
    maxPrice: 90,
  },
  {
    id: "vitamins",
    eyebrow: "Wellness",
    title: "Vitamins & daily health",
    description: "Multivitamins, minerals, omegas, immune, and joint support.",
    label: "Daily health",
    where:
      "p.store_department = 'vitamins_health' and p.brand not in ('iron_bull_strength')",
    nameIncludes: [
      "multi",
      "vitamin",
      "omega",
      "magnesium",
      "zinc",
      "zma",
      "turmeric",
      "ubiquinol",
      "immune",
      "probiotic",
      "synbiotic",
      "collagen",
      "joint",
    ],
    nameExcludes: [
      "protein",
      "kids",
      "bundle",
      "stack",
      "2 bags",
      "bottles of",
      "frother",
      "java shred",
      "night shred",
      "b2b",
    ],
    maxPrice: 110,
  },
  {
    id: "greens",
    eyebrow: "Wellness",
    title: "Greens & superfoods",
    description: "Greens blends, superfood powders, and daily nutrition.",
    label: "Greens",
    where:
      "p.store_collection = 'greens_superfoods' and p.brand not in ('allbirds','ten_thousand')",
    nameIncludes: [
      "green",
      "greens",
      "superfood",
      "cacao",
      "spirulina",
      "chlorella",
    ],
    nameExcludes: [
      "hydration",
      "sleep",
      "gummies",
      "protein",
      "subscription",
      "frother",
    ],
    maxPrice: 90,
  },
  {
    id: "bars-shakes",
    eyebrow: "Ready now",
    title: "Bars, shakes & meal replacements",
    description: "Protein bars, RTD shakes, complete meals, and snacks.",
    label: "Bars & shakes",
    where:
      "p.store_collection in ('protein_bars','rtd_shakes','meal_replacement')",
    nameIncludes: ["bar", "bars", "shake", "shakes", "meal", "drink"],
    nameExcludes: ["prepaid", "subscription", "bundle", "combo pack", "intro pack"],
    maxPrice: 120,
  },
  {
    id: "recovery",
    eyebrow: "Recovery",
    title: "Recovery devices",
    description: "Massage, red light, compression, and recovery accessories.",
    label: "Recovery device",
    where:
      "p.store_collection = 'recovery_devices'",
    nameIncludes: [
      "theragun",
      "hypervolt",
      "venom",
      "massage",
      "roller",
      "roll",
      "compression",
      "recoverypulse",
      "red light",
      "infrared",
      "heating pad",
      "compex",
      "fixx",
    ],
    nameExcludes: ["replacement", "strap only"],
    maxPrice: 250,
  },
  {
    id: "sleep",
    eyebrow: "Recovery",
    title: "Sleep recovery",
    description: "Sleep masks, relaxation support, and nighttime recovery.",
    label: "Sleep recovery",
    where:
      "p.store_collection in ('sleep_gear','sleep_stress') and p.brand not in ('codeage')",
    nameIncludes: ["sleep", "mask", "pillow", "zma", "night", "magnesium"],
    nameExcludes: ["welcome gift", "shaker", "carb", "combo pack"],
    maxPrice: 180,
  },
  {
    id: "apparel",
    eyebrow: "Apparel",
    title: "Training apparel",
    description: "Leggings, shorts, tees, hoodies, active layers, and gym wear.",
    label: "Training apparel",
    where:
      "p.store_department = 'apparel_accessories' and p.store_collection = 'apparel' and p.brand in ('nike','allbirds','ten_thousand','outdoor_voices','first_phorm','ghost_lifestyle','raw_nutrition','redcon1','bear_komplex','kaged','bare_performance','alpha_lion','trx')",
    nameIncludes: [
      "hoodie",
      "shirt",
      "tee",
      "short",
      "pant",
      "jogger",
      "legging",
      "jacket",
      "tank",
      "bra",
      "crewneck",
      "sweatshirt",
      "quarter zip",
      "zip-up",
    ],
    nameExcludes: ["shoe", "air max", "jordan", "duffel", "bag"],
    maxPrice: 180,
  },
  {
    id: "shoes",
    eyebrow: "Footwear",
    title: "Training shoes",
    description: "Running, training, trail, and performance footwear.",
    label: "Training footwear",
    where:
      "p.store_department = 'apparel_accessories' and p.store_collection = 'shoes' and p.brand in ('nike','allbirds','ten_thousand')",
    nameIncludes: [
      "shoe",
      "trainer",
      "training",
      "running",
      "runner",
      "trail",
      "metcon",
      "pegasus",
      "vaporfly",
      "allbirds",
    ],
    nameExcludes: [
      "cleat",
      "soccer",
      "football",
      "air max",
      "spike",
      "moon shoe",
      " nz",
    ],
    maxPrice: 220,
    maxPerBrand: 8,
  },
  {
    id: "accessories",
    eyebrow: "Accessories",
    title: "Bottles, bags & gym accessories",
    description: "Shakers, water bottles, belts, bags, grips, sleeves, and straps.",
    label: "Gym accessory",
    where:
      "p.store_department = 'apparel_accessories' and p.store_collection = 'bags_bottles'",
    nameIncludes: [
      "shaker",
      "bottle",
      "bag",
      "duffle",
      "backpack",
      "belt",
      "wrap",
      "grip",
      "strap",
      "sleeve",
    ],
    nameExcludes: [
      "bundle",
      "protein",
      "whey",
      "shirt",
      "hoodie",
      "longsleeve",
      "shortsleeve",
      "bodysuit",
      "frother",
      "offer",
      "bottles of",
    ],
    maxPrice: 130,
  },
  {
    id: "training-gear",
    eyebrow: "Training gear",
    title: "Gym equipment & fight gear",
    description: "Training systems, gloves, wraps, pads, grips, and fight gear.",
    label: "Training gear",
    where:
      "p.store_department = 'sports_gear' and p.store_collection = 'fight_gear' and p.brand in ('hayabusa','rival_boxing','century_martial_arts','fuji_sports','everlast','fairtex','venum','sanabul','bear_komplex','schiek','harbinger','trx','iron_bull_strength')",
    nameIncludes: [
      "glove",
      "wrap",
      "mitt",
      "pad",
      "bag",
      "boxing",
      "muay",
      "shin",
      "guard",
      "belt",
      "grip",
      "mat",
      "rope",
      "strap",
      "training",
    ],
    nameExcludes: [
      "jersey",
      "soccer",
      "football",
      "whey",
      "protein",
      "duffel",
      "duffle",
      "roller bag",
    ],
    maxPrice: 220,
  },
];

function sqlString(value) {
  return `'${value.replaceAll("'", "''")}'`;
}

function likeAnySql(column, terms = []) {
  if (terms.length === 0) return "";
  return `and (${terms
    .map((term) => `${column} like ${sqlString(`%${term.toLowerCase()}%`)}`)
    .join(" or ")})`;
}

function notLikeAllSql(column, terms = []) {
  if (terms.length === 0) return "";
  return terms
    .map((term) => `${column} not like ${sqlString(`%${term.toLowerCase()}%`)}`)
    .join(" and ");
}

function runQuery(sql) {
  const output = execFileSync("sqlite3", ["-json", DB_PATH, sql], {
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 16,
  });
  return JSON.parse(output || "[]");
}

const usedProductIds = new Set();
const usedImageKeys = new Set();
const usedNameKeys = new Set();

function imageKey(url) {
  return String(url ?? "")
    .split("?")[0]
    .replace(/_[0-9]+x[0-9]+(?=\.)/i, "")
    .replace(
      /_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?=\.)/gi,
      ""
    )
    .toLowerCase();
}

function isBlockedImage(url) {
  const normalized = String(url ?? "").toLowerCase();
  return blockedImageFragments.some((fragment) => normalized.includes(fragment));
}

function sourceDomain(url) {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

function isOfficialBrandSource(row) {
  const domain = sourceDomain(row.url);
  if (!domain || blockedSourceDomains.has(domain)) return false;

  const officialDomains = officialBrandDomains[row.brand] ?? [];
  return officialDomains.some(
    (officialDomain) =>
      domain === officialDomain || domain.endsWith(`.${officialDomain}`)
  );
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function cleanProductName(name, brand) {
  let value = String(name ?? "")
    .normalize("NFKC")
    .replace(/\u00a0/g, " ")
    .replace(/[®™©]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  value = value.replace(/^[A-Z]{2}\s*-\s*/i, "");
  value = value.replace(/^dented\s+/i, "");
  value = value.replace(/^get\s+raw nutrition\s+/i, "");
  value = value.replace(/^get\s+/i, "");

  const brandLabel = brandNames[brand];
  const aliases = [
    brandLabel,
    brandLabel?.replaceAll(".", ""),
    brand === "raw_nutrition" ? "RAW Nutrition" : null,
    brand === "raw_nutrition" ? "RAW" : null,
    brand === "ghost_lifestyle" ? "GHOST" : null,
    brand === "optimum_nutrition" ? "Optimum Nutrition" : null,
    brand === "optimum_nutrition" ? "ON" : null,
  ].filter(Boolean);

  for (const alias of aliases) {
    value = value.replace(
      new RegExp(`^${escapeRegExp(alias)}\\s*[-:|]?\\s*`, "i"),
      ""
    );
    value = value.replace(
      new RegExp(`\\s+by\\s+${escapeRegExp(alias)}$`, "i"),
      ""
    );
  }

  value = value
    .replace(/\s+by\s+[a-z0-9 .&+%-]+$/i, "")
    .replace(/\s*\|\s*/g, " - ")
    .replace(/([a-z])TM\b/gi, "$1")
    .replace(/\bTM\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  return value || String(name ?? "").trim();
}

function isBrandMismatch(row) {
  const name = String(row.name ?? "").trim();
  if (row.brand !== "now_foods" && /^now real food/i.test(name)) return true;
  return false;
}

function canonicalName(name, brand) {
  return cleanProductName(name, brand)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .split(/\s+-\s+/)[0]
    .replace(/\b\d+\s*x\b/g, "")
    .replace(/\b\d+\s*(lb|lbs|g|kg|oz|ml|ct|count|servings|serving)\b/g, "")
    .replace(/\b(bundle|duo|stack|set|pack|prepaid|special offer|intro)\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function productImageScore(image) {
  const url = String(image.url ?? "").toLowerCase();
  let score = 0;

  for (const fragment of imagePenaltyFragments) {
    if (url.includes(fragment)) score += 20;
  }

  for (const fragment of displayOnlyFragments) {
    if (url.includes(fragment)) score -= 6;
  }

  const position = Number(image.position ?? 0);
  score += position === 0 || position === 1 ? 0 : position;

  const width = Number(image.width ?? 0);
  const height = Number(image.height ?? 0);
  if (width > 0 && height > 0 && width > height * 1.8) score += 12;

  return score;
}

function bestImagesForProducts(productIds) {
  const ids = productIds
    .map((id) => Number(id))
    .filter((id) => Number.isInteger(id) && id > 0);

  if (ids.length === 0) return new Map();

  const BATCH = 4000;
  const images = [];
  for (let i = 0; i < ids.length; i += BATCH) {
    const chunk = ids.slice(i, i + BATCH);
    const rows = runQuery(`
      select product_row_id, position, url, width, height
      from images
      where product_row_id in (${chunk.join(",")})
        and url is not null
      order by product_row_id asc, coalesce(position, 0) asc, id asc;
    `);
    for (const row of rows) images.push(row);
  }

  const bestByProductId = new Map();
  for (const image of images) {
    if (isBlockedImage(image.url)) continue;
    const current = bestByProductId.get(image.product_row_id);
    if (!current || productImageScore(image) < productImageScore(current)) {
      bestByProductId.set(image.product_row_id, image);
    }
  }

  return bestByProductId;
}

function productsForSection(section) {
  const allowedSql = allowedBrands.map(sqlString).join(",");
  const excludedSql = excludedBrands.map(sqlString).join(",");
  const forbiddenSql = notLikeAllSql("lower(p.name)", [
    ...forbiddenNameFilters,
    ...(section.nameExcludes ?? []),
  ]);
  const nameIncludesSql = likeAnySql("lower(p.name)", section.nameIncludes);

  const sql = `
    select
      p.id,
      p.brand,
      p.name,
      p.store_collection,
      p.price,
      coalesce(p.currency, 'USD') currency,
      p.url
    from products p
    join images i on i.product_row_id = p.id and i.url is not null
    where p.available = 1
      and p.price is not null
      and p.price between 8 and ${section.maxPrice}
      and p.url is not null
      and p.brand in (${allowedSql})
      and p.brand not in (${excludedSql})
      and coalesce(p.store_collection, '') not like 'soccer_%'
      and ${forbiddenSql}
      ${nameIncludesSql}
      and (${section.where})
    group by p.id
    order by
      case p.brand
        when 'optimum_nutrition' then 1
        when 'ghost_lifestyle' then 2
        when 'gorilla_mind' then 3
        when 'raw_nutrition' then 4
        when 'liquid_iv' then 5
        when 'therabody' then 6
        when 'hyperice' then 7
        when 'nike' then 8
        when 'allbirds' then 9
        when 'ten_thousand' then 10
        else 99
      end,
      coalesce(p.store_priority, 0) desc,
      p.price desc,
      p.name asc
    limit 120;
  `;

  const rows = runQuery(sql);
  const imageByProductId = bestImagesForProducts(rows.map((row) => row.id));
  const brandCounts = new Map();
  const products = [];

  for (const row of rows) {
    if (isBrandMismatch(row)) continue;
    if (!isOfficialBrandSource(row)) continue;

    const image = imageByProductId.get(row.id);
    if (!image) continue;
    row.image = image.url;

    const nameKey = canonicalName(row.name, row.brand);
    const currentImageKey = imageKey(row.image);
    if (!nameKey || !currentImageKey) continue;
    if (usedProductIds.has(row.id)) continue;
    if (usedNameKeys.has(`${row.brand}:${nameKey}`)) continue;
    if (usedImageKeys.has(currentImageKey)) continue;

    const brandCount = brandCounts.get(row.brand) ?? 0;
    if (brandCount >= (section.maxPerBrand ?? 4)) continue;

    usedProductIds.add(row.id);
    usedNameKeys.add(`${row.brand}:${nameKey}`);
    usedImageKeys.add(currentImageKey);
    brandCounts.set(row.brand, brandCount + 1);
    products.push({
      ...row,
      displayName: cleanProductName(row.name, row.brand),
      displayLabel: section.label ?? collectionLabel(row.store_collection),
    });

    if (products.length >= 14) break;
  }

  return products;
}

function html(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function money(value, currency) {
  const symbol = currency === "USD" ? "$" : `${currency} `;
  return `${symbol}${Number(value).toFixed(2)}`;
}

function readJsonFile(url, fallback) {
  try {
    if (!existsSync(url)) return fallback;
    return JSON.parse(readFileSync(url, "utf8")) ?? fallback;
  } catch {
    return fallback;
  }
}

function collectionLabel(value) {
  return String(value ?? "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function productCard(product, pathPrefix = "./") {
  const brand = brandNames[product.brand] ?? product.brand;
  const name = product.displayName ?? product.name;
  const label = product.displayLabel ?? collectionLabel(product.store_collection);
  const deal = product.deal;
  const dealEnds = deal?.expires_at
    ? new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
      }).format(new Date(deal.expires_at))
    : "";
  const searchText = [brand, name, label, product.sectionTitle, product.sectionEyebrow]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const pdpHref = `${pathPrefix}product/${html(product.id)}.html`;
  return `
          <article class="product-card" data-product-id="${html(product.id)}" data-category="${html(product.sectionId)}" data-search="${html(searchText)}">
            <a class="product-image" href="${pdpHref}">
              <img src="${html(product.image)}" alt="${html(name)}" loading="lazy" />
            </a>
            <div class="product-body">
              <span>${html(brand)}</span>
              <h3><a class="product-card-link" href="${pdpHref}">${html(name)}</a></h3>
              <p>${html(label)}</p>
              <div class="product-price-line">
                <strong>${html(money(product.price, product.currency))}</strong>
                ${
                  deal?.original_price
                    ? `<span>${html(money(deal.original_price, product.currency))}</span>`
                    : ""
                }
              </div>
              ${
                deal
                  ? `<p class="product-deal-note">${html(
                      `${deal.discount_percent}% off${dealEnds ? ` through ${dealEnds}` : ""}`
                    )}</p>`
                  : ""
              }
              <button
                class="add-cart-button"
                type="button"
                data-add-to-cart
                data-cart-id="${html(product.id)}"
                data-cart-brand="${html(brand)}"
                data-cart-name="${html(name)}"
                data-cart-price="${html(product.price)}"
                data-cart-currency="${html(product.currency)}"
                data-cart-image="${html(product.image)}"
              >Add to cart</button>
            </div>
          </article>`;
}

const populatedSections = sections
  .map((section) => ({ ...section, products: productsForSection(section) }))
  .filter((section) => section.products.length > 0);

const allCuratedProducts = populatedSections.flatMap((section) =>
  section.products.map((product) => ({
    ...product,
    sectionId: section.id,
    sectionTitle: section.title,
    sectionEyebrow: section.eyebrow,
    sectionDescription: section.description,
  }))
);

const dealsState = readJsonFile(new URL("../data/deals-state.json", import.meta.url), {
  offers: [],
});
const activeDealsByProductId = new Map(
  (Array.isArray(dealsState.offers) ? dealsState.offers : [])
    .filter((offer) => {
      const expiresAt = Date.parse(offer.expires_at || "");
      return offer.product_id != null && Number.isFinite(expiresAt) && expiresAt > Date.now();
    })
    .map((offer) => [String(offer.product_id), offer])
);

for (const product of allCuratedProducts) {
  const deal = activeDealsByProductId.get(String(product.id));
  if (!deal) continue;
  const originalPrice = Number(product.price || 0);
  const salePrice = Number(deal.sale_price_cents || 0) / 100;
  if (!salePrice || salePrice >= originalPrice) continue;
  product.price = salePrice;
  product.deal = {
    discount_percent: Number(deal.discount_percent || 0),
    original_price: originalPrice,
    expires_at: deal.expires_at,
    reason: deal.reason || "Limited-time Athletonic offer",
  };
}

const hydratedProductsBySectionId = new Map();
for (const product of allCuratedProducts) {
  if (!hydratedProductsBySectionId.has(product.sectionId)) {
    hydratedProductsBySectionId.set(product.sectionId, []);
  }
  hydratedProductsBySectionId.get(product.sectionId).push(product);
}
for (const section of populatedSections) {
  section.products = hydratedProductsBySectionId.get(section.id) ?? [];
}

const totalProducts = populatedSections.reduce(
  (sum, section) => sum + section.products.length,
  0
);

// ---------------------------------------------------------------------------
// Single source of truth: department/section id -> real category page.
// Reused by the top nav, hero links, and the PDP "shop the section" links so
// the generated markup never points at a dead in-page anchor.
// ---------------------------------------------------------------------------
const SECTION_PAGE_HREFS = {
  protein: "pages/protein.html",
  creatine: "pages/creatine.html",
  "pre-workout": "pages/pre-workout.html",
  hydration: "pages/hydration.html",
  vitamins: "pages/vitamins.html",
  greens: "pages/greens.html",
  "bars-shakes": "pages/bars-shakes.html",
  recovery: "pages/recovery.html",
  sleep: "pages/sleep.html",
  apparel: "pages/training-apparel.html",
  shoes: "pages/footwear.html",
  accessories: "pages/accessories.html",
  "training-gear": "pages/lifting-gear.html",
};

// Resolve a section id to its real category page when that page exists on disk;
// otherwise fall back to the in-page anchor so no nav link 404s.
function sectionHref(id, pathPrefix = "./") {
  const page = SECTION_PAGE_HREFS[id];
  if (page && existsSync(new URL(`../${page}`, import.meta.url))) {
    return `${pathPrefix}${page}`;
  }
  return `${pathPrefix}#${id}`;
}

const BRANDS_PAGE_HREF = existsSync(
  new URL("../pages/brands.html", import.meta.url)
)
  ? "pages/brands.html"
  : "#brands";

// Department navigation, reused by the home header and the PDP/info headers so
// every page (including category pages) gets the same reachable nav. A leading
// hamburger button toggles `.department-nav` on narrow viewports.
function departmentNavHtml(pathPrefix = "./") {
  const links = populatedSections
    .slice(0, 9)
    .map(
      (section) =>
        `<a href="${html(sectionHref(section.id, pathPrefix))}">${html(
          section.label ?? section.title
        )}</a>`
    )
    .join("\n        ");
  const brandsHref =
    BRANDS_PAGE_HREF === "#brands"
      ? `${pathPrefix}#brands`
      : `${pathPrefix}${BRANDS_PAGE_HREF}`;
  return `<nav class="department-nav" id="department-nav" data-department-nav aria-label="Department navigation">
        ${links}
        <a href="${html(brandsHref)}">Brands</a>
      </nav>`;
}

function navToggleButton() {
  return `<button class="nav-toggle" type="button" data-nav-toggle aria-expanded="false" aria-controls="department-nav" aria-label="Open department menu">
            <svg class="nav-toggle-icon" viewBox="0 0 24 24" aria-hidden="true">
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <line x1="3" y1="12" x2="21" y2="12"></line>
              <line x1="3" y1="18" x2="21" y2="18"></line>
            </svg>
          </button>`;
}

const sectionNav = departmentNavHtml("./");

// Shared <select> options for the search category filter, reused by the home
// header and every PDP/info/catalog header so the values stay in sync with the
// real section ids used by the catalog filter and product cards.
const categoryOptionsHtml = populatedSections
  .map(
    (section) =>
      `<option value="${html(section.id)}">${html(
        section.label ?? section.title
      )}</option>`
  )
  .join("\n              ");

const productSections = populatedSections
  .map(
    (section) => {
      const productsWithSection = section.products.map((product) => ({
        ...product,
        sectionId: section.id,
        sectionTitle: section.title,
        sectionEyebrow: section.eyebrow,
      }));
      return `
      <section id="${section.id}" class="market-section">
        <div class="section-title">
          <div>
            <p class="eyebrow">${html(section.eyebrow)}</p>
            <h2>${html(section.title)}</h2>
          </div>
          <p>${html(section.description)}</p>
        </div>
        <div class="product-row">
${productsWithSection.map((product) => productCard(product)).join("\n")}
        </div>
      </section>`;
    }
  )
  .join("\n");

const topBrands = ATHLETONIC_SOURCE_OF_TRUTH.featuredBrandSlugs.map(
  (brandSlug) => brandNames[brandSlug] ?? brandSlug
);

// ---------------------------------------------------------------------------
// Footer renderer — produces an enterprise-grade multi-tier footer.
// Data lives in `ATHLETONIC_SOURCE_OF_TRUTH.footer` so future pages
// (shop, brands, deals) can reuse the same markup without duplication.
// ---------------------------------------------------------------------------
function resolveSiteHref(href, pathPrefix = "./") {
  const value = String(href ?? "").trim();
  if (!value) return "#";
  if (/^(https?:|mailto:|tel:)/i.test(value)) return value;
  if (value.startsWith("#")) return `${pathPrefix}${value}`;
  if (value.startsWith("./") || value.startsWith("../") || value.startsWith("/")) {
    return value;
  }
  return `${pathPrefix}${value}`;
}

function renderFooterLinkList(links, pathPrefix = "./") {
  return links
    .map(
      (link) =>
        `<li><a href="${html(resolveSiteHref(link.href, pathPrefix))}"${
          link.external ? ' rel="noopener noreferrer" target="_blank"' : ""
        }>${html(link.label)}</a></li>`
    )
    .join("\n              ");
}

function renderFooter(pathPrefix = "./") {
  const footer = ATHLETONIC_SOURCE_OF_TRUTH.footer;

  const newsletter = `
      <section class="footer-newsletter" aria-labelledby="footer-newsletter-title">
        <div class="footer-newsletter-inner">
          <div class="footer-newsletter-copy">
            <p class="footer-newsletter-eyebrow">${html(footer.newsletter.eyebrow)}</p>
            <h2 id="footer-newsletter-title" class="footer-newsletter-headline">${html(
              footer.newsletter.headline
            )}</h2>
            <p class="footer-newsletter-text">${html(footer.newsletter.copy)}</p>
          </div>
          <form class="footer-newsletter-form" data-footer-newsletter novalidate>
            <label class="sr-only" for="footer-newsletter-email">Email address</label>
            <input
              id="footer-newsletter-email"
              name="email"
              type="email"
              autocomplete="email"
              required
              placeholder="${html(footer.newsletter.placeholder)}"
            />
            <input type="text" name="company" tabindex="-1" autocomplete="off" class="sr-only" aria-hidden="true" />
            <button type="submit">${html(footer.newsletter.cta)}</button>
            <p class="footer-newsletter-status" data-footer-newsletter-status role="status" aria-live="polite"></p>
          </form>
        </div>
      </section>`;

  const backToTop = `
      <button type="button" class="footer-backtotop" data-back-to-top>
        <span>${html(footer.backToTop.label)}</span>
      </button>`;

  const columns = `
      <nav class="footer-main-grid" aria-label="Footer">
        ${footer.columns
          .map(
            (col) => `<div class="footer-col">
          <h3>${html(col.title)}</h3>
          <ul>
              ${renderFooterLinkList(col.links, pathPrefix)}
          </ul>
        </div>`
          )
          .join("\n        ")}
      </nav>`;

  const locale = `
      <div class="footer-locale" role="group" aria-label="Region preferences">
        <button type="button" class="footer-locale-pill" aria-disabled="true" disabled>
          <span class="footer-locale-text"><small>${html(footer.locale.language.label)}</small>${html(
    footer.locale.language.value
  )}</span>
        </button>
        <button type="button" class="footer-locale-pill" aria-disabled="true" disabled>
          <span class="footer-locale-text"><small>${html(footer.locale.currency.label)}</small>${html(
    footer.locale.currency.value
  )}</span>
        </button>
        <button type="button" class="footer-locale-pill" aria-disabled="true" disabled>
          <span class="footer-locale-text"><small>${html(footer.locale.country.label)}</small>${html(
    footer.locale.country.value
  )}</span>
        </button>
      </div>`;

  // Resolve mega-grid: fill any column that requests featured brands.
  const megaColumns = footer.megaGrid.map((col) => {
    if (col.linksFromFeaturedBrands) {
      const n = col.linksFromFeaturedBrands;
      const brandLinks = ATHLETONIC_SOURCE_OF_TRUTH.featuredBrandSlugs
        .slice(0, n)
        .map((slug) => ({
          label: brandNames[slug] ?? slug,
          href: `pages/brands.html#brand-${slug}`,
        }));
      return { title: col.title, links: brandLinks };
    }
    return col;
  });

  const mega = `
      <nav class="footer-mega" aria-label="Site directory">
        ${megaColumns
          .map(
            (col) => `<div class="footer-mega-col">
          <h4>${html(col.title)}</h4>
          <ul>
              ${renderFooterLinkList(col.links, pathPrefix)}
          </ul>
        </div>`
          )
          .join("\n        ")}
      </nav>`;

  const legalLinks = footer.legal.links
    .map(
      (link) =>
        `<li><a href="${html(resolveSiteHref(link.href, pathPrefix))}">${html(
          link.label
        )}</a></li>`
    )
    .join("\n            ");

  const legal = `
      <div class="footer-legal">
        <a class="footer-legal-brand" href="${pathPrefix}" aria-label="Athletonic home">
          <img src="${pathPrefix}assets/logo.png" alt="Athletonic" />
        </a>
        <ul class="footer-legal-links">
            ${legalLinks}
        </ul>
        <p class="footer-legal-copy">${html(footer.legal.copyright)}</p>
      </div>`;

  return `
    <footer class="market-footer" role="contentinfo">
${newsletter}
${backToTop}
${columns}
${locale}
${mega}
${legal}
    </footer>`;
}

const page = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Athletonic.com</title>
    <meta
      name="description"
      content="Athletonic.com is a performance store for supplements, sports nutrition, hydration, recovery, apparel, and fitness essentials."
    />
    <link rel="stylesheet" href="./styles.css" />
  </head>
  <body>
    <a id="top" tabindex="-1" aria-hidden="true"></a>
    <header class="market-header">
      <div class="header-main">
        ${navToggleButton()}
        <a class="brand" href="./" aria-label="Athletonic home">
          <img class="brand-logo" src="./assets/logo.png" alt="Athletonic" />
        </a>

        <form class="market-search" action="./pages/catalog.html" method="get" data-catalog-search>
          <select name="category" aria-label="Search category">
            <option value="all">All</option>
            ${categoryOptionsHtml}
          </select>
          <input
            name="q"
            type="search"
            aria-label="Search Athletonic"
            placeholder="Search protein, creatine, hydration, apparel, recovery..."
          />
          <button type="submit">Search</button>
        </form>

        <div class="header-actions" aria-label="Account and cart">
          <button class="header-icon-button" type="button" data-account-open aria-haspopup="dialog">
            <svg class="header-icon" viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="10"></circle>
              <circle cx="12" cy="10" r="3"></circle>
              <path d="M7 20.4a5.5 5.5 0 0 1 10 0"></path>
            </svg>
            <span class="header-action-label" data-account-label>Guest</span>
          </button>
          <button class="header-icon-button cart-button" type="button" data-cart-open aria-haspopup="dialog" aria-label="Open cart">
            <svg class="header-icon" viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="8" cy="21" r="1"></circle>
              <circle cx="19" cy="21" r="1"></circle>
              <path d="M2.05 2.05h2l2.65 12.4a2 2 0 0 0 2 1.6h8.95a2 2 0 0 0 1.95-1.57l1.25-5.48H5.45"></path>
            </svg>
            <span class="header-action-label">Cart</span>
            <span class="cart-count" data-cart-count>0</span>
          </button>
        </div>
      </div>

      ${sectionNav}
    </header>

    <div class="drawer-overlay" data-drawer-overlay hidden></div>
    <aside class="account-panel" data-account-panel hidden aria-hidden="true" aria-labelledby="account-title">
      <div class="drawer-header">
        <div>
          <p class="drawer-eyebrow">Account</p>
          <h2 id="account-title">Guest checkout profile</h2>
        </div>
        <button class="drawer-close" type="button" data-account-close aria-label="Close account panel">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M18 6 6 18"></path>
            <path d="m6 6 12 12"></path>
          </svg>
        </button>
      </div>
      <form class="account-form" data-account-form>
        <label for="guest-email">Email for checkout updates</label>
        <input id="guest-email" name="email" type="email" autocomplete="email" placeholder="you@example.com" required />
        <button type="submit">Save email</button>
        <p class="form-note">Guest checkout stays available. This email only connects your cart to follow-up and order communication.</p>
        <p class="form-status" data-account-status aria-live="polite"></p>
      </form>
    </aside>

    <aside class="cart-drawer" data-cart-drawer hidden aria-hidden="true" aria-labelledby="cart-title">
      <div class="drawer-header">
        <div>
          <p class="drawer-eyebrow">Checkout</p>
          <h2 id="cart-title">Your cart</h2>
        </div>
        <button class="drawer-close" type="button" data-cart-close aria-label="Close cart">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M18 6 6 18"></path>
            <path d="m6 6 12 12"></path>
          </svg>
        </button>
      </div>
      <div class="cart-items" data-cart-items></div>
      <p class="form-status drawer-status" data-checkout-status aria-live="polite"></p>
      <form class="checkout-form" data-checkout-form>
        <label for="checkout-email">Email</label>
        <input id="checkout-email" name="email" type="email" autocomplete="email" placeholder="you@example.com" required />
        <div class="cart-total">
          <span>Subtotal</span>
          <strong data-cart-subtotal>$0.00</strong>
        </div>
        <button type="submit" data-checkout-submit>Continue to secure payment</button>
        <p class="form-note">Payment is processed securely with Stripe. Athletonic creates your order after payment is confirmed.</p>
      </form>
    </aside>

    <main>
      <p class="search-status" id="catalog" aria-live="polite" hidden></p>

      <section class="hero">
        <div class="hero-copy">
          <p class="eyebrow"><img class="eyebrow-logo" src="./assets/logo.png" alt="Athletonic" /></p>
          <h1>Build your training stack in one store.</h1>
          <p>
            Supplements, hydration, wellness, recovery devices, footwear,
            apparel, bottles, bags, and gym accessories from fitness-first brands.
          </p>
          <div class="hero-actions">
            <a href="${sectionHref("protein")}">Shop products</a>
            <a href="./${BRANDS_PAGE_HREF}">Browse brands</a>
          </div>
        </div>

        <div class="hero-deal" id="catalog-summary">
          <span class="deal-label">Catalog snapshot</span>
          <img
            src="https://cdn.shopify.com/s/files/1/0794/9991/9627/files/on-ON-2-GSW-2270g-bundle_Image_01_1.png"
            alt="Gold Standard 100% Whey Protein"
          />
          <h2>${totalProducts} curated products</h2>
          <p>Protein, creatine, pre-workout, hydration, recovery, apparel, footwear, and accessories.</p>
          <strong>Sold through Athletonic</strong>
        </div>
      </section>

      <section class="quick-grid" aria-label="Shop by department">
        <article>
          <h2>Sports Nutrition</h2>
          <p>Protein, creatine, pre-workout, amino acids, bars, and shakes.</p>
          <a href="${sectionHref("protein")}">Shop nutrition</a>
        </article>
        <article>
          <h2>Hydration & Wellness</h2>
          <p>Electrolytes, vitamins, minerals, greens, gut health, and focus support.</p>
          <a href="${sectionHref("hydration")}">See wellness</a>
        </article>
        <article>
          <h2>Apparel & Footwear</h2>
          <p>Training shoes, leggings, shorts, shirts, bags, bottles, and shakers.</p>
          <a href="${sectionHref("apparel")}">View apparel</a>
        </article>
        <article>
          <h2>Recovery</h2>
          <p>Massage, compression, sleep masks, mobility, and post-training support.</p>
          <a href="${sectionHref("recovery")}">View recovery</a>
        </article>
      </section>

${productSections}

      <section id="brands" class="market-section brand-section">
        <div class="section-title">
          <div>
            <p class="eyebrow">Brands</p>
            <h2>Aligned performance brands</h2>
          </div>
          <p>Fitness, sports nutrition, wellness, apparel, accessories, and recovery brands only.</p>
        </div>

        <div class="brand-cloud">
          ${topBrands.map((brand) => `<span>${html(brand)}</span>`).join("\n          ")}
        </div>
      </section>
    </main>

${renderFooter("./")}
    <script>
      window.ATHLETONIC_SUPABASE_URL = "${html(SUPABASE_PUBLIC_URL)}";
      window.ATHLETONIC_SUPABASE_KEY = "${html(SUPABASE_PUBLIC_KEY)}";
    </script>
    <script src="./assets/cart.js" defer></script>
  </body>
</html>
`;

writeFileSync(new URL("../index.html", import.meta.url), page);
console.log(
  `Generated ${totalProducts} products across ${populatedSections.length} sections.`
);

// ---------------------------------------------------------------------------
// Product Detail Pages (PDPs)
// ---------------------------------------------------------------------------

const commerceCatalogDir = new URL("../data/", import.meta.url);
mkdirSync(commerceCatalogDir, { recursive: true });
writeFileSync(
  new URL("athletonic-catalog.json", commerceCatalogDir),
  JSON.stringify(
    {
      generated_at: new Date().toISOString(),
      currency: ATHLETONIC_SOURCE_OF_TRUTH.marketplace.currency,
      products: allCuratedProducts.map((product) => ({
        id: String(product.id),
        brand_slug: product.brand,
        brand: brandNames[product.brand] ?? product.brand,
        name: product.displayName ?? product.name,
        sku: product.sku ?? null,
        url: product.url ?? null,
        image: product.image ?? null,
        price_cents: Math.round(Number(product.price || 0) * 100),
        compare_at_price_cents: product.deal?.original_price
          ? Math.round(Number(product.deal.original_price) * 100)
          : null,
        currency: product.currency || ATHLETONIC_SOURCE_OF_TRUTH.marketplace.currency,
        available: true,
        section_id: product.sectionId,
        section_title: product.sectionTitle,
        deal: product.deal
          ? {
              discount_percent: product.deal.discount_percent,
              expires_at: product.deal.expires_at,
              reason: product.deal.reason,
            }
          : null,
      })),
    },
    null,
    2
  )
);

// ---------------------------------------------------------------------------
// Full-catalog search index (data/search-index.json)
//
// Lightweight records spanning the ENTIRE active US (USD) catalog: every
// available, priced, imaged product regardless of brand allowlist, so searches
// surface the full inventory (e.g. Twins Special, soccer/World-Cup jerseys, and
// any other real product). Only guardrails kept: must be available, have a
// price + image, be priced in USD (THB/foreign excluded), not on the brand
// deny-list, not a forbidden junk/service name, and not served from a blocked
// reseller domain. Only search/card fields are stored (no descriptions/HTML).
// ---------------------------------------------------------------------------
function categoryForRow(row) {
  const dept = String(row.store_department ?? "");
  const coll = String(row.store_collection ?? "");
  const key = `${dept}/${coll}`;
  const map = {
    "sports_nutrition/protein": "protein",
    "sports_nutrition/mass_gainers": "protein",
    "sports_nutrition/creatine": "creatine",
    "sports_nutrition/pre_workout": "pre-workout",
    "sports_nutrition/amino_acids": "recovery",
    "sports_nutrition/recovery": "recovery",
    "supplements/amino_acids": "recovery",
    "wellness_goals/energy_hydration": "hydration",
    "supplements/greens_superfoods": "greens",
    "functional_foods/protein_bars": "bars-shakes",
    "functional_foods/rtd_shakes": "bars-shakes",
    "functional_foods/meal_replacement": "bars-shakes",
    "functional_foods/snacks": "bars-shakes",
    "wellness_devices/recovery_devices": "recovery",
    "wellness_devices/sleep_gear": "sleep",
    "wellness_goals/sleep_stress": "sleep",
    "apparel_accessories/apparel": "apparel",
    "apparel_accessories/shoes": "shoes",
    "apparel_accessories/bags_bottles": "accessories",
    "sports_gear/fight_gear": "training-gear",
  };
  if (map[key]) return map[key];
  if (dept === "vitamins_health") return "vitamins";
  if (dept === "womens_wellness") return "vitamins";
  if (dept === "supplements" || dept === "wellness_goals") return "vitamins";
  return "";
}

const sectionTitleById = Object.fromEntries(
  sections.map((section) => [section.id, section.label ?? section.title])
);

// Junk/service names to keep out of the full search index. Unlike the curated
// catalog's forbiddenNameFilters, this does NOT exclude soccer/football/jersey
// or the soccer storefront brands — those are real US inventory the search must
// surface. Only non-product service add-ons and test rows are removed.
const indexJunkNameFilters = [
  "package protection",
  "returns protection",
  "shipping protection",
  "free returns",
  "sample",
  "tester",
  "test product",
  "dented",
  "free gifts",
  "welcome gift",
  "free welcome",
  "prepaid",
  "logo print",
];

function buildSearchIndex() {
  const forbiddenSql = notLikeAllSql("lower(p.name)", indexJunkNameFilters);
  const sql = `
    select
      p.id,
      p.brand,
      p.name,
      p.store_department,
      p.store_collection,
      p.price,
      coalesce(p.currency, 'USD') currency,
      p.url,
      coalesce(p.store_priority, 0) store_priority
    from products p
    join images i on i.product_row_id = p.id and i.url is not null
    where p.available = 1
      and p.price is not null
      and p.price between 3 and 2000
      and p.url is not null
      and coalesce(p.currency, 'USD') = 'USD'
      and ${forbiddenSql}
    group by p.id
    order by coalesce(p.store_priority, 0) desc, p.price desc, p.name asc;
  `;
  const rows = runQuery(sql);
  const imageByProductId = bestImagesForProducts(rows.map((row) => row.id));

  const MAX_RECORDS = 50000;
  const records = [];
  for (const row of rows) {
    if (records.length >= MAX_RECORDS) break;
    const domain = sourceDomain(row.url);
    if (!domain || blockedSourceDomains.has(domain)) continue;
    const image = imageByProductId.get(row.id);
    if (!image || isBlockedImage(image.url)) continue;

    const id = String(row.id);
    const brandLabel = brandNames[row.brand] ?? row.brand;
    const name = cleanProductName(row.name, row.brand);
    if (!name) continue;
    const category = categoryForRow(row);
    const sectionTitle = sectionTitleById[category] ?? "Athletonic catalog";
    const record = {
      id,
      name,
      brand: brandLabel,
      brand_slug: row.brand,
      section_id: category,
      url: row.url ?? null,
      image: image.url,
      price_cents: Math.round(Number(row.price || 0) * 100),
      search: [name, brandLabel, sectionTitle, category]
        .filter(Boolean)
        .join(" ")
        .toLowerCase(),
    };
    // Currency is USD (US-only store) and availability is always true here, so
    // both are omitted to keep the index small; the client defaults them. Every
    // indexed product now has a generated on-site PDP (product/<id>.html), so
    // catalogCardHtml always links on-site instead of the external brand url.
    record.has_pdp = true;
    records.push(record);
  }
  return records;
}

const searchIndexRecords = buildSearchIndex();
writeFileSync(
  new URL("search-index.json", commerceCatalogDir),
  JSON.stringify(
    {
      generated_at: new Date().toISOString(),
      currency: ATHLETONIC_SOURCE_OF_TRUTH.marketplace.currency,
      count: searchIndexRecords.length,
      products: searchIndexRecords,
    },
    null,
    0
  )
);
console.log(
  `Generated search index with ${searchIndexRecords.length} products in /data/search-index.json.`
);

function fetchPdpData(productIds) {
  const ids = productIds
    .map((id) => Number(id))
    .filter((id) => Number.isInteger(id) && id > 0);
  if (ids.length === 0) return { rowsById: new Map(), imagesById: new Map() };

  // Batch DB reads in chunks so large id sets (the full ~34.5k catalog) do not
  // build oversized SQL strings or overflow sqlite3's stdout buffer (ENOBUFS),
  // mirroring bestImagesForProducts.
  const BATCH = 3000;
  const rowsById = new Map();
  const imagesById = new Map();

  for (let i = 0; i < ids.length; i += BATCH) {
    const chunk = ids.slice(i, i + BATCH);

    const rows = runQuery(`
      select id, brand, name, handle, description_html, price, compare_at_price,
             currency, options, tags, store_collection, category_normalized, url
      from products
      where id in (${chunk.join(",")});
    `);
    for (const row of rows) rowsById.set(row.id, row);

    const images = runQuery(`
      select product_row_id, position, url, width, height
      from images
      where product_row_id in (${chunk.join(",")})
        and url is not null
      order by product_row_id asc, coalesce(position, 0) asc, id asc;
    `);
    for (const image of images) {
      if (isBlockedImage(image.url)) continue;
      if (!imagesById.has(image.product_row_id)) {
        imagesById.set(image.product_row_id, []);
      }
      imagesById.get(image.product_row_id).push(image);
    }
  }

  for (const list of imagesById.values()) {
    list.sort((a, b) => productImageScore(a) - productImageScore(b));
  }
  return { rowsById, imagesById };
}

function safeParseJson(raw, fallback) {
  if (raw == null || raw === "") return fallback;
  try {
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

const ALLOWED_DESC_TAGS = new Set([
  "p", "br", "strong", "b", "em", "i", "u", "ul", "ol", "li",
  "h1", "h2", "h3", "h4", "h5", "h6", "span", "div", "table",
  "thead", "tbody", "tr", "td", "th", "small", "sub", "sup", "hr",
]);

function sanitizeDescriptionHtml(raw) {
  if (!raw) return "";
  let out = String(raw);
  // Strip <script>, <style>, <meta>, <link>, <iframe>, <object>, <embed>, comments, doctypes
  out = out.replace(/<!--([\s\S]*?)-->/g, "");
  out = out.replace(/<!doctype[^>]*>/gi, "");
  out = out.replace(
    /<\s*(script|style|meta|link|iframe|object|embed|noscript)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi,
    ""
  );
  out = out.replace(
    /<\s*(script|style|meta|link|iframe|object|embed|noscript)\b[^>]*\/?>/gi,
    ""
  );
  // Keep only a small tag set and strip source attributes such as ids/classes.
  out = out.replace(/<\s*(\/?)\s*([a-zA-Z0-9]+)\b[^>]*>/g, (_match, slash, tag) => {
    const normalizedTag = tag.toLowerCase();
    if (!ALLOWED_DESC_TAGS.has(normalizedTag)) return "";
    const safeTag = normalizedTag === "h1" || normalizedTag === "h2" ? "h3" : normalizedTag;
    return `<${slash ? "/" : ""}${safeTag}>`;
  });
  // Strip inline event handlers and javascript: URIs
  out = out.replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, "");
  out = out.replace(/\son[a-z]+\s*=\s*'[^']*'/gi, "");
  out = out.replace(/javascript:/gi, "");
  return out.trim();
}

function renderPdpHeader(pathPrefix) {
  return `
    <header class="market-header pdp-header">
      <div class="header-main">
        ${navToggleButton()}
        <a class="brand" href="${pathPrefix}" aria-label="Athletonic home">
          <img class="brand-logo" src="${pathPrefix}assets/logo.png" alt="Athletonic" />
        </a>
        <div class="pdp-header-search">
          <form class="market-search" action="${pathPrefix}pages/catalog.html" method="get" data-catalog-search>
            <select name="category" aria-label="Search category">
              <option value="all">All</option>
              ${categoryOptionsHtml}
            </select>
            <input
              name="q"
              type="search"
              aria-label="Search Athletonic"
              placeholder="Search products, brands, categories..."
            />
            <button type="submit">Search</button>
          </form>
        </div>
        <div class="header-actions" aria-label="Account and cart">
          <button class="header-icon-button" type="button" data-account-open aria-haspopup="dialog">
            <svg class="header-icon" viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="10"></circle>
              <circle cx="12" cy="10" r="3"></circle>
              <path d="M7 20.4a5.5 5.5 0 0 1 10 0"></path>
            </svg>
            <span class="header-action-label" data-account-label>Guest</span>
          </button>
          <button class="header-icon-button cart-button" type="button" data-cart-open aria-haspopup="dialog" aria-label="Open cart">
            <svg class="header-icon" viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="8" cy="21" r="1"></circle>
              <circle cx="19" cy="21" r="1"></circle>
              <path d="M2.05 2.05h2l2.65 12.4a2 2 0 0 0 2 1.6h8.95a2 2 0 0 0 1.95-1.57l1.25-5.48H5.45"></path>
            </svg>
            <span class="header-action-label">Cart</span>
            <span class="cart-count" data-cart-count>0</span>
          </button>
        </div>
      </div>
      ${departmentNavHtml(pathPrefix)}
    </header>`;
}

function renderDrawers() {
  return `
    <div class="drawer-overlay" data-drawer-overlay hidden></div>
    <aside class="account-panel" data-account-panel hidden aria-hidden="true" aria-labelledby="account-title">
      <div class="drawer-header">
        <div>
          <p class="drawer-eyebrow">Account</p>
          <h2 id="account-title">Guest checkout profile</h2>
        </div>
        <button class="drawer-close" type="button" data-account-close aria-label="Close account panel">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M18 6 6 18"></path>
            <path d="m6 6 12 12"></path>
          </svg>
        </button>
      </div>
      <form class="account-form" data-account-form>
        <label for="guest-email">Email for checkout updates</label>
        <input id="guest-email" name="email" type="email" autocomplete="email" placeholder="you@example.com" required />
        <button type="submit">Save email</button>
        <p class="form-note">Guest checkout stays available. This email only connects your cart to follow-up and order communication.</p>
        <p class="form-status" data-account-status aria-live="polite"></p>
      </form>
    </aside>

    <aside class="cart-drawer" data-cart-drawer hidden aria-hidden="true" aria-labelledby="cart-title">
      <div class="drawer-header">
        <div>
          <p class="drawer-eyebrow">Checkout</p>
          <h2 id="cart-title">Your cart</h2>
        </div>
        <button class="drawer-close" type="button" data-cart-close aria-label="Close cart">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M18 6 6 18"></path>
            <path d="m6 6 12 12"></path>
          </svg>
        </button>
      </div>
      <div class="cart-items" data-cart-items></div>
      <p class="form-status drawer-status" data-checkout-status aria-live="polite"></p>
      <form class="checkout-form" data-checkout-form>
        <label for="checkout-email">Email</label>
        <input id="checkout-email" name="email" type="email" autocomplete="email" placeholder="you@example.com" required />
        <div class="cart-total">
          <span>Subtotal</span>
          <strong data-cart-subtotal>$0.00</strong>
        </div>
        <button type="submit" data-checkout-submit>Continue to secure payment</button>
        <p class="form-note">Payment is processed securely with Stripe. Athletonic creates your order after payment is confirmed.</p>
      </form>
    </aside>`;
}

function productPage(curated, fullRow, imageList, relatedProducts) {
  const pathPrefix = "../";
  const brand = brandNames[curated.brand] ?? curated.brand;
  const name = curated.displayName ?? curated.name;
  const price = Number(curated.price ?? fullRow?.price ?? 0);
  const compareAt = Number(curated.deal?.original_price ?? fullRow?.compare_at_price ?? 0);
  const currency = fullRow?.currency || curated.currency || "USD";
  const onSale = compareAt > 0 && compareAt > price;
  const discountPct = onSale
    ? Math.round(((compareAt - price) / compareAt) * 100)
    : 0;

  // Build image list: curated.image first (already best on home), then rest deduped
  const seen = new Set();
  const images = [];
  if (curated.image) {
    images.push(curated.image);
    seen.add(curated.image);
  }
  for (const img of imageList || []) {
    if (img.url && !seen.has(img.url)) {
      images.push(img.url);
      seen.add(img.url);
    }
  }
  if (images.length === 0 && curated.image) images.push(curated.image);

  const options = safeParseJson(fullRow?.options, []);
  const variantOptions = Array.isArray(options)
    ? options.filter(
        (opt) =>
          opt &&
          typeof opt === "object" &&
          Array.isArray(opt.values) &&
          opt.values.filter((v) => v != null && String(v).trim() !== "").length > 1
      )
    : [];

  const description = sanitizeDescriptionHtml(fullRow?.description_html);

  // External brand page kept ONLY as a secondary reference (never the primary
  // click target). The on-site PDP is the destination from search and cards.
  const officialUrl = curated.url || fullRow?.url || "";
  const officialLinkHtml = officialUrl
    ? `<p class="pdp-official-link"><a href="${html(
        officialUrl
      )}" target="_blank" rel="noopener nofollow">View official brand page ↗</a></p>`
    : "";

  const galleryHtml = `
        <div class="pdp-gallery">
          <div class="pdp-gallery-main">
            <img id="pdp-main-image" src="${html(images[0])}" alt="${html(name)}" />
          </div>
          ${
            images.length > 1
              ? `<div class="pdp-thumbs" role="tablist" aria-label="Product images">
            ${images
              .map(
                (src, idx) => `<button type="button" class="pdp-thumb${
                  idx === 0 ? " is-active" : ""
                }" data-pdp-thumb data-src="${html(src)}" aria-label="View image ${
                  idx + 1
                }"><img src="${html(src)}" alt="" loading="lazy" /></button>`
              )
              .join("\n            ")}
          </div>`
              : ""
          }
        </div>`;

  const variantSelectorsHtml = variantOptions.length
    ? `
          <div class="pdp-variants" data-pdp-variants>
            ${variantOptions
              .map(
                (opt, idx) => `
            <label class="pdp-variant">
              <span class="pdp-variant-label">${html(opt.name || "Option")}</span>
              <select data-pdp-variant data-variant-name="${html(opt.name || `Option ${idx + 1}`)}" required>
                <option value="" disabled selected>Select ${html(opt.name || "option")}…</option>
                ${opt.values
                  .filter((v) => v != null && String(v).trim() !== "")
                  .map(
                    (val) =>
                      `<option value="${html(val)}">${html(val)}</option>`
                  )
                  .join("\n                ")}
              </select>
            </label>`
              )
              .join("")}
          </div>`
    : "";

  const relatedHtml = relatedProducts && relatedProducts.length
    ? `
      <section class="market-section pdp-related">
        <div class="section-title">
          <div>
            <p class="eyebrow">More in ${html(curated.sectionTitle || "this category")}</p>
            <h2>You may also like</h2>
          </div>
        </div>
        <div class="product-row">
${relatedProducts.map((product) => productCard(product, pathPrefix)).join("\n")}
        </div>
      </section>`
    : "";

  const breadcrumbHtml = `
        <nav class="pdp-breadcrumb" aria-label="Breadcrumb">
          <a href="${pathPrefix}">Home</a>
          <span aria-hidden="true">›</span>
          <a href="${html(
            resolveSiteHref(
              SECTION_PAGE_HREFS[curated.sectionId] ?? `#${curated.sectionId}`,
              pathPrefix
            )
          )}">${html(curated.sectionTitle || "Catalog")}</a>
          <span aria-hidden="true">›</span>
          <span class="pdp-breadcrumb-current">${html(name)}</span>
        </nav>`;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${html(name)} — ${html(brand)} | Athletonic</title>
    <meta name="description" content="${html(
      `${name} by ${brand}. Buy directly on Athletonic, a performance store for sports nutrition, hydration, recovery, apparel, and training gear.`
    )}" />
    <meta property="og:title" content="${html(`${name} — ${brand}`)}" />
    <meta property="og:type" content="product" />
    <meta property="og:image" content="${html(images[0] || "")}" />
    <link rel="stylesheet" href="${pathPrefix}styles.css" />
  </head>
  <body class="pdp-body">
    <a id="top" tabindex="-1" aria-hidden="true"></a>
${renderPdpHeader(pathPrefix)}
${renderDrawers()}

    <main class="pdp-main">
${breadcrumbHtml}

      <article class="pdp-wrap">
${galleryHtml}

        <div class="pdp-info">
          <p class="pdp-brand">${html(brand)}</p>
          <h1 class="pdp-title">${html(name)}</h1>
          <div class="pdp-price-row">
            <strong class="pdp-price">${html(money(price, currency))}</strong>
            ${
              onSale
                ? `<span class="pdp-compare">${html(
                    money(compareAt, currency)
                  )}</span><span class="pdp-discount">−${discountPct}%</span>`
                : ""
            }
          </div>
          <p class="pdp-availability">In stock · Sold by Athletonic</p>
${variantSelectorsHtml}
          <div class="pdp-cta-row">
            <button
              class="pdp-cta"
              type="button"
              data-add-to-cart
              data-pdp-add-button
              data-cart-id="${html(curated.id)}"
              data-cart-brand="${html(brand)}"
              data-cart-name="${html(name)}"
              data-cart-price="${html(price)}"
              data-cart-currency="${html(currency)}"
              data-cart-image="${html(images[0] || curated.image || "")}"
              data-cart-variant=""
              ${variantOptions.length ? "disabled" : ""}
            >${variantOptions.length ? "Select options" : "Add to cart"}</button>
          </div>
          <p class="pdp-cta-note" data-pdp-cta-note></p>
          ${officialLinkHtml}

          ${
            description
              ? `<section class="pdp-section">
            <h2>About this product</h2>
            <div class="pdp-desc">${description}</div>
          </section>`
              : ""
          }
          <section class="pdp-section pdp-specs">
            <h2>Details</h2>
            <dl>
              <div><dt>Brand</dt><dd>${html(brand)}</dd></div>
              <div><dt>Category</dt><dd>${html(
                curated.sectionTitle || collectionLabel(curated.store_collection || "")
              )}</dd></div>
              ${
                fullRow?.handle
                  ? `<div><dt>Reference</dt><dd>${html(fullRow.handle)}</dd></div>`
                  : ""
              }
            </dl>
          </section>
        </div>
      </article>
${relatedHtml}
    </main>

${renderFooter(pathPrefix)}
    <script>
      window.ATHLETONIC_SUPABASE_URL = "${html(SUPABASE_PUBLIC_URL)}";
      window.ATHLETONIC_SUPABASE_KEY = "${html(SUPABASE_PUBLIC_KEY)}";
    </script>
    <script src="${pathPrefix}assets/cart.js" defer></script>
    <script>
      (function () {
        // Gallery: thumbnail click swaps main image
        var mainImg = document.getElementById("pdp-main-image");
        var thumbs = document.querySelectorAll("[data-pdp-thumb]");
        thumbs.forEach(function (btn) {
          btn.addEventListener("click", function () {
            var src = btn.getAttribute("data-src");
            if (src && mainImg) mainImg.src = src;
            thumbs.forEach(function (b) { b.classList.remove("is-active"); });
            btn.classList.add("is-active");
          });
        });

        // Variants: gate Add to Cart on selection; encode variant into data-cart-variant
        var addBtn = document.querySelector("[data-pdp-add-button]");
        var note = document.querySelector("[data-pdp-cta-note]");
        var selects = Array.from(document.querySelectorAll("[data-pdp-variant]"));
        function refresh() {
          if (!addBtn) return;
          var allChosen = selects.every(function (s) { return s.value !== ""; });
          if (selects.length === 0) {
            addBtn.disabled = false;
            return;
          }
          if (allChosen) {
            var parts = selects.map(function (s) { return s.value; });
            addBtn.dataset.cartVariant = parts.join(" / ");
            addBtn.disabled = false;
            addBtn.textContent = "Add to cart";
            if (note) note.textContent = "";
          } else {
            addBtn.dataset.cartVariant = "";
            addBtn.disabled = true;
            addBtn.textContent = "Select options";
          }
        }
        selects.forEach(function (s) { s.addEventListener("change", refresh); });
        refresh();
      })();
    </script>
  </body>
</html>
  `;
}

const sectionById = new Map(populatedSections.map((section) => [section.id, section]));
const productsBySectionId = new Map();
for (const product of allCuratedProducts) {
  if (!productsBySectionId.has(product.sectionId)) {
    productsBySectionId.set(product.sectionId, []);
  }
  productsBySectionId.get(product.sectionId).push(product);
}

function productSearchText(product) {
  return [
    brandNames[product.brand] ?? product.brand,
    product.displayName ?? product.name,
    product.displayLabel,
    product.store_collection,
    product.sectionTitle,
    product.sectionEyebrow,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function productMatchesTerms(product, terms = []) {
  if (!terms.length) return true;
  const searchText = productSearchText(product);
  return terms.some((term) => searchText.includes(term.toLowerCase()));
}

function uniqueProducts(products = [], limit = 14) {
  const seen = new Set();
  const out = [];
  for (const product of products) {
    const key = String(product.id);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(product);
    if (out.length >= limit) break;
  }
  return out;
}

function sectionProducts(sectionId, limit = 14) {
  return uniqueProducts(productsBySectionId.get(sectionId) ?? [], limit);
}

function blendedProducts(sectionIds = [], limit = 14) {
  const buckets = sectionIds.map((sectionId) => sectionProducts(sectionId, 80));
  const maxLength = Math.max(0, ...buckets.map((bucket) => bucket.length));
  const blended = [];
  for (let index = 0; index < maxLength && blended.length < limit * 3; index += 1) {
    for (const bucket of buckets) {
      if (bucket[index]) blended.push(bucket[index]);
    }
  }
  return uniqueProducts(blended, limit);
}

function shelfFromSection(sectionId, overrides = {}) {
  const section = sectionById.get(sectionId);
  if (!section) return null;
  return {
    eyebrow: overrides.eyebrow ?? section.eyebrow,
    title: overrides.title ?? section.title,
    description: overrides.description ?? section.description,
    products: uniqueProducts(overrides.products ?? sectionProducts(sectionId, 80), overrides.limit ?? 14),
  };
}

function customShelf({
  eyebrow = "Shop",
  title,
  description,
  sectionIds = [],
  products,
  limit = 14,
}) {
  return {
    eyebrow,
    title,
    description,
    products: uniqueProducts(products ?? blendedProducts(sectionIds, limit), limit),
  };
}

function filteredShelf({
  eyebrow = "Shop",
  title,
  description,
  sectionIds = [],
  terms = [],
  limit = 14,
}) {
  const candidates = blendedProducts(sectionIds, 80);
  const filtered = candidates.filter((product) => productMatchesTerms(product, terms));
  return customShelf({
    eyebrow,
    title,
    description,
    products: filtered.length ? filtered : candidates,
    limit,
  });
}

const catalogDirectoryGroups = [
  {
    title: "Shop",
    items: [
      {
        label: "All products",
        href: "pages/catalog.html",
        description: `${totalProducts} curated products across performance categories.`,
      },
      {
        label: "Best sellers",
        href: "pages/best-sellers.html",
        description: "Top store picks from each active shelf.",
      },
      {
        label: "New arrivals",
        href: "pages/new-arrivals.html",
        description: "Recently generated product picks from the live catalog.",
      },
      {
        label: "Daily deals",
        href: "pages/daily-deals.html",
        description: "Lower-price picks and timely promo candidates.",
      },
    ],
  },
  {
    title: "Supplements",
    items: [
      { label: "Protein", href: "pages/protein.html", description: "Whey, plant protein, shakes, and recovery protein." },
      { label: "Creatine", href: "pages/creatine.html", description: "Creatine powders, capsules, gummies, and daily strength support." },
      { label: "Pre-workout", href: "pages/pre-workout.html", description: "Pump, energy, and focus formulas for training days." },
      { label: "Hydration", href: "pages/hydration.html", description: "Electrolyte sticks, drink mixes, and hydration support." },
      { label: "Vitamins", href: "pages/vitamins.html", description: "Daily health, minerals, omegas, immune, and joint support." },
      { label: "Greens", href: "pages/greens.html", description: "Greens blends, superfood powders, and daily nutrition." },
      { label: "Bars & shakes", href: "pages/bars-shakes.html", description: "Ready-to-drink shakes, protein bars, and meal replacements." },
    ],
  },
  {
    title: "Recovery, Apparel & Gear",
    items: [
      { label: "Recovery devices", href: "pages/recovery.html", description: "Massage, red light, compression, and mobility tools." },
      { label: "Sleep recovery", href: "pages/sleep.html", description: "Sleep gear and nighttime recovery support." },
      { label: "Training apparel", href: "pages/training-apparel.html", description: "Shorts, tees, layers, leggings, and gym wear." },
      { label: "Footwear", href: "pages/footwear.html", description: "Running, training, trail, and performance footwear." },
      { label: "Accessories", href: "pages/accessories.html", description: "Bottles, bags, grips, belts, straps, and sleeves." },
      { label: "Lifting gear", href: "pages/lifting-gear.html", description: "Training systems, belts, wraps, grips, and fight gear." },
    ],
  },
];

const brandProductCounts = new Map();
for (const product of allCuratedProducts) {
  brandProductCounts.set(product.brand, (brandProductCounts.get(product.brand) ?? 0) + 1);
}

const catalogBrandItems = ATHLETONIC_SOURCE_OF_TRUTH.brands
  .filter((brand) => brandProductCounts.has(brand.slug))
  .map((brand) => ({
    id: `brand-${brand.slug}`,
    label: brand.name,
    href: `pages/brands.html#brand-${brand.slug}`,
    description: `${brandProductCounts.get(brand.slug)} curated products`,
  }))
  .sort((a, b) => a.label.localeCompare(b.label));

const featuredBrandItems = ATHLETONIC_SOURCE_OF_TRUTH.featuredBrandSlugs
  .filter((slug) => brandProductCounts.has(slug))
  .slice(0, 12)
  .map((slug) => ({
    label: brandNames[slug] ?? slug,
    href: `pages/brands.html#brand-${slug}`,
    description: `${brandProductCounts.get(slug)} curated products`,
  }));

const brandSpotlightShelves = ATHLETONIC_SOURCE_OF_TRUTH.featuredBrandSlugs
  .slice(0, 6)
  .map((slug) =>
    customShelf({
      eyebrow: "Featured brand",
      title: brandNames[slug] ?? slug,
      description: "Popular products from this brand in the Athletonic catalog.",
      products: allCuratedProducts.filter((product) => product.brand === slug),
      limit: 8,
    })
  )
  .filter((shelf) => shelf.products.length > 0);

const catalogShelves = populatedSections
  .map((section) => shelfFromSection(section.id, { limit: 8 }))
  .filter(Boolean);

const bestSellerShelf = customShelf({
  eyebrow: "Popular picks",
  title: "Popular picks",
  description: "Strong picks from each Athletonic category while sales ranking data is being built.",
  products: populatedSections.flatMap((section) => sectionProducts(section.id, 2)),
  limit: 18,
});

const dailyDealsShelf = customShelf({
  eyebrow: "Deals",
  title: "Active limited-time offers",
  description:
    "Offers selected from trend signals, margin-safe discounts, and active expiration dates.",
  products: allCuratedProducts.filter((product) => product.deal || Number(product.price) <= 50),
  limit: 18,
});

const newArrivalsShelf = customShelf({
  eyebrow: "New arrivals",
  title: "Recently added picks",
  description: "Fresh product picks from the current Athletonic catalog build.",
  products: [...allCuratedProducts].reverse(),
  limit: 18,
});

const staticPages = [
  {
    slug: "catalog",
    title: "Shop All Products",
    eyebrow: "Catalog",
    dynamicSearch: true,
    summary:
      "Browse Athletonic's curated store across sports nutrition, wellness, recovery, apparel, footwear, and training gear.",
    directoryGroups: catalogDirectoryGroups,
    productSections: catalogShelves,
    sections: [
      {
        heading: "Catalog Standard",
        body:
          "Products shown here come from the curated Athletonic catalog build and use official brand product data where available.",
      },
    ],
  },
  {
    slug: "brands",
    title: "Brand Directory",
    eyebrow: "Brands",
    summary:
      "Explore the performance, wellness, recovery, apparel, footwear, and training brands represented in the Athletonic catalog.",
    directoryGroups: [
      { title: "Featured Brands", items: featuredBrandItems },
      { title: "All Catalog Brands", items: catalogBrandItems },
    ],
    productSections: brandSpotlightShelves,
    sections: [
      {
        heading: "Brand Quality",
        body:
          "Athletonic keeps brand pages tied to products that are currently present in the curated catalog instead of listing empty brand destinations.",
      },
    ],
  },
  {
    slug: "best-sellers",
    title: "Best Sellers",
    eyebrow: "Shop",
    summary:
      "A cross-category view of strong Athletonic picks for customers who want the fastest route into the catalog.",
    productSections: [bestSellerShelf],
    sections: [
      {
        heading: "How This Shelf Works",
        body:
          "Best-seller placement should be validated against sales, inventory, margin, and campaign data before paid promotion.",
      },
    ],
  },
  {
    slug: "protein",
    title: "Protein",
    eyebrow: "Sports Nutrition",
    summary:
      "Shop protein powders, shakes, bars, isolates, plant protein, and recovery-focused protein products.",
    productSections: [shelfFromSection("protein")],
    sections: [
      {
        heading: "Shop Notes",
        body:
          "Protein customers usually compare serving size, protein source, flavor, sweetener preferences, and price per serving.",
      },
    ],
  },
  {
    slug: "creatine",
    title: "Creatine",
    eyebrow: "Strength",
    summary:
      "Shop creatine powders, capsules, gummies, and strength-focused daily staples.",
    productSections: [shelfFromSection("creatine")],
    sections: [
      {
        heading: "Shop Notes",
        body:
          "Creatine shoppers commonly compare format, serving size, flavor, and whether the product is a single-ingredient staple or part of a stack.",
      },
    ],
  },
  {
    slug: "pre-workout",
    title: "Pre-workout",
    eyebrow: "Energy",
    summary:
      "Shop pre-workout, pump, focus, and training energy formulas from performance brands.",
    productSections: [shelfFromSection("pre-workout")],
    sections: [
      {
        heading: "Shop Notes",
        body:
          "Pre-workout customers should compare stimulant level, flavor, serving size, and label directions before checkout.",
      },
    ],
  },
  {
    slug: "hydration",
    title: "Hydration & Electrolytes",
    eyebrow: "Daily Performance",
    summary:
      "Shop hydration mixes, electrolyte sticks, amino drinks, and functional hydration products.",
    productSections: [shelfFromSection("hydration")],
    sections: [
      {
        heading: "Shop Notes",
        body:
          "Hydration customers often compare sodium level, sugar content, flavor format, and pack count.",
      },
    ],
  },
  {
    slug: "vitamins",
    title: "Vitamins & Daily Health",
    eyebrow: "Wellness",
    summary:
      "Shop multivitamins, minerals, omegas, immune support, joint support, and daily wellness products.",
    productSections: [shelfFromSection("vitamins")],
    sections: [
      {
        heading: "Shop Notes",
        body:
          "Daily wellness customers should review label directions, allergens, serving size, and ingredient fit.",
      },
    ],
  },
  {
    slug: "greens",
    title: "Greens & Superfoods",
    eyebrow: "Wellness",
    summary:
      "Shop greens blends, superfood powders, cacao blends, spirulina, chlorella, and daily nutrition products.",
    productSections: [shelfFromSection("greens")],
    sections: [
      {
        heading: "Shop Notes",
        body:
          "Greens customers often compare flavor, ingredient profile, serving count, and whether the product includes probiotics or digestive support.",
      },
    ],
  },
  {
    slug: "bars-shakes",
    title: "Bars, Shakes & Meals",
    eyebrow: "Ready Now",
    summary:
      "Shop protein bars, ready-to-drink shakes, complete meals, and convenient nutrition products.",
    productSections: [shelfFromSection("bars-shakes")],
    sections: [
      {
        heading: "Shop Notes",
        body:
          "Ready-to-eat customers often compare calories, protein, sugar, pack count, texture, and portability.",
      },
    ],
  },
  {
    slug: "recovery",
    title: "Recovery Devices",
    eyebrow: "Recovery",
    summary:
      "Shop massage, mobility, red light, compression, and recovery accessories.",
    productSections: [shelfFromSection("recovery")],
    sections: [
      {
        heading: "Shop Notes",
        body:
          "Recovery-device customers should compare use case, portability, included attachments, warranty expectations, and return restrictions.",
      },
    ],
  },
  {
    slug: "sleep",
    title: "Sleep Recovery",
    eyebrow: "Recovery",
    summary:
      "Shop sleep masks, nighttime recovery products, and relaxation support.",
    productSections: [shelfFromSection("sleep")],
    sections: [
      {
        heading: "Shop Notes",
        body:
          "Sleep recovery customers often compare fit, comfort, ingredients, serving timing, and sensitivity to nighttime formulas.",
      },
    ],
  },
  {
    slug: "massage-mobility",
    title: "Massage & Mobility",
    eyebrow: "Recovery",
    summary:
      "Shop massage devices, mobility tools, rollers, and recovery accessories.",
    productSections: [
      filteredShelf({
        eyebrow: "Recovery",
        title: "Massage & mobility",
        description: "Massage, rolling, mobility, and recovery tools from the curated recovery shelf.",
        sectionIds: ["recovery"],
        terms: ["massage", "roller", "roll", "theragun", "hypervolt", "fixx"],
      }),
    ],
    sections: [
      {
        heading: "Shop Notes",
        body:
          "Customers should compare device size, intensity controls, attachments, and where the product fits in their recovery routine.",
      },
    ],
  },
  {
    slug: "compression",
    title: "Compression",
    eyebrow: "Recovery",
    summary:
      "Shop compression recovery products, sleeves, and related support accessories.",
    productSections: [
      filteredShelf({
        eyebrow: "Recovery",
        title: "Compression",
        description: "Compression and sleeve-focused products from the recovery catalog.",
        sectionIds: ["recovery", "accessories"],
        terms: ["compression", "sleeve", "recoverypulse"],
      }),
    ],
    sections: [
      {
        heading: "Shop Notes",
        body:
          "Compression customers should compare size, fit, body area, care instructions, and whether the item is wearable or device-based.",
      },
    ],
  },
  {
    slug: "cold-therapy",
    title: "Cold Therapy",
    eyebrow: "Recovery",
    summary:
      "Shop cold-therapy-adjacent recovery products and recovery tools suitable for post-training routines.",
    productSections: [
      filteredShelf({
        eyebrow: "Recovery",
        title: "Cold therapy",
        description: "Recovery products and tools relevant to cold-therapy routines.",
        sectionIds: ["recovery"],
        terms: ["cold", "ice", "therapy", "recovery"],
      }),
    ],
    sections: [
      {
        heading: "Shop Notes",
        body:
          "Cold therapy placement should stay conservative until dedicated cold plunge, ice bath, or cold-pack inventory is available.",
      },
    ],
  },
  {
    slug: "sleep-supplements",
    title: "Sleep Supplements",
    eyebrow: "Recovery",
    summary:
      "Shop nighttime supplement products and sleep-support items from the Athletonic catalog.",
    productSections: [
      filteredShelf({
        eyebrow: "Recovery",
        title: "Sleep supplements",
        description: "Nighttime, magnesium, and sleep-support products from the recovery shelf.",
        sectionIds: ["sleep", "vitamins"],
        terms: ["sleep", "night", "magnesium", "zma"],
      }),
    ],
    sections: [
      {
        heading: "Shop Notes",
        body:
          "Sleep supplement customers should read label directions carefully and consider ingredient sensitivities.",
      },
    ],
  },
  {
    slug: "build-muscle",
    title: "Build Muscle",
    eyebrow: "Goals",
    summary:
      "Shop protein, creatine, and training staples commonly compared by strength-focused customers.",
    productSections: [
      customShelf({
        eyebrow: "Goals",
        title: "Build muscle",
        description: "Protein and creatine products for strength-focused shopping.",
        sectionIds: ["protein", "creatine"],
        limit: 18,
      }),
    ],
    sections: [
      {
        heading: "Goal Fit",
        body:
          "Goal pages group relevant categories for faster shopping; customers should still review product labels and serving directions.",
      },
    ],
  },
  {
    slug: "lose-fat",
    title: "Lose Fat",
    eyebrow: "Goals",
    summary:
      "Shop lower-friction products customers often compare when building a leaner nutrition and training routine.",
    productSections: [
      customShelf({
        eyebrow: "Goals",
        title: "Lose fat",
        description: "Protein, hydration, bars, and training energy products organized for comparison.",
        sectionIds: ["protein", "hydration", "bars-shakes", "pre-workout"],
        limit: 18,
      }),
    ],
    sections: [
      {
        heading: "Goal Fit",
        body:
          "Athletonic does not treat product placement as medical or nutrition advice; customers should compare labels and choose what fits their plan.",
      },
    ],
  },
  {
    slug: "endurance",
    title: "Endurance",
    eyebrow: "Goals",
    summary:
      "Shop hydration, electrolytes, recovery, and ready-now nutrition for endurance-focused routines.",
    productSections: [
      customShelf({
        eyebrow: "Goals",
        title: "Endurance",
        description: "Hydration, ready nutrition, sleep, and recovery products for longer training days.",
        sectionIds: ["hydration", "bars-shakes", "sleep", "recovery"],
        limit: 18,
      }),
    ],
    sections: [
      {
        heading: "Goal Fit",
        body:
          "Endurance shoppers often compare packability, flavor, serving timing, and hydration format.",
      },
    ],
  },
  {
    slug: "daily-wellness",
    title: "Daily Wellness",
    eyebrow: "Goals",
    summary:
      "Shop vitamins, greens, hydration, and daily staples for general wellness routines.",
    productSections: [
      customShelf({
        eyebrow: "Goals",
        title: "Daily wellness",
        description: "Daily health, greens, hydration, and convenient nutrition products.",
        sectionIds: ["vitamins", "greens", "hydration", "bars-shakes"],
        limit: 18,
      }),
    ],
    sections: [
      {
        heading: "Goal Fit",
        body:
          "Daily wellness shoppers should compare label directions, allergens, ingredient overlap, and product format.",
      },
    ],
  },
  {
    slug: "womens-health",
    title: "Women's Health",
    eyebrow: "Goals",
    summary:
      "Shop daily wellness, vitamins, greens, hydration, and nutrition products relevant to women's health routines.",
    productSections: [
      customShelf({
        eyebrow: "Goals",
        title: "Women's health",
        description: "Daily health and wellness products organized for easier comparison.",
        sectionIds: ["vitamins", "greens", "hydration", "bars-shakes"],
        limit: 18,
      }),
    ],
    sections: [
      {
        heading: "Goal Fit",
        body:
          "Customers with medical, pregnancy, postpartum, hormone, allergy, or medication questions should consult a qualified professional.",
      },
    ],
  },
  {
    slug: "energy-focus",
    title: "Energy & Focus",
    eyebrow: "Goals",
    summary:
      "Shop training energy, pre-workout, hydration, and focus-oriented products.",
    productSections: [
      customShelf({
        eyebrow: "Goals",
        title: "Energy & focus",
        description: "Training energy, pump, focus, and hydration products for comparison.",
        sectionIds: ["pre-workout", "hydration"],
        limit: 18,
      }),
    ],
    sections: [
      {
        heading: "Goal Fit",
        body:
          "Energy-focused customers should compare stimulant content, serving directions, flavor, and personal tolerance.",
      },
    ],
  },
  {
    slug: "training-apparel",
    title: "Training Apparel",
    eyebrow: "Apparel",
    summary:
      "Shop training apparel, gym wear, tees, shorts, leggings, hoodies, and active layers.",
    productSections: [shelfFromSection("apparel")],
    sections: [
      {
        heading: "Shop Notes",
        body:
          "Apparel customers should compare size, fit, material, care instructions, and return eligibility before checkout.",
      },
    ],
  },
  {
    slug: "footwear",
    title: "Footwear",
    eyebrow: "Apparel",
    summary:
      "Shop running, training, trail, and performance footwear.",
    productSections: [shelfFromSection("shoes")],
    sections: [
      {
        heading: "Shop Notes",
        body:
          "Footwear customers should compare fit, intended use, size availability, return condition, and brand-specific sizing.",
      },
    ],
  },
  {
    slug: "accessories",
    title: "Accessories",
    eyebrow: "Gear",
    summary:
      "Shop gym accessories including shakers, bottles, bags, belts, grips, wraps, straps, and sleeves.",
    productSections: [shelfFromSection("accessories")],
    sections: [
      {
        heading: "Shop Notes",
        body:
          "Accessory customers usually compare size, material, use case, carry capacity, and compatibility with their training setup.",
      },
    ],
  },
  {
    slug: "bags",
    title: "Bags",
    eyebrow: "Gear",
    summary:
      "Shop gym bags, duffles, backpacks, and carry accessories.",
    productSections: [
      filteredShelf({
        eyebrow: "Gear",
        title: "Bags",
        description: "Gym bags, duffles, backpacks, and carry accessories.",
        sectionIds: ["accessories"],
        terms: ["bag", "duffle", "duffel", "backpack"],
      }),
    ],
    sections: [
      {
        heading: "Shop Notes",
        body:
          "Bag customers should compare capacity, strap style, compartments, material, and travel or gym use case.",
      },
    ],
  },
  {
    slug: "lifting-gear",
    title: "Lifting Gear",
    eyebrow: "Gear",
    summary:
      "Shop training systems, belts, wraps, grips, straps, gloves, and strength accessories.",
    productSections: [
      customShelf({
        eyebrow: "Gear",
        title: "Lifting gear",
        description: "Strength training gear and accessories from the curated catalog.",
        sectionIds: ["training-gear", "accessories"],
        limit: 18,
      }),
    ],
    sections: [
      {
        heading: "Shop Notes",
        body:
          "Lifting gear customers should compare size, support level, material, use case, and return condition.",
      },
    ],
  },
  {
    slug: "combat-sports",
    title: "Combat Sports",
    eyebrow: "Gear",
    summary:
      "Shop boxing, martial arts, Muay Thai, wraps, gloves, pads, guards, and fight-training gear.",
    productSections: [
      filteredShelf({
        eyebrow: "Gear",
        title: "Combat sports",
        description: "Fight-training gear from the curated sports gear shelf.",
        sectionIds: ["training-gear"],
        terms: ["glove", "wrap", "mitt", "pad", "boxing", "muay", "shin", "guard", "fight"],
        limit: 18,
      }),
    ],
    sections: [
      {
        heading: "Shop Notes",
        body:
          "Combat sports customers should compare sizing, protection level, intended discipline, and training vs competition use.",
      },
    ],
  },
  {
    slug: "about",
    title: "About Athletonic",
    eyebrow: "Company",
    summary:
      "Athletonic is a performance store built for customers who want supplements, training gear, apparel, footwear, recovery tools, and daily wellness products in one focused store.",
    sections: [
      {
        heading: "What We Sell",
        body:
          "Our catalog is organized around real training needs: strength, endurance, recovery, hydration, sleep, wellness, and everyday athletic essentials.",
      },
      {
        heading: "How We Operate",
        body:
          "Athletonic presents products in our own storefront, keeps carts inside Athletonic, and handles customer interest through our checkout request workflow.",
      },
    ],
  },
  {
    slug: "careers",
    title: "Careers",
    eyebrow: "Team",
    summary:
      "Athletonic is building a focused commerce team across store operations, product catalog quality, customer experience, performance marketing, and partnerships.",
    sections: [
      {
        heading: "Current Focus",
        bullets: [
          "Store operations and vendor coordination",
          "Catalog quality, product data, and pricing checks",
          "Customer support and post-purchase operations",
          "Growth, paid social, and lifecycle marketing",
        ],
      },
      {
        heading: "Contact",
        body:
          "For hiring conversations, email careers@athletonic.com with your background and the area where you can help.",
      },
    ],
  },
  {
    slug: "press",
    title: "Press Releases",
    eyebrow: "Newsroom",
    summary:
      "Company announcements, store updates, catalog milestones, and partnership news from Athletonic.",
    sections: [
      {
        heading: "Media Contact",
        body:
          "For press inquiries, email support@athletonic.com with your publication, deadline, and requested topic.",
      },
      {
        heading: "Launch Status",
        body:
          "Athletonic is preparing its performance store for public customer acquisition and paid social campaigns.",
      },
    ],
  },
  {
    slug: "science",
    title: "Athletonic Science",
    eyebrow: "Standards",
    summary:
      "Athletonic prioritizes clear product presentation, responsible category organization, and customer-friendly supplement information.",
    sections: [
      {
        heading: "Product Information",
        body:
          "Product pages are designed to show brand, category, price, images, options, and customer-relevant details before checkout intent is submitted.",
      },
      {
        heading: "Customer Safety",
        body:
          "Supplement and wellness products should be used according to label directions. Customers with medical conditions, allergies, or medication questions should consult a qualified professional.",
      },
    ],
  },
  {
    slug: "sustainability",
    title: "Sustainability",
    eyebrow: "Responsibility",
    summary:
      "Athletonic is building a marketplace that can grow responsibly through careful catalog selection, lower waste operations, and transparent customer communication.",
    sections: [
      {
        heading: "Operational Commitments",
        bullets: [
          "Avoiding unnecessary sample and test products in the public catalog",
          "Reviewing product data quality before promotion",
          "Prioritizing useful product information over misleading claims",
        ],
      },
    ],
  },
  {
    slug: "athletonic-cares",
    title: "Athletonic Cares",
    eyebrow: "Community",
    summary:
      "Athletonic Cares is our customer and community commitment for helping athletes, coaches, gyms, and everyday active people make confident buying decisions.",
    sections: [
      {
        heading: "Support Priorities",
        bullets: [
          "Responsive help before and after checkout",
          "Clear shipping, return, and privacy policies",
          "Responsible product categorization for serious customers",
        ],
      },
    ],
  },
  {
    slug: "daily-deals",
    title: "Daily Deals",
    eyebrow: "Shop",
    summary:
      "Daily deal placement is reserved for products with current pricing, available inventory, and a clean path to checkout inside Athletonic.",
    links: [{ label: "Shop all products", href: "pages/catalog.html" }],
    productSections: [dailyDealsShelf],
    sections: [
      {
        heading: "Deal Standards",
        body:
          "Promoted offers should be checked before ads go live so customers do not land on unavailable, stale, or mismatched products.",
      },
    ],
  },
  {
    slug: "new-arrivals",
    title: "New Arrivals",
    eyebrow: "Shop",
    summary:
      "New arrivals highlight recently added products across supplements, apparel, footwear, recovery, and training accessories.",
    links: [{ label: "Browse catalog", href: "pages/catalog.html" }],
    productSections: [newArrivalsShelf],
    sections: [
      {
        heading: "Catalog Review",
        body:
          "New products should pass image, price, category, and checkout checks before they are promoted to customers.",
      },
    ],
  },
  {
    slug: "gift-cards",
    title: "Gift Cards",
    eyebrow: "Shop",
    summary:
      "Athletonic gift cards are planned for a future release after payments, account credit, and redemption rules are fully configured.",
    sections: [
      {
        heading: "Availability",
        body:
          "Gift cards are not active yet. This page is connected so the footer does not send customers to a dead link while the program is prepared.",
      },
    ],
  },
  {
    slug: "sell-on-athletonic",
    title: "Sell on Athletonic",
    eyebrow: "Partners",
    summary:
      "Brands and suppliers can apply to list products that fit Athletonic's performance, wellness, recovery, apparel, footwear, and training categories.",
    sections: [
      {
        heading: "Partner Fit",
        bullets: [
          "Relevant products for active customers",
          "Reliable product images, prices, and inventory data",
          "Clear fulfillment, returns, and support expectations",
        ],
      },
      {
        heading: "Contact",
        body:
          "Email support@athletonic.com with your brand name, product categories, and operating region.",
      },
    ],
  },
  {
    slug: "affiliate",
    title: "Become an Affiliate",
    eyebrow: "Partners",
    summary:
      "Athletonic's affiliate program is intended for creators, coaches, reviewers, and publishers who serve serious fitness and wellness audiences.",
    sections: [
      {
        heading: "Program Status",
        body:
          "Affiliate tracking, account tools, and commission rules are being expanded before large-scale public recruitment.",
      },
    ],
  },
  {
    slug: "advertise",
    title: "Advertise Your Brand",
    eyebrow: "Partners",
    summary:
      "Athletonic advertising placements are for relevant brands that want visibility with customers shopping performance products.",
    sections: [
      {
        heading: "Placement Areas",
        bullets: [
          "Category placements",
          "Featured product shelves",
          "Email and lifecycle campaigns",
          "Paid social landing experiences",
        ],
      },
    ],
  },
  {
    slug: "vendor",
    title: "Become a Vendor",
    eyebrow: "Partners",
    summary:
      "Vendor onboarding covers product data, pricing, images, fulfillment rules, return expectations, and customer service responsibilities.",
    sections: [
      {
        heading: "Required Information",
        bullets: [
          "Legal business name and support contact",
          "Product feed or product list",
          "Wholesale, service, or commission terms",
          "Shipping and return policies",
        ],
      },
    ],
  },
  {
    slug: "coaches",
    title: "Athletonic for Coaches",
    eyebrow: "Teams",
    summary:
      "Coaches can use Athletonic to organize product recommendations for athletes, clients, and training groups.",
    sections: [
      {
        heading: "Use Cases",
        bullets: [
          "Recovery and hydration recommendations",
          "Training accessory lists",
          "Apparel and footwear shelves",
          "Supplement stacks reviewed for customer clarity",
        ],
      },
    ],
  },
  {
    slug: "gyms",
    title: "Athletonic for Gyms",
    eyebrow: "Teams",
    summary:
      "Gyms can coordinate product recommendations, member offers, and training essentials through Athletonic.",
    sections: [
      {
        heading: "Gym Opportunities",
        bullets: [
          "Member product shelves",
          "Recovery and mobility recommendations",
          "Hydration and nutrition bundles",
          "Local campaign landing pages",
        ],
      },
    ],
  },
  {
    slug: "account",
    title: "Your Account",
    eyebrow: "Customer",
    summary:
      "Athletonic currently supports guest checkout profiles so customers can save an email locally and submit checkout interest from the cart.",
    sections: [
      {
        heading: "Guest Checkout",
        body:
          "Use the account button in the header to save the email used for checkout updates.",
      },
    ],
  },
  {
    slug: "shipping",
    title: "Shipping Rates & Policies",
    eyebrow: "Customer Care",
    summary:
      "Shipping options, costs, and delivery windows are shown or confirmed during the checkout workflow.",
    sections: [
      {
        heading: "Shipping Scope",
        body:
          "Athletonic is US-first and USD-based, with international delivery available only where service, taxes, duties, payment review, and product restrictions allow.",
      },
      {
        heading: "Processing",
        body:
          "Orders should not be advertised as final until payment capture, fulfillment, tracking, and customer notifications are connected.",
      },
    ],
  },
  {
    slug: "returns",
    title: "Returns & Replacements",
    eyebrow: "Customer Care",
    summary:
      "Returns and replacements are handled according to product condition, category, customer issue, and applicable health and safety restrictions.",
    links: [{ label: "Start a return request", href: "pages/returns-request.html" }],
    sections: [
      {
        heading: "Return Review",
        body:
          "Customers should contact support with their order reference, product name, issue, and photos if the item arrived damaged.",
      },
      {
        heading: "Restricted Products",
        body:
          "Opened supplements, ingestible products, hygiene products, and worn apparel may be restricted from return for safety reasons.",
      },
    ],
  },
  {
    slug: "help",
    title: "Help Center",
    eyebrow: "Customer Care",
    summary:
      "Find help with product selection, checkout requests, shipping, returns, privacy choices, and account questions.",
    sections: [
      {
        heading: "Support Topics",
        bullets: [
          "Checkout and cart questions",
          "Shipping and delivery status",
          "Product options and availability",
          "Returns, replacements, and damaged items",
          "Privacy and advertising choices",
        ],
      },
    ],
  },
  {
    slug: "contact",
    title: "Contact Us",
    eyebrow: "Customer Care",
    summary:
      "Contact Athletonic for order questions, partnership requests, privacy choices, press inquiries, and customer support.",
    sections: [
      {
        heading: "Support",
        body:
          "Email support@athletonic.com with your name, email, product, and checkout reference if available.",
      },
      {
        heading: "Business",
        body:
          "For partnerships, advertising, vendors, and press, use support@athletonic.com with a clear subject line.",
      },
    ],
  },
  {
    slug: "conditions-of-use",
    title: "Conditions of Use",
    eyebrow: "Legal",
    summary:
      "These Conditions of Use govern access to Athletonic and purchases or checkout requests made through the store.",
    sections: [
      {
        heading: "Use of Athletonic",
        body:
          "Customers may browse products, save cart items, submit checkout requests, and communicate with Athletonic for support. Misuse, scraping, fraud, or interference with site operations is prohibited.",
      },
      {
        heading: "Products and Orders",
        body:
          "Product details, pricing, availability, and offers may change. A checkout request is not a completed order until payment, fulfillment, and confirmation steps are complete.",
      },
      {
        heading: "Health and Product Information",
        body:
          "Supplement and wellness content is informational and is not medical advice. Customers should read labels and consult a qualified professional when needed.",
      },
    ],
  },
  {
    slug: "privacy",
    title: "Privacy Notice",
    eyebrow: "Legal",
    summary:
      "This Privacy Notice explains how Athletonic collects, uses, and protects customer information when people browse, save carts, subscribe, or submit checkout requests.",
    sections: [
      {
        heading: "Information We Collect",
        bullets: [
          "Contact details such as email address",
          "Cart and checkout request contents",
          "Device, browser, analytics, and advertising signals",
          "Customer support messages and preferences",
        ],
      },
      {
        heading: "How We Use Information",
        bullets: [
          "To operate checkout and customer support",
          "To improve catalog quality and site performance",
          "To send updates when customers request them",
          "To measure advertising and reduce irrelevant marketing",
        ],
      },
      {
        heading: "Choices",
        body:
          "Customers can request privacy help by emailing support@athletonic.com.",
      },
    ],
  },
  {
    slug: "ads-privacy-choices",
    title: "Your Ads Privacy Choices",
    eyebrow: "Legal",
    summary:
      "Athletonic may use advertising and analytics technologies to understand campaign performance and show relevant offers.",
    sections: [
      {
        heading: "Advertising Data",
        body:
          "Advertising systems may use cookies, pixels, event data, device information, and shopping activity to measure campaigns and improve relevance.",
      },
      {
        heading: "Opt-Out Requests",
        body:
          "Customers can email support@athletonic.com with the subject Ads Privacy Choices.",
      },
    ],
  },
  {
    slug: "cookie-preferences",
    title: "Cookie Preferences",
    eyebrow: "Legal",
    summary:
      "Cookies and similar technologies help Athletonic remember carts, measure site usage, protect the service, and understand advertising performance.",
    sections: [
      {
        heading: "Cookie Categories",
        bullets: [
          "Required cookies for cart and site operation",
          "Preference cookies for saved checkout details",
          "Analytics cookies for performance measurement",
          "Advertising cookies and pixels for campaign attribution",
        ],
      },
      {
        heading: "Managing Cookies",
        body:
          "Customers can manage cookies in their browser settings. A dedicated cookie consent control should be connected before paid advertising is scaled.",
      },
    ],
  },
  {
    slug: "accessibility",
    title: "Accessibility",
    eyebrow: "Legal",
    summary:
      "Athletonic aims to provide a storefront that is usable by customers with different devices, assistive technologies, and accessibility needs.",
    sections: [
      {
        heading: "Standards",
        body:
          "The storefront uses semantic headings, keyboard-accessible controls, alt text for product images, and visible focus styles where possible.",
      },
      {
        heading: "Feedback",
        body:
          "Email support@athletonic.com with the page URL, issue description, assistive technology used, and contact information.",
      },
    ],
  },
  {
    slug: "do-not-sell",
    title: "Do Not Sell My Personal Information",
    eyebrow: "Legal",
    summary:
      "Customers can request that Athletonic limit the sale or sharing of personal information as required by applicable privacy laws.",
    sections: [
      {
        heading: "Request Method",
        body:
          "Email support@athletonic.com with the subject Do Not Sell or Share My Personal Information.",
      },
      {
        heading: "Verification",
        body:
          "Athletonic may need to verify the request before applying it to customer records, advertising identifiers, or support history.",
      },
    ],
  },
];

const footerPageCopy = {
  about: {
    title: "About Athletonic",
    eyebrow: "United States performance store",
    summary:
      "Athletonic is a US-based performance store for supplements, training gear, recovery products, apparel, footwear, and everyday fitness essentials.",
    links: [{ label: "Contact support", href: "mailto:support@athletonic.com" }],
    sections: [
      {
        heading: "What We Sell",
        body:
          "Products sold through Athletonic are offered by Athletonic through its own catalog. We focus on useful fitness categories instead of filling the store with random marketplace clutter.",
      },
      {
        heading: "How We Work",
        bullets: [
          "United States first in pricing, support, and customer experience",
          "Worldwide shipping where service, payment review, and product rules allow",
          "Product pages built from catalog data, image review, and current merchandising checks",
        ],
      },
      {
        heading: "Customer Standard",
        body:
          "Customers should know what they are buying, what it costs, when it may ship, and how to reach a real support contact when something needs attention.",
      },
    ],
  },
  careers: {
    title: "Careers",
    eyebrow: "Build with us",
    summary:
      "Athletonic is building a lean US-first commerce operation across catalog, operations, customer support, fulfillment, growth, and partner programs.",
    links: [{ label: "Send your interest", href: "mailto:support@athletonic.com?subject=Careers" }],
    sections: [
      {
        heading: "Who Fits",
        bullets: [
          "People who understand fitness customers and can work with detail",
          "Operators who care about clean product data, shipping accuracy, and customer trust",
          "Growth-minded people who can sell without making claims the business cannot stand behind",
        ],
      },
      {
        heading: "Current Status",
        body:
          "Open roles may change as the company grows. Email support with the subject Careers and include your location, strengths, and the kind of work you can handle.",
      },
    ],
  },
  press: {
    title: "Press",
    eyebrow: "Company news",
    summary:
      "Company updates, catalog milestones, customer experience improvements, and partnership news from Athletonic.",
    links: [{ label: "Email press request", href: "mailto:support@athletonic.com?subject=Press" }],
    sections: [
      {
        heading: "Press Contact",
        body:
          "For press requests, email support@athletonic.com with the subject Press. Include your publication, deadline, topic, and the best way to reach you.",
      },
      {
        heading: "Company Stage",
        body:
          "Athletonic is building a US-first performance store with customer support, checkout, order tracking, partner programs, and controlled offers being expanded step by step.",
      },
    ],
  },
  science: {
    title: "Athletonic Science",
    eyebrow: "Product clarity",
    summary:
      "Athletonic Science is our internal standard for writing product pages clearly, avoiding hype, and keeping health and supplement language responsible.",
    sections: [
      {
        heading: "Our Standard",
        bullets: [
          "Use label directions, product facts, and customer-relevant details",
          "Avoid medical promises, cure language, or exaggerated performance claims",
          "Encourage customers to read labels and speak with a qualified professional when needed",
        ],
      },
      {
        heading: "Not Medical Advice",
        body:
          "Product information on Athletonic is for shopping and education only. Supplements and wellness products are not a replacement for medical care.",
      },
    ],
  },
  sustainability: {
    title: "Sustainability",
    eyebrow: "Responsible operations",
    summary:
      "Athletonic is building responsible operations by keeping the catalog cleaner, reducing avoidable waste, and making product and shipping details easier to understand.",
    sections: [
      {
        heading: "Where We Start",
        bullets: [
          "Cleaner catalog data before products are promoted",
          "Packaging and shipping choices reviewed as operations scale",
          "Less waste from duplicate, dead, or misleading product listings",
        ],
      },
      {
        heading: "Practical Commitment",
        body:
          "We do not pretend every step is perfect. The goal is steady improvement while keeping the store useful, honest, and operationally realistic.",
      },
    ],
  },
  "athletonic-cares": {
    title: "Athletonic Cares",
    eyebrow: "Customers and community",
    summary:
      "Athletonic Cares is our commitment to support serious customers, coaches, gyms, and active people with clear shopping help and fair issue review.",
    links: [{ label: "Contact support", href: "mailto:support@athletonic.com" }],
    sections: [
      {
        heading: "What Matters",
        bullets: [
          "Clear help before and after checkout",
          "Careful review for damaged, missing, or incorrect items",
          "Responsible product information for supplements, gear, apparel, and recovery",
        ],
      },
      {
        heading: "How to Reach Us",
        body:
          "Email support@athletonic.com with your order reference, product name, and photos when the issue involves damage or delivery condition.",
      },
    ],
  },
  "best-sellers": {
    title: "Best Sellers / Popular Picks",
    eyebrow: "Shop",
    summary:
      "A fast route into strong Athletonic picks across nutrition, hydration, recovery, apparel, footwear, and training gear.",
    sections: [
      {
        heading: "How This Page Works",
        body:
          "Live sales ranking is being connected. Until then, this page highlights popular catalog picks by category, product quality checks, trend signals, and merchandising review.",
      },
      {
        heading: "Pricing and Availability",
        body:
          "Prices, inventory, and offers can change before checkout. A product is not reserved until payment and order review are complete.",
      },
    ],
  },
  "daily-deals": {
    title: "Daily Deals",
    eyebrow: "Limited-time offers",
    summary:
      "Limited-time Athletonic offers selected from US-first trend signals, catalog fit, pricing rules, and active expiration dates.",
    links: [{ label: "Shop all products", href: "pages/catalog.html" }],
    sections: [
      {
        heading: "Offer Timing",
        body:
          "Deals are time limited and may end automatically at the listed expiration time. A deal can also be changed, removed, or refused if there is a pricing error, product issue, fraud risk, or inventory problem.",
      },
      {
        heading: "How Deals Are Chosen",
        body:
          "The deals engine checks US-focused fitness news signals, matches them to Athletonic catalog categories, and applies controlled discounts that protect the business.",
      },
    ],
  },
  "gift-cards": {
    title: "Gift Cards",
    eyebrow: "Coming soon",
    summary:
      "Athletonic gift cards are planned for a future release in the United States only. They are not available for international purchase or redemption at launch.",
    sections: [
      {
        heading: "Availability",
        body:
          "Gift cards are coming soon for US customers after account credit, redemption, fraud review, and support rules are fully connected.",
      },
      {
        heading: "International Restriction",
        body:
          "Gift cards will not be offered internationally at launch. This keeps the program tighter, reduces fraud exposure, and gives support a cleaner review path.",
      },
    ],
  },
  "sell-on-athletonic": {
    title: "Sell Athletonic Products",
    eyebrow: "Partner program",
    summary:
      "Apply to sell Athletonic products as an approved partner. Athletonic controls the product catalog; partners help bring those products to customers.",
    links: [{ label: "Apply by email", href: "mailto:support@athletonic.com?subject=Sell%20Athletonic%20Products" }],
    sections: [
      {
        heading: "Who This Is For",
        bullets: [
          "International sellers who can represent Athletonic products responsibly",
          "Fitness operators, communities, and local sellers with real customer reach",
          "Partners who can follow pricing, brand, support, and claim rules",
        ],
      },
      {
        heading: "Commission Review",
        body:
          "Commission terms are reviewed before approval. Athletonic may approve, pause, reject, or remove a partner if orders, claims, chargebacks, or customer behavior create risk.",
      },
    ],
  },
  affiliate: {
    title: "Become an Affiliate",
    eyebrow: "Commissions",
    summary:
      "Athletonic is recruiting affiliates who can promote Athletonic products with clean language, real audience fit, and responsible customer expectations.",
    links: [{ label: "Request affiliate review", href: "mailto:support@athletonic.com?subject=Affiliate%20Program" }],
    sections: [
      {
        heading: "Program Fit",
        bullets: [
          "Fitness creators, coaches, reviewers, publishers, and community owners",
          "US-first promotion, with international opportunities reviewed case by case",
          "No fake health claims, fake discounts, misleading urgency, or traffic that creates fraud risk",
        ],
      },
      {
        heading: "Tracking",
        body:
          "Affiliate tracking and real account systems are being expanded. Commission eligibility depends on approved tracking, completed orders, return status, chargeback status, and program terms.",
      },
    ],
  },
  advertise: {
    title: "Advertise with Athletonic",
    eyebrow: "Growth partners",
    summary:
      "Athletonic reviews advertising and partnership requests that fit fitness, performance, wellness, recovery, apparel, footwear, or training audiences.",
    links: [{ label: "Send advertising request", href: "mailto:support@athletonic.com?subject=Advertising" }],
    sections: [
      {
        heading: "What We Review",
        bullets: [
          "Campaigns tied to Athletonic products or approved fitness categories",
          "Creator, gym, coach, and community placements",
          "Brand-safe copy that does not make medical or unrealistic performance claims",
        ],
      },
      {
        heading: "Approval",
        body:
          "Athletonic can approve, decline, change, pause, or remove placements when they do not fit the company, the customer experience, or the legal standard we need.",
      },
    ],
  },
  vendor: {
    title: "Vendor & Supply Partners",
    eyebrow: "Operations",
    summary:
      "Athletonic works with selected vendors, service partners, fulfillment contacts, and supply relationships that support the Athletonic-owned catalog.",
    links: [{ label: "Contact vendor review", href: "mailto:support@athletonic.com?subject=Vendor%20Review" }],
    sections: [
      {
        heading: "Important Difference",
        body:
          "Athletonic is not opening a free-for-all marketplace. The company controls what is sold on Athletonic, and vendor relationships are reviewed before anything reaches customers.",
      },
      {
        heading: "What to Send",
        bullets: [
          "Legal business name and operating region",
          "Products or services offered",
          "Pricing, fulfillment, compliance, and support details",
          "Proof that product claims and images can be used correctly",
        ],
      },
    ],
  },
  coaches: {
    title: "Athletonic for Coaches",
    eyebrow: "Coach program",
    summary:
      "Coaches can apply to recommend Athletonic products to athletes and clients through approved lists, campaigns, or commission-based programs.",
    links: [{ label: "Apply as a coach", href: "mailto:support@athletonic.com?subject=Coach%20Program" }],
    sections: [
      {
        heading: "How Coaches Can Use It",
        bullets: [
          "Build product lists for hydration, recovery, training gear, and nutrition basics",
          "Share approved Athletonic product recommendations with clients",
          "Earn commission only when tracking, order status, and program rules support it",
        ],
      },
      {
        heading: "Professional Standard",
        body:
          "Coaches should not present supplement information as medical advice. Product recommendations must be practical, honest, and tied to the customer's own needs.",
      },
    ],
  },
  gyms: {
    title: "Athletonic for Gyms",
    eyebrow: "Gym program",
    summary:
      "Gyms can apply to sell or recommend Athletonic products for members through approved product shelves, campaigns, and commission programs.",
    links: [{ label: "Apply as a gym", href: "mailto:support@athletonic.com?subject=Gym%20Program" }],
    sections: [
      {
        heading: "Gym Opportunities",
        bullets: [
          "Member product shelves for training essentials",
          "Recovery, hydration, apparel, and gear recommendations",
          "Commission opportunities for approved sales channels",
        ],
      },
      {
        heading: "Review First",
        body:
          "Athletonic reviews each gym before approval. We may limit products, countries, promotions, or payout terms to protect customers and the company.",
      },
    ],
  },
  account: {
    title: "Your Account",
    eyebrow: "Customer",
    summary:
      "Athletonic is expanding real customer accounts. Today, customers can use checkout email, order reference, and support history for tracking and returns.",
    links: [{ label: "Track an order", href: "pages/order-tracking.html" }],
    sections: [
      {
        heading: "Current Account Tools",
        bullets: [
          "Save a checkout email in the account panel",
          "Track orders by email and order reference",
          "Submit return or replacement requests from the order lookup flow",
        ],
      },
      {
        heading: "Tracking and Security",
        body:
          "Athletonic may use account, checkout, order, device, fraud, and support signals to protect customers, prevent abuse, review returns, and improve the store.",
      },
    ],
  },
  shipping: {
    title: "Shipping Rates & Policies",
    eyebrow: "Customer care",
    summary:
      "Athletonic ships from a US-first operating standard and supports worldwide delivery where service, payment review, product restrictions, and local rules allow.",
    links: [
      { label: "Track an order", href: "pages/order-tracking.html" },
      { label: "Contact support", href: "mailto:support@athletonic.com?subject=Shipping%20Help" },
    ],
    sections: [
      {
        heading: "US First, Worldwide Where Available",
        body:
          "The United States is Athletonic's priority market. International delivery may be available for selected products and countries, but it can be limited by carrier service, customs, payment review, or product rules.",
      },
      {
        heading: "Processing",
        body:
          "Most orders are reviewed before fulfillment. Processing may take longer during high volume, address review, payment review, inventory checks, weather events, or carrier disruption.",
      },
      {
        heading: "Customs, Duties, and Taxes",
        body:
          "International customers are responsible for customs duties, taxes, brokerage fees, import rules, and local delivery requirements unless Athletonic states otherwise at checkout.",
      },
      {
        heading: "Delivery and Tracking",
        body:
          "Tracking is provided when available. Delivery estimates are not guarantees, and Athletonic is not responsible for carrier delays, incorrect addresses, customs holds, or missed delivery attempts.",
      },
    ],
  },
  returns: {
    title: "Returns & Replacements",
    eyebrow: "Customer care",
    summary:
      "Returns are reviewed by product type, condition, timing, order status, safety rules, and the reason for the request.",
    links: [
      { label: "Start a return request", href: "pages/returns-request.html" },
      { label: "Email support", href: "mailto:support@athletonic.com?subject=Returns" },
    ],
    sections: [
      {
        heading: "Return Window",
        body:
          "Return requests should be submitted within 14 days of delivery. A request is not approved until Athletonic reviews the order, product, condition, and reason.",
      },
      {
        heading: "What We Can Usually Accept",
        bullets: [
          "Unopened supplements or ingestible products in original packaging",
          "Unworn apparel or footwear with tags and clean original packaging",
          "Unused gear or accessories returned with all parts and packaging",
        ],
      },
      {
        heading: "What We Do Not Accept",
        bullets: [
          "Opened supplements, ingestibles, hygiene items, or products with broken seals",
          "Worn, washed, damaged, altered, or incomplete items",
          "Gift cards, digital credit, final sale items, unauthorized returns, or suspicious activity",
        ],
      },
      {
        heading: "Refunds and Costs",
        body:
          "Customers pay return shipping unless Athletonic sent the wrong item or confirms eligible damage. Shipping charges, duties, taxes, and import fees are usually not refundable. Refunds may be denied or reduced after inspection.",
      },
    ],
  },
  help: {
    title: "Help Center",
    eyebrow: "Customer care",
    summary:
      "Get help with product questions, checkout, orders, shipping, returns, privacy choices, accounts, and partner requests.",
    links: [
      { label: "Track an order", href: "pages/order-tracking.html" },
      { label: "Contact support", href: "mailto:support@athletonic.com" },
    ],
    sections: [
      {
        heading: "Fastest Way to Get Help",
        body:
          "Email support@athletonic.com with your order reference, checkout email, product name, and a short explanation. Add photos for damaged, wrong, or incomplete items.",
      },
      {
        heading: "Support Topics",
        bullets: [
          "Orders, tracking, shipping, and delivery review",
          "Returns, replacements, refunds, and damaged items",
          "Product availability, pricing, and checkout issues",
          "Privacy, cookies, advertising choices, and account questions",
          "Affiliate, coach, gym, vendor, and advertising requests",
        ],
      },
    ],
  },
  contact: {
    title: "Contact Us",
    eyebrow: "Customer care",
    summary:
      "Use support@athletonic.com for customer support, orders, returns, privacy requests, partnerships, vendors, coaches, gyms, advertising, press, and general help.",
    links: [{ label: "Email support", href: "mailto:support@athletonic.com" }],
    sections: [
      {
        heading: "Customer Support",
        body:
          "For orders, shipping, returns, product questions, or account help, email support@athletonic.com. Include your order reference when you have one.",
      },
      {
        heading: "Business Requests",
        body:
          "For affiliates, partners, vendors, coaches, gyms, advertising, or press, email support@athletonic.com with a clear subject line so the request can be routed.",
      },
      {
        heading: "Privacy and Legal Requests",
        body:
          "For privacy, cookie, advertising choice, or accessibility requests, use support@athletonic.com and include the request type in the subject line.",
      },
    ],
  },
  "conditions-of-use": {
    title: "Conditions of Use",
    eyebrow: "Legal",
    summary:
      "These Conditions of Use apply when customers browse Athletonic, use account tools, submit checkout information, place orders, request returns, or contact support.",
    sections: [
      {
        heading: "Orders and Review",
        body:
          "A checkout submission or payment attempt does not guarantee acceptance. Athletonic may review, refuse, cancel, limit, or adjust orders for pricing errors, product restrictions, fraud risk, inventory issues, address problems, or policy concerns.",
      },
      {
        heading: "Products, Pricing, and Offers",
        body:
          "Product details, images, prices, availability, discounts, and offers can change. Limited-time offers may expire, sell out, or be removed before checkout is complete.",
      },
      {
        heading: "Use of the Site",
        body:
          "Customers may not misuse the site, scrape data, interfere with checkout, abuse returns, create fake accounts, manipulate promotions, or use Athletonic in a way that harms customers or the company.",
      },
      {
        heading: "Health Information",
        body:
          "Supplement, wellness, and training content is not medical advice. Customers should read labels, follow product directions, and consult a qualified professional when needed.",
      },
    ],
  },
  privacy: {
    title: "Privacy Notice",
    eyebrow: "Legal",
    summary:
      "This Privacy Notice explains how Athletonic may collect, use, protect, and review information from customers, visitors, account users, checkout users, and support contacts.",
    links: [{ label: "Email privacy request", href: "mailto:support@athletonic.com?subject=Privacy%20Request" }],
    sections: [
      {
        heading: "Information We May Collect",
        bullets: [
          "Contact details such as name, email, phone, shipping address, and support messages",
          "Account, checkout, cart, order, return, payment status, and fulfillment information",
          "Device, browser, cookie, analytics, advertising, fraud, and security signals",
          "Partner, affiliate, coach, gym, vendor, or advertising application details",
        ],
      },
      {
        heading: "How We Use Information",
        bullets: [
          "Operate checkout, accounts, shipping, tracking, support, returns, and refunds",
          "Prevent fraud, chargebacks, abuse, fake accounts, and policy violations",
          "Improve catalog quality, site performance, marketing, and customer service",
          "Comply with legal, tax, payment, customs, and business record requirements",
        ],
      },
      {
        heading: "US-Based Business",
        body:
          "Athletonic is a United States business. If a customer uses Athletonic from outside the United States, information may be processed in the United States and with service providers that support the store.",
      },
    ],
  },
  "cookie-preferences": {
    title: "Cookie Preferences",
    eyebrow: "Legal",
    summary:
      "Cookies and similar technologies help Athletonic operate the cart, account tools, checkout, security, analytics, advertising, and customer experience.",
    links: [{ label: "Email cookie request", href: "mailto:support@athletonic.com?subject=Cookie%20Preferences" }],
    sections: [
      {
        heading: "Cookie Categories",
        bullets: [
          "Required cookies for cart, checkout, account tools, security, and site operation",
          "Preference cookies for saved email, region, and customer experience settings",
          "Analytics cookies for performance, product interest, and site improvement",
          "Advertising cookies and pixels for attribution, campaign measurement, and relevant offers",
        ],
      },
      {
        heading: "Managing Cookies",
        body:
          "Customers can manage many cookies in their browser settings. Athletonic may add a dedicated preference tool as the tracking and account systems expand.",
      },
    ],
  },
  "ads-privacy-choices": {
    title: "Your Ads Privacy Choices",
    eyebrow: "Legal",
    summary:
      "Athletonic may use advertising, analytics, pixels, cookies, and event data to measure campaigns, improve offers, and reduce irrelevant marketing.",
    links: [{ label: "Email ads privacy request", href: "mailto:support@athletonic.com?subject=Ads%20Privacy%20Choices" }],
    sections: [
      {
        heading: "Advertising Data",
        body:
          "Advertising systems may use shopping activity, product interest, device data, browser signals, cookies, pixels, and campaign events for measurement and relevance.",
      },
      {
        heading: "Choices",
        body:
          "Customers can email support@athletonic.com with the subject Ads Privacy Choices. Athletonic may need to verify the request before applying it to customer records or advertising identifiers.",
      },
    ],
  },
  "do-not-sell": {
    title: "Do Not Sell or Share My Personal Information",
    eyebrow: "Legal",
    summary:
      "Customers can ask Athletonic to limit certain sale or sharing of personal information where required by applicable privacy law.",
    links: [{ label: "Email privacy request", href: "mailto:support@athletonic.com?subject=Do%20Not%20Sell%20or%20Share" }],
    sections: [
      {
        heading: "Request Method",
        body:
          "Email support@athletonic.com with the subject Do Not Sell or Share My Personal Information. Include enough information for Athletonic to review and verify the request.",
      },
      {
        heading: "Verification and Limits",
        body:
          "Athletonic may need to verify identity and may keep information needed for security, legal, transaction, tax, fraud prevention, and customer support purposes.",
      },
    ],
  },
  accessibility: {
    title: "Accessibility",
    eyebrow: "Legal",
    summary:
      "Athletonic aims to make the storefront usable for customers using different devices, browsers, keyboards, screen readers, and assistive technologies.",
    links: [{ label: "Email accessibility request", href: "mailto:support@athletonic.com?subject=Accessibility" }],
    sections: [
      {
        heading: "Our Approach",
        bullets: [
          "Readable structure, semantic headings, and keyboard-friendly controls",
          "Alt text for product images where catalog data supports it",
          "Visible focus states and straightforward checkout flows where possible",
        ],
      },
      {
        heading: "Feedback",
        body:
          "Email support@athletonic.com with the subject Accessibility. Include the page URL, issue, device, browser, and assistive technology if you can.",
      },
    ],
  },
};

for (const page of staticPages) {
  const copy = footerPageCopy[page.slug];
  if (copy) Object.assign(page, copy);
}

function renderInfoSections(sections = []) {
  return sections
    .map((section) => {
      const bullets = Array.isArray(section.bullets)
        ? `<ul>${section.bullets
            .map((item) => `<li>${html(item)}</li>`)
            .join("\n              ")}</ul>`
        : "";
      const body = section.body ? `<p>${html(section.body)}</p>` : "";
      return `
        <section class="info-section">
          <h2>${html(section.heading)}</h2>
          ${body}
          ${bullets}
        </section>`;
    })
    .join("\n");
}

function renderInfoLinks(links = [], pathPrefix = "../") {
  if (!links.length) return "";
  return `
          <div class="info-actions">
            ${links
              .map(
                (link) =>
                  `<a href="${html(resolveSiteHref(link.href, pathPrefix))}">${html(
                    link.label
                  )}</a>`
              )
              .join("\n            ")}
          </div>`;
}

function renderDirectoryGroups(groups = [], pathPrefix = "../") {
  const visibleGroups = groups.filter((group) => Array.isArray(group.items) && group.items.length);
  if (!visibleGroups.length) return "";
  return `
      <div class="directory-groups">
        ${visibleGroups
          .map(
            (group) => `<section class="directory-group">
          <h2>${html(group.title)}</h2>
          <div class="directory-grid">
            ${group.items
              .map(
                (item) => `<a class="directory-card" href="${html(
                  resolveSiteHref(item.href, pathPrefix)
                )}"${item.id ? ` id="${html(item.id)}"` : ""}>
              <span>${html(item.label)}</span>
              ${item.description ? `<small>${html(item.description)}</small>` : ""}
            </a>`
              )
              .join("\n            ")}
          </div>
        </section>`
          )
          .join("\n        ")}
      </div>`;
}

function renderProductShelves(shelves = [], pathPrefix = "../") {
  const visibleShelves = shelves.filter((shelf) => shelf && shelf.products?.length);
  if (!visibleShelves.length) return "";
  return `
      <div class="listing-sections">
        ${visibleShelves
          .map(
            (shelf) => `<section class="market-section listing-section">
          <div class="section-title">
            <div>
              <p class="eyebrow">${html(shelf.eyebrow)}</p>
              <h2>${html(shelf.title)}</h2>
            </div>
            <p>${html(shelf.description)}</p>
          </div>
          <div class="product-row">
${shelf.products.map((product) => productCard(product, pathPrefix)).join("\n")}
          </div>
        </section>`
          )
          .join("\n        ")}
      </div>`;
}

function infoPage(pageInfo) {
  const pathPrefix = "../";
  const hasExtendedContent =
    pageInfo.productSections?.length || pageInfo.directoryGroups?.length;
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${html(pageInfo.title)} | Athletonic</title>
    <meta name="description" content="${html(pageInfo.summary)}" />
    <link rel="stylesheet" href="${pathPrefix}styles.css" />
  </head>
  <body class="info-body">
    <a id="top" tabindex="-1" aria-hidden="true"></a>
${renderPdpHeader(pathPrefix)}
${renderDrawers()}

    <main class="info-main${hasExtendedContent ? " listing-main" : ""}"${
      pageInfo.dynamicSearch ? " data-catalog-page" : ""
    }>
      <section class="info-hero">
        <p class="eyebrow">${html(pageInfo.eyebrow)}</p>
        <h1>${html(pageInfo.title)}</h1>
        <p>${html(pageInfo.summary)}</p>
        ${renderInfoLinks(pageInfo.links, pathPrefix)}
      </section>
      ${
        pageInfo.dynamicSearch
          ? `<p class="search-status" id="catalog" aria-live="polite" hidden></p>
      <div class="product-row catalog-results" data-catalog-results hidden></div>`
          : pageInfo.productSections?.length
          ? `<p class="search-status" id="catalog" aria-live="polite" hidden></p>`
          : ""
      }
      <div${pageInfo.dynamicSearch ? " data-catalog-browse" : ""}>
${renderDirectoryGroups(pageInfo.directoryGroups, pathPrefix)}
${renderProductShelves(pageInfo.productSections, pathPrefix)}
      </div>
      <div class="info-grid">
${renderInfoSections(pageInfo.sections)}
      </div>
      <p class="info-updated">Last updated June 3, 2026</p>
    </main>

${renderFooter(pathPrefix)}
    <script>
      window.ATHLETONIC_SUPABASE_URL = "${html(SUPABASE_PUBLIC_URL)}";
      window.ATHLETONIC_SUPABASE_KEY = "${html(SUPABASE_PUBLIC_KEY)}";
    </script>
    <script src="${pathPrefix}assets/cart.js" defer></script>
  </body>
</html>
`;
}

function renderCommerceHeader(activePage, shopLabel = "Shop") {
  const current = (page) => (activePage === page ? ' aria-current="page"' : "");
  return `
    <header class="market-header pdp-header">
      <div class="header-main">
        <a class="brand" href="../" aria-label="Athletonic home">
          <img class="brand-logo" src="../assets/logo.png" alt="Athletonic" />
        </a>
        <nav class="commerce-nav" aria-label="Order navigation">
          <a href="./order-tracking.html"${current("tracking")}>Track order</a>
          <a href="./returns-request.html"${current("returns")}>Returns</a>
          <a href="./catalog.html">${html(shopLabel)}</a>
        </nav>
      </div>
    </header>`;
}

const orderLookupContent = ({ eyebrow, title, copy }) => `
    <main class="commerce-main">
      <section class="commerce-hero">
        <p class="eyebrow">${html(eyebrow)}</p>
        <h1>${html(title)}</h1>
        <p>${html(copy)}</p>
      </section>

      <section class="commerce-grid commerce-grid-form">
        <article class="commerce-panel">
          <form class="commerce-form" data-order-lookup-form>
            <label for="tracking-email">Email</label>
            <input id="tracking-email" name="email" type="email" autocomplete="email" required />

            <label for="tracking-reference">Order reference</label>
            <input id="tracking-reference" name="order_reference" type="text" placeholder="ATH-123ABC4567" required />

            <button type="submit">Find order</button>
            <p class="form-status" data-order-lookup-status aria-live="polite"></p>
          </form>
        </article>

        <article class="commerce-panel commerce-result" data-order-lookup-result hidden></article>
      </section>
    </main>`;

const returnsRequestContent = `
    <main class="commerce-main">
      <section class="commerce-hero">
        <p class="eyebrow">Returns</p>
        <h1>Request a return or replacement.</h1>
        <p>Find your order first, then select the item, reason, preferred resolution, and optional photos.</p>
      </section>

      <section class="commerce-grid commerce-grid-form">
        <article class="commerce-panel">
          <form class="commerce-form" data-return-lookup-form>
            <label for="return-email">Email</label>
            <input id="return-email" name="email" type="email" autocomplete="email" required />

            <label for="return-reference">Order reference</label>
            <input id="return-reference" name="order_reference" type="text" placeholder="ATH-123ABC4567" required />

            <button type="submit">Find order</button>
          </form>
          <p class="form-status" data-return-status aria-live="polite"></p>
        </article>

        <article class="commerce-panel">
          <div class="return-order-summary" data-return-order-summary></div>

          <form class="commerce-form" data-return-request-form hidden>
            <label for="return-item">Item</label>
            <select id="return-item" name="item" data-return-item required></select>

            <label for="return-quantity">Quantity</label>
            <input id="return-quantity" name="quantity" type="number" min="1" value="1" data-return-quantity required />

            <label for="return-resolution">Resolution</label>
            <select id="return-resolution" name="resolution" required>
              <option value="refund">Refund</option>
              <option value="replacement">Replacement</option>
            </select>

            <label for="return-reason">Reason</label>
            <select id="return-reason" name="reason" required>
              <option value="">Choose a reason</option>
              <option value="Damaged item">Damaged item</option>
              <option value="Wrong item received">Wrong item received</option>
              <option value="Missing part or accessory">Missing part or accessory</option>
              <option value="Quality issue">Quality issue</option>
              <option value="Changed my mind">Changed my mind</option>
            </select>

            <label for="return-notes">Notes</label>
            <textarea id="return-notes" name="notes" rows="4" placeholder="Add details for support."></textarea>

            <label for="return-photos">Photos optional</label>
            <input id="return-photos" name="photos" type="file" accept="image/png,image/jpeg,image/webp" multiple />

            <button type="submit">Submit request</button>
          </form>
        </article>
      </section>
    </main>`;

const orderConfirmationContent = `
    <main class="commerce-main">
      <section class="commerce-hero">
        <p class="eyebrow">Order confirmation</p>
        <h1>Thanks for your order.</h1>
        <p data-confirmation-status data-state="pending">Confirming your payment with Stripe...</p>
      </section>

      <section class="commerce-grid">
        <article class="commerce-panel">
          <span class="order-kicker">Reference</span>
          <h2 data-order-reference>Pending</h2>
          <p class="commerce-muted">A copy of this reference is used for tracking and return requests.</p>
          <dl class="commerce-meta">
            <div>
              <dt>Email</dt>
              <dd data-order-email>Pending</dd>
            </div>
          </dl>
          <div data-order-summary></div>
        </article>

        <article class="commerce-panel">
          <h2>Items</h2>
          <div class="order-lines" data-order-items></div>
        </article>

        <article class="commerce-panel commerce-panel-wide">
          <h2>Timeline</h2>
          <ol class="order-timeline" data-order-timeline></ol>
        </article>
      </section>
    </main>`;

const commercePages = [
  {
    slug: "order-tracking",
    title: "Order Tracking",
    description: "Track an Athletonic order by email and order reference.",
    activePage: "tracking",
    content: orderLookupContent({
      eyebrow: "Tracking",
      title: "Track your Athletonic order.",
      copy: "Use the email from checkout and the order reference from your confirmation page.",
    }),
    scripts: ["assets/order-tracking.js"],
  },
  {
    slug: "orders",
    title: "Your Orders",
    description: "Track an Athletonic order by email and order reference.",
    activePage: "tracking",
    content: orderLookupContent({
      eyebrow: "Orders",
      title: "Your Athletonic orders.",
      copy: "Use the email from checkout and the order reference from your confirmation page.",
    }),
    scripts: ["assets/order-tracking.js"],
  },
  {
    slug: "returns-request",
    title: "Returns & Replacements Request",
    description: "Request a return or replacement for an Athletonic order.",
    activePage: "returns",
    content: returnsRequestContent,
    scripts: ["assets/returns-request.js"],
  },
  {
    slug: "order-confirmation",
    title: "Order Confirmation",
    description: "Athletonic order confirmation and payment status.",
    activePage: "",
    shopLabel: "Continue shopping",
    content: orderConfirmationContent,
    scripts: ["assets/order-confirmation.js"],
  },
];

function commercePage(pageInfo) {
  const pathPrefix = "../";
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${html(pageInfo.title)} | Athletonic</title>
    <meta name="description" content="${html(pageInfo.description)}" />
    <link rel="stylesheet" href="${pathPrefix}styles.css" />
  </head>
  <body class="info-body commerce-body">
${renderCommerceHeader(pageInfo.activePage, pageInfo.shopLabel)}
${pageInfo.content}

${renderFooter(pathPrefix)}
    <script>
      window.ATHLETONIC_SUPABASE_URL = "${html(SUPABASE_PUBLIC_URL)}";
      window.ATHLETONIC_SUPABASE_KEY = "${html(SUPABASE_PUBLIC_KEY)}";
    </script>
    <script src="${pathPrefix}assets/cart.js" defer></script>
    ${pageInfo.scripts
      .map((src) => `<script src="${pathPrefix}${html(src)}" defer></script>`)
      .join("\n    ")}
  </body>
</html>
`;
}

const curatedIds = allCuratedProducts.map((p) => p.id);
const { rowsById: pdpRowsById, imagesById: pdpImagesById } = fetchPdpData(curatedIds);

// Group curated products by section to compute "related" lists
const sectionProductsBySection = new Map();
for (const product of allCuratedProducts) {
  if (!sectionProductsBySection.has(product.sectionId)) {
    sectionProductsBySection.set(product.sectionId, []);
  }
  sectionProductsBySection.get(product.sectionId).push(product);
}

const pdpDir = new URL("../product/", import.meta.url);
mkdirSync(pdpDir, { recursive: true });

let pdpCount = 0;
for (const product of allCuratedProducts) {
  const fullRow = pdpRowsById.get(product.id);
  const imageList = pdpImagesById.get(product.id) || [];
  const peers = (sectionProductsBySection.get(product.sectionId) || [])
    .filter((p) => p.id !== product.id)
    .slice(0, 4);
  const pageHtml = productPage(product, fullRow, imageList, peers);
  writeFileSync(new URL(`${product.id}.html`, pdpDir), pageHtml);
  pdpCount += 1;
}

console.log(`Generated ${pdpCount} curated product detail pages in /product/.`);

// Generate an on-site PDP for EVERY remaining indexed product (the ~34.5k full
// catalog) so search/cards never redirect to an external brand site. Curated
// products already got their richer treatment above and are skipped here.
// Reuses the same productPage() / fetchPdpData() / sanitizeDescriptionHtml()
// pipeline; DB reads are batched inside fetchPdpData to avoid ENOBUFS.
const curatedIdSet = new Set(allCuratedProducts.map((p) => String(p.id)));

// Pre-bucket index records by section for "related" lists on non-curated PDPs.
const indexRecordsBySection = new Map();
for (const record of searchIndexRecords) {
  if (!indexRecordsBySection.has(record.section_id)) {
    indexRecordsBySection.set(record.section_id, []);
  }
  indexRecordsBySection.get(record.section_id).push(record);
}

function indexRecordToProduct(record) {
  return {
    id: record.id,
    brand: record.brand_slug,
    name: record.name,
    displayName: record.name,
    image: record.image,
    price: (Number(record.price_cents) || 0) / 100,
    currency: "USD",
    sectionId: record.section_id,
    sectionTitle: sectionTitleById[record.section_id] ?? "Athletonic catalog",
    store_collection: "",
    url: record.url || null,
  };
}

const nonCuratedRecords = searchIndexRecords.filter(
  (record) => !curatedIdSet.has(record.id)
);

let extraPdpCount = 0;
const PDP_BATCH = 3000;
for (let i = 0; i < nonCuratedRecords.length; i += PDP_BATCH) {
  const batch = nonCuratedRecords.slice(i, i + PDP_BATCH);
  const batchIds = batch.map((record) => record.id);
  const { rowsById: batchRows, imagesById: batchImages } = fetchPdpData(batchIds);

  for (const record of batch) {
    const numericId = Number(record.id);
    const fullRow = batchRows.get(numericId);
    const imageList = batchImages.get(numericId) || [];
    const product = indexRecordToProduct(record);
    const peers = (indexRecordsBySection.get(record.section_id) || [])
      .filter((peer) => peer.id !== record.id)
      .slice(0, 4)
      .map(indexRecordToProduct);
    const pageHtml = productPage(product, fullRow, imageList, peers);
    writeFileSync(new URL(`${record.id}.html`, pdpDir), pageHtml);
    extraPdpCount += 1;
  }
}

console.log(
  `Generated ${extraPdpCount} additional catalog PDPs (total ${
    pdpCount + extraPdpCount
  }) in /product/.`
);

const pagesDir = new URL("../pages/", import.meta.url);
mkdirSync(pagesDir, { recursive: true });

let staticPageCount = 0;
for (const pageInfo of staticPages) {
  writeFileSync(new URL(`${pageInfo.slug}.html`, pagesDir), infoPage(pageInfo));
  staticPageCount += 1;
}

let commercePageCount = 0;
for (const pageInfo of commercePages) {
  writeFileSync(new URL(`${pageInfo.slug}.html`, pagesDir), commercePage(pageInfo));
  commercePageCount += 1;
}

console.log(
  `Generated ${staticPageCount} footer pages and ${commercePageCount} commerce pages in /pages/.`
);
