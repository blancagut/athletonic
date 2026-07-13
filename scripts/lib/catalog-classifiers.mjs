const FIGHT_BRANDS = new Set([
  "boon",
  "fairtex",
  "primo",
  "raja_boxing",
  "thaismai",
  "topking",
  "twins_special",
  "windy",
  "yokkao",
]);

const GLOVE_BRANDS = new Set([
  ...FIGHT_BRANDS,
  "century_martial_arts",
  "fuji_sports",
  "sanabul",
  "venum",
]);

function value(product, ...keys) {
  for (const key of keys) {
    const candidate = product?.[key];
    if (candidate != null && String(candidate).trim()) return String(candidate).trim();
  }
  return "";
}

export function normalizedBrandSlug(product) {
  return value(product, "brand_slug", "brandSlug", "brand")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/^top_king$/, "topking")
    .replace(/^twins_special_?$/, "twins_special");
}

export function normalizedProductText(product) {
  return [
    value(product, "name", "displayName", "product_name", "title"),
    value(product, "category", "category_text", "category_label"),
    value(product, "product_type", "productType", "type"),
    value(product, "section_id", "sectionId"),
    value(product, "store_collection"),
    value(product, "search"),
    value(product, "url"),
    value(product, "external_url"),
  ]
    .join(" ")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function isCatalogEligible(product) {
  if (!product || product.available === false || product.purchasable === false || product.ready_for_sale === false) {
    return false;
  }
  if (["draft", "rejected", "archived", "unpublished"].includes(String(product.publish_status || "").toLowerCase())) {
    return false;
  }
  const cents = Number(product.price_cents || 0);
  const price = Number(product.price || product.price_usd || 0);
  return (cents > 0 || price > 0) && Boolean(value(product, "image", "image_url"));
}

function has(text, pattern) {
  return pattern.test(text);
}

export function isBoxingGlove(product) {
  if (!isCatalogEligible(product) || !GLOVE_BRANDS.has(normalizedBrandSlug(product))) return false;
  const text = normalizedProductText(product);
  return has(text, /\b(boxing|muay thai|training|sparring|bag|lace up|velcro)? ?gloves?\b|\bbgv[a-z0-9-]*\b/) &&
    !has(text, /\b(baseball|football|golf|goalkeeper|oven|winter|work|insert|key ?chain|keyring|mini|mirror|ornament|deodorizer|mitts?)\b/);
}

export function isAuthenticFightShorts(product) {
  if (!isCatalogEligible(product) || !FIGHT_BRANDS.has(normalizedBrandSlug(product))) return false;
  const text = normalizedProductText(product);
  const compatibleSection = has(text, /\b(apparel|clothing|muay thai shorts|boxing shorts|fight shorts|thai boxing shorts)\b/);
  const compatibleName = has(text, /\b(muay thai|thai boxing|boxing|fight)? ?shorts\b/);
  const incompatible = has(text, /\b(skirt|skort|shirt|t shirt|tee|tank|hoodie|jacket|pants|trousers|jogger|legging|tracksuit|robe|gloves?|shin|guard|pads?|mitts?|key ?chain|keyring|mini|mirror|ornament|accessor)\b/);
  return compatibleSection && compatibleName && !incompatible;
}

export function isShinGuard(product) {
  if (!isCatalogEligible(product)) return false;
  const text = normalizedProductText(product);
  return has(text, /\b(shin ?guards?|shin ?pads?|shinguards?)\b/) &&
    !has(text, /\b(key ?chain|keyring|mini|mirror|ornament|sock|sleeve)\b/);
}

export function isThaiPad(product) {
  if (!isCatalogEligible(product)) return false;
  const text = normalizedProductText(product);
  return has(text, /\b(thai pads?|kick pads?|kicking pads?|muay thai pads?|pao)\b/) &&
    !has(text, /\b(belly pads?|body protectors?|kick shields?|mouse|knee|elbow|shoulder|replacement|mini|keyring)\b/);
}

export function isFocusMitt(product) {
  if (!isCatalogEligible(product)) return false;
  const text = normalizedProductText(product);
  return has(text, /\b(focus mitts?|punch mitts?|boxing mitts?)\b/) &&
    !has(text, /\b(key ?chain|keyring|mini|mirror|ornament)\b/);
}

export function isHeavyBag(product) {
  if (!isCatalogEligible(product)) return false;
  const text = normalizedProductText(product);
  return has(text, /\b(heavy bags?|punching bags?|banana bags?|uppercut bags?|muay thai bags?|pole bags?)\b/) &&
    !has(text, /\b(rear view mirror|key ?chain|keyring|mini|ornament|gloves?|stand|hanger|replacement)\b/);
}

export function isFightClothing(product) {
  if (!isCatalogEligible(product) || !FIGHT_BRANDS.has(normalizedBrandSlug(product))) return false;
  const text = normalizedProductText(product);
  return has(text, /\b(apparel|clothing|shorts|shirt|t shirt|tee|tank|hoodie|jacket|pants|trousers|jogger|legging|tracksuit|robe|rashguard|compression)\b/) &&
    !has(text, /\b(gloves?|shin ?guards?|headgear|pads?|mitts?|heavy bag|key ?chain|keyring|mini|mirror|ornament)\b/);
}

export function isNikeApparel(product) {
  if (!isCatalogEligible(product) || normalizedBrandSlug(product) !== "nike") return false;
  const section = value(product, "section_id", "sectionId").toLowerCase();
  const text = normalizedProductText(product);
  const apparel = has(text, /\b(apparel|shirt|t shirt|tee|tank|shorts|hoodie|sweatshirt|jacket|pants|trousers|jogger|leggings?|tights|bra|top|jersey|polo|tracksuit|pullover|parka|windbreaker|dress|skirt|vest)\b/);
  const footwearOrNonApparel = has(text, /\b(shoes?|sneakers?|boots?|cleats?|slides?|sandals?|loafers?|metcon|romaleos|pegasus|vomero|dunk|air max|jordan|poster|sock|bag|backpack|hat|cap|gloves?)\b/);
  return section === "apparel" && apparel && !footwearOrNonApparel;
}
