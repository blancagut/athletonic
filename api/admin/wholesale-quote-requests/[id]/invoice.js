"use strict";

const { handleError, json, methodNotAllowed, readJson, requireEnv } = require("../../../_lib/http");
const { requireSuperAdmin, logAudit } = require("../../../_lib/auth");
const { getSupabaseAdmin } = require("../../../_lib/supabase");
const { getParam } = require("../../../_lib/admin");
const { BANK_DETAILS } = require("../../../_lib/wholesale-order");
const { buildWholesaleOrderInvoicePdf, invoiceReference } = require("../../../_lib/wholesale-order-pdf");
const { sendWholesaleOrderBuyerEmail } = require("../../../_lib/email");

const DETAIL_SELECT = `
  id,
  name,
  company_name,
  email,
  whatsapp,
  country,
  notes,
  items,
  item_count,
  quantity_count,
  source_page,
  metadata,
  status,
  created_at,
  updated_at
`;

function validationError(message, code) {
  const error = new Error(message);
  error.statusCode = 400;
  error.code = code || "invalid_input";
  return error;
}

function requestQuery(req) {
  if (req.query && typeof req.query === "object") return req.query;
  try {
    return Object.fromEntries(new URL(req.url || "/", "https://athletonic.local").searchParams.entries());
  } catch {
    return {};
  }
}

function getSiteUrl(req) {
  const proto = String(req.headers["x-forwarded-proto"] || "https");
  const host = String(req.headers["x-forwarded-host"] || req.headers.host || "athletonic.com");
  return `${proto}://${host}`;
}

async function fetchQuoteRequest(supabase, id) {
  const { data, error } = await supabase
    .from("wholesale_quote_requests")
    .select(DETAIL_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    const notFound = new Error("Order not found.");
    notFound.statusCode = 404;
    notFound.code = "quote_request_not_found";
    throw notFound;
  }
  return data;
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    methodNotAllowed(res, ["POST"]);
    return;
  }

  try {
    requireEnv(["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "RESEND_API_KEY"]);
    const ctx = await requireSuperAdmin(req);
    const id = getParam(req, "id");
    if (!id) throw validationError("Missing order id.", "missing_id");

    const query = requestQuery(req);
    const body = await readJson(req).catch(() => ({}));
    const recipientEmail = String(
      body.recipient_email || body.recipientEmail || query.recipient_email || ""
    ).trim();

    const supabase = getSupabaseAdmin();
    const quoteRequest = await fetchQuoteRequest(supabase, id);
    const metadata = quoteRequest && quoteRequest.metadata && typeof quoteRequest.metadata === "object"
      ? quoteRequest.metadata
      : {};
    if (!["unit_order", "wholesale_order"].includes(metadata.request_type)) {
      throw validationError("This record does not contain an invoice-ready order.", "not_invoice_order");
    }

    const order = {
      id: quoteRequest.id,
      created_at: quoteRequest.created_at,
      name: quoteRequest.name,
      company_name: quoteRequest.company_name,
      email: recipientEmail || quoteRequest.email,
      whatsapp: quoteRequest.whatsapp,
      country: quoteRequest.country,
      notes: quoteRequest.notes,
      items: Array.isArray(quoteRequest.items) ? quoteRequest.items : [],
      item_count: quoteRequest.item_count,
      quantity_count: quoteRequest.quantity_count,
      estimated_total_cents: Number(metadata.estimated_total_cents) || 0,
      has_quote_only: Boolean(metadata.has_quote_only),
      payment_method: metadata.payment_method || "bank_transfer",
      payment_proof_storage: metadata.payment_proof || null,
      invoice_reference: metadata.invoice_reference || invoiceReference(quoteRequest.id),
      billing: metadata.billing && typeof metadata.billing === "object" ? metadata.billing : {},
      shipping: metadata.shipping && typeof metadata.shipping === "object" ? metadata.shipping : {},
    };

    if (!order.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(order.email)) {
      throw validationError("A valid recipient email is required.", "invalid_recipient_email");
    }

    const siteUrl = getSiteUrl(req);
    const invoicePdf = buildWholesaleOrderInvoicePdf({
      order,
      bankDetails: BANK_DETAILS,
      siteHost: siteUrl.replace(/^https?:\/\//, ""),
    });

    await sendWholesaleOrderBuyerEmail({
      order,
      bankDetails: BANK_DETAILS,
      siteUrl,
      invoicePdf,
    });

    await logAudit(ctx, "wholesale_quote_request.send_invoice", "wholesale_quote_request", id, {
      recipient_email: order.email,
      invoice_reference: order.invoice_reference,
    });

    json(res, 200, {
      ok: true,
      recipient_email: order.email,
      invoice_reference: order.invoice_reference,
    });
  } catch (error) {
    handleError(res, error);
  }
};
