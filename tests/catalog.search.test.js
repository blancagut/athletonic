"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const handler = require("../api/catalog/search.js");

function createResponseCapture() {
  return {
    statusCode: 200,
    headers: {},
    body: "",
    setHeader(name, value) {
      this.headers[name] = value;
    },
    end(payload = "") {
      this.body += payload;
    },
  };
}

async function search(q, limit = "10") {
  return searchPage(q, limit, "0");
}

async function searchPage(q, limit = "10", offset = "0") {
  const req = {
    method: "GET",
    query: { q, category: "all", limit, offset },
    url: `/api/catalog/search?q=${encodeURIComponent(q)}&category=all&limit=${limit}&offset=${offset}`,
  };
  const res = createResponseCapture();
  await handler(req, res);
  return JSON.parse(res.body);
}

test("catalog search returns Twins results for brand queries", async () => {
  const payload = await search("Twins Special");
  assert.ok(payload.total >= 100, "expected the published Twins catalog to be searchable");
  assert.equal(payload.products[0].brand, "Twins Special");
  assert.match(payload.products[0].name, /Twins Special/i);
});

test("catalog search matches exact product codes ahead of superstrings", async () => {
  const payload = await search("bgv1");
  assert.ok(payload.products.length > 0, "expected BGV1 search results");
  assert.match(payload.products[0].name, /BGV1/i);
  assert.doesNotMatch(payload.products[0].name, /BGV14/i);
});

test("catalog search matches SKU-only queries from the published catalog", async () => {
  const payload = await search("FTSA");
  assert.ok(payload.products.length > 0, "expected FTSA search results");
  assert.equal(payload.products[0].id, "official-boon-ftsa");
});

test("catalog search matches variant SKU queries", async () => {
  const payload = await search("fsgl10-49-white-blackS");
  assert.ok(payload.products.length > 0, "expected variant SKU search results");
  assert.equal(payload.products[0].id, "official-twins_special-fsgl10-49-white-blacks");
});

test("catalog search supports offset pagination for deep result sets", async () => {
  const firstPage = await searchPage("pads", "50", "0");
  const secondPage = await searchPage("pads", "50", "50");
  assert.ok(firstPage.total > 50, "expected pads search to span multiple pages");
  assert.equal(firstPage.products.length, 50);
  assert.ok(secondPage.products.length > 0, "expected more pads results after the first page");
  assert.notEqual(firstPage.products[0].id, secondPage.products[0].id);
});
