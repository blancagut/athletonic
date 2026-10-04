(function () {
  var page = document.body && document.body.dataset.liveCategory;
  var sections = document.querySelector('.listing-sections');
  if (!page || !sections) return;

  var input = document.querySelector('[data-listing-filter]');
  var clear = document.querySelector('[data-listing-clear]');
  var count = document.querySelector('[data-listing-count]');
  var empty = document.querySelector('[data-listing-empty]');
  var products = [];
  var activeBrand = 'all';
  var order = ['Twins Special', 'Top King', 'Boon', 'Raja Boxing', 'Fairtex', 'Primo', 'Windy'];

  document.body.classList.remove('live-category-ready');
  sections.innerHTML = '';

  if (page === 'boxing-gloves' && location.hash === '#fairtex-gloves') {
    history.replaceState(null, '', location.pathname + location.search);
  }
  if (page === 'gym-equipment' && location.hash) {
    history.replaceState(null, '', location.pathname + location.search);
  }
  if (page === 'shin-guards' && (location.hash === '#mma-shin-guards' || location.hash === '#muay-thai-shin-guards')) {
    history.replaceState(null, '', location.pathname + location.search);
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function text(product) {
    return [product.name, product.title, product.brand, product.section_id, product.section_title, product.id, product.sku]
      .filter(Boolean).join(' ').toLowerCase();
  }

  function productNameText(product) {
    return [product.name, product.title, product.id, product.sku].filter(Boolean).join(' ').toLowerCase();
  }

  function normalized(value) {
    return String(value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  function searchMatches(product, query) {
    var haystack = normalized(text(product));
    return normalized(query).split(/\s+/).filter(Boolean).every(function (term) {
      return haystack.indexOf(term) !== -1;
    });
  }

  function matches(product) {
    var value = text(product);
    if (page === 'boxing-gloves') return /glove|bag mitt/.test(productNameText(product)) && !/deodorizer|bundle/.test(productNameText(product));
    if (page === 'shin-guards') return /shin guard|shinpad|shin pad/.test(value) && !/bundle|glove/.test(value);
    if (page === 'muay-thai-shorts') return product.section_id === 'muay-thai-shorts' || /muay thai shorts|boxing shorts|retro shorts/.test(value);
    if (page === 'pads-punch-mitts') return product.section_id === 'pads-punch-mitts' || /thai pad|kick pad|kicking pad|focus mitt|micromitt|hybrid mitt|donut pad|belly pad|thigh pad|boxing paddle/.test(value);
    if (page === 'heavy-bags') return /heavy bag|punching bag|banana bag|water bag|wall bag|wall pad|training surface/.test(value);
    if (page === 'gym-equipment') return /heavy bag|punching bag|banana bag|water bag|wall bag|pole bag|tear drop bag|ground combat bag|upper.?cut|sandbag|weight rack|dumbbell|training mat|floor mat|wall pad|striking station/.test(productNameText(product));
    if (page === 'training-apparel') {
      return product.section_id === 'apparel' ||
        /training apparel|fight clothing|t-shirt|tee|sleeveless|jersey|hoodie|jacket|track suit|sauna suit|track pant|shorts/.test(value);
    }
    return false;
  }

  function productUrl(product) {
    return product.url ? '..' + product.url : '../product/' + encodeURIComponent(product.id) + '.html';
  }

  function image(product) {
    return product.image || product.image_url || '../assets/logo.png';
  }

  function money(product) {
    return '$' + (Number(product.price_cents || 0) / 100).toFixed(2);
  }

  function offerPrice(product) {
    var price = Number(product.price_cents || 0);
    var compare = Number(product.compare_at_price_cents || 0);
    return (compare > price
      ? '<s class="product-compare-price">$' + (compare / 100).toFixed(2) + '</s>'
      : '') +
      '<strong>' + money(product) + '</strong>' +
      (compare > price ? '<span class="deal-pct">Offer</span>' : '');
  }

  function sectionId(brand) {
    var ids = page === 'muay-thai-shorts' ? {
      'Twins Special': 'twins-shorts', 'Top King': 'top-king-shorts', 'Boon': 'boon-shorts',
      'Raja Boxing': 'raja-shorts', 'Fairtex': 'fairtex-shorts', 'Primo': 'primo-shorts'
    } : null;
    if (!ids) return '';
    return ids[brand] || String(brand || '').toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + page;
  }

  function typedSections(items) {
    var definitions = null;
    if (page === 'boxing-gloves') {
      definitions = [
        { id: 'boxing-gloves', title: 'Boxing Gloves', test: function (p) { return !/kid|child|children|mma|grappling|combat glove|bag glove|bag mitt|lace.?up/.test(productNameText(p)); } },
        { id: 'lace-up-gloves', title: 'Lace-Up Boxing Gloves', test: function (p) { return /lace.?up/.test(productNameText(p)) && !/kid|child|children/.test(productNameText(p)); } },
        { id: 'bag-gloves', title: 'Bag Gloves', test: function (p) { return /bag glove|bag mitt/.test(productNameText(p)); } },
        { id: 'mma-gloves', title: 'MMA & Grappling Gloves', test: function (p) { return /mma|grappling|combat glove/.test(productNameText(p)); } },
        { id: 'kids-gloves', title: 'Kids Boxing Gloves', test: function (p) { return /kid|child|children/.test(productNameText(p)); } }
      ];
    } else if (page === 'shin-guards') {
      definitions = [
        { id: 'training-shin-guards', title: 'Shin Guards for Training', test: function (p) { return !/competition/.test(productNameText(p)); } },
        { id: 'competition-shin-guards', title: 'Shin Guards for Competition', test: function (p) { return /competition/.test(productNameText(p)); } }
      ];
    } else if (page === 'pads-punch-mitts') {
      definitions = [
        { id: 'thai-kick-pads', title: 'Thai & Kick Pads', test: function (p) { return /thai pad|kick pad|kicking pad/.test(text(p)); } },
        { id: 'focus-mitts', title: 'Focus Mitts', test: function (p) { return /focus mitt|micromitt|hybrid mitt|classic pro mitt/.test(text(p)); } },
        { id: 'donut-pads', title: 'Donut Pads', test: function (p) { return /donut pad/.test(text(p)); } },
        { id: 'belly-pads', title: 'Belly Pads', test: function (p) { return /belly pad/.test(text(p)); } },
        { id: 'thigh-pads', title: 'Thigh Pads', test: function (p) { return /thigh pad/.test(text(p)); } },
        { id: 'boxing-paddles', title: 'Boxing Paddles', test: function (p) { return /boxing paddle/.test(text(p)); } }
      ];
    } else if (page === 'heavy-bags') {
      definitions = [
        { id: 'heavy-bags', title: 'Heavy & Punching Bags', test: function (p) { return !/wall pad|training surface/.test(text(p)); } },
        { id: 'wall-pads', title: 'Wall Pads & Training Surfaces', test: function (p) { return /wall pad|training surface/.test(text(p)); } }
      ];
    } else if (page === 'gym-equipment') {
      definitions = [
        { id: 'banana-bags', title: 'Banana Bags', test: function (p) { return /banana bag/.test(productNameText(p)); } },
        { id: 'tear-drop-bags', title: 'Tear Drop Bags', test: function (p) { return /tear drop/.test(productNameText(p)); } },
        { id: 'water-bags', title: 'Water Bags', test: function (p) { return /water heavy bag|water bag/.test(productNameText(p)); } },
        { id: 'pole-bags', title: 'Pole Bags', test: function (p) { return /pole bag/.test(productNameText(p)); } },
        { id: 'uppercut-bags', title: 'Uppercut Bags', test: function (p) { return /upper.?cut/.test(productNameText(p)); } },
        { id: 'ground-bags', title: 'Ground Bags', test: function (p) { return /ground combat bag/.test(productNameText(p)); } },
        { id: 'kids-bags', title: 'Kids Heavy Bags', test: function (p) { return /kid/.test(productNameText(p)); } },
        { id: 'heavy-bags', title: 'Heavy Bags', test: function () { return true; } }
      ];
    }
    if (!definitions) return null;
    var assigned = new Set();
    return definitions.map(function (definition) {
      var groupItems = items.filter(function (product) {
        if (assigned.has(product.id) || !definition.test(product)) return false;
        assigned.add(product.id);
        return true;
      });
      return { id: definition.id, title: definition.title, items: groupItems };
    }).filter(function (section) { return section.items.length; });
  }

  function renderCategoryMenu() {
    var finder = document.querySelector('.listing-finder');
    if (!finder) return;
    var menuLabel = page === 'muay-thai-shorts' ? 'Shop by brand' : 'Shop by category';
    finder.classList.add('listing-finder-single');
    var nav = document.querySelector('[data-collection-category-menu]') || document.querySelector('.listing-quick-links');
    if (!nav) nav = document.createElement('nav');
    nav.className = 'collection-category-menu';
    nav.setAttribute('data-collection-category-menu', '');
    nav.setAttribute('aria-label', menuLabel);
    var links = Array.from(sections.querySelectorAll('.listing-section[id]')).map(function (section) {
      var title = section.querySelector('h2');
      return title ? '<a href="#' + escapeHtml(section.id) + '">' + escapeHtml(title.textContent.trim()) + '</a>' : '';
    }).filter(Boolean).join('');
    nav.innerHTML = '<details class="brand-category-menu"><summary>' + menuLabel + '</summary><div class="brand-category-menu-panel">' + links + '</div></details>';
    finder.insertAdjacentElement('afterend', nav);
    if (!nav.dataset.menuBound) {
      nav.dataset.menuBound = 'true';
      nav.addEventListener('click', function (event) {
        if (!event.target.closest('a[href^="#"]')) return;
        var details = nav.querySelector('details');
        if (details) details.removeAttribute('open');
      });
    }
  }

  function applyShinBrandFilter() {
    if (page !== 'shin-guards') return;
    Array.from(sections.querySelectorAll('.listing-section')).forEach(function (section) {
      var visible = 0;
      Array.from(section.querySelectorAll('.product-card')).forEach(function (card) {
        var brand = (card.querySelector('.product-body > span') || {}).textContent || '';
        var show = activeBrand === 'all' || brand.trim() === activeBrand;
        card.hidden = !show;
        if (show) visible += 1;
      });
      section.hidden = visible === 0;
    });
  }

  function renderShinBrandMenu() {
    if (page !== 'shin-guards') return;
    var brands = Array.from(new Set(products.map(function (product) { return product.brand; }).filter(Boolean))).sort(function (a, b) {
      var ai = order.indexOf(a); var bi = order.indexOf(b);
      return (ai < 0 ? 999 : ai) - (bi < 0 ? 999 : bi) || a.localeCompare(b);
    });
    var nav = document.querySelector('[data-shin-brand-menu]');
    if (!nav) {
      nav = document.createElement('nav');
      nav.className = 'collection-brand-menu';
      nav.setAttribute('data-shin-brand-menu', '');
      nav.setAttribute('aria-label', 'Shop by brand');
      var categoryNav = document.querySelector('[data-collection-category-menu]');
      if (categoryNav) categoryNav.insertAdjacentElement('afterend', nav);
      nav.addEventListener('click', function (event) {
        var link = event.target.closest('[data-shin-brand]');
        if (!link) return;
        event.preventDefault();
        activeBrand = link.dataset.shinBrand;
        renderShinBrandMenu();
        applyShinBrandFilter();
      });
    }
    var links = [{ value: 'all', label: 'All Brands' }].concat(brands.map(function (brand) { return { value: brand, label: brand }; }));
    nav.innerHTML = '<span>Shop by brand</span>' + links.map(function (item) {
      return '<a href="#brand-' + escapeHtml(item.value.toLowerCase().replace(/[^a-z0-9]+/g, '-')) + '" data-shin-brand="' + escapeHtml(item.value) + '"' + (activeBrand === item.value ? ' class="is-active" aria-current="page"' : '') + '>' + escapeHtml(item.label) + '</a>';
    }).join('');
    applyShinBrandFilter();
  }

  function card(product) {
    var url = productUrl(product);
    var variantCount = Array.isArray(product.variants) ? product.variants.length : 0;
    return '<article class="product-card" data-product-id="' + escapeHtml(product.id) + '" data-search="' + escapeHtml(text(product)) + '">' +
      '<a class="product-image" href="' + escapeHtml(url) + '"><img src="' + escapeHtml(image(product)) + '" alt="' + escapeHtml(product.name) + '" loading="lazy" decoding="async" /></a>' +
      '<div class="product-body"><span>' + escapeHtml(product.brand) + '</span><h3><a class="product-card-link" href="' + escapeHtml(url) + '">' + escapeHtml(product.name) + '</a></h3>' +
      '<p>' + escapeHtml(product.section_title || 'Training gear') + '</p><div class="product-price-line">' + offerPrice(product) + '</div>' +
      '<a class="add-cart-button product-options-button" href="' + escapeHtml(url) + '">' + (variantCount > 1 ? 'View options' : 'View product') + '</a></div></article>';
  }

  function render() {
    var query = (input && input.value || '').trim().toLowerCase();
    var filtered = query ? products.filter(function (product) { return searchMatches(product, query); }) : products;
    var typed = typedSections(filtered);
    if (typed) {
      sections.innerHTML = typed.map(function (section) {
        return '<section class="market-section listing-section" id="' + escapeHtml(section.id) + '"><div class="section-title"><div><h2>' + escapeHtml(section.title) + '</h2></div></div><div class="product-row">' + section.items.map(card).join('') + '</div></section>';
      }).join('');
    } else {
      var byBrand = new Map();
      filtered.forEach(function (product) {
        var list = byBrand.get(product.brand) || [];
        list.push(product);
        byBrand.set(product.brand, list);
      });
      var brands = Array.from(byBrand.keys()).sort(function (a, b) {
        var ai = order.indexOf(a); var bi = order.indexOf(b);
        return (ai < 0 ? 999 : ai) - (bi < 0 ? 999 : bi) || a.localeCompare(b);
      });
      sections.innerHTML = brands.map(function (brand) {
        var items = byBrand.get(brand);
        var id = sectionId(brand);
        return '<section class="market-section listing-section"' + (id ? ' id="' + escapeHtml(id) + '"' : '') + '><div class="section-title"><div><h2>' + escapeHtml(brand) + '</h2></div></div><div class="product-row">' + items.map(card).join('') + '</div></section>';
      }).join('');
    }
    if (count) count.textContent = filtered.length + ' product' + (filtered.length === 1 ? '' : 's') + (query ? ' found' : ' in this collection');
    if (empty) empty.hidden = filtered.length !== 0;
    if (!query) {
      Array.from(document.querySelectorAll('.listing-quick-links a[href^="#"]')).forEach(function (link) {
        if (!document.querySelector(link.getAttribute('href'))) link.remove();
      });
    }
    renderCategoryMenu();
    renderShinBrandMenu();
    document.body.classList.add('live-category-ready');
    if (!query && location.hash) {
      requestAnimationFrame(function () {
        var target = document.getElementById(location.hash.slice(1));
        if (target) target.scrollIntoView({ block: 'start' });
      });
    }
  }

  fetch('../data/final/catalog.published.json', { cache: 'no-store' })
    .then(function (response) { return response.json(); })
    .then(function (payload) {
      var all = Array.isArray(payload) ? payload : (payload.products || []);
      var seen = new Set();
      products = all.filter(function (product) {
        var id = String(product.id || '');
        if (!id || seen.has(id) || !matches(product)) return false;
        seen.add(id);
        return true;
      });
      render();
    })
    .catch(function () {
      document.body.classList.add('live-category-ready');
      sections.innerHTML = '<p class="catalog-load-error" role="alert">Could not load this collection. Please retry.</p>';
      if (count) count.textContent = 'Could not load products.';
    });

  if (input) input.addEventListener('input', render);
  if (clear) clear.addEventListener('click', function () { input.value = ''; render(); input.focus(); });
})();
