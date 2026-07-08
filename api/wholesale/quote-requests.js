const { getSiteUrl, getClientIp, handleError, json, methodNotAllowed, readJson, requireEnv } = require("../_lib/http");
const { getSupabaseAdmin } = require("../_lib/supabase");
const {
  loadWholesaleCatalogManifest,
  normalizeQuoteRequestBody,
  sanitizeQuoteItem,
} = require("../_lib/wholesale-muay-thai");
const { loadSupplementsCatalogManifest } = require("../_lib/wholesale-supplements");
const { sendWholesaleQuoteRequestEmail, sendWholesaleQuoteBuyerEmail } = require("../_lib/email");
const { buildWholesaleQuotePdf } = require("../_lib/quote-pdf");
const { BANK_DETAILS } = require("../_lib/wholesale-order");
const { handleWholesaleOrderRequest } = require("../_lib/wholesale-order-handler");
const { detectTwinsBundles } = require("../_lib/twins-bundles");

function requestQuery(req) {
  if (req.query && typeof req.query === "object") return req.query;
  try {
    return Object.fromEntries(new URL(req.url || "/", "https://athletonic.local").searchParams.entries());
  } catch {
    return {};
  }
}

function normalizeSelectedOptions(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out = {};
  for (const [key, rawValue] of Object.entries(value)) {
    const cleanKey = String(key || "").trim();
    const cleanValue = String(rawValue || "").trim();
    if (cleanKey && cleanValue) {
      out[cleanKey] = cleanValue;
    }
  }
  return out;
}

const FREEFORM_OPTION_KEYS = new Set(["color note", "notes"]);

function validateSelectedOptions(product, selectedOptions) {
  const clean = normalizeSelectedOptions(selectedOptions);
  if (!Object.keys(clean).length) return clean;

  const allowedValues = new Set([
    ...(Array.isArray(product.sizes) ? product.sizes : []),
    ...(Array.isArray(product.colors) ? product.colors : []),
    ...(Array.isArray(product.other_options) ? product.other_options : []),
  ].map((value) => String(value).toLowerCase()));

  for (const [key, value] of Object.entries(clean)) {
    if (FREEFORM_OPTION_KEYS.has(String(key).trim().toLowerCase())) continue;
    if (allowedValues.size > 0 && !allowedValues.has(String(value).toLowerCase())) {
      const error = new Error("Selected size or color is not available for one of the products.");
      error.statusCode = 400;
      error.code = "invalid_selected_options";
      throw error;
    }
  }

  return clean;
}

function isInternationalRetailRequest(rawBody, sourcePage) {
  const explicitMode = String((rawBody && (rawBody.order_mode || rawBody.orderMode)) || "").trim().toLowerCase();
  if (explicitMode === "international_retail") return true;
  return /\/catalog\/international_orders_martial_arts/i.test(String(sourcePage || ""));
}

function sumQuantities(items) {
  return items.reduce((total, item) => total + Number(item.quantity || 0), 0);
}

function uniqueEmails(values) {
  return [...new Set(
    values
      .map((value) => String(value || "").trim().toLowerCase())
      .filter((value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))
  )];
}

async function getSuperAdminNotificationEmails(supabase) {
  const { data, error } = await supabase
    .from("profiles")
    .select("email")
    .eq("role", "super_admin");
  if (error) {
    console.warn("Could not load super admin notification recipients:", error);
    return [];
  }
  return uniqueEmails((data || []).map((row) => row.email));
}

module.exports = async function handler(req, res) {
  const query = requestQuery(req);

  if (req.method === "GET" && String(query.bank_details || "") === "1") {
    json(res, 200, { bank_details: BANK_DETAILS });
    return;
  }

  if (req.method === "GET" && query.status_id) {
    try {
      requireEnv(["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]);
      const statusId = String(query.status_id || "").trim();
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(statusId)) {
        json(res, 400, { error: "invalid_reference", message: "Enter a valid order reference." });
        return;
      }
      const supabase = getSupabaseAdmin();
      const { data: request, error } = await supabase
        .from("wholesale_quote_requests")
        .select("id, status, created_at, updated_at, item_count, quantity_count, items, metadata")
        .eq("id", statusId)
        .maybeSingle();
      if (error) {
        error.statusCode = 500;
        throw error;
      }
      if (!request || request.status === "spam") {
        json(res, 404, { error: "not_found", message: "We could not find an order with that reference." });
        return;
      }
      const items = Array.isArray(request.items) ? request.items : [];
      json(res, 200, {
        ok: true,
        order: {
          id: request.id,
          status: request.status,
          created_at: request.created_at,
          updated_at: request.updated_at,
          item_count: request.item_count,
          quantity_count: request.quantity_count,
          order_mode: (request.metadata && request.metadata.order_mode) || "wholesale",
          items: items.map((item) => ({
            name: item.name,
            brand: item.brand,
            quantity: item.quantity,
            image_url: item.image_url || null,
            selected_options: item.selected_options || {},
          })),
        },
      });
    } catch (error) {
      handleError(res, error);
    }
    return;
  }

  if (req.method !== "POST") {
    methodNotAllowed(res, ["GET", "POST"]);
    return;
  }

  if (String(query.order || "") === "1" || String(req.headers["x-athletonic-order-request"] || "") === "1") {
    await handleWholesaleOrderRequest(req, res);
    return;
  }

  try {
    requireEnv(["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]);
    const manifest = loadWholesaleCatalogManifest();
    const supplementsManifest = loadSupplementsCatalogManifest();
    const rawBody = await readJson(req);
    const sourcePage = String(
      rawBody.source_page ||
        rawBody.sourcePage ||
        req.headers.referer ||
        req.headers["x-forwarded-referer"] ||
        "/catalog/wholesale-muay-thai"
    ).slice(0, 300);
    const isInternationalRetail = isInternationalRetailRequest(rawBody, sourcePage);
    const body = normalizeQuoteRequestBody(rawBody, { requireCompany: !isInternationalRetail });
    const productsById = new Map(
      [...manifest.products, ...supplementsManifest.products].map((product) => [String(product.id), product])
    );
    const items = body.items.map((rawItem) => {
      const productId = String(rawItem.product_id || rawItem.id || "").trim();
      if (!productId) {
        const error = new Error("Each quote item must include a product ID.");
        error.statusCode = 400;
        error.code = "missing_product_id";
        throw error;
      }

      const product = productsById.get(productId);
      if (!product) {
        const error = new Error("One of the requested products is not available in the wholesale catalog.");
        error.statusCode = 400;
        error.code = "unknown_product";
        throw error;
      }

      const quantity = Number.parseInt(rawItem.quantity, 10);
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 999) {
        const error = new Error("Enter a valid quantity for each product.");
        error.statusCode = 400;
        error.code = "invalid_quantity";
        throw error;
      }

      const selectedOptions = validateSelectedOptions(product, rawItem.selected_options);
      return sanitizeQuoteItem(
        { ...rawItem, quantity, selected_options: selectedOptions },
        product,
        { noDiscount: isInternationalRetail }
      );
    });

    const itemCount = items.length;
    const quantityCount = sumQuantities(items);
    if (itemCount < 1 || quantityCount < 1) {
      const error = new Error("Add at least one product to your quote request.");
      error.statusCode = 400;
      error.code = "empty_items";
      throw error;
    }

    // Silent bundle pricing (international retail only): the system recognizes
    // qualifying Twins combinations and applies the fixed bundle price.
    const bundleInfo = isInternationalRetail ? detectTwinsBundles(items) : { discount_cents: 0, bundles: {} };
    const bundleDiscountCents = bundleInfo.discount_cents || 0;

    const supabase = getSupabaseAdmin();
    const metadata = {
      client_ip: getClientIp(req),
      user_agent: String(req.headers["user-agent"] || "").slice(0, 500) || null,
      source_page: sourcePage,
      catalog_generated_at: manifest.generated_at,
      order_mode: isInternationalRetail ? "international_retail" : "wholesale",
      ...(bundleDiscountCents > 0
        ? { bundle_discount_cents: bundleDiscountCents, bundles: bundleInfo.bundles }
        : {}),
    };

    const { data: quoteRequest, error } = await supabase
      .from("wholesale_quote_requests")
      .insert({
        name: body.name,
        company_name: body.company_name,
        email: body.email,
        whatsapp: body.whatsapp,
        country: body.country,
        notes: body.notes,
        items,
        item_count: itemCount,
        quantity_count: quantityCount,
        source_page: sourcePage,
        metadata,
        status: "new",
      })
      .select("id, created_at")
      .single();

    if (error) {
      error.statusCode = 500;
      throw error;
    }

    const salesEmail = process.env.ATHLETONIC_SALES_EMAIL || "orders@athletonic.com";
    const recipientEmails = uniqueEmails([
      ...(await getSuperAdminNotificationEmails(supabase)),
      process.env.ATHLETONIC_SUPPORT_EMAIL,
      salesEmail,
    ]);

    const isWholesale = !isInternationalRetail;

    let quotePdf = null;
    try {
      quotePdf = await buildWholesaleQuotePdf({
        request: { id: quoteRequest.id, created_at: quoteRequest.created_at, ...body, items, bundle_discount_cents: bundleDiscountCents },
        supportEmail: salesEmail,
        siteHost: getSiteUrl(req).replace(/^https?:\/\//, ""),
        isWholesale,
        bankDetails: BANK_DETAILS,
      });
    } catch (pdfError) {
      console.warn("Wholesale quotation PDF generation failed:", pdfError);
    }

    let buyerConfirmationSent = false;
    if (process.env.RESEND_API_KEY) {
      try {
        await sendWholesaleQuoteBuyerEmail({
          request: { id: quoteRequest.id, ...body, items, bundle_discount_cents: bundleDiscountCents },
          siteUrl: getSiteUrl(req),
          quotePdf,
          bankDetails: BANK_DETAILS,
          sourcePage,
          isWholesale,
        });
        buyerConfirmationSent = true;
      } catch (emailError) {
        console.warn("Wholesale buyer quotation email failed:", emailError);
      }
    }

    let notificationSent = false;
    if (recipientEmails.length && process.env.RESEND_API_KEY) {
      try {
        await sendWholesaleQuoteRequestEmail({
          request: {
            id: quoteRequest.id,
            ...body,
            items,
            bundle_discount_cents: bundleDiscountCents,
          },
          recipientEmail: recipientEmails,
          siteUrl: getSiteUrl(req),
          quotePdf,
          sourcePage,
          isWholesale,
        });
        notificationSent = true;
      } catch (emailError) {
        console.warn("Wholesale quote notification email failed:", emailError);
      }
    }

    json(res, 201, {
      ok: true,
      request_id: quoteRequest.id,
      created_at: quoteRequest.created_at,
      notification_sent: notificationSent,
      buyer_confirmation_sent: buyerConfirmationSent,
    });
  } catch (error) {
    handleError(res, error);
  }
};
