"use strict";

const { getSiteUrl, handleError, json, methodNotAllowed, readJson } = require("./_lib/http");
const {
  BANK_DETAILS,
  normalizeInternationalOrder,
  productLookupResponse,
} = require("./_lib/international-orders");
const {
  sendInternationalOrderCustomerEmail,
  sendInternationalOrderSalesEmail,
} = require("./_lib/email");

const MAX_ORDER_BYTES = 6 * 1024 * 1024;

function uniqueEmails(values) {
  return [...new Set(
    values
      .map((value) => String(value || "").trim().toLowerCase())
      .filter((value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))
  )];
}

module.exports = async function handler(req, res) {
  if (req.method === "GET") {
    try {
      const params =
        req.query && typeof req.query === "object"
          ? req.query
          : Object.fromEntries(new URL(req.url, "http://localhost").searchParams);
      if (!params.product_id) {
        json(res, 400, { error: "missing_product_id", message: "Provide product_id." });
        return;
      }
      json(res, 200, { ok: true, product: productLookupResponse(params.product_id) });
    } catch (error) {
      handleError(res, error);
    }
    return;
  }

  if (req.method !== "POST") {
    methodNotAllowed(res, ["GET", "POST"]);
    return;
  }

  try {
    const body = await readJson(req, MAX_ORDER_BYTES);
    const order = normalizeInternationalOrder(body);
    const siteUrl = getSiteUrl(req);
    const salesRecipients = uniqueEmails([
      process.env.ATHLETONIC_SALES_EMAIL || "sales@athletonic.com",
      process.env.ATHLETONIC_SUPPORT_EMAIL,
    ]);

    if (!process.env.RESEND_API_KEY) {
      const error = new Error("Email service is not configured.");
      error.statusCode = 500;
      error.code = "missing_resend";
      throw error;
    }

    await sendInternationalOrderCustomerEmail({
      order,
      bankDetails: BANK_DETAILS,
      siteUrl,
    });

    if (!salesRecipients.length) {
      const error = new Error("Sales email is not configured.");
      error.statusCode = 500;
      error.code = "missing_sales_email";
      throw error;
    }

    await sendInternationalOrderSalesEmail({
      order,
      bankDetails: BANK_DETAILS,
      siteUrl,
      recipientEmail: salesRecipients,
    });

    json(res, 201, {
      ok: true,
      reference: order.reference,
      receipt_uploaded: order.receipt_uploaded,
      customer_email: order.customer.email,
    });
  } catch (error) {
    handleError(res, error);
  }
};
