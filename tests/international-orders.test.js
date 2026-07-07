const test = require("node:test");
const assert = require("node:assert/strict");

const {
  productLookupResponse,
  normalizeInternationalOrder,
} = require("../api/_lib/international-orders");

test("productLookupResponse exposes unique color options for Twins Special families", () => {
  const product = productLookupResponse("official-twins_special-twins-special-shinguards-sgl-10-blues");
  const labels = product.color_choices.map((choice) => choice.label);
  assert.ok(labels.includes("Blue"));
  assert.equal(new Set(labels).size, labels.length);
});

test("normalizeInternationalOrder keeps selected color notes when image is referential", () => {
  const product = productLookupResponse("official-twins_special-twins-special-shinguards-sgl-10-blues");
  const alternativeColor = product.color_choices.find((choice) => choice.label !== product.color_label);
  assert.ok(alternativeColor, "expected an alternate color choice");

  const order = normalizeInternationalOrder({
    name: "Jane Doe",
    email: "jane@example.com",
    phone: "+1 555 0000",
    country: "Chile",
    city: "Santiago",
    shipping_address: "123 Main St",
    items: [
      {
        product_id: product.id,
        variant_id: product.variant_choices[0].variant_id,
        color: alternativeColor.label,
        quantity: 2,
      },
    ],
  });

  assert.equal(order.items[0].quantity, 2);
  assert.equal(order.items[0].selected_options.Color, alternativeColor.label);
  assert.match(order.reference, /^AIO-[A-F0-9]{10}$/);
});
