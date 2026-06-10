const { URL } = require("url");

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;
const MAX_SEARCH_LENGTH = 100;

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

function normalizeSearchTerm(value, maxLength = MAX_SEARCH_LENGTH) {
  if (value == null) return "";
  return String(value)
    .trim()
    .replace(/[%*]/g, "")
    .replace(/\s+/g, " ")
    .slice(0, maxLength)
    .trim();
}

function quotePostgrestValue(value) {
  return `"${String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function buildIlikeOr(clauses) {
  const filters = clauses
    .map(({ column, value }) => {
      const term = normalizeSearchTerm(value);
      return term ? `${column}.ilike.${quotePostgrestValue(`*${term}*`)}` : null;
    })
    .filter(Boolean);
  return filters.join(",");
}

module.exports = {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  buildIlikeOr,
  getQuery,
  getParam,
  getPagination,
  normalizeSearchTerm,
};
