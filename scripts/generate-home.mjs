import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
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

  const images = runQuery(`
    select product_row_id, position, url, width, height
    from images
    where product_row_id in (${ids.join(",")})
      and url is not null
    order by product_row_id asc, coalesce(position, 0) asc, id asc;
  `);

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

function collectionLabel(value) {
  return String(value ?? "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function productCard(product) {
  const brand = brandNames[product.brand] ?? product.brand;
  const name = product.displayName ?? product.name;
  const label = product.displayLabel ?? collectionLabel(product.store_collection);
  const searchText = [brand, name, label, product.sectionTitle, product.sectionEyebrow]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return `
          <article class="product-card" data-product-id="${html(product.id)}" data-category="${html(product.sectionId)}" data-search="${html(searchText)}">
            <a class="product-image" href="${html(product.url)}" target="_blank" rel="noopener noreferrer">
              <img src="${html(product.image)}" alt="${html(name)}" loading="lazy" />
            </a>
            <div class="product-body">
              <span>${html(brand)}</span>
              <h3>${html(name)}</h3>
              <p>${html(label)}</p>
              <strong>${html(money(product.price, product.currency))}</strong>
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
                data-cart-url="${html(product.url)}"
              >Add to cart</button>
            </div>
          </article>`;
}

const populatedSections = sections
  .map((section) => ({ ...section, products: productsForSection(section) }))
  .filter((section) => section.products.length > 0);

const totalProducts = populatedSections.reduce(
  (sum, section) => sum + section.products.length,
  0
);

const sectionNav = populatedSections
  .slice(0, 9)
  .map((section) => `<a href="#${section.id}">${html(section.title)}</a>`)
  .join("\n        ");

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
${productsWithSection.map(productCard).join("\n")}
        </div>
      </section>`;
    }
  )
  .join("\n");

const topBrands = ATHLETONIC_SOURCE_OF_TRUTH.featuredBrandSlugs.map(
  (brandSlug) => brandNames[brandSlug] ?? brandSlug
);

const page = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Athletonic.com</title>
    <meta
      name="description"
      content="Athletonic.com is a performance marketplace for supplements, sports nutrition, hydration, recovery, apparel, and fitness essentials."
    />
    <link rel="stylesheet" href="./styles.css" />
  </head>
  <body>
    <header class="market-header">
      <div class="header-main">
        <a class="brand" href="/" aria-label="Athletonic home">
          <img class="brand-logo" src="./assets/logo.png" alt="Athletonic" />
        </a>

        <form class="market-search" action="#catalog" data-catalog-search>
          <select name="category" aria-label="Search category">
            <option value="all">All</option>
            ${populatedSections
              .map((section) => `<option value="${html(section.id)}">${html(section.label ?? section.title)}</option>`)
              .join("\n            ")}
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

      <nav class="department-nav" aria-label="Department navigation">
        ${sectionNav}
        <a href="#brands">Brands</a>
      </nav>
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
        <button type="submit" data-checkout-submit>Send checkout request</button>
        <p class="form-note">No fake payment step: this saves your cart so checkout can continue with a real order workflow.</p>
      </form>
    </aside>

    <main>
      <p class="search-status" id="catalog" aria-live="polite" hidden></p>

      <section class="hero">
        <div class="hero-copy">
          <p class="eyebrow"><img class="eyebrow-logo" src="./assets/logo.png" alt="Athletonic" /></p>
          <h1>Build your training stack in one marketplace.</h1>
          <p>
            Supplements, hydration, wellness, recovery devices, footwear,
            apparel, bottles, bags, and gym accessories from fitness-first brands.
          </p>
          <div class="hero-actions">
            <a href="#protein">Shop products</a>
            <a href="#brands">Browse brands</a>
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
          <strong>Official brand sources only</strong>
        </div>
      </section>

      <section class="quick-grid" aria-label="Shop by department">
        <article>
          <h2>Sports Nutrition</h2>
          <p>Protein, creatine, pre-workout, amino acids, bars, and shakes.</p>
          <a href="#protein">Shop nutrition</a>
        </article>
        <article>
          <h2>Hydration & Wellness</h2>
          <p>Electrolytes, vitamins, minerals, greens, gut health, and focus support.</p>
          <a href="#hydration">See wellness</a>
        </article>
        <article>
          <h2>Apparel & Footwear</h2>
          <p>Training shoes, leggings, shorts, shirts, bags, bottles, and shakers.</p>
          <a href="#apparel">View apparel</a>
        </article>
        <article>
          <h2>Recovery</h2>
          <p>Massage, compression, sleep masks, mobility, and post-training support.</p>
          <a href="#recovery">View recovery</a>
        </article>
      </section>

${productSections}

      <section id="brands" class="market-section brand-section">
        <div class="section-title">
          <div>
            <p class="eyebrow">Brands</p>
            <h2>Aligned marketplace brands</h2>
          </div>
          <p>Fitness, sports nutrition, wellness, apparel, accessories, and recovery brands only.</p>
        </div>

        <div class="brand-cloud">
          ${topBrands.map((brand) => `<span>${html(brand)}</span>`).join("\n          ")}
        </div>
      </section>
    </main>

    <footer class="market-footer">
      <div class="footer-main">
        <a class="brand" href="/" aria-label="Athletonic home">
          <img class="brand-logo" src="./assets/logo.png" alt="Athletonic" />
        </a>
        <p class="footer-tagline">Performance marketplace for supplements, hydration, recovery and apparel.</p>
        <p class="footer-copy">&copy; 2026 — All rights reserved.</p>
      </div>
    </footer>
    <script>
      const SUPABASE_PUBLIC_URL = "${html(SUPABASE_PUBLIC_URL)}";
      const SUPABASE_PUBLIC_KEY = "${html(SUPABASE_PUBLIC_KEY)}";
      const CART_STORAGE_KEY = "athletonic-cart-v1";
      const GUEST_EMAIL_KEY = "athletonic-guest-email";

      const searchForm = document.querySelector("[data-catalog-search]");
      const searchStatus = document.querySelector(".search-status");
      const productCards = Array.from(document.querySelectorAll(".product-card"));
      const drawerOverlay = document.querySelector("[data-drawer-overlay]");
      const cartDrawer = document.querySelector("[data-cart-drawer]");
      const accountPanel = document.querySelector("[data-account-panel]");
      const cartItems = document.querySelector("[data-cart-items]");
      const cartCount = document.querySelector("[data-cart-count]");
      const cartSubtotal = document.querySelector("[data-cart-subtotal]");
      const checkoutForm = document.querySelector("[data-checkout-form]");
      const checkoutEmail = document.querySelector("#checkout-email");
      const checkoutStatus = document.querySelector("[data-checkout-status]");
      const checkoutSubmit = document.querySelector("[data-checkout-submit]");
      const accountForm = document.querySelector("[data-account-form]");
      const accountEmail = document.querySelector("#guest-email");
      const accountStatus = document.querySelector("[data-account-status]");
      const accountLabel = document.querySelector("[data-account-label]");

      let cart = loadCart();

      function loadCart() {
        try {
          const parsed = JSON.parse(localStorage.getItem(CART_STORAGE_KEY) || "[]");
          return Array.isArray(parsed) ? parsed : [];
        } catch {
          return [];
        }
      }

      function saveCart() {
        localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
      }

      function formatMoney(value, currency) {
        return new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: currency || "USD",
        }).format(value || 0);
      }

      function cartQuantity() {
        return cart.reduce((sum, item) => sum + item.quantity, 0);
      }

      function cartTotal() {
        return cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
      }

      function openPanel(panel) {
        drawerOverlay.hidden = false;
        panel.hidden = false;
        panel.setAttribute("aria-hidden", "false");
      }

      function closePanels() {
        drawerOverlay.hidden = true;
        cartDrawer.hidden = true;
        accountPanel.hidden = true;
        cartDrawer.setAttribute("aria-hidden", "true");
        accountPanel.setAttribute("aria-hidden", "true");
      }

      function openCart() {
        openPanel(cartDrawer);
      }

      function openAccount() {
        openPanel(accountPanel);
        accountEmail.focus();
      }

      function setFormStatus(element, message, state) {
        element.textContent = message;
        element.dataset.state = state || "";
      }

      function hydrateEmailFields() {
        const email = localStorage.getItem(GUEST_EMAIL_KEY) || "";
        accountEmail.value = email;
        checkoutEmail.value = email;
        accountLabel.textContent = email ? "Guest" : "Guest";
      }

      function renderCart() {
        const totalItems = cartQuantity();
        const total = cartTotal();
        cartCount.textContent = String(totalItems);
        cartCount.hidden = totalItems === 0;
        cartSubtotal.textContent = formatMoney(total, "USD");
        cartItems.textContent = "";

        if (cart.length === 0) {
          const empty = document.createElement("div");
          empty.className = "empty-cart";
          const message = document.createElement("p");
          message.textContent = "Your cart is empty.";
          const action = document.createElement("button");
          action.type = "button";
          action.dataset.cartClose = "";
          action.textContent = "Continue shopping";
          empty.append(message, action);
          cartItems.append(empty);
          checkoutForm.hidden = true;
          checkoutSubmit.disabled = true;
          return;
        }

        checkoutForm.hidden = false;
        checkoutSubmit.disabled = false;

        for (const item of cart) {
          const article = document.createElement("article");
          article.className = "cart-item";

          const image = document.createElement("img");
          image.src = item.image;
          image.alt = item.name;
          image.loading = "lazy";

          const body = document.createElement("div");
          body.className = "cart-item-body";

          const brand = document.createElement("span");
          brand.textContent = item.brand;

          const title = document.createElement("h3");
          title.textContent = item.name;

          const price = document.createElement("strong");
          price.textContent = formatMoney(item.price * item.quantity, item.currency);

          const controls = document.createElement("div");
          controls.className = "cart-controls";

          const minus = document.createElement("button");
          minus.type = "button";
          minus.dataset.cartDecrement = item.id;
          minus.setAttribute("aria-label", "Decrease quantity");
          minus.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"></path></svg>';

          const quantity = document.createElement("span");
          quantity.textContent = String(item.quantity);

          const plus = document.createElement("button");
          plus.type = "button";
          plus.dataset.cartIncrement = item.id;
          plus.setAttribute("aria-label", "Increase quantity");
          plus.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14"></path><path d="M5 12h14"></path></svg>';

          const remove = document.createElement("button");
          remove.type = "button";
          remove.className = "cart-remove-button";
          remove.dataset.cartRemove = item.id;
          remove.setAttribute("aria-label", "Remove item");
          remove.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18"></path><path d="M8 6V4h8v2"></path><path d="M19 6l-1 14H6L5 6"></path><path d="M10 11v5"></path><path d="M14 11v5"></path></svg>';

          controls.append(minus, quantity, plus, remove);
          body.append(brand, title, price, controls);
          article.append(image, body);
          cartItems.append(article);
        }
      }

      function addToCart(button) {
        const item = {
          id: button.dataset.cartId,
          brand: button.dataset.cartBrand,
          name: button.dataset.cartName,
          price: Number(button.dataset.cartPrice || 0),
          currency: button.dataset.cartCurrency || "USD",
          image: button.dataset.cartImage,
          url: button.dataset.cartUrl,
          quantity: 1,
        };
        const existing = cart.find((cartItem) => cartItem.id === item.id);
        if (existing) {
          existing.quantity += 1;
        } else {
          cart.push(item);
        }
        saveCart();
        setFormStatus(checkoutStatus, "", "");
        renderCart();
        openCart();
      }

      function updateCartItem(id, delta) {
        const item = cart.find((cartItem) => cartItem.id === id);
        if (!item) return;
        item.quantity += delta;
        if (item.quantity <= 0) {
          cart = cart.filter((cartItem) => cartItem.id !== id);
        }
        saveCart();
        renderCart();
      }

      function removeCartItem(id) {
        cart = cart.filter((cartItem) => cartItem.id !== id);
        saveCart();
        renderCart();
      }

      function sectionHasVisibleProducts(section) {
        return Array.from(section.querySelectorAll(".product-card")).some(
          (card) => !card.hidden
        );
      }

      function applyCatalogSearch() {
        const formData = new FormData(searchForm);
        const query = String(formData.get("q") || "").trim().toLowerCase();
        const category = String(formData.get("category") || "all");
        let visibleCount = 0;

        for (const card of productCards) {
          const categoryMatches = category === "all" || card.dataset.category === category;
          const queryMatches = !query || (card.dataset.search || "").includes(query);
          const isVisible = categoryMatches && queryMatches;
          card.hidden = !isVisible;
          if (isVisible) visibleCount += 1;
        }

        for (const section of document.querySelectorAll(".market-section")) {
          if (section.id === "brands") continue;
          section.hidden = !sectionHasVisibleProducts(section);
        }

        searchStatus.hidden = false;
        searchStatus.textContent = query || category !== "all"
          ? visibleCount + " products found"
          : "Showing all products";
      }

      async function submitCheckout(email) {
        const payload = {
          p_email: email,
          p_cart: cart.map((item) => ({
            id: item.id,
            brand: item.brand,
            name: item.name,
            price: item.price,
            currency: item.currency,
            quantity: item.quantity,
            url: item.url,
          })),
          p_subtotal: Number(cartTotal().toFixed(2)),
          p_currency: "USD",
        };

        const response = await fetch(SUPABASE_PUBLIC_URL + "/rest/v1/rpc/submit_checkout_intent", {
          method: "POST",
          headers: {
            apikey: SUPABASE_PUBLIC_KEY,
            Authorization: "Bearer " + SUPABASE_PUBLIC_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          throw new Error(await response.text());
        }

        return response.json();
      }

      searchForm.addEventListener("submit", (event) => {
        event.preventDefault();
        applyCatalogSearch();
        searchStatus.scrollIntoView({ block: "start", behavior: "smooth" });
      });

      searchForm.addEventListener("input", applyCatalogSearch);
      searchForm.addEventListener("change", applyCatalogSearch);

      document.addEventListener("click", (event) => {
        const closeButton = event.target.closest("[data-cart-close], [data-account-close]");
        if (closeButton) closePanels();

        const addButton = event.target.closest("[data-add-to-cart]");
        if (addButton) addToCart(addButton);

        const incrementButton = event.target.closest("[data-cart-increment]");
        if (incrementButton) updateCartItem(incrementButton.dataset.cartIncrement, 1);

        const decrementButton = event.target.closest("[data-cart-decrement]");
        if (decrementButton) updateCartItem(decrementButton.dataset.cartDecrement, -1);

        const removeButton = event.target.closest("[data-cart-remove]");
        if (removeButton) removeCartItem(removeButton.dataset.cartRemove);
      });

      document.querySelector("[data-cart-open]").addEventListener("click", openCart);
      document.querySelector("[data-account-open]").addEventListener("click", openAccount);
      drawerOverlay.addEventListener("click", closePanels);

      accountForm.addEventListener("submit", (event) => {
        event.preventDefault();
        const email = String(new FormData(accountForm).get("email") || "").trim();
        localStorage.setItem(GUEST_EMAIL_KEY, email);
        hydrateEmailFields();
        setFormStatus(accountStatus, "Email saved for guest checkout.", "success");
      });

      checkoutForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const email = String(new FormData(checkoutForm).get("email") || "").trim();
        if (cart.length === 0) {
          setFormStatus(checkoutStatus, "Add at least one product before checkout.", "error");
          return;
        }
        localStorage.setItem(GUEST_EMAIL_KEY, email);
        hydrateEmailFields();
        checkoutSubmit.disabled = true;
        setFormStatus(checkoutStatus, "Saving checkout request...", "pending");
        try {
          const records = await submitCheckout(email);
          const reference = Array.isArray(records) && records[0] ? records[0].id : "received";
          cart = [];
          saveCart();
          renderCart();
          setFormStatus(checkoutStatus, "Checkout request saved. Reference: " + reference, "success");
        } catch (error) {
          console.error(error);
          checkoutSubmit.disabled = false;
          setFormStatus(checkoutStatus, "Could not save checkout online. Your cart is still saved here.", "error");
        }
      });

      hydrateEmailFields();
      renderCart();
    </script>
  </body>
</html>
`;

writeFileSync(new URL("../index.html", import.meta.url), page);
console.log(
  `Generated ${totalProducts} products across ${populatedSections.length} sections.`
);
