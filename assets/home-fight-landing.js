(() => {
  "use strict";

  // Carry only campaign attribution to existing storefront routes. No cookies,
  // persistent storage or third-party requests are created by this page.
  const campaignKeys = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "utm_id", "gclid", "gbraid", "wbraid"];
  const incoming = new URLSearchParams(window.location.search);
  const links = document.querySelectorAll("a[data-gear-link]");
  links.forEach((link) => {
    const destination = new URL(link.href, window.location.origin);
    if (destination.origin !== window.location.origin) return;
    campaignKeys.forEach((key) => {
      const value = incoming.get(key);
      if (value && !destination.searchParams.has(key)) destination.searchParams.set(key, value);
    });
    link.href = `${destination.pathname}${destination.search}${destination.hash}`;
  });

  // A measurement hook for a separately configured, consent-aware tag manager.
  // This interaction is not a purchase conversion and sends no data by itself.
  document.addEventListener("click", (event) => {
    const link = event.target instanceof Element ? event.target.closest("a[data-gear-link]") : null;
    if (!link) return;
    window.dataLayer = window.dataLayer || [];
    if (typeof window.dataLayer.push !== "function") return;
    window.dataLayer.push({
      event: "combat_gear_click",
      landing_page: window.location.pathname,
      placement: link.dataset.placement,
      destination: new URL(link.href, window.location.origin).pathname,
    });
  });
})();
