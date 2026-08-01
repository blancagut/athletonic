(function () {
  var id = document.body && document.body.dataset.liveCatalogId;
  if (!id) return;
  fetch('../data/final/catalog.published.json', { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (data) {
    var product = (data.products || []).find(function (item) { return item.id === id; });
    if (!product || !product.compare_at_price_cents) return;
    var money = function (cents) { return '$' + (Number(cents) / 100).toFixed(2); };
    function applyOffer() {
      var row = document.querySelector('[data-pdp-price-row]');
      if (row) { row.dataset.basePriceCents = product.price_cents; row.dataset.baseCompareCents = product.compare_at_price_cents; }
      var price = document.querySelector('[data-pdp-price]'); if (price) price.textContent = money(product.price_cents);
      var compare = document.querySelector('[data-pdp-compare]'); if (compare) { compare.hidden = false; compare.textContent = money(product.compare_at_price_cents); }
      var discount = document.querySelector('[data-pdp-discount]'); if (discount) { discount.hidden = false; discount.textContent = product.deal && product.deal.reason || 'Offer'; }
      document.querySelectorAll('[data-cart-price]').forEach(function (button) { button.dataset.cartPrice = (product.price_cents / 100).toFixed(2); });
    }
    applyOffer();
    // Product pages update their static variant price on change. Reapply the
    // approved catalog offer afterward so every selected Fancy size keeps the
    // same visible sale and compare-at price.
    document.querySelectorAll('[data-pdp-variant]').forEach(function (select) {
      select.addEventListener('change', function () { window.setTimeout(applyOffer, 0); });
    });
  });
})();
