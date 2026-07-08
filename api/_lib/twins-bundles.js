"use strict";

// Twins Special automatic bundle pricing.
// Not advertised anywhere — the system silently recognizes qualifying
// combinations in an order and applies the fixed bundle price.
//
// Bundle A (4 items, $389): BGVL3 gloves ($95 tier) + solid-color headgear (HGL3, $140)
//                           + Gym Bag BAG5 ($110) + solid leather shin guards ($110)
//   Component sum $455 → discount $66 per bundle.
// Bundle B (3 items, $289): BGVL3 gloves + solid-color headgear + solid leather shin guards
//   Component sum $345 → discount $56 per bundle.
//
// Applies to international retail pricing only (full retail per-unit prices).

const BUNDLE4_PRICE_CENTS = 38900;
const BUNDLE3_PRICE_CENTS = 28900;
const BUNDLE4_COMPONENTS_CENTS = 9500 + 14000 + 11000 + 11000; // 45500
const BUNDLE3_COMPONENTS_CENTS = 9500 + 14000 + 11000; // 34500
const BUNDLE4_DISCOUNT_CENTS = BUNDLE4_COMPONENTS_CENTS - BUNDLE4_PRICE_CENTS; // 6600
const BUNDLE3_DISCOUNT_CENTS = BUNDLE3_COMPONENTS_CENTS - BUNDLE3_PRICE_CENTS; // 5600

function unitPriceCents(item) {
  const value = Number(item && (item.retail_price_cents || item.unit_price_cents));
  return Number.isInteger(value) && value > 0 ? value : null;
}

function itemText(item) {
  return `${item && item.product_id ? item.product_id : ""} ${item && item.name ? item.name : ""}`.toLowerCase();
}

function isTwinsBrand(item) {
  return /twins/i.test(String((item && item.brand) || ""));
}

function isStandardBgvl3Gloves(item) {
  if (!isTwinsBrand(item)) return false;
  if (unitPriceCents(item) !== 9500) return false;
  const text = itemText(item);
  if (!/bgvl.?3|boxing gloves/.test(text)) return false;
  if (!/bgvl.?3/.test(text)) return false;
  if (/fancy|fbgvl|pattern|dual/.test(text)) return false;
  return true;
}

function isSolidHeadgear(item) {
  if (!isTwinsBrand(item)) return false;
  if (unitPriceCents(item) !== 14000) return false;
  const text = itemText(item);
  if (!/head\s?gear|headguard|hgl/.test(text)) return false;
  if (/fancy|fhgl|pattern|comic|dual/.test(text)) return false;
  return true;
}

function isBag5(item) {
  if (!isTwinsBrand(item)) return false;
  if (unitPriceCents(item) !== 11000) return false;
  return /bag\s?5|bag5/.test(itemText(item));
}

function isSolidShinGuards(item) {
  if (!isTwinsBrand(item)) return false;
  if (unitPriceCents(item) !== 11000) return false;
  const text = itemText(item);
  if (!/shin\s?guard|sgl|sgs|sgn/.test(text)) return false;
  if (/fancy|pattern|grafiti|graffiti|demon|demo|comic/.test(text)) return false;
  if (/bag\s?5|bag5|bag\s?2|bag2/.test(text)) return false;
  return true;
}

function countUnits(items, predicate) {
  return items.reduce((sum, item) => {
    if (!predicate(item)) return sum;
    const quantity = Math.max(1, Number(item.quantity) || 1);
    return sum + quantity;
  }, 0);
}

/**
 * Detects qualifying Twins bundles in a sanitized item list.
 * Returns { discount_cents, bundles: { four_item, three_item } }.
 */
function detectTwinsBundles(items) {
  const list = Array.isArray(items) ? items : [];
  let gloves = countUnits(list, isStandardBgvl3Gloves);
  let headgear = countUnits(list, isSolidHeadgear);
  let bags = countUnits(list, isBag5);
  let shins = countUnits(list, isSolidShinGuards);

  const fourItem = Math.min(gloves, headgear, bags, shins);
  gloves -= fourItem;
  headgear -= fourItem;
  shins -= fourItem;

  const threeItem = Math.min(gloves, headgear, shins);

  const discount = fourItem * BUNDLE4_DISCOUNT_CENTS + threeItem * BUNDLE3_DISCOUNT_CENTS;
  return {
    discount_cents: discount,
    bundles: { four_item: fourItem, three_item: threeItem },
  };
}

module.exports = {
  detectTwinsBundles,
  BUNDLE4_PRICE_CENTS,
  BUNDLE3_PRICE_CENTS,
  BUNDLE4_DISCOUNT_CENTS,
  BUNDLE3_DISCOUNT_CENTS,
};
