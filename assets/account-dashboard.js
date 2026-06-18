(function () {
  "use strict";

  var sb = window.supabase && window.supabase.createClient(
    window.ATHLETONIC_SUPABASE_URL,
    window.ATHLETONIC_SUPABASE_KEY
  );
  if (!sb) return;

  var gateEl = document.getElementById("hub-gate");
  var bodyEl = document.getElementById("hub-body");
  var resetEl = document.getElementById("hub-reset");
  var greetEl = document.getElementById("hub-greeting");
  var emailEl = document.getElementById("hub-email");
  var ordersEl = document.querySelector("[data-recent-orders]");
  var buyAgainEl = document.querySelector("[data-buy-again-shelf]");
  var recommendedEl = document.querySelector("[data-recommended-shelf]");
  var latestOrderLink = document.querySelector("[data-latest-order-link]");
  var summaryOrders = document.querySelector("[data-summary-orders]");
  var summaryDeliveries = document.querySelector("[data-summary-deliveries]");
  var summaryStatus = document.querySelector("[data-summary-status]");

  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function formatMoney(cents, currency) {
    try {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: currency || "USD",
      }).format((Number(cents) || 0) / 100);
    } catch (error) {
      return "$" + ((Number(cents) || 0) / 100).toFixed(2);
    }
  }

  function formatDate(value) {
    if (!value) return "Pending";
    var date = new Date(value);
    if (isNaN(date.getTime())) return "Pending";
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(date);
  }

  function statusLabel(value) {
    return String(value || "pending")
      .replaceAll("_", " ")
      .replace(/\b\w/g, function (letter) { return letter.toUpperCase(); });
  }

  function productHref(product) {
    return "../product/" + encodeURIComponent(product.id) + ".html";
  }

  function orderLookupHref(order) {
    if (!order) return "order-tracking.html";
    var params = new URLSearchParams();
    if (order.customer_email) params.set("email", order.customer_email);
    if (order.order_reference) params.set("order_reference", order.order_reference);
    var query = params.toString();
    return "order-tracking.html" + (query ? "?" + query : "");
  }

  function isActiveDelivery(order) {
    var fulfillment = String(order.fulfillment_status || "");
    var status = String(order.order_status || "");
    return ["processing", "shipped"].includes(fulfillment) || ["processing", "shipped"].includes(status);
  }

  function setText(element, value) {
    if (element) element.textContent = value;
  }

  async function fetchOrders(session) {
    var response = await fetch("/api/orders", {
      headers: {
        Authorization: "Bearer " + session.access_token,
      },
    });
    var payload = await response.json().catch(function () { return {}; });
    if (!response.ok) throw new Error(payload.message || "Order history is unavailable right now.");
    return Array.isArray(payload.orders) ? payload.orders : [];
  }

  async function fetchCatalog() {
    var response = await fetch("../data/athletonic-catalog.json", { cache: "no-store" });
    if (!response.ok) throw new Error("Catalog is unavailable right now.");
    var payload = await response.json();
    return Array.isArray(payload.products) ? payload.products : [];
  }

  function usableProduct(product) {
    return product && product.id && product.image && product.available === true && Number(product.price_cents) > 0;
  }

  function renderSummary(orders) {
    var active = orders.filter(isActiveDelivery).length;
    setText(summaryOrders, orders.length ? String(orders.length) : "No orders yet");
    setText(summaryDeliveries, active ? String(active) : "No active deliveries");
    setText(summaryStatus, "Ready");
    if (latestOrderLink && orders[0]) latestOrderLink.href = orderLookupHref(orders[0]);
  }

  function renderOrders(orders) {
    if (!ordersEl) return;

    if (!orders.length) {
      ordersEl.innerHTML =
        '<div class="account-empty-state">' +
          '<h3>No orders yet</h3>' +
          '<p>Start with best sellers, protein deals, or training gear.</p>' +
          '<div class="account-empty-actions">' +
            '<a href="best-sellers.html">Shop best sellers</a>' +
            '<a href="protein.html">Protein deals</a>' +
            '<a href="combat-sports.html">Boxing gear</a>' +
          '</div>' +
        '</div>';
      return;
    }

    ordersEl.innerHTML = orders.slice(0, 4).map(function (order) {
      var items = Array.isArray(order.items) ? order.items : [];
      var firstItem = items.find(function (item) { return item.image_url; }) || items[0] || {};
      var count = items.reduce(function (sum, item) { return sum + Number(item.quantity || 0); }, 0);
      var ctaHref = order.tracking && order.tracking.url ? order.tracking.url : orderLookupHref(order);
      var ctaText = order.tracking && order.tracking.url ? "Track shipment" : "Track order";
      return (
        '<article class="account-order-card">' +
          '<div class="account-order-media">' +
            (firstItem.image_url ? '<img src="' + escapeHtml(firstItem.image_url) + '" alt="" loading="lazy" decoding="async" />' : '<span>No image</span>') +
          '</div>' +
          '<div class="account-order-body">' +
            '<div class="account-order-title-row">' +
              '<div>' +
                '<h3>Order ' + escapeHtml(order.order_reference) + '</h3>' +
                '<p>Placed ' + escapeHtml(formatDate(order.timestamps && order.timestamps.created_at)) + '</p>' +
              '</div>' +
              '<strong>' + escapeHtml(formatMoney(order.amounts && order.amounts.total_cents, order.currency)) + '</strong>' +
            '</div>' +
            '<div class="account-order-meta">' +
              '<span>' + escapeHtml(statusLabel(order.order_status)) + '</span>' +
              '<span>' + escapeHtml(statusLabel(order.fulfillment_status)) + '</span>' +
              '<span>' + count + (count === 1 ? ' item' : ' items') + '</span>' +
            '</div>' +
          '</div>' +
          '<a class="account-order-cta" href="' + escapeHtml(ctaHref) + '"' + (order.tracking && order.tracking.url ? ' rel="noopener"' : '') + '>' + ctaText + '</a>' +
        '</article>'
      );
    }).join("");
  }

  function productCard(product) {
    var href = productHref(product);
    var price = (Number(product.price_cents) || 0) / 100;
    var priceText = price.toFixed(2);
    var needsOptions = product.requires_variant_selection === true;
    var action = needsOptions
      ? '<a class="add-cart-button product-options-button" href="' + escapeHtml(href) + '">View options</a>'
      : '<button class="add-cart-button" type="button" data-add-to-cart' +
          ' data-cart-id="' + escapeHtml(product.id) + '"' +
          ' data-cart-product-id="' + escapeHtml(product.id) + '"' +
          ' data-cart-brand="' + escapeHtml(product.brand) + '"' +
          ' data-cart-name="' + escapeHtml(product.name) + '"' +
          ' data-cart-price="' + escapeHtml(priceText) + '"' +
          ' data-cart-price-cents="' + escapeHtml(String(product.price_cents)) + '"' +
          ' data-cart-currency="' + escapeHtml(product.currency || "USD") + '"' +
          ' data-cart-image="' + escapeHtml(product.image) + '"' +
          ' aria-label="Add ' + escapeHtml(product.name) + ' to cart">Add to cart</button>';

    return (
      '<article class="product-card account-product-card">' +
        '<a class="product-image" href="' + escapeHtml(href) + '">' +
          '<img src="' + escapeHtml(product.image) + '" alt="' + escapeHtml(product.name) + '" loading="lazy" decoding="async" />' +
        '</a>' +
        '<div class="product-body">' +
          '<span>' + escapeHtml(product.brand) + '</span>' +
          '<h3><a class="product-card-link" href="' + escapeHtml(href) + '">' + escapeHtml(product.name) + '</a></h3>' +
          '<p>' + escapeHtml(product.section_title || product.section_id || "Athletonic pick") + '</p>' +
          '<div class="product-price-line"><strong>' + escapeHtml(formatMoney(product.price_cents, product.currency)) + '</strong></div>' +
          '<p class="account-stock-state">' + (needsOptions ? 'Options available' : 'In stock') + '</p>' +
          action +
        '</div>' +
      '</article>'
    );
  }

  function uniqueById(products) {
    var seen = new Set();
    return products.filter(function (product) {
      if (!product || seen.has(product.id)) return false;
      seen.add(product.id);
      return true;
    });
  }

  function orderProducts(orders, productsById) {
    var ids = [];
    orders.forEach(function (order) {
      (order.items || []).forEach(function (item) {
        if (item.product_id) ids.push(String(item.product_id));
      });
    });
    return uniqueById(ids.map(function (id) { return productsById.get(id); }).filter(usableProduct));
  }

  function fallbackProducts(products, excludeIds, limit) {
    var sectionOrder = ["protein", "creatine", "pre-workout", "hydration", "training-gear", "recovery", "accessories"];
    var picks = [];
    sectionOrder.forEach(function (section) {
      products.forEach(function (product) {
        if (picks.length >= limit) return;
        if (excludeIds.has(product.id)) return;
        if (product.section_id === section && usableProduct(product)) picks.push(product);
      });
    });
    return uniqueById(picks).slice(0, limit);
  }

  function renderShelf(container, products, emptyMessage) {
    if (!container) return;
    if (!products.length) {
      container.innerHTML = '<div class="account-empty-state compact"><p>' + escapeHtml(emptyMessage) + '</p></div>';
      return;
    }
    container.innerHTML = products.map(productCard).join("");
  }

  function renderProducts(orders, catalog) {
    var products = catalog.filter(usableProduct);
    var productsById = new Map(products.map(function (product) { return [String(product.id), product]; }));
    var buyAgain = orderProducts(orders, productsById).slice(0, 8);
    if (!buyAgain.length) buyAgain = fallbackProducts(products, new Set(), 8);

    var buyAgainIds = new Set(buyAgain.map(function (product) { return product.id; }));
    var recommended = fallbackProducts(products, buyAgainIds, 8);
    if (!recommended.length) recommended = fallbackProducts(products, new Set(), 8);

    renderShelf(buyAgainEl, buyAgain, "No reorderable products are available right now.");
    renderShelf(recommendedEl, recommended, "Recommended products are unavailable right now.");
  }

  function showDashboard(session) {
    var user = session.user || {};
    var meta = user.user_metadata || {};
    var name = meta.full_name || meta.name || "";
    var first = name ? name.trim().split(" ")[0] : "";
    setText(greetEl, first ? "Hello, " + first : "Hello");
    setText(emailEl, user.email || "");
    if (bodyEl) bodyEl.hidden = false;

    Promise.all([fetchOrders(session), fetchCatalog()])
      .then(function (result) {
        var orders = result[0];
        var catalog = result[1];
        renderSummary(orders);
        renderOrders(orders);
        renderProducts(orders, catalog);
      })
      .catch(function (error) {
        renderSummary([]);
        if (ordersEl) {
          ordersEl.innerHTML = '<div class="account-empty-state"><h3>Order history is unavailable</h3><p>' + escapeHtml(error.message) + '</p><div class="account-empty-actions"><a href="order-tracking.html">Look up an order</a><a href="contact.html">Contact support</a></div></div>';
        }
        fetchCatalog()
          .then(function (catalog) { renderProducts([], catalog); })
          .catch(function () {
            renderShelf(buyAgainEl, [], "Products are unavailable right now.");
            renderShelf(recommendedEl, [], "Products are unavailable right now.");
          });
      });
  }

  function bindGate() {
    var btnIn = document.getElementById("btn-hub-signin");
    if (btnIn) {
      btnIn.addEventListener("click", function () {
        window.location.href = "login.html?return_to=" + encodeURIComponent(window.location.href);
      });
    }
  }

  function bindSignOut() {
    var btnOut = document.getElementById("btn-signout");
    if (btnOut) {
      btnOut.addEventListener("click", function () {
        sb.auth.signOut().then(function () {
          window.location.href = "../";
        });
      });
    }
  }

  function bindSecurityReset(user) {
    var button = document.getElementById("btn-security-reset");
    var status = document.getElementById("security-reset-status");
    if (!button || !user || !user.email) return;
    button.addEventListener("click", function () {
      button.disabled = true;
      if (status) status.textContent = "Sending reset link...";
      var redirectUrl = window.location.origin + "/pages/account.html?action=reset-password";
      sb.auth.resetPasswordForEmail(user.email, { redirectTo: redirectUrl }).then(function (result) {
        if (result.error) {
          if (status) status.textContent = result.error.message || "Could not send reset link.";
          button.disabled = false;
          return;
        }
        if (status) status.textContent = "Reset link sent to " + user.email + ".";
      });
    });
  }

  function bindResetForm() {
    var formReset = document.getElementById("form-reset");
    if (!formReset) return;
    formReset.addEventListener("submit", function (event) {
      event.preventDefault();
      var password = formReset.elements.password.value;
      var confirm = formReset.elements.confirm.value;
      var statusEl = document.getElementById("reset-status");
      if (password !== confirm) {
        if (statusEl) {
          statusEl.textContent = "Passwords do not match.";
          statusEl.dataset.state = "error";
        }
        return;
      }
      var button = formReset.querySelector("button[type=submit]");
      if (button) button.disabled = true;
      sb.auth.updateUser({ password: password }).then(function (res) {
        if (res.error) {
          if (statusEl) {
            statusEl.textContent = res.error.message || "Could not update password.";
            statusEl.dataset.state = "error";
          }
          if (button) button.disabled = false;
          return;
        }
        if (statusEl) {
          statusEl.textContent = "Password updated. Taking you home...";
          statusEl.dataset.state = "success";
        }
        setTimeout(function () { window.location.href = "../"; }, 1500);
      });
    });
  }

  function init() {
    bindGate();
    bindSignOut();
    bindResetForm();

    var hashParams = new URLSearchParams(window.location.hash.slice(1));
    if (hashParams.get("type") === "recovery" && hashParams.get("access_token")) {
      sb.auth.setSession({
        access_token: hashParams.get("access_token"),
        refresh_token: hashParams.get("refresh_token") || "",
      });
      if (resetEl) resetEl.hidden = false;
      history.replaceState(null, "", window.location.pathname + window.location.search);
      return;
    }

    sb.auth.getSession().then(function (res) {
      var session = res && res.data && res.data.session;
      if (!session) {
        if (gateEl) gateEl.hidden = false;
        return;
      }
      bindSecurityReset(session.user || {});
      showDashboard(session);
    });
  }

  init();
})();