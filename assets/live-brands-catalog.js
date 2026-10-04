(function () {
  if (!document.body || !document.body.hasAttribute('data-live-brands')) return;
  var sections = document.querySelector('.listing-sections');
  if (!sections) return;
  var input = document.querySelector('[data-listing-filter]');
  var clear = document.querySelector('[data-listing-clear]');
  var count = document.querySelector('[data-listing-count]');
  var empty = document.querySelector('[data-listing-empty]');
  var products = [];
  var preferred = ['Twins Special', 'Top King', 'Boon', 'Fairtex', 'Raja Boxing', 'Primo', 'Windy', 'Optimum Nutrition', 'MuscleTech', 'Ghost Nutrition', 'Nike', 'Manta Sleep', 'Schiek', 'Shock Doctor'];

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }
  function text(product) {
    return [product.name, product.title, product.brand, product.section_id, product.section_title, product.id, product.sku].filter(Boolean).join(' ').toLowerCase();
  }
  function slug(value) { return String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''); }
  function url(product) { return product.url ? '..' + product.url : '../product/' + encodeURIComponent(product.id) + '.html'; }
  function card(product) {
    var href = url(product);
    var variants = Array.isArray(product.variants) ? product.variants.length : 0;
    return '<article class="product-card" data-product-id="' + escapeHtml(product.id) + '" data-search="' + escapeHtml(text(product)) + '">' +
      '<a class="product-image" href="' + escapeHtml(href) + '"><img src="' + escapeHtml(product.image || product.image_url || '../assets/logo.png') + '" alt="' + escapeHtml(product.name) + '" loading="lazy" decoding="async" /></a>' +
      '<div class="product-body"><span>' + escapeHtml(product.brand) + '</span><h3><a class="product-card-link" href="' + escapeHtml(href) + '">' + escapeHtml(product.name) + '</a></h3>' +
      '<p>' + escapeHtml(product.section_title || 'Training gear') + '</p><div class="product-price-line"><strong>$' + (Number(product.price_cents || 0) / 100).toFixed(2) + '</strong></div>' +
      '<a class="add-cart-button product-options-button" href="' + escapeHtml(href) + '">' + (variants > 1 ? 'View options' : 'View product') + '</a></div></article>';
  }
  function render() {
    var query = (input && input.value || '').trim().toLowerCase();
    var filtered = query ? products.filter(function (product) { return text(product).indexOf(query) !== -1; }) : products;
    var groups = new Map();
    filtered.forEach(function (product) { var rows = groups.get(product.brand) || []; rows.push(product); groups.set(product.brand, rows); });
    var brands = Array.from(groups.keys()).sort(function (a, b) { var ai = preferred.indexOf(a), bi = preferred.indexOf(b); return (ai < 0 ? 999 : ai) - (bi < 0 ? 999 : bi) || a.localeCompare(b); });
    sections.innerHTML = brands.map(function (brand) {
      return '<section class="market-section listing-section" id="brand-' + slug(brand) + '"><div class="section-title"><div><h2>' + escapeHtml(brand) + '</h2></div></div><div class="product-row">' + groups.get(brand).map(card).join('') + '</div></section>';
    }).join('');
    if (count) count.textContent = filtered.length + ' product' + (filtered.length === 1 ? '' : 's') + (query ? ' found' : ' in this collection');
    if (empty) empty.hidden = filtered.length !== 0;
  }
  fetch('../data/final/catalog.published.json', { cache: 'no-store' }).then(function (response) { return response.json(); }).then(function (payload) {
    var all = Array.isArray(payload) ? payload : (payload.products || []); var seen = new Set();
    products = all.filter(function (product) { var id = String(product.id || ''); if (!id || seen.has(id)) return false; seen.add(id); return true; });
    render();
  }).catch(function () { if (count) count.textContent = 'Could not load products.'; });
  if (input) input.addEventListener('input', render);
  if (clear) clear.addEventListener('click', function () { input.value = ''; render(); input.focus(); });
})();
