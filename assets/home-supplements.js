(function () {
  "use strict";

  if (!document.body || document.body.dataset.homeSupplements !== "true") return;

  var sections = document.querySelector(".listing-sections");
  var preferredShelves = ["dymatize", "isopure", "bsn", "gat", "muscletech", "mhp"];
  var compacted = false;

  function addHomeStyles() {
    var style = document.createElement("style");
    style.textContent = [
      ".supplement-home-shop-all{display:flex;justify-content:center;margin:8px 0 36px}",
      "body[data-home-supplements='true'] .supplement-hub-hero{margin-top:24px}",
      "body[data-home-supplements-compact='true'] .listing-section{display:none!important}",
      "body[data-home-supplements-compact='true'] .listing-section:is(#dymatize,#isopure,#bsn,#gat,#muscletech,#mhp){display:block!important}",
      "body[data-home-supplements-compact='true'] .listing-section .product-card:nth-child(n+5){display:none!important}",
      "body[data-home-supplements-compact='true'] .listing-shelf-footer{display:none!important}",
      "@media(max-width:600px){body[data-home-supplements-compact='true'] .listing-section .product-card:nth-child(n+3){display:none!important}}"
    ].join("");
    document.head.appendChild(style);
  }

  function compactHomeCatalog() {
    if (!sections) return;

    var shelves = Array.from(sections.querySelectorAll(".listing-section"));
    var shelvesById = new Map(shelves.map(function (shelf) {
      return [shelf.id, shelf];
    }));
    if (!preferredShelves.every(function (id) { return shelvesById.has(id); })) return;

    compacted = true;
    document.body.dataset.homeSupplementsCompact = "true";
    shelves.forEach(function (shelf) {
      shelf.style.display = preferredShelves.includes(shelf.id) ? "" : "none";
    });

    preferredShelves.forEach(function (id) {
      var shelf = shelvesById.get(id);
      var cardLimit = window.matchMedia("(max-width: 600px)").matches ? 2 : 4;
      Array.from(shelf.querySelectorAll(".product-card")).forEach(function (card, index) {
        card.hidden = index >= cardLimit;
        card.style.display = index >= cardLimit ? "none" : "";
      });
      var footer = shelf.querySelector(".listing-shelf-footer");
      if (footer) footer.style.display = "none";
    });

    var finder = document.querySelector(".supplement-hub-finder");
    var menus = document.querySelector(".supplements-discovery-menus");
    var count = document.querySelector("[data-listing-count]");
    var intro = document.querySelector("#supplement-catalog h2");
    var introCopy = document.querySelector("#supplement-catalog h2 + p");
    if (finder) finder.style.display = "none";
    if (menus) menus.style.display = "none";
    if (count) count.textContent = window.matchMedia("(max-width: 600px)").matches
      ? "12 featured products"
      : "24 featured products";
    if (intro) intro.textContent = "Featured supplements";
    if (introCopy) introCopy.textContent = "A focused first look at proven performance brands. The complete catalog remains one click away.";

    if (!document.querySelector(".supplement-home-shop-all")) {
      var shopAll = document.createElement("p");
      shopAll.className = "supplement-home-shop-all";
      shopAll.innerHTML = '<a class="supplement-hub-button" href="/supplements">Shop all supplements</a>';
      sections.insertAdjacentElement("afterend", shopAll);
    }
  }

  addHomeStyles();

  if (sections) {
    var observer = new MutationObserver(function () {
      compactHomeCatalog();
    });
    observer.observe(sections, { childList: true });
    compactHomeCatalog();
  }

  var script = document.createElement("script");
  script.src = "/assets/supplements-page-menu.js?v=20260826-home-1";
  script.defer = true;
  document.body.appendChild(script);
})();
