const { getResend } = require("./resend");
const { ATHLETONIC_OFFICE_ADDRESS_TEXT } = require("./wholesale-applications");

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function formatMoney(cents, currency) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
  }).format((Number(cents) || 0) / 100);
}

function formatDate(value) {
  if (!value) return "Pending";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function textAddress(address) {
  if (!address) return "We are still finalizing your shipping details.";
  return [
    address.line1,
    address.line2,
    [address.city, address.state].filter(Boolean).join(", "),
    [address.postal_code, address.country].filter(Boolean).join(" "),
  ]
    .filter(Boolean)
    .join("\n");
}

function htmlAddress(address) {
  return escapeHtml(textAddress(address)).replaceAll("\n", "<br />");
}

function getFromAddress() {
  return process.env.RESEND_FROM_EMAIL || "Athletonic <onboarding@resend.dev>";
}

function getReplyToAddress() {
  return process.env.ATHLETONIC_SUPPORT_EMAIL || undefined;
}

async function sendEmail(message) {
  const resend = getResend();
  const payload = {
    from: getFromAddress(),
    ...message,
  };

  const replyTo = getReplyToAddress();
  if (replyTo && !payload.replyTo) payload.replyTo = replyTo;

  const { data, error } = await resend.emails.send(payload);
  if (error) {
    const sendError = new Error(error.message || "Unable to send email.");
    sendError.code = error.name || "email_send_failed";
    throw sendError;
  }

  return data;
}

async function sendNewsletterWelcomeEmail({ email, siteUrl }) {
  const subject = "Welcome to Athletonic Performance Club";
  const accountUrl = `${siteUrl}/pages/account.html`;
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a;padding:24px;">
      <p style="margin:0 0 12px;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#64748b;">
        Athletonic
      </p>
      <h1 style="margin:0 0 16px;font-size:28px;line-height:1.2;">You're on the list.</h1>
      <p style="margin:0 0 16px;">
        Thanks for joining Performance Club. We'll send product drops, private offers, and
        practical performance guidance to <strong>${escapeHtml(email)}</strong>.
      </p>
      <p style="margin:0 0 20px;">
        While you're here, you can explore the latest collection or manage your account any time.
      </p>
      <p style="margin:0 0 24px;">
        <a href="${escapeHtml(accountUrl)}" style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:999px;">
          Open your Athletonic account
        </a>
      </p>
      <p style="margin:0;color:#475569;font-size:14px;">
        If this wasn't you, you can safely ignore this email.
      </p>
    </div>
  `;
  const text = [
    "You're on the Athletonic Performance Club list.",
    "",
    `We will send product drops, private offers, and performance guidance to ${email}.`,
    "",
    `Account: ${accountUrl}`,
  ].join("\n");

  return sendEmail({
    to: email,
    subject,
    html,
    text,
  });
}

async function sendOrderConfirmationEmail({ order, siteUrl }) {
  const trackingUrl = `${siteUrl}/pages/order-tracking.html?email=${encodeURIComponent(
    order.customer_email
  )}&order_reference=${encodeURIComponent(order.order_reference)}`;
  const subject = `Athletonic order confirmed: ${order.order_reference}`;
  const itemsHtml = order.items
    .map(
      (item) => `
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #e2e8f0;">
            <strong>${escapeHtml(item.name)}</strong>${item.variant ? ` - ${escapeHtml(item.variant)}` : ""}
            <div style="color:#64748b;font-size:14px;">${escapeHtml(item.brand)} · Qty ${item.quantity}</div>
          </td>
          <td style="padding:10px 0 10px 16px;border-bottom:1px solid #e2e8f0;text-align:right;white-space:nowrap;">
            ${escapeHtml(formatMoney(item.line_subtotal_cents, item.currency))}
          </td>
        </tr>
      `
    )
    .join("");
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a;padding:24px;">
      <p style="margin:0 0 12px;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#64748b;">
        Athletonic order confirmed
      </p>
      <h1 style="margin:0 0 16px;font-size:28px;line-height:1.2;">Thanks for your order.</h1>
      <p style="margin:0 0 8px;">
        We've confirmed payment for <strong>${escapeHtml(order.order_reference)}</strong>.
      </p>
      <p style="margin:0 0 20px;color:#475569;">
        Placed ${escapeHtml(formatDate(order.timestamps.paid_at || order.timestamps.created_at))}
      </p>
      <table style="width:100%;border-collapse:collapse;margin:0 0 20px;">
        ${itemsHtml}
      </table>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:16px;padding:16px;margin:0 0 20px;">
        <p style="margin:0 0 8px;"><strong>Order total:</strong> ${escapeHtml(
          formatMoney(order.amounts.total_cents, order.currency)
        )}</p>
        <p style="margin:0 0 8px;"><strong>Shipping:</strong> ${escapeHtml(
          formatMoney(order.amounts.shipping_cents, order.currency)
        )}</p>
        <p style="margin:0;"><strong>Ship to:</strong><br />${htmlAddress(order.shipping_address)}</p>
      </div>
      <p style="margin:0 0 24px;">
        <a href="${escapeHtml(trackingUrl)}" style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:999px;">
          Track your order
        </a>
      </p>
      <p style="margin:0;color:#475569;font-size:14px;">
        Questions? Reply to this email and we'll help.
      </p>
    </div>
  `;
  const text = [
    `Athletonic order confirmed: ${order.order_reference}`,
    "",
    `Total: ${formatMoney(order.amounts.total_cents, order.currency)}`,
    `Shipping: ${formatMoney(order.amounts.shipping_cents, order.currency)}`,
    "",
    "Items:",
    ...order.items.map(
      (item) =>
        `- ${item.name}${item.variant ? ` - ${item.variant}` : ""} x${item.quantity} (${formatMoney(
          item.line_subtotal_cents,
          item.currency
        )})`
    ),
    "",
    "Ship to:",
    textAddress(order.shipping_address),
    "",
    `Track order: ${trackingUrl}`,
  ].join("\n");

  return sendEmail({
    to: order.customer_email,
    subject,
    html,
    text,
  });
}

function bankTransferInstructionLines(order, salesEmail) {
  const configured = String(
    process.env.ATHLETONIC_BANK_TRANSFER_INSTRUCTIONS || ""
  ).trim();
  if (configured) {
    return configured
      .split(/\r?\n/)
      .map((line) =>
        line
          .replaceAll("{order_reference}", order.order_reference)
          .replaceAll("{sales_email}", salesEmail)
      )
      .map((line) => line.trim())
      .filter(Boolean);
  }

  return [
    "Your Athletonic order has been received for final review.",
    "Shipping, duties, and local taxes vary by country in Latin America, so Athletonic sales will confirm the final cost before payment.",
    "Once the final cost is confirmed, we will send the Athletonic bank transfer details.",
    `Use ${order.order_reference} as the transfer memo or reference when payment is requested.`,
    `Reply to this email if your destination country or delivery details need to be updated. You can also contact ${salesEmail}.`,
  ];
}

function bankTransferItemsHtml(order) {
  return order.items
    .map(
      (item) => `
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #e2e8f0;">
            <strong>${escapeHtml(item.name)}</strong>${item.variant ? ` - ${escapeHtml(item.variant)}` : ""}
            <div style="color:#64748b;font-size:14px;">${escapeHtml(item.brand)} · Qty ${item.quantity}</div>
          </td>
          <td style="padding:10px 0 10px 16px;border-bottom:1px solid #e2e8f0;text-align:right;white-space:nowrap;">
            ${escapeHtml(formatMoney(item.line_subtotal_cents, item.currency))}
          </td>
        </tr>
      `
    )
    .join("");
}

function bankTransferItemsText(order) {
  return order.items.map(
    (item) =>
      `- ${item.name}${item.variant ? ` - ${item.variant}` : ""} x${item.quantity} (${formatMoney(
        item.line_subtotal_cents,
        item.currency
      )})`
  );
}

async function sendBankTransferOrderCustomerEmail({ order, siteUrl, salesEmail }) {
  const confirmationUrl = `${siteUrl}/pages/order-confirmation.html?transfer=1&order_reference=${encodeURIComponent(
    order.order_reference
  )}`;
  const trackingUrl = `${siteUrl}/pages/order-tracking.html?email=${encodeURIComponent(
    order.customer_email
  )}&order_reference=${encodeURIComponent(order.order_reference)}`;
  const subject = `Athletonic order received: ${order.order_reference}`;
  const instructions = bankTransferInstructionLines(order, salesEmail);
  const instructionsHtml = instructions
    .map((line) => `<li>${escapeHtml(line)}</li>`)
    .join("");
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a;padding:24px;">
      <p style="margin:0 0 12px;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#64748b;">
        Athletonic order received
      </p>
      <h1 style="margin:0 0 16px;font-size:28px;line-height:1.2;">Thanks for your order.</h1>
      <p style="margin:0 0 8px;">
        We received <strong>${escapeHtml(order.order_reference)}</strong> and sent it to Athletonic sales for final cost review.
      </p>
      <p style="margin:0 0 20px;color:#475569;">
        Placed ${escapeHtml(formatDate(order.timestamps.created_at))}
      </p>
      <table style="width:100%;border-collapse:collapse;margin:0 0 20px;">
        ${bankTransferItemsHtml(order)}
      </table>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:16px;padding:16px;margin:0 0 20px;">
        <p style="margin:0 0 8px;"><strong>Cart subtotal:</strong> ${escapeHtml(
          formatMoney(order.amounts.total_cents, order.currency)
        )}</p>
        <p style="margin:0 0 8px;"><strong>Payment method:</strong> Bank transfer to Athletonic after final cost confirmation</p>
        <ul style="margin:10px 0 0;padding-left:20px;color:#475569;">
          ${instructionsHtml}
        </ul>
      </div>
      <p style="margin:0 0 24px;">
        <a href="${escapeHtml(confirmationUrl)}" style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:8px;margin:0 8px 8px 0;">
          View order confirmation
        </a>
        <a href="${escapeHtml(trackingUrl)}" style="display:inline-block;background:#ffffff;color:#0f172a;text-decoration:none;padding:12px 18px;border-radius:8px;border:1px solid #cbd5e1;margin:0 0 8px 0;">
          Track order
        </a>
      </p>
      <p style="margin:0;color:#475569;font-size:14px;">
        Questions? Reply to this email or contact ${escapeHtml(salesEmail)}.
      </p>
    </div>
  `;
  const text = [
    `Athletonic order received: ${order.order_reference}`,
    "",
    `Cart subtotal: ${formatMoney(order.amounts.total_cents, order.currency)}`,
    "Payment method: Bank transfer to Athletonic after final cost confirmation",
    "",
    "Items:",
    ...bankTransferItemsText(order),
    "",
    "Next steps:",
    ...instructions,
    "",
    `Confirmation: ${confirmationUrl}`,
    `Track order: ${trackingUrl}`,
  ].join("\n");

  return sendEmail({
    to: order.customer_email,
    subject,
    html,
    text,
    replyTo: salesEmail,
  });
}

async function sendBankTransferOrderSalesEmail({ order, siteUrl, salesEmail }) {
  const adminUrl = order.id
    ? `${siteUrl}/pages/admin/index.html#/orders/${encodeURIComponent(order.id)}`
    : `${siteUrl}/pages/admin/index.html#/orders`;
  const subject = `New bank transfer order: ${order.order_reference}`;
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a;padding:24px;">
      <p style="margin:0 0 12px;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#64748b;">
        Athletonic sales order
      </p>
      <h1 style="margin:0 0 16px;font-size:28px;line-height:1.2;">New bank transfer order</h1>
      <p style="margin:0 0 8px;">
        <strong>${escapeHtml(order.order_reference)}</strong> was placed by
        <a href="mailto:${escapeHtml(order.customer_email)}" style="color:#0f172a;font-weight:bold;">${escapeHtml(order.customer_email)}</a>.
      </p>
      <p style="margin:0 0 20px;color:#475569;">
        Cart subtotal ${escapeHtml(formatMoney(order.amounts.total_cents, order.currency))} · ${escapeHtml(order.items.length)} line${order.items.length === 1 ? "" : "s"}
      </p>
      <table style="width:100%;border-collapse:collapse;margin:0 0 20px;">
        ${bankTransferItemsHtml(order)}
      </table>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:16px;padding:16px;margin:0 0 20px;">
        <p style="margin:0 0 8px;"><strong>Next step:</strong> confirm final cost with shipping, duties, and local taxes, then send Athletonic bank transfer details.</p>
        <p style="margin:0;"><strong>Reference:</strong> ${escapeHtml(order.order_reference)}</p>
      </div>
      <p style="margin:0 0 24px;">
        <a href="${escapeHtml(adminUrl)}" style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:8px;">
          Open order in admin
        </a>
      </p>
      <p style="margin:0;color:#475569;font-size:14px;">
        Sales inbox: ${escapeHtml(salesEmail)}
      </p>
    </div>
  `;
  const text = [
    `New bank transfer order: ${order.order_reference}`,
    "",
    `Customer: ${order.customer_email}`,
    `Cart subtotal: ${formatMoney(order.amounts.total_cents, order.currency)}`,
    "",
    "Items:",
    ...bankTransferItemsText(order),
    "",
    "Next step: confirm final cost with shipping, duties, and local taxes, then send Athletonic bank transfer details.",
    `Admin: ${adminUrl}`,
  ].join("\n");

  return sendEmail({
    to: salesEmail,
    subject,
    html,
    text,
    replyTo: order.customer_email,
  });
}

const WHOLESALE_PRODUCT_LABELS = {
  protein: "Protein",
  creatine: "Creatine",
  pre_workout: "Pre-workout",
  hydration: "Hydration",
  vitamins_wellness: "Vitamins & wellness",
  bars_shakes: "Bars & shakes",
  recovery_devices: "Recovery devices",
  apparel: "Apparel",
  footwear: "Footwear",
  accessories_gear: "Accessories & gear",
};

const WHOLESALE_EMAIL_LABELS = {
  years: {
    pre_launch: "Pre-launch",
    under_1_year: "Under 1 year",
    "1_2_years": "1 - 2 years",
    "3_5_years": "3 - 5 years",
    "6_10_years": "6 - 10 years",
    "10_plus_years": "10+ years",
  },
  budget: {
    under_1000: "Under $1,000",
    "1000_5000": "$1,000 - $5,000",
    "5000_15000": "$5,000 - $15,000",
    "15000_50000": "$15,000 - $50,000",
    "50000_plus": "$50,000+",
  },
  import: {
    none: "No import experience",
    domestic_only: "Domestic buying only",
    imported_before: "Imported goods before",
    currently_importing: "Currently importing goods",
  },
  channel: {
    retail_store: "Retail store",
    gym_members: "Gym members",
    online_store: "Online store",
    marketplace: "Marketplace",
    events: "Events or pop-ups",
    mixed: "Mixed channels",
    other: "Other",
  },
  reach: {
    under_100: "Under 100",
    "100_500": "100 - 500",
    "500_2500": "500 - 2,500",
    "2500_10000": "2,500 - 10,000",
    "10000_plus": "10,000+",
  },
  frequency: {
    one_time: "One-time opening order",
    monthly: "Monthly",
    twice_monthly: "Twice monthly",
    weekly: "Weekly",
    as_needed: "As needed",
  },
  fulfillment: {
    store_pick_pack: "Store pick & pack",
    warehouse: "Own warehouse",
    third_party_logistics: "3PL / fulfillment partner",
    dropship: "Dropship model",
    not_set: "Not set yet",
  },
};

function labelFrom(labels, value) {
  if (!value) return null;
  return labels[value] || String(value).replaceAll("_", " ");
}

function productSummary(products) {
  if (!Array.isArray(products) || products.length === 0) return null;
  return products.map((product) => WHOLESALE_PRODUCT_LABELS[product] || product).join(", ");
}

function wholesaleApplicationDetails(application) {
  const products = Array.isArray(application.desired_products)
    ? productSummary(application.desired_products)
    : "";
  return [
    ["Applicant", application.full_name],
    ["Business", application.company_name],
    ["Email", application.email],
    ["Phone", application.phone],
    ["Location", [application.city, application.region, application.country].filter(Boolean).join(", ")],
    ["Time in business", labelFrom(WHOLESALE_EMAIL_LABELS.years, application.years_in_business)],
    ["Products", products],
    ["Initial budget", labelFrom(WHOLESALE_EMAIL_LABELS.budget, application.investment_budget_usd)],
    ["Import experience", labelFrom(WHOLESALE_EMAIL_LABELS.import, application.import_experience)],
    ["Primary channel", labelFrom(WHOLESALE_EMAIL_LABELS.channel, application.sales_channel)],
    ["Customer reach", labelFrom(WHOLESALE_EMAIL_LABELS.reach, application.customer_reach)],
    ["Order frequency", labelFrom(WHOLESALE_EMAIL_LABELS.frequency, application.order_frequency)],
    ["Sales regions", application.sales_regions],
    ["Fulfillment", labelFrom(WHOLESALE_EMAIL_LABELS.fulfillment, application.fulfillment_setup)],
    ["Reseller/tax ID", application.reseller_or_tax_id],
  ]
    .map(
      ([label, value]) => `
        <tr>
          <td style="padding:6px 12px 6px 0;color:#64748b;font-size:13px;white-space:nowrap;">${escapeHtml(label)}</td>
          <td style="padding:6px 0;font-size:13px;"><strong>${escapeHtml(value || "Pending")}</strong></td>
        </tr>
      `
    )
    .join("");
}

async function sendWholesaleApplicationDecisionEmail({
  application,
  decision,
  decisionNotes,
  accessCode,
  siteUrl,
}) {
  const approved = decision === "approved";
  const accountUrl = `${siteUrl}/pages/login.html?return_to=${encodeURIComponent("/pages/account.html")}`;
  const logoUrl = `${siteUrl}/assets/logo.png`;
  const subject = approved
    ? "Athletonic wholesale application approved"
    : "Athletonic wholesale application update";
  const decisionCopy = approved
    ? "Your wholesale access has been approved."
    : "We are not able to approve wholesale access at this time.";
  const notesHtml = decisionNotes
    ? `<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:14px;margin:18px 0;"><strong>Review notes</strong><p style="margin:8px 0 0;">${escapeHtml(decisionNotes).replaceAll("\n", "<br />")}</p></div>`
    : "";
  const accessHtml = approved
    ? `
      <div style="background:#ecfdf3;border:1px solid #bbf7d0;border-radius:12px;padding:16px;margin:18px 0;">
        <p style="margin:0 0 8px;"><strong>Wholesale access is now connected to:</strong> ${escapeHtml(application.email)}</p>
        <p style="margin:0 0 10px;color:#475569;">Sign in or create an Athletonic account with this exact email. Wholesale pricing will apply automatically at checkout.</p>
        ${
          accessCode
            ? `<p style="margin:0;color:#475569;">Fallback guest access code: <strong style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;color:#0f172a;">${escapeHtml(accessCode)}</strong></p>`
            : `<p style="margin:0;color:#475569;">No code is required for signed-in checkout.</p>`
        }
      </div>
    `
    : "";

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a;padding:24px;">
      <div style="display:flex;align-items:center;gap:14px;margin:0 0 20px;">
        <img src="${escapeHtml(logoUrl)}" alt="Athletonic" width="72" height="48" style="display:block;object-fit:contain;" />
        <div>
          <p style="margin:0;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#64748b;">Athletonic Wholesale</p>
          <p style="margin:2px 0 0;color:#475569;font-size:13px;">${escapeHtml(ATHLETONIC_OFFICE_ADDRESS_TEXT)}</p>
        </div>
      </div>
      <h1 style="margin:0 0 14px;font-size:28px;line-height:1.2;">${escapeHtml(decisionCopy)}</h1>
      <p style="margin:0 0 16px;">
        Thank you for applying for Athletonic wholesale access for <strong>${escapeHtml(application.company_name)}</strong>.
      </p>
      <table style="width:100%;border-collapse:collapse;margin:0 0 14px;">
        ${wholesaleApplicationDetails(application)}
      </table>
      ${accessHtml}
      ${notesHtml}
      ${
        approved
          ? `<p style="margin:0 0 24px;"><a href="${escapeHtml(accountUrl)}" style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:8px;">Sign in to Athletonic</a></p>`
          : ""
      }
      <p style="margin:18px 0 0;color:#475569;font-size:14px;">
        Questions? Reply to this email and our team will help.
      </p>
      <p style="margin:14px 0 0;color:#64748b;font-size:12px;">
        Athletonic<br />${escapeHtml(ATHLETONIC_OFFICE_ADDRESS_TEXT)}
      </p>
    </div>
  `;

  const textLines = [
    approved
      ? "Athletonic wholesale application approved"
      : "Athletonic wholesale application update",
    "",
    decisionCopy,
    "",
    `Business: ${application.company_name}`,
    `Applicant: ${application.full_name}`,
    `Email: ${application.email}`,
    application.years_in_business
      ? `Time in business: ${labelFrom(WHOLESALE_EMAIL_LABELS.years, application.years_in_business)}`
      : null,
    productSummary(application.desired_products)
      ? `Products: ${productSummary(application.desired_products)}`
      : null,
    application.investment_budget_usd
      ? `Initial budget: ${labelFrom(WHOLESALE_EMAIL_LABELS.budget, application.investment_budget_usd)}`
      : null,
    application.import_experience
      ? `Import experience: ${labelFrom(WHOLESALE_EMAIL_LABELS.import, application.import_experience)}`
      : null,
    "",
  ].filter((line) => line !== null);
  if (approved) {
    textLines.push(
      "Sign in or create an Athletonic account with this exact email. Wholesale pricing will apply automatically at checkout.",
      `Account: ${accountUrl}`,
      accessCode ? `Fallback guest access code: ${accessCode}` : "No code is required for signed-in checkout.",
      ""
    );
  }
  if (decisionNotes) {
    textLines.push("Review notes:", decisionNotes, "");
  }
  textLines.push("Questions? Reply to this email.", "", `Athletonic - ${ATHLETONIC_OFFICE_ADDRESS_TEXT}`);

  return sendEmail({
    to: application.email,
    subject,
    html,
    text: textLines.join("\n"),
  });
}

async function sendWholesaleQuoteRequestEmail({ request, recipientEmail, siteUrl, quotePdf }) {
  if (!recipientEmail) return null;

  const quoteUrl = `${siteUrl}/catalog/wholesale-muay-thai`;
  const adminUrl = `${siteUrl}/pages/admin/index.html#/wholesaleQuotes/${encodeURIComponent(request.id)}`;
  const itemWholesaleCents = (item) => {
    const value = Number(item && item.wholesale_price_cents);
    return Number.isInteger(value) && value > 0 ? value : null;
  };
  const estimatedTotalCents = request.items.reduce((total, item) => {
    const unit = itemWholesaleCents(item);
    return unit ? total + unit * Math.max(1, Number(item.quantity) || 1) : total;
  }, 0);
  const itemsHtml = request.items
    .map(
      (item) => `
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #e2e8f0;">
            <strong>${escapeHtml(item.name)}</strong>
            <div style="color:#64748b;font-size:14px;">${escapeHtml(item.brand)} · Qty ${item.quantity}${
              itemWholesaleCents(item)
                ? ` · Wholesale ${escapeHtml(formatMoney(itemWholesaleCents(item), "usd"))}/unit`
                : " · Price on quote"
            }</div>
            ${
              item.selected_options && Object.keys(item.selected_options).length
                ? `<div style="color:#475569;font-size:13px;margin-top:4px;">${escapeHtml(
                    Object.entries(item.selected_options)
                      .map(([key, value]) => `${key}: ${value}`)
                      .join(" / ")
                  )}</div>`
                : ""
            }
          </td>
        </tr>
      `
    )
    .join("");

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a;padding:24px;">
      <p style="margin:0 0 12px;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#64748b;">
        Athletonic wholesale quote request
      </p>
      <h1 style="margin:0 0 16px;font-size:28px;line-height:1.2;">New wholesale inquiry</h1>
      <p style="margin:0 0 16px;">
        <strong>${escapeHtml(request.company_name)}</strong> submitted a quote request from
        <strong>${escapeHtml(request.name)}</strong> (${escapeHtml(request.email)}).
      </p>
      <p style="margin:0 0 12px;color:#475569;">
        WhatsApp: ${escapeHtml(request.whatsapp)}<br />
        Country: ${escapeHtml(request.country)}
      </p>
      <table style="width:100%;border-collapse:collapse;margin:0 0 20px;">
        ${itemsHtml}
      </table>
      ${
        estimatedTotalCents
          ? `<p style="margin:0 0 20px;font-size:15px;"><strong>Est. wholesale total:</strong> ${escapeHtml(
              formatMoney(estimatedTotalCents, "usd")
            )}</p>`
          : ""
      }
      ${
        request.notes
          ? `<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:16px;margin:0 0 20px;"><strong>Notes</strong><br />${escapeHtml(
              request.notes
            ).replaceAll("\n", "<br />")}</div>`
          : ""
      }
      <p style="margin:0 0 24px;">
        <a href="${escapeHtml(adminUrl)}" style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:8px;margin:0 8px 8px 0;">
          Open quote in admin
        </a>
        <a href="${escapeHtml(quoteUrl)}" style="display:inline-block;background:#ffffff;color:#0f172a;text-decoration:none;padding:12px 18px;border-radius:8px;border:1px solid #cbd5e1;margin:0 0 8px 0;">
          Open catalog
        </a>
      </p>
      <p style="margin:0;color:#475569;font-size:14px;">
        Request ID: ${escapeHtml(request.id)}
      </p>
    </div>
  `;

  const textLines = [
    "Athletonic wholesale quote request",
    "",
    `Company: ${request.company_name}`,
    `Contact: ${request.name} <${request.email}>`,
    `WhatsApp: ${request.whatsapp}`,
    `Country: ${request.country}`,
    "",
    "Items:",
    ...request.items.map((item) => {
      const options =
        item.selected_options && Object.keys(item.selected_options).length
          ? ` (${Object.entries(item.selected_options)
              .map(([key, value]) => `${key}: ${value}`)
              .join(" / ")})`
          : "";
      const unit = itemWholesaleCents(item);
      const price = unit ? ` @ ${formatMoney(unit, "usd")}/unit` : " (price on quote)";
      return `- ${item.brand} ${item.name}${options} x${item.quantity}${price}`;
    }),
    estimatedTotalCents ? `Est. wholesale total: ${formatMoney(estimatedTotalCents, "usd")}` : null,
    request.notes ? "" : null,
    request.notes ? `Notes:\n${request.notes}` : null,
    "",
    `Open in admin: ${adminUrl}`,
    `Open catalog: ${quoteUrl}`,
    `Request ID: ${request.id}`,
  ].filter((line) => line !== null);

  return sendEmail({
    to: recipientEmail,
    subject: `Athletonic wholesale quote request from ${request.company_name}`,
    html,
    text: textLines.join("\n"),
    ...(quotePdf && quotePdf.buffer
      ? { attachments: [{ filename: quotePdf.filename, content: quotePdf.buffer.toString("base64") }] }
      : {}),
  });
}

async function sendWholesaleQuoteBuyerEmail({ request, siteUrl, quotePdf }) {
  if (!request || !request.email) return null;

  const salesEmail = process.env.ATHLETONIC_SALES_EMAIL || "sales@athletonic.com";
  const catalogUrl = `${siteUrl}/catalog/wholesale-muay-thai`;
  const reference = quotePdf && quotePdf.reference ? quotePdf.reference : request.id;
  const itemWholesaleCents = (item) => {
    const value = Number(item && item.wholesale_price_cents);
    return Number.isInteger(value) && value > 0 ? value : null;
  };
  const estimatedTotalCents = request.items.reduce((total, item) => {
    const unit = itemWholesaleCents(item);
    return unit ? total + unit * Math.max(1, Number(item.quantity) || 1) : total;
  }, 0);

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a;padding:24px;">
      <p style="margin:0 0 12px;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#64748b;">
        Athletonic Wholesale
      </p>
      <h1 style="margin:0 0 16px;font-size:28px;line-height:1.2;">Your quotation is attached</h1>
      <p style="margin:0 0 16px;">
        Hi ${escapeHtml(request.name)}, thank you for your wholesale inquiry from
        <strong>${escapeHtml(request.company_name)}</strong>.
      </p>
      <p style="margin:0 0 16px;">
        Your quotation <strong>${escapeHtml(reference)}</strong> is attached as a PDF. It covers
        ${escapeHtml(request.items.length)} product line${request.items.length === 1 ? "" : "s"}${
          estimatedTotalCents
            ? ` with an estimated wholesale total of <strong>${escapeHtml(formatMoney(estimatedTotalCents, "usd"))}</strong>`
            : ""
        }.
      </p>
      <p style="margin:0 0 16px;color:#475569;">
        Our sales team will contact you shortly on WhatsApp (${escapeHtml(request.whatsapp)}) or by email to
        confirm availability, MOQ, and shipping to ${escapeHtml(request.country)}. You can reach us any time at
        <a href="mailto:${escapeHtml(salesEmail)}" style="color:#0f172a;font-weight:bold;">${escapeHtml(salesEmail)}</a>.
      </p>
      <p style="margin:0 0 24px;">
        <a href="${escapeHtml(catalogUrl)}" style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:8px;">
          Browse the wholesale catalog
        </a>
      </p>
      <p style="margin:0;color:#475569;font-size:14px;">
        Reference: ${escapeHtml(reference)} · ${escapeHtml(ATHLETONIC_OFFICE_ADDRESS_TEXT)}
      </p>
    </div>
  `;

  const textLines = [
    "Athletonic Wholesale",
    "",
    `Hi ${request.name},`,
    "",
    `Thank you for your wholesale inquiry from ${request.company_name}.`,
    `Your quotation ${reference} is attached as a PDF (${request.items.length} product line${request.items.length === 1 ? "" : "s"}).`,
    estimatedTotalCents ? `Estimated wholesale total: ${formatMoney(estimatedTotalCents, "usd")}` : null,
    "",
    `Our sales team will contact you shortly on WhatsApp (${request.whatsapp}) or by email to confirm availability, MOQ, and shipping to ${request.country}.`,
    `Contact us: ${salesEmail}`,
    "",
    `Catalog: ${catalogUrl}`,
    `Reference: ${reference}`,
    ATHLETONIC_OFFICE_ADDRESS_TEXT,
  ].filter((line) => line !== null);

  return sendEmail({
    to: request.email,
    subject: `Your Athletonic wholesale quotation ${reference}`,
    html,
    text: textLines.join("\n"),
    replyTo: salesEmail,
    ...(quotePdf && quotePdf.buffer
      ? { attachments: [{ filename: quotePdf.filename, content: quotePdf.buffer.toString("base64") }] }
      : {}),
  });
}

module.exports = {
  sendNewsletterWelcomeEmail,
  sendOrderConfirmationEmail,
  sendBankTransferOrderCustomerEmail,
  sendBankTransferOrderSalesEmail,
  sendWholesaleApplicationDecisionEmail,
  sendWholesaleQuoteRequestEmail,
  sendWholesaleQuoteBuyerEmail,
};
