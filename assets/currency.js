/* ============================================================
 *  Athletonic currency switcher (assets/currency.js)
 *
 *  Live FX display conversion for international shoppers (South
 *  America focus). All prices on the site are authored in USD;
 *  this runtime rewrites *displayed* prices client-side using
 *  rates from /api/currency/rates (ExchangeRate-API, cached).
 *  Checkout always bills in USD — a note in the menu says so.
 *
 *  - Header pill + dropdown injected into .header-actions on every
 *    page (mirrors the i18n language switcher; no HTML edits).
 *  - Reversible: original USD text kept per node, so switching
 *    back to USD restores the exact original strings.
 *  - MutationObserver converts late-rendered prices (cart drawer,
 *    live search, catalog pagination, PDP variant updates).
 *  - Stamps data-usd on price elements so the deal-chip "-N%"
 *    logic in cart.js keeps computing from true USD numbers.
 *  - First visit: currency auto-detected from browser locale
 *    region (e.g. pt-BR -> BRL); explicit choice persists.
 * ============================================================ */
(function () {
  "use strict";

  if (window.AthletonicCurrency) return;

  var path = window.location.pathname || "";
  /* Admin console + wholesale B2B line sheets stay strictly USD. */
  if (/\/admin\//.test(path) || /wholesale/.test(path)) return;

  var STORAGE_KEY = "athletonic-currency";
  var RATES_KEY = "athletonic-fx-v1";
  var RATES_TTL = 6 * 60 * 60 * 1000; /* 6h, matches API cache */

  /* [code, display name, formatting locale] */
  var CURRENCIES = [
    ["USD", "US Dollar", "en-US"],
    ["BRL", "Real brasileiro", "pt-BR"],
    ["MXN", "Peso mexicano", "es-MX"],
    ["ARS", "Peso argentino", "es-AR"],
    ["CLP", "Peso chileno", "es-CL"],
    ["COP", "Peso colombiano", "es-CO"],
    ["PEN", "Sol peruano", "es-PE"],
    ["UYU", "Peso uruguayo", "es-UY"],
    ["PYG", "Guaraní paraguayo", "es-PY"],
    ["BOB", "Boliviano", "es-BO"],
    ["CRC", "Colón costarricense", "es-CR"],
    ["DOP", "Peso dominicano", "es-DO"],
    ["GTQ", "Quetzal guatemalteco", "es-GT"],
    ["EUR", "Euro", "es-ES"],
    ["GBP", "British Pound", "en-GB"],
    ["CAD", "Canadian Dollar", "en-CA"],
  ];

  var META = {};
  for (var c = 0; c < CURRENCIES.length; c++) {
    META[CURRENCIES[c][0]] = { name: CURRENCIES[c][1], locale: CURRENCIES[c][2] };
  }

  /* Simplified inline SVG flags (24x18). Real vectors — never emoji,
   * which render as letter squares on Windows/Chrome. */
  var FLAGS = {
    USD:
      '<rect width="24" height="18" fill="#B22234"/>' +
      '<path d="M0 2h24v2H0zM0 6h24v2H0zM0 10h24v2H0zM0 14h24v2H0z" fill="#fff"/>' +
      '<rect width="10" height="8" fill="#3C3B6E"/>',
    BRL:
      '<rect width="24" height="18" fill="#009739"/>' +
      '<path d="M12 2.4 20.8 9 12 15.6 3.2 9z" fill="#FEDD00"/>' +
      '<circle cx="12" cy="9" r="3.1" fill="#012169"/>',
    MXN:
      '<rect width="8" height="18" fill="#006341"/>' +
      '<rect x="8" width="8" height="18" fill="#fff"/>' +
      '<rect x="16" width="8" height="18" fill="#C8102E"/>' +
      '<circle cx="12" cy="9" r="1.8" fill="#8C6239"/>',
    ARS:
      '<rect width="24" height="18" fill="#74ACDF"/>' +
      '<rect y="6" width="24" height="6" fill="#fff"/>' +
      '<circle cx="12" cy="9" r="2" fill="#F6B40E"/>',
    CLP:
      '<rect width="24" height="9" fill="#fff"/>' +
      '<rect y="9" width="24" height="9" fill="#D52B1E"/>' +
      '<rect width="8" height="9" fill="#0039A6"/>' +
      '<path d="m4 2.5.47 1.35 1.43.03-1.14.87.42 1.37L4 5.3l-1.18.82.42-1.37-1.14-.87 1.43-.03z" fill="#fff"/>',
    COP:
      '<rect width="24" height="9" fill="#FFCD00"/>' +
      '<rect y="9" width="24" height="4.5" fill="#003087"/>' +
      '<rect y="13.5" width="24" height="4.5" fill="#C8102E"/>',
    PEN:
      '<rect width="24" height="18" fill="#fff"/>' +
      '<rect width="8" height="18" fill="#D91023"/>' +
      '<rect x="16" width="8" height="18" fill="#D91023"/>',
    UYU:
      '<rect width="24" height="18" fill="#fff"/>' +
      '<path d="M0 2h24v2H0zM0 6h24v2H0zM0 10h24v2H0zM0 14h24v2H0z" fill="#0038A8"/>' +
      '<rect width="9" height="9" fill="#fff"/>' +
      '<circle cx="4.5" cy="4.5" r="2.2" fill="#FCD116"/>',
    PYG:
      '<rect width="24" height="6" fill="#D52B1E"/>' +
      '<rect y="6" width="24" height="6" fill="#fff"/>' +
      '<rect y="12" width="24" height="6" fill="#0038A8"/>' +
      '<circle cx="12" cy="9" r="1.9" fill="none" stroke="#7B9C41" stroke-width="0.9"/>',
    BOB:
      '<rect width="24" height="6" fill="#DA291C"/>' +
      '<rect y="6" width="24" height="6" fill="#F4E400"/>' +
      '<rect y="12" width="24" height="6" fill="#007A33"/>',
    CRC:
      '<rect width="24" height="18" fill="#002B7F"/>' +
      '<rect y="3" width="24" height="12" fill="#fff"/>' +
      '<rect y="6" width="24" height="6" fill="#CE1126"/>',
    DOP:
      '<rect width="24" height="18" fill="#fff"/>' +
      '<rect width="10" height="7" fill="#002D62"/>' +
      '<rect x="14" width="10" height="7" fill="#CE1126"/>' +
      '<rect y="11" width="10" height="7" fill="#CE1126"/>' +
      '<rect x="14" y="11" width="10" height="7" fill="#002D62"/>',
    GTQ:
      '<rect width="8" height="18" fill="#4997D0"/>' +
      '<rect x="8" width="8" height="18" fill="#fff"/>' +
      '<rect x="16" width="8" height="18" fill="#4997D0"/>',
    EUR:
      '<rect width="24" height="18" fill="#003399"/>' +
      '<g fill="#FFCC00">' +
      '<circle cx="12" cy="4" r="0.85"/><circle cx="14.5" cy="4.67" r="0.85"/>' +
      '<circle cx="16.33" cy="6.5" r="0.85"/><circle cx="17" cy="9" r="0.85"/>' +
      '<circle cx="16.33" cy="11.5" r="0.85"/><circle cx="14.5" cy="13.33" r="0.85"/>' +
      '<circle cx="12" cy="14" r="0.85"/><circle cx="9.5" cy="13.33" r="0.85"/>' +
      '<circle cx="7.67" cy="11.5" r="0.85"/><circle cx="7" cy="9" r="0.85"/>' +
      '<circle cx="7.67" cy="6.5" r="0.85"/><circle cx="9.5" cy="4.67" r="0.85"/>' +
      "</g>",
    GBP:
      '<rect width="24" height="18" fill="#012169"/>' +
      '<path d="M0 0 24 18M24 0 0 18" stroke="#fff" stroke-width="3.6"/>' +
      '<path d="M0 0 24 18M24 0 0 18" stroke="#C8102E" stroke-width="1.4"/>' +
      '<path d="M12 0v18M0 9h24" stroke="#fff" stroke-width="6"/>' +
      '<path d="M12 0v18M0 9h24" stroke="#C8102E" stroke-width="3.4"/>',
    CAD:
      '<rect width="24" height="18" fill="#fff"/>' +
      '<rect width="6" height="18" fill="#D80621"/>' +
      '<rect x="18" width="6" height="18" fill="#D80621"/>' +
      '<path d="m12 3.5.9 2.3 2.4-.7-.8 2.6 2.3.9-2.3 1.4.6 2.4-2.5-.9-.6 2.4-.6-2.4-2.5.9.6-2.4L7.2 8.6l2.3-.9-.8-2.6 2.4.7z" fill="#D80621"/>',
  };

  function flagSvg(code) {
    if (!FLAGS[code]) return "";
    return (
      '<svg class="header-currency-flag" viewBox="0 0 24 18" aria-hidden="true">' +
      FLAGS[code] +
      "</svg>"
    );
  }

  var REGION_CURRENCY = {
    BR: "BRL", MX: "MXN", AR: "ARS", CL: "CLP", CO: "COP", PE: "PEN",
    UY: "UYU", PY: "PYG", BO: "BOB", CR: "CRC", DO: "DOP", GT: "GTQ",
    GB: "GBP", CA: "CAD",
    ES: "EUR", FR: "EUR", DE: "EUR", IT: "EUR", PT: "EUR", NL: "EUR",
    IE: "EUR", AT: "EUR", BE: "EUR", FI: "EUR", GR: "EUR",
  };

  var PRICE_RE = /\$\s?(\d{1,3}(?:,\d{3})+|\d+)(\.\d{1,2})?/g;
  var SKIP_TAGS = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, NOSCRIPT: 1, CODE: 1 };

  var rates = null;
  var currentCurrency = "USD";
  var explicitChoice = false;
  /* node -> { orig: USD text, out: last text we wrote } */
  var tracked = new Map();
  var observer = null;
  var formatterCache = {};

  /* ------------------------------------------------------------
   *  Preference persistence + auto-detection
   * ---------------------------------------------------------- */
  function readSaved() {
    try {
      var saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved && META[saved]) {
        explicitChoice = true;
        return saved;
      }
    } catch (e) { /* private mode */ }
    return null;
  }

  function persist(code) {
    explicitChoice = true;
    try {
      window.localStorage.setItem(STORAGE_KEY, code);
    } catch (e) { /* ignore */ }
  }

  function detectCurrency() {
    var langs = navigator.languages || [navigator.language || ""];
    for (var i = 0; i < langs.length; i++) {
      var m = /^[a-z]{2,3}-([A-Z]{2})/.exec(String(langs[i] || ""));
      if (m && REGION_CURRENCY[m[1]]) return REGION_CURRENCY[m[1]];
    }
    return "USD";
  }

  /* ------------------------------------------------------------
   *  Rates loading (API -> direct source fallback -> stale cache)
   * ---------------------------------------------------------- */
  function readCachedRates(allowStale) {
    try {
      var raw = window.localStorage.getItem(RATES_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || !parsed.rates || !parsed.rates.BRL) return null;
      if (!allowStale && Date.now() - (parsed.t || 0) > RATES_TTL) return null;
      return parsed.rates;
    } catch (e) {
      return null;
    }
  }

  function cacheRates(fresh) {
    try {
      window.localStorage.setItem(
        RATES_KEY,
        JSON.stringify({ t: Date.now(), rates: fresh })
      );
    } catch (e) { /* ignore */ }
  }

  function fetchJson(url) {
    return window.fetch(url, { credentials: "omit" }).then(function (res) {
      if (!res.ok) throw new Error("http " + res.status);
      return res.json();
    });
  }

  var ratesPromise = null;

  function loadRates() {
    if (rates) return Promise.resolve(rates);
    var cached = readCachedRates(false);
    if (cached) {
      rates = cached;
      return Promise.resolve(rates);
    }
    if (ratesPromise) return ratesPromise;

    var sameOrigin =
      window.location.protocol === "http:" ||
      window.location.protocol === "https:";

    ratesPromise = (sameOrigin
      ? fetchJson("/api/currency/rates")
      : Promise.reject(new Error("no origin"))
    )
      .catch(function () {
        /* Direct fallback keeps things working locally / if the API is down. */
        return fetchJson("https://open.er-api.com/v6/latest/USD").then(function (data) {
          if (!data || data.result !== "success") throw new Error("bad rates");
          return data;
        });
      })
      .then(function (data) {
        if (!data || !data.rates || !data.rates.BRL) throw new Error("bad rates");
        rates = data.rates;
        cacheRates(rates);
        return rates;
      })
      .catch(function (err) {
        var stale = readCachedRates(true);
        if (stale) {
          rates = stale;
          return rates;
        }
        throw err;
      })
      .finally(function () {
        ratesPromise = null;
      });

    return ratesPromise;
  }

  /* ------------------------------------------------------------
   *  Formatting + conversion
   * ---------------------------------------------------------- */
  function formatter(code) {
    if (!formatterCache[code]) {
      try {
        formatterCache[code] = new Intl.NumberFormat(META[code].locale, {
          style: "currency",
          currency: code,
        });
      } catch (e) {
        formatterCache[code] = null;
      }
    }
    return formatterCache[code];
  }

  function formatAmount(amount, code) {
    var fmt = formatter(code);
    if (fmt) return fmt.format(amount);
    return code + " " + amount.toFixed(2);
  }

  function convertText(text, code, rate, firstUsdOut) {
    return text.replace(PRICE_RE, function (match, intPart, decPart, offset) {
      /* Never re-convert already-localized prices like "R$539" / "US$12". */
      if (offset > 0 && /[A-Za-z]/.test(text.charAt(offset - 1))) return match;
      var usd = parseFloat(intPart.replace(/,/g, "") + (decPart || ""));
      if (!isFinite(usd)) return match;
      if (firstUsdOut && firstUsdOut.value === null) firstUsdOut.value = usd;
      return formatAmount(usd * rate, code);
    });
  }

  function shouldSkip(node) {
    var el = node.parentElement;
    if (!el) return true;
    if (SKIP_TAGS[el.nodeName]) return true;
    if (el.closest("[data-currency-ignore]")) return true;
    return false;
  }

  /* Idempotent per-node conversion. Re-captures the USD original when
     another script (cart drawer, live catalog) rewrites the node. */
  function convertTextNode(node) {
    var data = node.data;
    var entry = tracked.get(node);

    if (entry && entry.out === data) {
      /* Our own output — original unchanged. */
    } else if (PRICE_RE.test(data)) {
      PRICE_RE.lastIndex = 0;
      if (shouldSkip(node)) return;
      entry = { orig: data, out: data };
      tracked.set(node, entry);
    } else {
      PRICE_RE.lastIndex = 0;
      return;
    }

    var desired;
    var firstUsd = { value: null };
    if (currentCurrency === "USD" || !rates || !rates[currentCurrency]) {
      desired = entry.orig;
    } else {
      desired = convertText(entry.orig, currentCurrency, rates[currentCurrency], firstUsd);
    }

    /* Expose the true USD number so cart.js deal chips ("-N%") keep
       computing correct percentages from converted displays. */
    if (node.parentElement) {
      if (firstUsd.value !== null) {
        node.parentElement.setAttribute("data-usd", String(firstUsd.value));
      } else if (desired === entry.orig) {
        node.parentElement.removeAttribute("data-usd");
      }
    }

    if (desired !== data) {
      entry.out = desired;
      node.data = desired;
    } else {
      entry.out = desired;
    }
  }

  function walk(root) {
    if (!root) return;
    if (root.nodeType === 3) {
      convertTextNode(root);
      return;
    }
    if (root.nodeType !== 1 && root.nodeType !== 9 && root.nodeType !== 11) return;
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    var node;
    while ((node = walker.nextNode())) {
      if (node.data.indexOf("$") !== -1 || tracked.has(node)) convertTextNode(node);
    }
  }

  function applyAll() {
    walk(document.body);
    /* Re-run tracked nodes not currently containing "$" (restores). */
    tracked.forEach(function (entry, node) {
      if (!node.isConnected) {
        tracked.delete(node);
        return;
      }
      convertTextNode(node);
    });
    syncSwitcher();
  }

  /* ------------------------------------------------------------
   *  Public set()
   * ---------------------------------------------------------- */
  function setCurrency(code, options) {
    code = String(code || "").toUpperCase();
    if (!META[code]) return;
    if (!options || !options.silent) persist(code);
    currentCurrency = code;
    if (code === "USD") {
      applyAll();
      return;
    }
    loadRates()
      .then(function () {
        applyAll();
      })
      .catch(function () {
        /* No rates available — stay in USD rather than showing stale junk. */
        currentCurrency = "USD";
        applyAll();
      });
  }

  /* ------------------------------------------------------------
   *  Header switcher UI (mirrors the i18n language pill)
   * ---------------------------------------------------------- */
  function syncSwitcher() {
    var codeEl = document.querySelector(".header-currency-code");
    if (codeEl) codeEl.textContent = currentCurrency;
    var flagEl = document.querySelector(".header-currency-button .header-currency-flag");
    if (flagEl && FLAGS[currentCurrency]) flagEl.innerHTML = FLAGS[currentCurrency];
    var items = document.querySelectorAll(".header-currency-item");
    for (var i = 0; i < items.length; i++) {
      var on = items[i].getAttribute("data-currency") === currentCurrency;
      items[i].setAttribute("aria-checked", on ? "true" : "false");
      items[i].classList.toggle("is-active", on);
    }
  }

  function buildHeaderSwitcher() {
    var actions = document.querySelector(".header-actions");
    if (!actions || actions.querySelector(".header-currency")) return;

    var wrap = document.createElement("div");
    wrap.className = "header-currency";
    wrap.setAttribute("data-currency-ignore", "");

    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "header-icon-button header-currency-button";
    btn.setAttribute("aria-haspopup", "true");
    btn.setAttribute("aria-expanded", "false");
    btn.setAttribute("aria-label", "Choose currency");
    btn.innerHTML =
      flagSvg(currentCurrency) +
      '<span class="header-action-label header-currency-code"></span>' +
      '<svg class="header-currency-caret" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"></path></svg>';

    var menu = document.createElement("div");
    menu.className = "header-currency-menu";
    menu.setAttribute("role", "menu");
    menu.hidden = true;

    function closeMenu() {
      if (menu.hidden) return;
      menu.hidden = true;
      btn.setAttribute("aria-expanded", "false");
      document.removeEventListener("click", onDocClick, true);
      document.removeEventListener("keydown", onKey, true);
    }
    function openMenu() {
      if (!menu.hidden) return;
      menu.hidden = false;
      btn.setAttribute("aria-expanded", "true");
      document.addEventListener("click", onDocClick, true);
      document.addEventListener("keydown", onKey, true);
      /* Warm the rates cache while the visitor is deciding. */
      loadRates().catch(function () {});
    }
    function onDocClick(e) {
      if (!wrap.contains(e.target)) closeMenu();
    }
    function onKey(e) {
      if (e.key === "Escape") {
        closeMenu();
        btn.focus();
      }
    }

    for (var i = 0; i < CURRENCIES.length; i++) {
      var code = CURRENCIES[i][0];
      var item = document.createElement("button");
      item.type = "button";
      item.className = "header-currency-item";
      item.setAttribute("role", "menuitemradio");
      item.setAttribute("data-currency", code);
      item.innerHTML =
        flagSvg(code) +
        "<span>" + code + "</span>" +
        '<span class="header-currency-name">' + META[code].name + "</span>" +
        '<svg class="header-currency-check" viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 5 5L20 7"></path></svg>';
      item.addEventListener(
        "click",
        (function (chosen) {
          return function () {
            closeMenu();
            setCurrency(chosen);
          };
        })(code)
      );
      menu.appendChild(item);
    }

    var note = document.createElement("p");
    note.className = "header-currency-note";
    note.textContent = "Orders are billed in USD. Converted prices are estimates.";
    menu.appendChild(note);

    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      if (menu.hidden) openMenu();
      else closeMenu();
    });

    wrap.appendChild(btn);
    wrap.appendChild(menu);

    /* Sit right next to the language (globe) pill when it exists. */
    var locale = actions.querySelector(".header-locale");
    if (locale && locale.nextSibling) {
      actions.insertBefore(wrap, locale.nextSibling);
    } else if (locale) {
      actions.appendChild(wrap);
    } else {
      actions.insertBefore(wrap, actions.firstChild);
    }
    syncSwitcher();
  }

  /* ------------------------------------------------------------
   *  Boot
   * ---------------------------------------------------------- */
  function init() {
    if (!document.body) return;

    currentCurrency = readSaved() || detectCurrency();

    observer = new MutationObserver(function (mutations) {
      if (currentCurrency === "USD" || !rates) return;
      for (var m = 0; m < mutations.length; m++) {
        var mut = mutations[m];
        if (mut.type === "characterData") {
          convertTextNode(mut.target);
        } else {
          for (var n = 0; n < mut.addedNodes.length; n++) {
            walk(mut.addedNodes[n]);
          }
        }
      }
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    buildHeaderSwitcher();

    /* The header is injected by other runtimes too; retry once late. */
    window.addEventListener("load", buildHeaderSwitcher);

    if (currentCurrency !== "USD") {
      setCurrency(currentCurrency, { silent: !explicitChoice });
    } else {
      syncSwitcher();
    }
  }

  /* Public API */
  window.AthletonicCurrency = {
    set: setCurrency,
    get: function () {
      return currentCurrency;
    },
    supported: CURRENCIES.map(function (row) {
      return row[0];
    }),
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
