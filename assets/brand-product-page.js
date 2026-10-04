(function () {
  "use strict";

  var root = document.querySelector("[data-brand-product]");
  if (!root) return;

  var brandMap = {
    hayabusa: { slug: "hayabusa", name: "Hayabusa", catalog: "/data/brand-page-catalog.json", page: "/hayabusa" },
    everlast: { slug: "everlast", name: "Everlast", catalog: "/data/everlast-products.json", page: "/everlast" },
    "cleto-reyes": { slug: "cleto_reyes", name: "Cleto Reyes", catalog: "/data/cleto-reyes-products.json", page: "/cleto-reyes" }
  };
  var parts = window.location.pathname.split("/").filter(Boolean);
  var config = brandMap[parts[1]];
  var productId = parts[2] || "";
  if (!config || !productId) return;

  var nameEls = document.querySelectorAll("[data-product-name]");
  var image = document.querySelector("[data-product-image]");
  var brand = document.querySelector("[data-product-brand]");
  var brandDetail = document.querySelector("[data-product-brand-detail]");
  var price = document.querySelector("[data-product-price]");
  var compare = document.querySelector("[data-product-compare]");
  var category = document.querySelector("[data-product-category]");
  var reference = document.querySelector("[data-product-reference]");
  var description = document.querySelector("[data-product-description]");
  var availability = document.querySelector("[data-product-availability]");
  var note = document.querySelector("[data-product-note]");
  var button = document.querySelector("[data-product-cta]");
  var canonical = document.querySelector("[data-brand-product-canonical]");
  var brandLink = document.querySelector("[data-brand-link]");

  function text(value) { return String(value == null ? "" : value); }
  function escapeHtml(value) { return text(value).replace(/[&<>'"]/g, function (character) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[character]; }); }
  function setText(nodes, value) { Array.prototype.forEach.call(nodes, function (node) { node.textContent = value; }); }
  function cents(product) { return product.price_cents != null ? Number(product.price_cents) : Math.round(Number(product.price || 0) * 100); }
  function money(value) { return "$" + (Number(value || 0) / 100).toFixed(2); }
  function sourceImage(product) { return product.image_url || product.image || (Array.isArray(product.images) && product.images[0]) || "/assets/logo.png"; }

  function renderGallery(product) {
    var gallery = document.querySelector(".pdp-gallery");
    var urls = Array.isArray(product.images) ? product.images.filter(Boolean) : [];
    if (!gallery || urls.length < 2) return;
    var thumbs = document.createElement("div");
    thumbs.className = "pdp-thumbs";
    thumbs.setAttribute("role", "tablist");
    thumbs.setAttribute("aria-label", "Product images");
    urls.forEach(function (url, index) {
      var item = document.createElement("button");
      item.type = "button";
      item.className = "pdp-thumb" + (index === 0 ? " is-active" : "");
      item.setAttribute("aria-label", "View image " + (index + 1));
      var thumb = document.createElement("img");
      thumb.src = url;
      thumb.alt = "";
      thumb.loading = "lazy";
      item.appendChild(thumb);
      item.addEventListener("click", function () {
        image.src = url;
        thumbs.querySelectorAll(".pdp-thumb").forEach(function (button) { button.classList.toggle("is-active", button === item); });
      });
      thumbs.appendChild(item);
    });
    gallery.appendChild(thumbs);
  }

  function renderOptions(product) {
    if (Array.isArray(product.variants) && !product.variants.length) return;
    var optionMap = product.options && typeof product.options === "object" ? product.options : {};
    var names = Object.keys(optionMap).filter(function (name) { return Array.isArray(optionMap[name]) && optionMap[name].length; });
    var variants = Array.isArray(product.variants) ? product.variants.filter(function (variant) { return variant && variant.selected_options; }) : [];
    var ctaRow = document.querySelector(".pdp-cta-row");
    if (!ctaRow || !names.length) return;
    var wrapper = document.createElement("div");
    wrapper.className = "pdp-variants";
    wrapper.setAttribute("data-pdp-variants", "");
    var selects = {};
    var selected = {};
    var findVariant = function () {
      return variants.find(function (variant) {
        return names.every(function (name) { return selected[name] && String(variant.selected_options[name]) === String(selected[name]); });
      });
    };
    var matchesPartial = function (name, value) {
      return variants.some(function (variant) {
        return String(variant.selected_options[name]) === String(value) && names.every(function (otherName) {
          return otherName === name || !selected[otherName] || String(variant.selected_options[otherName]) === String(selected[otherName]);
        });
      });
    };
    var refresh = function () {
      names.forEach(function (name) {
        Array.prototype.forEach.call(selects[name].options, function (option) {
          option.disabled = Boolean(option.value) && variants.length > 0 && !matchesPartial(name, option.value);
        });
      });
      var variant = variants.length ? findVariant() : null;
      if (variants.length && !variant) {
        button.disabled = true;
        button.textContent = "Select a valid combination";
        return;
      }
      button.disabled = false;
      button.textContent = "Add to cart";
      if (!variant) return;
      button.dataset.cartVariantId = variant.variant_id || variant.id || "";
      button.dataset.cartSelectedOptions = JSON.stringify(variant.selected_options || {});
      button.dataset.cartVariant = variant.title || "";
      button.dataset.cartPrice = (Number(variant.price_cents || cents(product)) / 100).toFixed(2);
      button.dataset.cartSku = variant.sku || product.sku || "";
      if (variant.image_url) image.src = variant.image_url;
      if (variant.title) note.textContent = variant.title + " · This product page, pricing, and order request are handled by Athletonic.";
    };
    names.forEach(function (name) {
      var label = document.createElement("label");
      label.className = "pdp-variant";
      var title = document.createElement("span");
      title.className = "pdp-variant-label";
      title.textContent = name;
      var select = document.createElement("select");
      select.setAttribute("data-pdp-variant", "");
      select.setAttribute("data-variant-name", name);
      select.required = true;
      selects[name] = select;
      var placeholder = document.createElement("option");
      placeholder.value = "";
      placeholder.disabled = true;
      placeholder.selected = true;
      placeholder.textContent = "Select " + name + "…";
      select.appendChild(placeholder);
      optionMap[name].forEach(function (value) {
        var option = document.createElement("option");
        option.value = value;
        option.textContent = value;
        select.appendChild(option);
      });
      select.addEventListener("change", function () {
        selected[name] = select.value;
        refresh();
      });
      label.append(title, select);
      wrapper.appendChild(label);
    });
    ctaRow.parentNode.insertBefore(wrapper, ctaRow);
    if (variants.length) {
      button.disabled = true;
      button.textContent = "Select options";
      button.dataset.cartVariantId = "";
      button.dataset.cartSelectedOptions = "{}";
      button.dataset.cartVariant = "";
    }
  }

  fetch(config.catalog, { cache: "no-store" })
    .then(function (response) { if (!response.ok) throw new Error("Catalog unavailable"); return response.json(); })
    .then(function (payload) {
      var products = Array.isArray(payload) ? payload : payload.products || [];
      var product = products.find(function (item) {
        return String(item.id || "") === productId && String(item.brand_slug || "").toLowerCase() === config.slug;
      });
      if (!product) throw new Error("Product not found");

      var productName = product.name || product.title || "Product";
      var productBrand = product.brand || config.name;
      var productCategory = product.category || product.category_name || "Training gear";
      var productPrice = cents(product);
      var productMaxPrice = Number(product.price_max_cents || productPrice);
      var comparePrice = product.compare_at_price_cents != null ? Number(product.compare_at_price_cents) : Math.round(Number(product.compare_at_price || 0) * 100);
      var publicUrl = window.location.origin + window.location.pathname;
      document.title = productName + " — " + productBrand + " | Athletonic";
      document.querySelector('meta[name="description"]').setAttribute("content", productName + " by " + productBrand + ". Shop on Athletonic.");
      canonical.href = publicUrl;
      setText(nameEls, productName);
      brand.textContent = productBrand;
      brandDetail.textContent = productBrand;
      price.textContent = productMaxPrice > productPrice ? money(productPrice) + " – " + money(productMaxPrice) : money(productPrice);
      category.textContent = productCategory;
      reference.textContent = productId;
      description.textContent = product.description || (productName + " by " + productBrand + ". Shop authentic combat sports equipment through Athletonic.");
      availability.textContent = product.available === 0 || product.available === false ? "Availability confirmed by Athletonic" : "Available · Sold by Athletonic";
      brandLink.href = config.page;
      image.src = sourceImage(product);
      image.alt = productName;
      if (comparePrice > productPrice) { compare.textContent = money(comparePrice); compare.hidden = false; }
      button.disabled = false;
      button.textContent = "Add to cart";
      button.dataset.cartId = productId;
      button.dataset.cartProductId = productId;
      button.dataset.cartBrand = productBrand;
      button.dataset.cartName = productName;
      button.dataset.cartPrice = (productPrice / 100).toFixed(2);
      button.dataset.cartCurrency = "USD";
      button.dataset.cartImage = sourceImage(product);
      button.dataset.cartSku = product.sku || "";
      note.textContent = "This product page, pricing, and order request are handled by Athletonic.";
      renderGallery(product);
      renderOptions(product);
    })
    .catch(function () {
      document.title = "Product unavailable | Athletonic";
      setText(nameEls, "Product unavailable");
      if (note) note.textContent = "We could not load this product right now.";
      if (button) { button.disabled = true; button.textContent = "Unavailable"; }
    });
})();
