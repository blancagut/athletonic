const { handleError, json, methodNotAllowed } = require("../_lib/http");

/* Currencies exposed to the storefront currency switcher.
   USD is the base — everything on the site is priced/billed in USD. */
const SUPPORTED = [
  "USD", "BRL", "MXN", "ARS", "CLP", "COP", "PEN", "UYU", "PYG",
  "BOB", "CRC", "DOP", "GTQ", "HNL", "NIO", "VES", "CUP", "BZD",
  "GYD", "SRD", "HTG", "EUR", "GBP", "CAD",
];

const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
let cache = { at: 0, payload: null };

function pickSupported(allRates) {
  const rates = { USD: 1 };
  for (const code of SUPPORTED) {
    const value = Number(allRates[code]);
    if (Number.isFinite(value) && value > 0) rates[code] = value;
  }
  return rates;
}

/* Primary source: ExchangeRate-API open endpoint (no key, 160+ currencies). */
async function fetchPrimary() {
  const response = await fetch("https://open.er-api.com/v6/latest/USD");
  if (!response.ok) throw new Error(`er-api http ${response.status}`);
  const data = await response.json();
  if (!data || data.result !== "success" || !data.rates) {
    throw new Error("er-api bad payload");
  }
  return {
    base: "USD",
    rates: pickSupported(data.rates),
    updated: data.time_last_update_utc || new Date().toUTCString(),
    source: "open.er-api.com",
  };
}

/* Fallback source: fawazahmed0 currency-api on jsDelivr (lowercase keys). */
async function fetchFallback() {
  const response = await fetch(
    "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.min.json"
  );
  if (!response.ok) throw new Error(`currency-api http ${response.status}`);
  const data = await response.json();
  if (!data || !data.usd) throw new Error("currency-api bad payload");
  const upper = {};
  for (const [code, value] of Object.entries(data.usd)) {
    upper[code.toUpperCase()] = value;
  }
  return {
    base: "USD",
    rates: pickSupported(upper),
    updated: data.date || new Date().toUTCString(),
    source: "currency-api",
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    methodNotAllowed(res, ["GET"]);
    return;
  }

  try {
    const now = Date.now();
    if (!cache.payload || now - cache.at > CACHE_TTL_MS) {
      let payload;
      try {
        payload = await fetchPrimary();
      } catch (primaryError) {
        payload = await fetchFallback();
      }
      /* Require a usable spread of currencies before caching. */
      if (Object.keys(payload.rates).length < 8) {
        throw new Error("rates payload too sparse");
      }
      cache = { at: now, payload };
    }

    res.setHeader(
      "Cache-Control",
      "public, s-maxage=21600, stale-while-revalidate=86400"
    );
    json(res, 200, cache.payload);
  } catch (error) {
    /* Serve stale cache rather than failing the storefront. */
    if (cache.payload) {
      json(res, 200, { ...cache.payload, stale: true });
      return;
    }
    handleError(res, error);
  }
};
