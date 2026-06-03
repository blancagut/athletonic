const { URL } = require("url");

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

/**
 * Parse query parameters from a Node serverless request. On Vercel `req.query`
 * is already populated, but we fall back to parsing the URL so the handlers
 * work the same way under `node --check` and local tooling.
 */
function getQuery(req) {
  if (req.query && typeof req.query === "object") return req.query;
  try {
    const url = new URL(req.url, "http://localhost");
    return Object.fromEntries(url.searchParams.entries());
  } catch {
    return {};
  }
}

/**
 * Resolve a `[id]` style dynamic segment value.
 */
function getParam(req, name) {
  const query = getQuery(req);
  const value = query[name];
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Normalize pagination into Supabase range bounds.
 */
function getPagination(query) {
  let page = Number.parseInt(query.page, 10);
  let pageSize = Number.parseInt(query.page_size, 10);

  if (!Number.isInteger(page) || page < 1) page = 1;
  if (!Number.isInteger(pageSize) || pageSize < 1) pageSize = DEFAULT_PAGE_SIZE;
  if (pageSize > MAX_PAGE_SIZE) pageSize = MAX_PAGE_SIZE;

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  return { page, pageSize, from, to };
}

module.exports = {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  getQuery,
  getParam,
  getPagination,
};
