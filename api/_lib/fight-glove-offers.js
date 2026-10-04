const BGVL6_SALE_CENTS = 11900;
const BGVL6_REGULAR_CENTS = 14900;

function isTwinsBgvl6(product) {
  return String(product?.brand || "") === "Twins Special" &&
    /\bBGVL[ -]?6\b/i.test(String(product?.name || ""));
}

function applyFightGloveOffers(product) {
  if (!isTwinsBgvl6(product)) return product;
  return {
    ...product,
    price_cents: BGVL6_SALE_CENTS,
    price_min_cents: BGVL6_SALE_CENTS,
    price_max_cents: BGVL6_SALE_CENTS,
    compare_at_price_cents: BGVL6_REGULAR_CENTS,
    variants: (product.variants || []).map((variant) => ({
      ...variant,
      price_cents: BGVL6_SALE_CENTS,
      regular_price_cents: BGVL6_REGULAR_CENTS,
      compare_at_price_cents: BGVL6_REGULAR_CENTS,
    })),
  };
}

module.exports = {
  BGVL6_SALE_CENTS,
  BGVL6_REGULAR_CENTS,
  applyFightGloveOffers,
  isTwinsBgvl6,
};
