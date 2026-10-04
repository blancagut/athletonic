const { getClientIp, getSiteUrl, handleError, json, readJson, requireEnv } = require("./http");
const { getSupabaseAdmin } = require("./supabase");
const { loadWholesaleCatalogManifest } = require("./wholesale-muay-thai");
const {
  BANK_DETAILS,
  normalizeOrderRequestBody,
  uploadPaymentProof,
} = require("./wholesale-order");
const {
  sendWholesaleOrderBuyerEmail,
  sendWholesaleOrderSalesEmail,
} = require("./email");
const { buildWholesaleOrderInvoicePdf, invoiceReference } = require("./wholesale-order-pdf");

const MAX_ORDER_JSON_BYTES = 6 * 1024 * 1024;

function uniqueEmails(values) {
  return [...new Set(
    values
      .map((value) => String(value || "").trim().toLowerCase())
      .filter((value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))
  )];
}

async function handleWholesaleOrderRequest(req, res) {
  try {
    requireEnv(["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]);
    const productsById = new Map(
      loadWholesaleCatalogManifest().products.map((product) => [String(product.id), product])
    );
    const rawBody = await readJson(req, MAX_ORDER_JSON_BYTES);
    const order = normalizeOrderRequestBody(rawBody, productsById);
    order.invoice_reference = invoiceReference(order.id);

    const supabase = getSupabaseAdmin();
    const proofStorage = await uploadPaymentProof(supabase, order.id, order.payment_proof);
    const metadata = {
      request_type: "unit_order",
      invoice_reference: order.invoice_reference,
      payment_method: order.payment_method,
      payment_status: "proof_uploaded",
      payment_proof: proofStorage,
      billing: order.billing,
      shipping: order.shipping,
      estimated_total_cents: order.estimated_total_cents,
      has_quote_only: order.has_quote_only,
      bank_details_revealed: true,
      client_ip: getClientIp(req),
      user_agent: String(req.headers["user-agent"] || "").slice(0, 500) || null,
    };

    const { data, error } = await supabase
      .from("wholesale_quote_requests")
      .insert({
        id: order.id,
        name: order.name,
        company_name: order.company_name,
        email: order.email,
        whatsapp: order.whatsapp,
        country: order.country,
        notes: order.notes,
        items: order.items,
        item_count: order.item_count,
        quantity_count: order.quantity_count,
        source_page: order.source_page,
        metadata,
        status: "new",
      })
      .select("id, created_at")
      .single();

    if (error) {
      error.statusCode = 500;
      throw error;
    }

    const savedOrder = {
      ...order,
      id: data.id,
      created_at: data.created_at,
      payment_proof_storage: proofStorage,
    };
    const siteUrl = getSiteUrl(req);
    const invoicePdf = buildWholesaleOrderInvoicePdf({
      order: savedOrder,
      bankDetails: BANK_DETAILS,
      siteHost: siteUrl.replace(/^https?:\/\//, ""),
    });
    const proofAttachment = {
      filename: proofStorage.filename,
      content: order.payment_proof.buffer.toString("base64"),
    };

    let buyerEmailSent = false;
    let salesEmailSent = false;
    const emailErrors = [];
    if (process.env.RESEND_API_KEY) {
      try {
        await sendWholesaleOrderBuyerEmail({
          order: savedOrder,
          bankDetails: BANK_DETAILS,
          siteUrl,
          invoicePdf,
        });
        buyerEmailSent = true;
      } catch (emailError) {
        emailErrors.push(emailError);
        console.warn("Wholesale order buyer email failed:", emailError);
      }

      const recipients = uniqueEmails([
        process.env.ATHLETONIC_SALES_EMAIL || "orders@athletonic.com",
        process.env.ATHLETONIC_SUPPORT_EMAIL,
      ]);
      if (recipients.length) {
        try {
          await sendWholesaleOrderSalesEmail({
            order: savedOrder,
            bankDetails: BANK_DETAILS,
            recipientEmail: recipients,
            siteUrl,
            invoicePdf,
            proofAttachment,
          });
          salesEmailSent = true;
        } catch (emailError) {
          emailErrors.push(emailError);
          console.warn("Wholesale order sales email failed:", emailError);
        }
      }
    } else {
      emailErrors.push(new Error("RESEND_API_KEY is not configured."));
    }

    if (!buyerEmailSent || !salesEmailSent) {
      console.error("Wholesale order saved but email delivery failed:", {
        request_id: savedOrder.id,
        invoice_reference: savedOrder.invoice_reference,
        buyer_email_sent: buyerEmailSent,
        sales_email_sent: salesEmailSent,
        errors: emailErrors.map((error) => error && (error.message || String(error))).filter(Boolean),
      });
      json(res, 502, {
        ok: false,
        error: "email_delivery_failed",
        message:
          "We received the order, but could not email the invoice. Contact orders@athletonic.com with this reference.",
        request_id: savedOrder.id,
        invoice_reference: savedOrder.invoice_reference,
        buyer_email_sent: buyerEmailSent,
        sales_email_sent: salesEmailSent,
      });
      return;
    }

    json(res, 201, {
      ok: true,
      request_id: savedOrder.id,
      invoice_reference: savedOrder.invoice_reference,
      buyer_email_sent: buyerEmailSent,
      sales_email_sent: salesEmailSent,
    });
  } catch (error) {
    handleError(res, error);
  }
}

module.exports = { handleWholesaleOrderRequest };
