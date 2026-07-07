"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { DEFAULT_DISCOUNT_BPS } = require("./private-pricing");

const WHOLESALE_CATALOG_PATH = path.join(
  process.cwd(),
  "data",
  "wholesale-muay-thai-catalog.json"
);

// Wholesale pricing mirrors the private-pricing gear tier: 40% off US retail.
const WHOLESALE_DISCOUNT_BPS = DEFAULT_DISCOUNT_BPS;

function toPriceCents(price, currency) {
  const value = Number(price);
  if (!Number.isFinite(value) || value <= 0) return null;
  if (String(currency || "USD").trim().toUpperCase() !== "USD") return null;
  return Math.round(value * 100);
}

function wholesalePriceCents(retailPriceCents) {
  const retail = Number(retailPriceCents);
  if (!Number.isInteger(retail) || retail <= 0) return null;
  return Math.max(1, Math.round((retail * (10000 - WHOLESALE_DISCOUNT_BPS)) / 10000));
}

const THAI_FIGHT_BRANDS = new Set([
  "boon",
  "fairtex",
  "topking",
  "top king",
  "raja_boxing",
  "raja boxing",
  "twins_special",
  "twins special",
  "windy",
  "king pro",
  "sks",
  "thaismai",
  "yokkao",
  "primo",
]);

const APPROVED_WHOLESALE_BRANDS = new Set([
  ...THAI_FIGHT_BRANDS,
  "century_martial_arts",
  "fuji_sports",
  "rdx_sports",
  "sanabul",
  "shock_doctor",
]);

const BANNED_WHOLESALE_BRANDS = new Set([
  "allbirds",
  "bear_komplex",
  "everlast",
  "ghost_lifestyle",
  "hayabusa",
  "rival_boxing",
  "soccer90",
  "soccer_post",
  "soccer_zone_usa",
  "venum",
]);

const GLOBAL_FIGHT_BRANDS = new Set([
  "century_martial_arts",
  "fuji_sports",
  "rdx_sports",
  "sanabul",
  "shock_doctor",
]);

const POSITIVE_PATTERNS = [
  /\bmuay thai\b/i,
  /\bboxing\b/i,
  /\bkickboxing\b/i,
  /\bmma\b/i,
  /\bfight gear\b/i,
  /\bfight glove(s)?\b/i,
  /\bgloves?\b/i,
  /\bpunch mitts?\b/i,
  /\bpunching mitts?\b/i,
  /\bfocus mitts?\b/i,
  /\bmitts?\b/i,
  /\bhand wraps?\b/i,
  /\bwraps?\b/i,
  /\bshin guard(s)?\b/i,
  /\bheadgear\b/i,
  /\bhead guard\b/i,
  /\bgroin (protector|guard)\b/i,
  /\bmouth guard\b/i,
  /\bbelly pad\b/i,
  /\bbody protector\b/i,
  /\btraining shields?\b/i,
  /\bbody shields?\b/i,
  /\bblock trainers?\b/i,
  /\bthigh pads?\b/i,
  /\bbag gloves?\b/i,
  /\bheavy bag\b/i,
  /\bpunching bag\b/i,
  /\bspeed bag\b/i,
  /\btraining bag\b/i,
  /\bthai pad(s)?\b/i,
  /\bkick pad(s)?\b/i,
  /\bskipping rope\b/i,
  /\bjump rope\b/i,
  /\bgauze\b/i,
  /\bboxing oil\b/i,
  /\bankle guard(s)?\b/i,
  /\bankle support(s)?\b/i,
  /\belbow guard(s)?\b/i,
  /\bmongkols?\b/i,
  /\bprajits?\b/i,
  /\bprajiads?\b/i,
  /\bfight short(s)?\b/i,
  /\bmuay thai short(s)?\b/i,
  /\bboxing short(s)?\b/i,
  /\btraining gear\b/i,
];

const WHOLESALE_ALLOWED_PRODUCT_PATTERNS = [
  /\bgloves?\b/i,
  /\bboxing gloves?\b/i,
  /\bmuay thai gloves?\b/i,
  /\btraining gloves?\b/i,
  /\bsparring gloves?\b/i,
  /\bfight gloves?\b/i,
  /\b(rfbgv|rbgv|rbgl|bgv)[- ]?[a-z0-9]*/i,
  /\bbag gloves?\b/i,
  /\bbag mitts?\b/i,
  /\bgrappling gloves?\b/i,
  /\bmma gloves?\b/i,
  /\bfocus mitts?\b/i,
  /\bpunch mitts?\b/i,
  /\bpunching mitts?\b/i,
  /\bpro mitts?\b/i,
  /\bthai pads?\b/i,
  /\bkick pads?\b/i,
  /\bkicking pads?\b/i,
  /\bkicking shields?\b/i,
  /\bstrike shields?\b/i,
  /\bpunch shields?\b/i,
  /\bboxing pads?\b/i,
  /\bboxing paddles?\b/i,
  /\bboxing sticks?\b/i,
  /\bstriking (sticks?|paddles?)\b/i,
  /\bbelly pads?\b/i,
  /\bbelly protectors?\b/i,
  /\bbody protectors?\b/i,
  /\bprotective vests?\b/i,
  /\btraining shields?\b/i,
  /\bbody shields?\b/i,
  /\bblock trainers?\b/i,
  /\bthigh pads?\b/i,
  /\bshin guards?\b/i,
  /\bshinguards?\b/i,
  /\b(rfbsg|rsg)[- ]?[a-z0-9]*/i,
  /\bshin pads?\b/i,
  /\bheadgear\b/i,
  /\bhead guards?\b/i,
  /\bheadguards?\b/i,
  /\bgroin (guards?|protectors?)\b/i,
  /\bno[- ]?foul protectors?\b/i,
  /\bgroin cups?\b/i,
  /\bprotective cups?\b/i,
  /\bcups? & supporters?\b/i,
  /\bmouth ?guards?\b/i,
  /\bhand wraps?\b/i,
  /\bhandwraps?\b/i,
  /\bwrist wraps?\b/i,
  /\bankle (guards?|supports?)\b/i,
  /\bheavy bags?\b/i,
  /\bpunching bags?\b/i,
  /\bbanana bags?\b/i,
  /\bdouble end bags?\b/i,
  /\bspeed bags?\b/i,
  /\bmaize bags?\b/i,
  /\bmuay thai heavy bags?\b/i,
  /\btraining bags?\b/i,
  /\bpunch balls?\b/i,
  /\bboxing kits?\b/i,
  /\bmma kits?\b/i,
  /\bboxing tape\b/i,
  /\bgauze\b/i,
  /\bboxing oil\b/i,
  /\bmuay thai shorts?\b/i,
  /\bthai boxing shorts?\b/i,
  /\bboxing shorts?\b/i,
  /\bboxing trunks?\b/i,
  /\bfight shorts?\b/i,
  /\bkids boxing shorts?\b/i,
  /\bmma shorts?\b/i,
  /\belbow guards?\b/i,
  /\bmongkols?\b/i,
  /\bprajits?\b/i,
  /\bprajiads?\b/i,
  /\bskipping ropes?\b/i,
  /\bjump ropes?\b/i,
  /\bcorner supplies?\b/i,
  /\bcoach(ing)? (gear|equipment)\b/i,
  /\btraining (tools?|equipment)\b/i,
];

const NEGATIVE_PATTERNS = [
  /\bsupplement(s)?\b/i,
  /\bprotein\b/i,
  /\bwhey\b/i,
  /\bcreatine\b/i,
  /\bvitamin(s)?\b/i,
  /\b(greens? powder|super greens?|greens? superfoods?|green superfoods?)\b/i,
  /\bpre[- ]workout\b/i,
  /\bsoccer\b/i,
  /\bfootball\b/i,
  /\bgoalkeeper\b/i,
  /\bcleats?\b/i,
  /\bshoes?\b/i,
  /\brunning\b/i,
  /\bcasual wear\b/i,
  /\blifestyle\b/i,
  /\bhoodies?\b/i,
  /\btees?\b/i,
  /\bt[- ]?shirts?\b/i,
  /\bshirts?\b/i,
  /\bcaps?\b/i,
  /\bhats?\b/i,
  /\bjackets?\b/i,
  /\bbeanies?\b/i,
  /\bsweatshirts?\b/i,
  /\btank tops?\b/i,
  /\bpants?\b/i,
  /\bleggings?\b/i,
  /\btrousers?\b/i,
  /\bbra\b/i,
  /\bsock(s)?\b/i,
  /\bfootwear\b/i,
  /\buniforms?\b/i,
  /\bjerseys?\b/i,
  /\bkimono\b/i,
  /\bkeikogi\b/i,
  /\bbjj\b/i,
  /\bjiu[- ]?jitsu\b/i,
  /\bjudo\b/i,
  /\bkarate\b/i,
  /\bgi\b/i,
  /\bbelts?\b/i,
  /\bpatch(es)?\b/i,
  /\bbooks?\b/i,
  /\bnovelt(y|ies)\b/i,
  /\begift\b/i,
  /\bgift cards?\b/i,
  /\bexchange and return credit\b/i,
  /\bmug\b/i,
  /\bcandle\b/i,
  /\bhanging mirror\b/i,
  /\bmini boxing gloves?\b/i,
  /\bmini gloves?\b/i,
  /\bkeychains?\b/i,
  /\bkey chains?\b/i,
  /\bkey rings?\b/i,
  /\bautograph gloves?\b/i,
  /\bautograph boxing gloves?\b/i,
  /\bstickers?\b/i,
  /\bnecklace\b/i,
  /\bjewelry\b/i,
  /\bduffle\b/i,
  /\bgym bags?\b/i,
  /\btoys?\b/i,
  /\bshakers?\b/i,
  /\bbottles?\b/i,
  /\bbackpack\b/i,
  /\bcooler\b/i,
  /\bdeodorant\b/i,
  /\bmouthwash\b/i,
  /\bmassage oil\b/i,
  /\bsoap\b/i,
  /\bperfume\b/i,
  /\bwallet\b/i,
  /\bblanket\b/i,
  /\bposter\b/i,
  /\bpackage protection\b/i,
  /\bpersonalization\b/i,
  /\bgrappling dummy\b/i,
  /\btraining dummy\b/i,
  /\bwall pads?\b/i,
  /\bpost pads?\b/i,
  /\broll out mat\b/i,
  /\bhome roll mat\b/i,
  /\bmat tape\b/i,
  /\bunderlayment\b/i,
  /\bfoam\b/i,
  /\bcarpet bonded\b/i,
  /\bcrash pads?\b/i,
  /\bescrima\b/i,
  /\bbo staff\b/i,
  /\brattan cane\b/i,
  /\bceiling hook\b/i,
  /\bsteel hook\b/i,
  /\banchor\b/i,
];

const SIZE_NAME_RE = /\b(size|sizes|fit|fitment|weight|oz|kg|lb|lbs|youth|adult|xs|s|m|l|xl|xxl|xxxl)\b/i;
const COLOR_NAME_RE = /\b(color|colour|colors|colours|shade|tone)\b/i;

function stripHtml(value) {
  return String(value || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanText(value) {
  return stripHtml(value).toLowerCase();
}

function humanizeSlug(value) {
  return String(value || "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .map((part) => {
      if (/^(rdx|mma|muay|thai)$/i.test(part)) return part.toUpperCase();
      if (/^\d+$/.test(part)) return part;
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    })
    .join(" ");
}

function normalizeTextList(values) {
  if (!Array.isArray(values)) return [];
  return values
    .map((entry) => stripHtml(entry).trim())
    .filter(Boolean);
}

function parseJson(value, fallback) {
  if (!value) return fallback;
  try {
    return JSON.parse(String(value));
  } catch {
    return fallback;
  }
}

function dedupeSorted(values) {
  return [...new Set(values.map((value) => stripHtml(value).trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" })
  );
}

function getBrandOrigin(brandSlug) {
  const slug = cleanText(brandSlug || "").trim();
  if (!slug) return "Unknown";
  if (THAI_FIGHT_BRANDS.has(slug)) return "Thailand";
  if (slug === "twins_special" || slug === "raja_boxing") return "Thailand";
  return "Other";
}

function deriveProductType(text) {
  const thaiBrand = /\b(raja boxing|raja_boxing|fairtex|twins special|twins_special|windy|boon|topking|top king|thaismai)\b/.test(text);

  if (/\b(shorts?|trunks?)\b/.test(text) || (thaiBrand && /\bshorts?\b/.test(text))) return "Shorts";
  if (/\b(rfbsg|rsg)[- ]?[a-z0-9]*/.test(text)) return "Shin Guards";
  if (/\bshin (guard|pad)(s)?\b/.test(text) || /\bshinguards?\b/.test(text)) return "Shin Guards";
  if (/\bheadgear\b/.test(text) || /\bhead guards?\b/.test(text) || /\bheadguards?\b/.test(text)) return "Headgear";
  if (/\bgroin (protector|guard|cup)\b/.test(text) || /\bno[- ]?foul protector\b/.test(text) || /\bprotective cup\b/.test(text))
    return "Groin Protectors";
  if (/\bmouth ?guards?\b/.test(text)) return "Mouthguards";
  if (/\bankle (guards?|supports?)\b/.test(text) || /\belbow guards?\b/.test(text)) return "Ankle & Elbow Supports";
  if (/\bmongkols?\b/.test(text) || /\bprajits?\b/.test(text) || /\bprajiads?\b/.test(text)) return "Mongkol & Prajiad";
  if (/\bhand ?wraps?\b/.test(text) || /\bboxing tape\b/.test(text) || /\bgauze\b/.test(text)) return "Hand Wraps & Tape";
  if (/\bbelly (pad|protector)s?\b/.test(text)) return "Belly Pads";
  if (/\bbody protectors?\b/.test(text) || /\bprotective vests?\b/.test(text)) return "Body Protectors";
  if (/\btraining shields?\b/.test(text) || /\bbody shields?\b/.test(text) || /\bstrike shields?\b/.test(text) || /\bpunch shields?\b/.test(text) || /\bblock trainers?\b/.test(text) || /\bthigh pads?\b/.test(text))
    return "Body Shields";
  if (/\bthai pad(s)?\b/.test(text) || /\bkick(ing)? pad(s)?\b/.test(text)) return "Thai Pads & Kick Pads";
  if (/\bpunch(ing)? mitts?\b/.test(text) || /\bfocus mitts?\b/.test(text) || /\bpro mitts?\b/.test(text)) return "Focus Mitts";
  if (/\bboxing (sticks?|paddles?|pads?)\b/.test(text) || /\bstriking (sticks?|paddles?)\b/.test(text)) return "Striking Tools";
  if (/\b(speed bags?|double end bags?|maize bags?|maize balls?|punch balls?)\b/.test(text)) return "Speed & Double-End Bags";
  if (/\b(heavy bags?|punching bags?|banana bags?|training bags?)\b/.test(text)) return "Heavy Bags";
  if (/\bskipping ropes?\b/.test(text) || /\bjump ropes?\b/.test(text)) return "Jump Ropes";
  if (/\bboxing oil\b/.test(text) || /\bliniment\b/.test(text)) return "Boxing Oil & Care";
  if (/\bcorner supplies?\b/.test(text) || /\bcorner stools?\b/.test(text)) return "Coach & Corner Gear";
  if (/\bboxing kits?\b/.test(text) || /\bmma kits?\b/.test(text)) return "Boxing Kits";

  if (/\bbag gloves?\b/.test(text) || /\bbag mitts?\b/.test(text)) return "Bag Gloves";
  if (/\bgrappling gloves?\b/.test(text) || /\bmma gloves?\b/.test(text)) return "MMA & Grappling Gloves";
  if (/\bkids? boxing gloves?\b/.test(text) || /\byouth boxing gloves?\b/.test(text)) return "Kids Boxing Gloves";
  if (/\b(lace[- ]?up|competition|fight) gloves?\b/.test(text)) return "Lace-Up & Fight Gloves";
  if (/\b(rfbgv|rbgv|rbgl|bgv)[- ]?[a-z0-9]*/.test(text)) return "Training Gloves";
  if (/\b(sparring|training|boxing|muay thai) gloves?\b/.test(text) || /\bgloves?\b/.test(text)) return "Training Gloves";

  if (/\brash ?guards?\b/.test(text)) return "Rash Guards";
  if (/\bcompression pants?\b/.test(text)) return "Compression Fightwear";

  return "Training Gear";
}

function deriveCategoryLabel(productType) {
  switch (productType) {
    default:
      return productType || "Training Gear";
  }
}

function extractOptionGroups(productRow, variants) {
  const parsedOptions = parseJson(productRow.options, []);
  const optionNameByIndex = new Map();
  if (Array.isArray(parsedOptions)) {
    parsedOptions.forEach((entry, index) => {
      const name = stripHtml(entry && entry.name ? entry.name : "").trim();
      if (name) optionNameByIndex.set(index + 1, name);
    });
  }

  const sizeValues = [];
  const colorValues = [];
  const otherValues = [];

  for (const variant of variants) {
    const optionTriples = [
      [1, variant.option1],
      [2, variant.option2],
      [3, variant.option3],
    ];

    for (const [position, rawValue] of optionTriples) {
      const value = stripHtml(rawValue).trim();
      if (!value) continue;
      const name = optionNameByIndex.get(position) || "";
      const target = SIZE_NAME_RE.test(name)
        ? sizeValues
        : COLOR_NAME_RE.test(name)
          ? colorValues
          : /\b(size|fit|height|weight|oz|kg|lb|lbs|youth|adult|xs|s|m|l|xl|xxl|xxxl)\b/i.test(value)
            ? sizeValues
            : /\b(black|white|blue|red|green|pink|yellow|orange|purple|grey|gray|navy|gold|silver|brown|burgundy|olive|teal|khaki|beige|charcoal|maroon|mint|clear)\b/i.test(value)
              ? colorValues
              : otherValues;
      target.push(value);
    }
  }

  return {
    sizes: dedupeSorted(sizeValues),
    colors: dedupeSorted(colorValues),
    other_options: dedupeSorted(otherValues),
  };
}

function hasOzSize(values, ounces) {
  const pattern = new RegExp(`\\b${ounces}\\s*[- ]?oz\\.?\\b`, "i");
  return values.some((value) => pattern.test(value));
}

function inferOzLabel(values, ounces) {
  const sample = values.find((value) => /\b\d+\s*[- ]?oz\.?\b/i.test(value)) || "";
  if (/\d+-oz/i.test(sample)) return `${ounces}-oz`;
  if (/\d+\s+oz\./i.test(sample)) return `${ounces} oz.`;
  if (/\d+\s+oz/i.test(sample)) return `${ounces} oz`;
  return `${ounces}oz`;
}

function sortSizeValues(values) {
  const rank = new Map([
    ["xxs", 1],
    ["xs", 2],
    ["s", 3],
    ["m", 4],
    ["l", 5],
    ["xl", 6],
    ["xxl", 7],
    ["xxxl", 8],
  ]);
  return [...values].sort((a, b) => {
    const aOz = String(a).match(/\b(\d+)\s*[- ]?oz\.?\b/i);
    const bOz = String(b).match(/\b(\d+)\s*[- ]?oz\.?\b/i);
    if (aOz && bOz) return Number(aOz[1]) - Number(bOz[1]);
    if (aOz) return -1;
    if (bOz) return 1;
    const aRank = rank.get(cleanText(a));
    const bRank = rank.get(cleanText(b));
    if (aRank && bRank) return aRank - bRank;
    if (aRank) return -1;
    if (bRank) return 1;
    return String(a).localeCompare(String(b), undefined, { sensitivity: "base" });
  });
}

function normalizeWholesaleSizes(productRow, productType, sizes) {
  const nextSizes = dedupeSorted(sizes);
  const titleOzSizes = [
    ...new Set(
      (String(productRow.name || "").match(/\b\d+\s*[- ]?oz\.?\b/gi) || []).map((value) =>
        value.replace(/\s*-\s*/g, "-").replace(/\s+/g, "").replace(/\.$/, "")
      )
    ),
  ];
  const text = [
    productRow.brand,
    productRow.brand_slug,
    productRow.name,
    productRow.category,
    productRow.category_label,
    productRow.product_type,
    productType,
  ]
    .map((value) => cleanText(value))
    .join(" ");
  const brand = cleanText(productRow.brand || productRow.brand_slug);
  const isChildGlove = /\b(kids?|children|youth)\b/i.test(text);

  if (isChildGlove && titleOzSizes.length) {
    return sortSizeValues(titleOzSizes);
  }

  const isThaiAdultGlove =
    THAI_FIGHT_BRANDS.has(brand) &&
    /\b(training gloves|lace-up & fight gloves|bag gloves)\b/i.test(productType || "") &&
    !/\b(kids?|children|youth|mini|key ring|keychain|hanging mirror)\b/i.test(text);

  if (!isThaiAdultGlove) return sortSizeValues(nextSizes);

  if (brand === "twins_special" && !nextSizes.length) {
    return ["8oz", "10oz", "12oz", "14oz", "16oz"];
  }

  const hasStandardRun = [8, 10, 12, 14].every((ounces) => hasOzSize(nextSizes, ounces));
  if (hasStandardRun && !hasOzSize(nextSizes, 16)) {
    nextSizes.push(inferOzLabel(nextSizes, 16));
  }

  return sortSizeValues(dedupeSorted(nextSizes));
}

function buildSearchText(productRow, extraValues = []) {
  return [
    productRow.brand,
    productRow.name,
    productRow.category,
    productRow.tags,
    productRow.store_department,
    productRow.store_collection,
    ...extraValues,
  ]
    .map((value) => cleanText(value))
    .filter(Boolean)
    .join(" ");
}

function buildProductTypeText(productRow, variants = []) {
  const variantText = variants.map((variant) => [variant.title, variant.sku].join(" "));
  return [
    productRow.brand,
    productRow.name,
    productRow.category,
    productRow.category_normalized,
    productRow.url,
    ...variantText,
  ]
    .map((value) => cleanText(value))
    .filter(Boolean)
    .join(" ");
}

function scoreWholesaleProduct(productRow, images = [], variants = []) {
  const variantText = variants.map((variant) => [variant.title, variant.option1, variant.option2, variant.option3].join(" "));
  const hardExclusionText = [
    productRow.brand,
    productRow.name,
    productRow.category,
    productRow.store_department,
    productRow.store_collection,
    productRow.category_normalized,
    ...variantText,
  ]
    .map((value) => cleanText(value))
    .filter(Boolean)
    .join(" ");
  const summaryText = buildSearchText(
    productRow,
    variantText
  );
  const text = buildSearchText(productRow, [
    productRow.description_html,
    ...variantText,
  ]);
  const brand = cleanText(productRow.brand);

  if (BANNED_WHOLESALE_BRANDS.has(brand)) {
    return {
      score: -999,
      reasons: ["banned_brand"],
      text,
    };
  }

  const hasApprovedBrand = APPROVED_WHOLESALE_BRANDS.has(brand);
  if (!hasApprovedBrand) {
    return {
      score: -999,
      reasons: ["unapproved_brand"],
      text,
    };
  }

  if (NEGATIVE_PATTERNS.some((pattern) => pattern.test(hardExclusionText))) {
    return {
      score: -999,
      reasons: ["hard_exclusion"],
      text,
    };
  }

  const hasThaiBrand = THAI_FIGHT_BRANDS.has(brand);
  const hasThaiGenericFightType =
    hasThaiBrand && /\b(shorts?|fancy|fightwear|training gear|home)\b/i.test(summaryText);
  const hasAllowedProductType = WHOLESALE_ALLOWED_PRODUCT_PATTERNS.some((pattern) => pattern.test(text)) || hasThaiGenericFightType;
  const hasFightCollection = String(productRow.store_collection || "").toLowerCase() === "fight_gear";
  const hasFightKeyword = POSITIVE_PATTERNS.some((pattern) => pattern.test(text));

  if (!hasAllowedProductType) {
    return {
      score: -999,
      reasons: ["unsupported_product_type"],
      text,
    };
  }

  let score = 0;
  const reasons = [];

  if (hasThaiBrand) {
    score += 6;
    reasons.push("thai_brand");
  }

  if (GLOBAL_FIGHT_BRANDS.has(brand)) {
    score += 4;
    reasons.push("fight_brand");
  }

  if (hasApprovedBrand && hasAllowedProductType) {
    score += 5;
    reasons.push("approved_brand_product_type");
  }

  if (!hasApprovedBrand && hasFightCollection && hasFightKeyword && hasAllowedProductType) {
    score += 3;
    reasons.push("fight_collection_product_type");
  }

  if (hasFightKeyword) {
    score += 4;
    reasons.push("fight_keyword");
  }

  if (hasFightCollection) {
    score += 2;
    reasons.push("fight_collection");
  }

  if (String(productRow.store_department || "").toLowerCase() === "sports_gear") {
    score += 1;
  }

  if (NEGATIVE_PATTERNS.some((pattern) => pattern.test(text))) {
    score -= 6;
    reasons.push("negative_keyword");
  }

  if (!images.length) {
    score -= 5;
    reasons.push("missing_image");
  }

  if (!Number(productRow.available)) {
    score -= 2;
    reasons.push("unavailable");
  }

  return { score, reasons, text };
}

function buildWholesaleProductRecord(productRow, variants = [], images = []) {
  const firstImage = images[0] || {};
  const text = buildProductTypeText(productRow, variants);
  const productType = deriveProductType(text);
  const optionGroups = extractOptionGroups(productRow, variants);
  optionGroups.sizes = normalizeWholesaleSizes(productRow, productType, optionGroups.sizes);
  const availability = Number(productRow.available) ? "Available" : "Out of stock";

  return {
    id: String(productRow.product_id || ""),
    brand_slug: String(productRow.brand || "").trim(),
    brand: String(productRow.brand_label || humanizeSlug(productRow.brand) || "").trim(),
    name: String(productRow.name || "").trim(),
    url: String(productRow.url || "").trim() || null,
    image_url: String(productRow.image_url || firstImage.url || "").trim() || null,
    image_width: Number(productRow.image_width || firstImage.width || 0) || null,
    image_height: Number(productRow.image_height || firstImage.height || 0) || null,
    category_slug: String(productRow.category_normalized || productRow.store_collection || "").trim() || null,
    category_label: deriveCategoryLabel(productType),
    product_type: productType,
    brand_origin: getBrandOrigin(productRow.brand),
    catalog_visibility: "wholesale",
    quote_enabled: true,
    available: Boolean(productRow.available),
    availability_status: availability,
    retail_price_cents: toPriceCents(productRow.price, productRow.currency),
    sizes: optionGroups.sizes,
    colors: optionGroups.colors,
    other_options: optionGroups.other_options,
    variant_count: Array.isArray(variants) ? variants.length : 0,
  };
}

function normalizeWholesaleCatalogProduct(product) {
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
    category_label: String(product.category_label || "").trim() || "Training gear",
    product_type: String(product.product_type || "").trim() || "Training Gear",
    brand_origin: String(product.brand_origin || "Unknown").trim(),
    catalog_visibility: String(product.catalog_visibility || "wholesale").trim(),
    quote_enabled: product.quote_enabled !== false,
    available: Boolean(product.available),
    availability_status: String(product.availability_status || (product.available ? "Available" : "Out of stock")).trim(),
    retail_price_cents:
      Number.isInteger(product.retail_price_cents) && product.retail_price_cents > 0
        ? product.retail_price_cents
        : null,
    wholesale_price_cents: wholesalePriceCents(product.retail_price_cents),
    wholesale_discount_bps: WHOLESALE_DISCOUNT_BPS,
    sizes: Array.isArray(product.sizes) ? normalizeTextList(product.sizes) : [],
    colors: Array.isArray(product.colors) ? normalizeTextList(product.colors) : [],
    other_options: Array.isArray(product.other_options) ? normalizeTextList(product.other_options) : [],
    variant_count: Number(product.variant_count || 0) || 0,
  };
}

function loadWholesaleCatalogManifest() {
  if (!fs.existsSync(WHOLESALE_CATALOG_PATH)) {
    return { generated_at: null, products: [] };
  }

  const manifest = JSON.parse(fs.readFileSync(WHOLESALE_CATALOG_PATH, "utf8"));
  const products = Array.isArray(manifest.products) ? manifest.products.map(normalizeWholesaleCatalogProduct) : [];
  return {
    generated_at: manifest.generated_at || null,
    source_db: manifest.source_db || null,
    products,
  };
}

function buildSearchCorpus(product) {
  return [
    product.id,
    product.brand_slug,
    product.brand,
    product.name,
    product.category_label,
    product.category_slug,
    product.product_type,
    product.brand_origin,
    ...(Array.isArray(product.sizes) ? product.sizes : []),
    ...(Array.isArray(product.colors) ? product.colors : []),
    ...(Array.isArray(product.other_options) ? product.other_options : []),
  ]
    .map((value) => cleanText(value))
    .filter(Boolean)
    .join(" ");
}

function matchesWholesaleFilters(product, filters = {}) {
  const brand = String(filters.brand || "").trim().toLowerCase();
  if (brand && product.brand_slug.toLowerCase() !== brand) {
    return false;
  }

  const category = String(filters.category || "").trim().toLowerCase();
  if (category) {
    const categoryCandidates = new Set([
      product.category_slug,
      product.category_label,
      product.product_type,
    ].map((value) => String(value || "").toLowerCase()).filter(Boolean));
    if (![...categoryCandidates].some((candidate) => candidate === category || candidate.includes(category))) {
      return false;
    }
  }

  const availability = String(filters.availability || "").trim().toLowerCase();
  if (availability === "available" && !product.available) return false;
  if (availability === "unavailable" && product.available) return false;

  const size = String(filters.size || "").trim().toLowerCase();
  if (size && !product.sizes.some((value) => value.toLowerCase() === size || value.toLowerCase().includes(size))) {
    return false;
  }

  const color = String(filters.color || "").trim().toLowerCase();
  if (color && !product.colors.some((value) => value.toLowerCase() === color || value.toLowerCase().includes(color))) {
    return false;
  }

  const search = String(filters.search || "").trim().toLowerCase();
  if (search) {
    const corpus = buildSearchCorpus(product);
    if (!corpus.includes(search)) {
      return false;
    }
  }

  return true;
}

function paginateWholesaleProducts(products, page, pageSize) {
  const safePage = Number.isInteger(page) && page > 0 ? page : 1;
  const safePageSize = Number.isInteger(pageSize) && pageSize > 0 ? pageSize : 24;
  const start = (safePage - 1) * safePageSize;
  return {
    page: safePage,
    pageSize: safePageSize,
    total: products.length,
    products: products.slice(start, start + safePageSize),
  };
}

function collectWholesaleFacets(products) {
  const brands = new Map();
  const categories = new Map();
  const sizes = new Set();
  const colors = new Set();

  for (const product of products) {
    if (product.brand_slug) brands.set(product.brand_slug, product.brand);
    if (product.category_label) categories.set(product.category_label, product.category_label);
    for (const value of product.sizes || []) sizes.add(value);
    for (const value of product.colors || []) colors.add(value);
  }

  return {
    brands: [...brands.entries()]
      .map(([slug, name]) => ({ slug, name }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    categories: [...categories.values()].sort((a, b) => a.localeCompare(b)),
    sizes: [...sizes.values()].sort((a, b) => a.localeCompare(b)),
    colors: [...colors.values()].sort((a, b) => a.localeCompare(b)),
  };
}

function sanitizeQuoteItem(rawItem, catalogProduct) {
  const quantity = Number.parseInt(rawItem && rawItem.quantity, 10);
  const safeQuantity = Number.isInteger(quantity) && quantity > 0 ? Math.min(quantity, 999) : 1;
  const selectedOptions = rawItem && typeof rawItem.selected_options === "object" && !Array.isArray(rawItem.selected_options)
    ? Object.fromEntries(
        Object.entries(rawItem.selected_options)
          .map(([key, value]) => [stripHtml(key).trim(), stripHtml(value).trim()])
          .filter(([key, value]) => key && value)
      )
    : {};

  const retailPriceCents =
    Number.isInteger(catalogProduct.retail_price_cents) && catalogProduct.retail_price_cents > 0
      ? catalogProduct.retail_price_cents
      : null;
  const discountBps =
    Number.isInteger(catalogProduct.wholesale_discount_bps) && catalogProduct.wholesale_discount_bps > 0
      ? catalogProduct.wholesale_discount_bps
      : WHOLESALE_DISCOUNT_BPS;
  const wholesaleCents = retailPriceCents
    ? Number.isInteger(catalogProduct.wholesale_price_cents) && catalogProduct.wholesale_price_cents > 0
      ? catalogProduct.wholesale_price_cents
      : Math.max(1, Math.round((retailPriceCents * (10000 - discountBps)) / 10000))
    : null;

  return {
    product_id: catalogProduct.id,
    brand: catalogProduct.brand,
    name: catalogProduct.name,
    category_label: catalogProduct.category_label,
    product_type: catalogProduct.product_type,
    image_url: catalogProduct.image_url,
    url: catalogProduct.url,
    selected_options: selectedOptions,
    quantity: safeQuantity,
    availability_status: catalogProduct.availability_status,
    unit_price_cents: retailPriceCents,
    retail_price_cents: retailPriceCents,
    wholesale_price_cents: wholesaleCents,
    wholesale_discount_bps: discountBps,
  };
}

function normalizeQuoteRequestBody(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new Error("Invalid request payload.");
  }

  const name = stripHtml(body.name).trim();
  const companyName = stripHtml(body.company_name).trim();
  const email = stripHtml(body.email).trim().toLowerCase();
  const whatsapp = stripHtml(body.whatsapp).trim();
  const country = stripHtml(body.country).trim();
  const notes = stripHtml(body.notes).trim();
  const items = Array.isArray(body.items) ? body.items : [];

  if (!name) throw Object.assign(new Error("Enter your name."), { statusCode: 400, code: "missing_name" });
  if (!companyName) throw Object.assign(new Error("Enter your company name."), { statusCode: 400, code: "missing_company_name" });
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw Object.assign(new Error("Enter a valid email address."), { statusCode: 400, code: "invalid_email" });
  }
  if (!whatsapp) throw Object.assign(new Error("Enter a WhatsApp number."), { statusCode: 400, code: "missing_whatsapp" });
  if (!country) throw Object.assign(new Error("Enter your country."), { statusCode: 400, code: "missing_country" });
  if (!items.length) throw Object.assign(new Error("Add at least one product to your quote request."), { statusCode: 400, code: "empty_items" });

  return {
    name,
    company_name: companyName,
    email,
    whatsapp,
    country,
    notes: notes || null,
    items,
  };
}

module.exports = {
  THAI_FIGHT_BRANDS,
  APPROVED_WHOLESALE_BRANDS,
  BANNED_WHOLESALE_BRANDS,
  GLOBAL_FIGHT_BRANDS,
  POSITIVE_PATTERNS,
  NEGATIVE_PATTERNS,
  WHOLESALE_CATALOG_PATH,
  WHOLESALE_DISCOUNT_BPS,
  buildWholesaleProductRecord,
  buildSearchCorpus,
  collectWholesaleFacets,
  deriveCategoryLabel,
  deriveProductType,
  extractOptionGroups,
  loadWholesaleCatalogManifest,
  matchesWholesaleFilters,
  normalizeWholesaleCatalogProduct,
  normalizeQuoteRequestBody,
  normalizeWholesaleSizes,
  paginateWholesaleProducts,
  sanitizeQuoteItem,
  scoreWholesaleProduct,
  humanizeSlug,
  stripHtml,
  cleanText,
  toPriceCents,
  wholesalePriceCents,
};
