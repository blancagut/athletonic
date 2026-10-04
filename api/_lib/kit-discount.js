const KIT_DISCOUNT_BPS = 1000;
const MIN_KIT_PIECES = 3;

function normalizedKitId(value) {
  const id = String(value || "").trim();
  return /^kl_[a-z0-9_-]{6,64}$/i.test(id) ? id : "";
}

function kitDiscountFromLines(cart, lineItems) {
  const groups = new Map();
  if (!Array.isArray(cart) || !Array.isArray(lineItems)) {
    return { discountCents: 0, qualifyingGroups: [], lineDiscounts: [] };
  }

  for (const line of lineItems) {
    const raw = cart[line?.input_index];
    const kitId = normalizedKitId(raw?.kit_id || raw?.kitId);
    if (!kitId || line?.valid !== true) continue;
    const productId = String(line.product_id || "");
    const variantId = String(line.variant_id || line.variant || "");
    if (!productId || !variantId) continue;
    if (!groups.has(kitId)) groups.set(kitId, new Map());
    const key = productId;
    const entries = groups.get(kitId);
    const previous = entries.get(key);
    entries.set(key, {
      product_id: productId,
      variant_id: line.variant_id || null,
      quantity: Number(line.quantity || 0) + Number(previous?.quantity || 0),
      subtotal_cents: Number(line.line_total_cents || 0) + Number(previous?.subtotal_cents || 0),
    });
  }

  const qualifyingGroups = [];
  const lineDiscounts = [];
  let discountCents = 0;
  for (const [kitId, entries] of groups) {
    if (entries.size < MIN_KIT_PIECES) continue;
    const subtotalCents = [...entries.values()].reduce((sum, line) => sum + line.subtotal_cents, 0);
    const groupDiscountCents = Math.round(subtotalCents * KIT_DISCOUNT_BPS / 10000);
    discountCents += groupDiscountCents;
    qualifyingGroups.push({ kit_id: kitId, pieces: entries.size, subtotal_cents: subtotalCents, discount_cents: groupDiscountCents });
    lineDiscounts.push(...entries.values());
  }

  return { discountCents, qualifyingGroups, lineDiscounts };
}

module.exports = { KIT_DISCOUNT_BPS, MIN_KIT_PIECES, kitDiscountFromLines, normalizedKitId };
