import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const DB_PATH = "/Users/User/Desktop/Sups/output/data/products.db";

const brandNames = {
  agent_nateur: "Agent Nateur",
  allbirds: "Allbirds",
  alpha_lion: "Alpha Lion",
  amazing_grass: "Amazing Grass",
  animal_pak: "Animal",
  armra: "ARMRA",
  bare_performance: "Bare Performance",
  bear_komplex: "Bear KompleX",
  bloom_nutrition: "Bloom Nutrition",
  body_science_au: "Body Science",
  bsn: "BSN",
  bucked_up: "Bucked Up",
  cellucor: "Cellucor",
  century_martial_arts: "Century Martial Arts",
  codeage: "Codeage",
  compex: "Compex",
  core_nutritionals: "Core Nutritionals",
  cure_hydration: "Cure Hydration",
  cymbiotika: "Cymbiotika",
  drip_drop: "DripDrop",
  dymatize: "Dymatize",
  everlast: "Everlast",
  fairtex: "Fairtex",
  first_phorm: "1st Phorm",
  five_percent_nutrition: "5% Nutrition",
  four_sigmatic: "Four Sigmatic",
  fuji_sports: "Fuji Sports",
  garden_of_life: "Garden of Life",
  ghost_lifestyle: "GHOST",
  goli: "Goli",
  gorilla_mind: "Gorilla Mind",
  harbinger: "Harbinger",
  hayabusa: "Hayabusa",
  huge_supplements: "Huge Supplements",
  hyperice: "Hyperice",
  inno_supps: "Inno Supps",
  iron_bull_strength: "Iron Bull Strength",
  jacked_factory: "Jacked Factory",
  jocko_fuel: "Jocko Fuel",
  kaged: "Kaged",
  key_nutrients: "Key Nutrients",
  kos: "KOS",
  liquid_iv: "Liquid I.V.",
  manta_sleep: "Manta Sleep",
  maryruth_organics: "MaryRuth Organics",
  momentous: "Momentous",
  mud_wtr: "MUD/WTR",
  muscletech: "MuscleTech",
  naked_nutrition: "Naked Nutrition",
  nike: "Nike",
  nordic_naturals: "Nordic Naturals",
  now_foods: "NOW Foods",
  nutrabio: "NutraBio",
  nuun: "Nuun",
  olly: "OLLY",
  onnit: "Onnit",
  optimum_nutrition: "Optimum Nutrition",
  orgain: "Orgain",
  outdoor_voices: "Outdoor Voices",
  owyn: "OWYN",
  pescience: "PEScience",
  primal_kitchen: "Primal Kitchen",
  promix: "Promix",
  pure_encapsulations: "Pure Encapsulations",
  quest_nutrition: "Quest Nutrition",
  raw_nutrition: "RAW Nutrition",
  redcon1: "Redcon1",
  renue_by_science: "Renue By Science",
  ritual: "Ritual",
  rival_boxing: "Rival Boxing",
  sanabul: "Sanabul",
  schiek: "Schiek",
  skratch_labs: "Skratch Labs",
  soylent: "Soylent",
  swolverine: "Swolverine",
  ten_thousand: "Ten Thousand",
  terrasoul_superfoods: "Terrasoul Superfoods",
  therabody: "Therabody",
  thorne: "Thorne",
  transparent_labs: "Transparent Labs",
  true_nutrition: "True Nutrition",
  trx: "TRX Training",
  venum: "Venum",
  vital_proteins: "Vital Proteins",
};

const allowedBrands = Object.keys(brandNames);

const officialBrandDomains = {
  agent_nateur: ["agentnateur.com"],
  allbirds: ["allbirds.com"],
  alpha_lion: ["alphalion.com"],
  amazing_grass: ["amazinggrass.com"],
  animal_pak: ["animalpak.com"],
  armra: ["tryarmra.com"],
  bare_performance: ["bareperformancenutrition.com"],
  bear_komplex: ["bearkomplex.com"],
  bloom_nutrition: ["bloomnu.com"],
  bsn: ["bsnsupplements.com"],
  cellucor: ["cellucor.com"],
  century_martial_arts: ["centurymartialarts.com"],
  codeage: ["codeage.com"],
  compex: ["compex.com"],
  core_nutritionals: ["corenutritionals.com"],
  cure_hydration: ["curehydration.com"],
  cymbiotika: ["cymbiotika.com"],
  drip_drop: ["dripdrop.com"],
  dymatize: ["dymatize.com"],
  everlast: ["everlast.com"],
  fairtex: ["fairtex.com"],
  first_phorm: ["1stphorm.com"],
  five_percent_nutrition: ["5percentnutrition.com"],
  four_sigmatic: ["us.foursigmatic.com"],
  fuji_sports: ["fujisports.com"],
  garden_of_life: ["gardenoflife.com"],
  ghost_lifestyle: ["ghostlifestyle.com"],
  goli: ["goli.com"],
  gorilla_mind: ["gorillamind.com"],
  harbinger: ["harbingerfitness.com"],
  hayabusa: ["hayabusafight.com"],
  huge_supplements: ["hugesupplements.com"],
  hyperice: ["hyperice.com"],
  inno_supps: ["innosupps.com"],
  iron_bull_strength: ["ironbullstrength.com"],
  jacked_factory: ["jackedfactory.com"],
  jocko_fuel: ["jockofuel.com"],
  kaged: ["kaged.com"],
  key_nutrients: ["keynutrients.com"],
  kos: ["kos.com"],
  liquid_iv: ["liquid-iv.com"],
  manta_sleep: ["mantasleep.com"],
  maryruth_organics: ["maryruthorganics.com"],
  momentous: ["livemomentous.com"],
  muscletech: ["muscletech.com"],
  naked_nutrition: ["nakednutrition.com"],
  nike: ["nike.com"],
  nordic_naturals: ["nordic.com"],
  now_foods: ["nowfoods.com"],
  nutrabio: ["nutrabio.com"],
  nuun: ["nuunlife.com"],
  olly: ["olly.com"],
  onnit: ["onnit.com"],
  optimum_nutrition: ["optimumnutrition.com"],
  orgain: ["orgain.com"],
  outdoor_voices: ["outdoorvoices.com"],
  owyn: ["liveowyn.com"],
  pescience: ["pescience.com"],
  primal_kitchen: ["primalkitchen.com"],
  promix: ["promixnutrition.com"],
  pure_encapsulations: ["pureencapsulationspro.com"],
  quest_nutrition: ["questnutrition.com"],
  raw_nutrition: ["getrawnutrition.com"],
  redcon1: ["redcon1.com"],
  renue_by_science: ["renuebyscience.com"],
  ritual: ["ritual.com"],
  rival_boxing: ["rivalboxing.us"],
  sanabul: ["sanabulsports.com"],
  schiek: ["schiek.com"],
  skratch_labs: ["skratchlabs.com"],
  soylent: ["soylent.com"],
  swolverine: ["swolverine.com"],
  ten_thousand: ["tenthousand.cc"],
  terrasoul_superfoods: ["terrasoul.com"],
  therabody: ["therabody.com"],
  thorne: ["thorne.com"],
  transparent_labs: ["transparentlabs.com"],
  true_nutrition: ["truenutrition.com"],
  trx: ["trxtraining.com"],
  venum: ["venum.com"],
  vital_proteins: ["vitalproteins.com"],
};

const blockedSourceDomains = new Set([
  "bodyandfit.com",
  "bodyscience.com.au",
  "bodybuilding.com",
  "discount-supplements.co.uk",
  "nzmuscle.co.nz",
  "supplementmart.com.au",
  "supplementsource.ca",
  "suppz.com",
  "swansonvitamins.com",
  "thefeed.com",
  "tigerfitness.com",
  "nutritionwarehouse.com.au",
]);
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
      "p.store_collection = 'energy_hydration' and (p.brand in ('liquid_iv','nuun','skratch_labs','drip_drop','cure_hydration','bare_performance','alpha_lion','body_science_au','naked_nutrition') or lower(p.name) like '%hydration%' or lower(p.name) like '%electrolyte%')",
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
  return `
          <article class="product-card" data-product-id="${html(product.id)}">
            <a class="product-image" href="${html(product.url)}" target="_blank" rel="noreferrer">
              <img src="${html(product.image)}" alt="${html(name)}" loading="lazy" />
            </a>
            <div class="product-body">
              <span>${html(brand)}</span>
              <h3>${html(name)}</h3>
              <p>${html(label)}</p>
              <strong>${html(money(product.price, product.currency))}</strong>
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
    (section) => `
      <section id="${section.id}" class="market-section">
        <div class="section-title">
          <div>
            <p class="eyebrow">${html(section.eyebrow)}</p>
            <h2>${html(section.title)}</h2>
          </div>
          <p>${html(section.description)}</p>
        </div>
        <div class="product-row">
${section.products.map(productCard).join("\n")}
        </div>
      </section>`
  )
  .join("\n");

const topBrands = [
  "Optimum Nutrition",
  "GHOST",
  "Gorilla Mind",
  "RAW Nutrition",
  "Cellucor",
  "Transparent Labs",
  "Kaged",
  "1st Phorm",
  "Liquid I.V.",
  "Nuun",
  "Skratch Labs",
  "Thorne",
  "Garden of Life",
  "Ritual",
  "MaryRuth Organics",
  "Goli",
  "Nike",
  "Allbirds",
  "Ten Thousand",
  "Outdoor Voices",
  "Bear KompleX",
  "TRX Training",
  "Harbinger",
  "Schiek",
  "Therabody",
  "Hyperice",
  "Compex",
  "Manta Sleep",
];

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
        <a class="brand" href="/">
          <span class="brand-mark">A</span>
          <span>Athletonic<span>.com</span></span>
        </a>

        <button class="location-chip" type="button">
          <span>Ship to</span>
          <strong>United States</strong>
        </button>

        <form class="market-search" action="#protein">
          <select aria-label="Search category">
            <option>All</option>
            <option>Protein</option>
            <option>Creatine</option>
            <option>Hydration</option>
            <option>Apparel</option>
            <option>Recovery</option>
          </select>
          <input
            type="search"
            aria-label="Search Athletonic"
            placeholder="Search protein, creatine, hydration, apparel, recovery..."
          />
          <button type="submit">Search</button>
        </form>

        <a class="header-link" href="#brands">
          <span>Explore</span>
          <strong>Brands</strong>
        </a>
        <a class="header-link" href="#deals">
          <span>${totalProducts}</span>
          <strong>Top picks</strong>
        </a>
        <a class="cart-link" href="#protein" aria-label="Cart">
          <span>0</span>
          <strong>Cart</strong>
        </a>
      </div>

      <nav class="department-nav" aria-label="Department navigation">
        <a href="#deals">Today's Deals</a>
        ${sectionNav}
        <a href="#brands">Brands</a>
      </nav>
    </header>

    <main>
      <section class="hero">
        <div class="hero-copy">
          <p class="eyebrow">Athletonic.com</p>
          <h1>Build your training stack in one marketplace.</h1>
          <p>
            Supplements, hydration, wellness, recovery devices, footwear,
            apparel, bottles, bags, and gym accessories from fitness-first brands.
          </p>
          <div class="hero-actions">
            <a href="#protein">Shop top picks</a>
            <a href="#brands">Browse brands</a>
          </div>
        </div>

        <div class="hero-deal" id="deals">
          <span class="deal-label">Launch shelf</span>
          <img
            src="https://cdn.shopify.com/s/files/1/0794/9991/9627/files/on-ON-2-GSW-2270g-bundle_Image_01_1.png"
            alt="Gold Standard 100% Whey Protein"
          />
          <h2>${totalProducts} curated products</h2>
          <p>Protein, creatine, pre-workout, hydration, recovery, apparel, footwear, and accessories.</p>
          <strong>From $8.99</strong>
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
  </body>
</html>
`;

writeFileSync(new URL("../index.html", import.meta.url), page);
console.log(
  `Generated ${totalProducts} products across ${populatedSections.length} sections.`
);
