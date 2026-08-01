const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");

test("landing HTML starts with authoritative prices and no legacy runtimes", () => {
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");

  assert.doesNotMatch(
    html,
    /home-featured-order|live-home-offer-pricing|home-boon-featured|home-protection-featured/
  );
  assert.match(html, /assets\/cart\.js\?v=20260730-controls-1/);
  assert.match(html, /Twins Special Fancy Boxing Gloves FBGVL4-66/);
  assert.match(html, /BGBK Bag Gloves, Black/);
  assert.match(html, /Aquila Muay Thai Shorts - Volcano/);
  assert.match(
    html,
    /official-raja-raja-boxing-gloves-rbgv-1-black[\s\S]*?\$99\.00[\s\S]*?\$49\.50/
  );
  assert.doesNotMatch(
    html,
    /official-raja-raja-boxing-gloves-rbgv-1-black[\s\S]{0,500}\$(?:79\.00|49\.00)/
  );
  assert.match(html, /FREE<\/span> Mexico shipping from <strong>\$99<\/strong>/);
  assert.doesNotMatch(html, /ship-rotator ship-rotator-duo/);
  assert.match(
    html,
    /official-boon-bgsbk[\s\S]*?\$129\.00[\s\S]*?\$103\.20/
  );
});

test("landing preserves catalog while enabling existing locale and currency controls", () => {
  const cart = fs.readFileSync(path.join(ROOT, "assets/cart.js"), "utf8");
  const homeGuard =
    /if \(document\.body\?\.classList\.contains\("home-body"\)\) return;/g;
  assert.equal(
    [...cart.matchAll(homeGuard)].length,
    2,
    "only catalog replacement and generated deal chips stay disabled on home"
  );
  assert.match(cart, /assets\/i18n\.js/);
  assert.match(cart, /assets\/currency\.js/);

  const i18n = fs.readFileSync(path.join(ROOT, "assets/i18n.js"), "utf8");
  const currency = fs.readFileSync(path.join(ROOT, "assets/currency.js"), "utf8");
  assert.match(i18n, /data-locale-bound/);
  assert.match(currency, /data-currency-bound/);
});
