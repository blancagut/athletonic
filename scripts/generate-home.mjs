import { execFileSync } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";
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

function productCard(product, pathPrefix = "./") {
  const brand = brandNames[product.brand] ?? product.brand;
  const name = product.displayName ?? product.name;
  const label = product.displayLabel ?? collectionLabel(product.store_collection);
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
          href: "#brands",
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
      content="Athletonic.com is a performance marketplace for supplements, sports nutrition, hydration, recovery, apparel, and fitness essentials."
    />
    <link rel="stylesheet" href="./styles.css" />
  </head>
  <body>
    <a id="top" tabindex="-1" aria-hidden="true"></a>
    <header class="market-header">
      <div class="header-main">
        <a class="brand" href="./" aria-label="Athletonic home">
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
        <button type="submit" data-checkout-submit>Continue to secure payment</button>
        <p class="form-note">Payment is processed securely with Stripe. Athletonic creates your order after payment is confirmed.</p>
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
          <strong>Sold through Athletonic</strong>
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

const allCuratedProducts = populatedSections.flatMap((section) =>
  section.products.map((product) => ({
    ...product,
    sectionId: section.id,
    sectionTitle: section.title,
    sectionEyebrow: section.eyebrow,
    sectionDescription: section.description,
  }))
);

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
        currency: product.currency || ATHLETONIC_SOURCE_OF_TRUTH.marketplace.currency,
        available: true,
        section_id: product.sectionId,
        section_title: product.sectionTitle,
      })),
    },
    null,
    2
  )
);

function fetchPdpData(productIds) {
  const ids = productIds
    .map((id) => Number(id))
    .filter((id) => Number.isInteger(id) && id > 0);
  if (ids.length === 0) return { rowsById: new Map(), imagesById: new Map() };

  const rows = runQuery(`
    select id, brand, name, handle, description_html, price, compare_at_price,
           currency, options, tags, store_collection, category_normalized
    from products
    where id in (${ids.join(",")});
  `);
  const rowsById = new Map(rows.map((row) => [row.id, row]));

  const images = runQuery(`
    select product_row_id, position, url, width, height
    from images
    where product_row_id in (${ids.join(",")})
      and url is not null
    order by product_row_id asc, coalesce(position, 0) asc, id asc;
  `);
  const imagesById = new Map();
  for (const image of images) {
    if (isBlockedImage(image.url)) continue;
    if (!imagesById.has(image.product_row_id)) {
      imagesById.set(image.product_row_id, []);
    }
    imagesById.get(image.product_row_id).push(image);
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
  // Drop disallowed tags but keep their inner text
  out = out.replace(/<\s*\/?\s*([a-zA-Z0-9]+)\b[^>]*>/g, (match, tag) => {
    return ALLOWED_DESC_TAGS.has(tag.toLowerCase()) ? match : "";
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
        <a class="brand" href="${pathPrefix}" aria-label="Athletonic home">
          <img class="brand-logo" src="${pathPrefix}assets/logo.png" alt="Athletonic" />
        </a>
        <div class="pdp-header-search">
          <form class="market-search" action="${pathPrefix}#catalog" method="get" data-catalog-search>
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
  const price = Number(fullRow?.price ?? curated.price ?? 0);
  const compareAt = Number(fullRow?.compare_at_price ?? 0);
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
          <a href="${pathPrefix}#${html(curated.sectionId)}">${html(curated.sectionTitle || "Catalog")}</a>
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
      `${name} by ${brand}. Buy directly on Athletonic — marketplace for sports nutrition, hydration, recovery, apparel, and training gear.`
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

const staticPages = [
  {
    slug: "about",
    title: "About Athletonic",
    eyebrow: "Company",
    summary:
      "Athletonic is a performance marketplace built for customers who want supplements, training gear, apparel, footwear, recovery tools, and daily wellness products in one focused store.",
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
      "Athletonic is building a focused commerce team across marketplace operations, product catalog quality, customer experience, performance marketing, and partnerships.",
    sections: [
      {
        heading: "Current Focus",
        bullets: [
          "Marketplace operations and vendor coordination",
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
      "Company announcements, marketplace updates, catalog milestones, and partnership news from Athletonic.",
    sections: [
      {
        heading: "Media Contact",
        body:
          "For press inquiries, email press@athletonic.com with your publication, deadline, and requested topic.",
      },
      {
        heading: "Launch Status",
        body:
          "Athletonic is preparing its performance marketplace for public customer acquisition and paid social campaigns.",
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
    links: [{ label: "Shop all products", href: "#catalog" }],
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
    links: [{ label: "Browse catalog", href: "#catalog" }],
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
          "Email partners@athletonic.com with your brand name, product categories, and operating region.",
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
          "Affiliate tracking and commission rules should be finalized before public recruitment begins.",
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
          "Wholesale or marketplace pricing terms",
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
    slug: "orders",
    title: "Your Orders",
    eyebrow: "Customer",
    summary:
      "Order tracking will connect to completed checkout records once the full payment and fulfillment workflow is active.",
    sections: [
      {
        heading: "Checkout Requests",
        body:
          "Current checkout submissions create a saved request reference so the customer flow can continue with a real order workflow.",
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
          "Athletonic is configured for United States customers and USD pricing. International shipping should remain unavailable until rates, taxes, and restrictions are configured.",
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
          "For partnerships, advertising, vendors, and press, use partners@athletonic.com or press@athletonic.com.",
      },
    ],
  },
  {
    slug: "conditions-of-use",
    title: "Conditions of Use",
    eyebrow: "Legal",
    summary:
      "These Conditions of Use govern access to Athletonic and purchases or checkout requests made through the marketplace.",
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
          "Customers can request privacy help by emailing privacy@athletonic.com.",
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
          "Customers can email privacy@athletonic.com with the subject Ads Privacy Choices.",
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
          "Email accessibility@athletonic.com with the page URL, issue description, assistive technology used, and contact information.",
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
          "Email privacy@athletonic.com with the subject Do Not Sell or Share My Personal Information.",
      },
      {
        heading: "Verification",
        body:
          "Athletonic may need to verify the request before applying it to customer records, advertising identifiers, or support history.",
      },
    ],
  },
];

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

function infoPage(pageInfo) {
  const pathPrefix = "../";
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

    <main class="info-main">
      <section class="info-hero">
        <p class="eyebrow">${html(pageInfo.eyebrow)}</p>
        <h1>${html(pageInfo.title)}</h1>
        <p>${html(pageInfo.summary)}</p>
        ${renderInfoLinks(pageInfo.links, pathPrefix)}
      </section>
      <div class="info-grid">
${renderInfoSections(pageInfo.sections)}
      </div>
      <p class="info-updated">Last updated May 20, 2026</p>
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

console.log(`Generated ${pdpCount} product detail pages in /product/.`);

const pagesDir = new URL("../pages/", import.meta.url);
mkdirSync(pagesDir, { recursive: true });

let staticPageCount = 0;
for (const pageInfo of staticPages) {
  writeFileSync(new URL(`${pageInfo.slug}.html`, pagesDir), infoPage(pageInfo));
  staticPageCount += 1;
}

console.log(`Generated ${staticPageCount} footer pages in /pages/.`);
