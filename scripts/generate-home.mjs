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
  cellucor: "Cellucor",
  codeage: "Codeage",
  compex: "Compex",
  core_nutritionals: "Core Nutritionals",
  cure_hydration: "Cure Hydration",
  cymbiotika: "Cymbiotika",
  drip_drop: "DripDrop",
  dymatize: "Dymatize",
  first_phorm: "1st Phorm",
  five_percent_nutrition: "5% Nutrition",
  garden_of_life: "Garden of Life",
  ghost_lifestyle: "GHOST",
  goli: "Goli",
  gorilla_mind: "Gorilla Mind",
  harbinger: "Harbinger",
  huge_supplements: "Huge Supplements",
  hyperice: "Hyperice",
  inno_supps: "Inno Supps",
  iron_bull_strength: "Iron Bull Strength",
  jacked_factory: "Jacked Factory",
  jocko_fuel: "Jocko Fuel",
  kaged: "Kaged",
  kos: "KOS",
  liquid_iv: "Liquid I.V.",
  manta_sleep: "Manta Sleep",
  maryruth_organics: "MaryRuth Organics",
  momentous: "Momentous",
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
  vital_proteins: "Vital Proteins",
};

const allowedBrands = Object.keys(brandNames);
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
  "tool",
  "drill",
  "saw",
  "wrench",
];

const sections = [
  {
    id: "protein",
    eyebrow: "Sports nutrition",
    title: "Protein best sellers",
    description: "Whey, plant protein, meal shakes, and recovery protein.",
    where:
      "p.store_department = 'sports_nutrition' and p.store_collection = 'protein'",
    maxPrice: 180,
  },
  {
    id: "creatine",
    eyebrow: "Strength",
    title: "Creatine shelf",
    description: "Creatine powders, capsules, chews, and stack bundles.",
    where:
      "p.store_department = 'sports_nutrition' and p.store_collection = 'creatine'",
    maxPrice: 130,
  },
  {
    id: "pre-workout",
    eyebrow: "Energy",
    title: "Pre-workout",
    description: "Performance blends, pump formulas, and training energy.",
    where:
      "p.store_department = 'sports_nutrition' and p.store_collection = 'pre_workout'",
    maxPrice: 120,
  },
  {
    id: "hydration",
    eyebrow: "Daily performance",
    title: "Hydration & electrolytes",
    description: "Hydration mixes, electrolyte sticks, and functional drinks.",
    where:
      "p.store_collection = 'energy_hydration' and (p.brand in ('liquid_iv','nuun','skratch_labs','drip_drop','cure_hydration','bare_performance','alpha_lion','body_science_au','naked_nutrition') or lower(p.name) like '%hydration%' or lower(p.name) like '%electrolyte%')",
    maxPrice: 90,
  },
  {
    id: "vitamins",
    eyebrow: "Wellness",
    title: "Vitamins & daily health",
    description: "Multivitamins, minerals, omegas, immune, and joint support.",
    where:
      "p.store_department = 'vitamins_health' and p.brand not in ('iron_bull_strength')",
    maxPrice: 110,
  },
  {
    id: "greens",
    eyebrow: "Wellness",
    title: "Greens & superfoods",
    description: "Greens blends, superfood powders, and daily nutrition.",
    where:
      "p.store_collection = 'greens_superfoods' and p.brand not in ('allbirds','ten_thousand')",
    maxPrice: 90,
  },
  {
    id: "bars-shakes",
    eyebrow: "Ready now",
    title: "Bars, shakes & meal replacements",
    description: "Protein bars, RTD shakes, complete meals, and snacks.",
    where:
      "p.store_collection in ('protein_bars','rtd_shakes','meal_replacement')",
    maxPrice: 120,
  },
  {
    id: "recovery",
    eyebrow: "Recovery",
    title: "Recovery devices",
    description: "Massage, red light, compression, and recovery accessories.",
    where:
      "p.store_collection = 'recovery_devices'",
    maxPrice: 250,
  },
  {
    id: "sleep",
    eyebrow: "Recovery",
    title: "Sleep recovery",
    description: "Sleep masks, relaxation support, and nighttime recovery.",
    where:
      "p.store_collection in ('sleep_gear','sleep_stress') and p.brand not in ('codeage')",
    maxPrice: 180,
  },
  {
    id: "apparel",
    eyebrow: "Apparel",
    title: "Training apparel",
    description: "Leggings, shorts, tees, hoodies, active layers, and gym wear.",
    where:
      "p.store_department = 'apparel_accessories' and p.store_collection = 'apparel' and p.brand in ('nike','allbirds','ten_thousand','outdoor_voices','first_phorm','ghost_lifestyle','raw_nutrition','redcon1','bear_komplex','kaged','bare_performance','alpha_lion','trx')",
    maxPrice: 180,
  },
  {
    id: "shoes",
    eyebrow: "Footwear",
    title: "Training shoes",
    description: "Running, training, trail, and performance footwear.",
    where:
      "p.store_department = 'apparel_accessories' and p.store_collection = 'shoes' and p.brand in ('nike','allbirds','ten_thousand')",
    maxPrice: 220,
  },
  {
    id: "accessories",
    eyebrow: "Accessories",
    title: "Bottles, bags & gym accessories",
    description: "Shakers, water bottles, belts, bags, grips, sleeves, and straps.",
    where:
      "p.store_department = 'apparel_accessories' and p.store_collection = 'bags_bottles'",
    maxPrice: 130,
  },
  {
    id: "training-gear",
    eyebrow: "Training gear",
    title: "Gym equipment & fight gear",
    description: "Training systems, gloves, wraps, pads, grips, and fight gear.",
    where:
      "p.store_department = 'sports_gear' and p.store_collection = 'fight_gear'",
    maxPrice: 220,
  },
];

function sqlString(value) {
  return `'${value.replaceAll("'", "''")}'`;
}

function runQuery(sql) {
  const output = execFileSync("sqlite3", ["-json", DB_PATH, sql], {
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 16,
  });
  return JSON.parse(output || "[]");
}

function productsForSection(section) {
  const allowedSql = allowedBrands.map(sqlString).join(",");
  const excludedSql = excludedBrands.map(sqlString).join(",");
  const forbiddenSql = forbiddenNameFilters
    .map((term) => `lower(p.name) not like ${sqlString(`%${term}%`)}`)
    .join(" and ");

  const sql = `
    select
      p.brand,
      p.name,
      p.store_collection,
      p.price,
      coalesce(p.currency, 'USD') currency,
      p.url,
      min(i.url) image
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
  const seenNames = new Set();
  const brandCounts = new Map();
  const products = [];

  for (const row of rows) {
    const nameKey = String(row.name).toLowerCase().replace(/\s+/g, " ").trim();
    if (seenNames.has(nameKey)) continue;

    const brandCount = brandCounts.get(row.brand) ?? 0;
    if (brandCount >= 4) continue;

    seenNames.add(nameKey);
    brandCounts.set(row.brand, brandCount + 1);
    products.push(row);

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
  return `
          <article class="product-card">
            <a class="product-image" href="${html(product.url)}" target="_blank" rel="noreferrer">
              <img src="${html(product.image)}" alt="${html(product.name)}" loading="lazy" />
            </a>
            <div class="product-body">
              <span>${html(brand)}</span>
              <h3>${html(product.name)}</h3>
              <p>${html(collectionLabel(product.store_collection))}</p>
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
