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

function getSalesFromAddress() {
  return process.env.ATHLETONIC_SALES_FROM_EMAIL || "Athletonic Sales <sales@athletonic.com>";
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

function quoteItemWholesaleCents(item) {
  const value = Number(item && item.wholesale_price_cents);
  return Number.isInteger(value) && value > 0 ? value : null;
}

function quoteEstimatedTotalCents(items) {
  return (items || []).reduce((total, item) => {
    const unit = quoteItemWholesaleCents(item);
    const quantity = Math.max(1, Number(item.quantity) || 1);
    return unit ? total + unit * quantity : total;
  }, 0);
}

function wholesaleQuoteItemsHtml(items, isWholesale = true) {
  const unitLabel = isWholesale ? "Wholesale / unit" : "Unit price";
  return (items || [])
    .map((item) => {
      const options = Object.entries(item.selected_options || {})
        .map(([name, value]) => `<div style="margin:2px 0;"><strong>${escapeHtml(name)}:</strong> ${escapeHtml(value)}</div>`)
        .join("");
      const unit = quoteItemWholesaleCents(item);
      const quantity = Math.max(1, Number(item.quantity) || 1);
      const image = item.image_url
        ? `<img src="${escapeHtml(item.image_url)}" alt="${escapeHtml(item.name)}" width="96" style="display:block;width:96px;height:96px;object-fit:cover;border-radius:12px;border:1px solid #e2e8f0;" />`
        : `<div style="width:96px;height:96px;border-radius:12px;background:#f8fafc;border:1px solid #e2e8f0;color:#64748b;font-size:12px;display:flex;align-items:center;justify-content:center;text-align:center;padding:10px;box-sizing:border-box;">Athletonic</div>`;
      return `
        <tr>
          <td style="padding:18px 0;border-bottom:1px solid #e2e8f0;vertical-align:top;width:112px;">${image}</td>
          <td style="padding:18px 0;border-bottom:1px solid #e2e8f0;vertical-align:top;">
            <div style="font-size:17px;font-weight:700;color:#0f172a;">${escapeHtml(item.name)}</div>
            <div style="margin:4px 0 8px;color:#475569;font-size:14px;">${escapeHtml(item.brand || "")} · Qty ${quantity}</div>
            ${options || '<div style="color:#64748b;font-size:14px;">No size/color selected.</div>'}
          </td>
          <td style="padding:18px 0 18px 16px;border-bottom:1px solid #e2e8f0;vertical-align:top;text-align:right;white-space:nowrap;">
            <div style="font-size:14px;color:#475569;">${unit ? unitLabel : ""}</div>
            <div style="font-weight:700;color:#0f172a;">${unit ? escapeHtml(formatMoney(unit, "usd")) : "Quote only"}</div>
            ${
              unit
                ? `<div style="margin-top:10px;font-size:14px;color:#475569;">Line total</div><div style="font-weight:700;color:#0f172a;">${escapeHtml(formatMoney(unit * quantity, "usd"))}</div>`
                : ""
            }
          </td>
        </tr>
      `;
    })
    .join("");
}

function wholesaleQuoteItemsText(items) {
  return (items || []).map((item) => {
    const options = Object.entries(item.selected_options || {})
      .map(([name, value]) => `${name}: ${value}`)
      .join(" / ");
    const unit = quoteItemWholesaleCents(item);
    const quantity = Math.max(1, Number(item.quantity) || 1);
    const price = unit
      ? ` @ ${formatMoney(unit, "usd")}/unit (line total ${formatMoney(unit * quantity, "usd")})`
      : " (price on quote)";
    return `- ${item.brand || ""} ${item.name}${options ? ` [${options}]` : ""} x${quantity}${price}`;
  });
}

async function sendWholesaleQuoteRequestEmail({ request, recipientEmail, siteUrl, quotePdf, sourcePage, isWholesale = true }) {
  if (!recipientEmail) return null;

  const estimatedTotalCents = quoteEstimatedTotalCents(request.items);
  const inquirerLabel = request.company_name || request.name;

  const introHtml = isWholesale
    ? `
    <p style="margin:0 0 12px;font-size:16px;">
      <strong>${escapeHtml(request.company_name)}</strong> submitted a quote request from
      <strong>${escapeHtml(request.name)}</strong> (${escapeHtml(request.email)}).
    </p>
    <p style="margin:0 0 24px;color:#475569;font-size:15px;">
      WhatsApp: ${escapeHtml(request.whatsapp)} · Country: ${escapeHtml(request.country)}
    </p>
  `
    : `
    <p style="margin:0 0 12px;font-size:16px;">
      <strong>${escapeHtml(request.name)}</strong> (${escapeHtml(request.email)}) submitted an international order request.
    </p>
    <p style="margin:0 0 24px;color:#475569;font-size:15px;">
      WhatsApp: ${escapeHtml(request.whatsapp)} · Country: ${escapeHtml(request.country)}
    </p>
  `;
  const bodyHtml = `
    <table role="presentation" style="width:100%;border-collapse:collapse;margin:0 0 24px;">
      ${wholesaleQuoteItemsHtml(request.items, isWholesale)}
    </table>
    ${
      estimatedTotalCents
        ? `<p style="margin:0 0 20px;font-size:15px;"><strong>${isWholesale ? "Est. wholesale total:" : "Est. total:"}</strong> ${escapeHtml(
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
  `;
  const footerHtml = `
    <p style="margin:0;color:#475569;font-size:14px;">Request ID: ${escapeHtml(request.id)}</p>
  `;

  const textLines = [
    isWholesale ? "Athletonic wholesale quote request" : "Athletonic international order request",
    "",
    ...(isWholesale ? [`Company: ${request.company_name}`] : []),
    `Contact: ${request.name} <${request.email}>`,
    `WhatsApp: ${request.whatsapp}`,
    `Country: ${request.country}`,
    "",
    "Items:",
    ...wholesaleQuoteItemsText(request.items, isWholesale),
    estimatedTotalCents ? `${isWholesale ? "Est. wholesale total" : "Est. total"}: ${formatMoney(estimatedTotalCents, "usd")}` : null,
    request.notes ? "" : null,
    request.notes ? `Notes:\n${request.notes}` : null,
    "",
    `Request ID: ${request.id}`,
  ].filter((line) => line !== null);

  return sendEmail({
    to: recipientEmail,
    subject: isWholesale
      ? `Athletonic wholesale quote request from ${request.company_name}`
      : `Athletonic international order request from ${inquirerLabel}`,
    html: internationalEmailShell({
      siteUrl,
      eyebrow: isWholesale ? "Athletonic Wholesale" : "Athletonic International Orders",
      title: isWholesale ? "New wholesale inquiry" : "New international order request",
      introHtml,
      bodyHtml,
      footerHtml,
    }),
    text: textLines.join("\n"),
    ...(quotePdf && quotePdf.buffer
      ? { attachments: [{ filename: quotePdf.filename, content: quotePdf.buffer.toString("base64") }] }
      : {}),
  });
}

async function sendWholesaleQuoteBuyerEmail({ request, siteUrl, quotePdf, bankDetails, sourcePage, isWholesale = true }) {
  if (!request || !request.email) return null;

  const salesEmail = process.env.ATHLETONIC_SALES_EMAIL || "sales@athletonic.com";
  const catalogUrl = `${siteUrl}${sourcePage || "/catalog/wholesale-muay-thai"}`;
  const reference = quotePdf && quotePdf.reference ? quotePdf.reference : request.id;
  const estimatedTotalCents = quoteEstimatedTotalCents(request.items);
  const itemCount = request.items.length;
  const totalLabel = isWholesale ? "estimated wholesale total" : "estimated total";
  const confirmCopy = isWholesale ? "availability, MOQ, and shipping" : "availability and shipping";

  const introHtml = isWholesale
    ? `
    <p style="margin:0 0 12px;font-size:16px;">
      Hi ${escapeHtml(request.name)}, thank you for your wholesale inquiry from
      <strong>${escapeHtml(request.company_name)}</strong>.
    </p>
    <p style="margin:0 0 24px;font-size:16px;line-height:1.7;color:#475569;">
      Your quotation <strong>${escapeHtml(reference)}</strong> is attached as a PDF and detailed below. It covers
      ${escapeHtml(String(itemCount))} product line${itemCount === 1 ? "" : "s"}${
        estimatedTotalCents
          ? ` with an ${totalLabel} of <strong>${escapeHtml(formatMoney(estimatedTotalCents, "usd"))}</strong>`
          : ""
      }. This is a proforma, not a final invoice — our sales team will confirm ${confirmCopy} to
      ${escapeHtml(request.country)} before you pay.
    </p>
  `
    : `
    <p style="margin:0 0 12px;font-size:16px;">
      Hi ${escapeHtml(request.name)}, thank you for your Athletonic order request.
    </p>
    <p style="margin:0 0 24px;font-size:16px;line-height:1.7;color:#475569;">
      Your order confirmation <strong>${escapeHtml(reference)}</strong> is attached as a PDF and detailed below. It covers
      ${escapeHtml(String(itemCount))} product line${itemCount === 1 ? "" : "s"}${
        estimatedTotalCents
          ? ` with an ${totalLabel} of <strong>${escapeHtml(formatMoney(estimatedTotalCents, "usd"))}</strong>`
          : ""
      }. This is a proforma, not a final invoice — our sales team will confirm ${confirmCopy} to
      ${escapeHtml(request.country)} before you pay.
    </p>
  `;
  const bodyHtml = `
    <table role="presentation" style="width:100%;border-collapse:collapse;margin:0 0 24px;">
      ${wholesaleQuoteItemsHtml(request.items, isWholesale)}
    </table>
    ${
      estimatedTotalCents
        ? `<div style="margin:0 0 24px;padding:20px;border:1px solid #e2e8f0;border-radius:18px;background:#f8fafc;">
            <p style="margin:0;font-size:18px;font-weight:700;">${isWholesale ? "Estimated wholesale total" : "Estimated total"}: ${escapeHtml(
              formatMoney(estimatedTotalCents, "usd")
            )}</p>
          </div>`
        : ""
    }
    ${
      bankDetails
        ? `<div style="margin:0 0 24px;padding:24px;border-radius:20px;background:#fff7ed;border:1px solid #fdba74;">
            <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.16em;text-transform:uppercase;color:#9a3412;">Payment instructions</p>
            <p style="margin:0 0 14px;font-size:22px;font-weight:700;">ATHLETONIC LLC</p>
            <p style="margin:0 0 16px;font-size:16px;font-weight:700;">Datos para Transferencia Bancaria</p>
            ${bankDetailsHtml(bankDetails)}
            <p style="margin:16px 0 0;font-size:14px;color:#7c2d12;">${escapeHtml(WHOLESALE_PAYMENT_INSTRUCTIONS_NOTE)}</p>
          </div>`
        : ""
    }
    <p style="margin:0 0 16px;color:#475569;font-size:15px;line-height:1.7;">
      Our sales team will contact you shortly on WhatsApp (${escapeHtml(request.whatsapp)}) or by email to
      confirm ${confirmCopy} to ${escapeHtml(request.country)}. You can reach us any time at
      <a href="mailto:${escapeHtml(salesEmail)}" style="color:#0f172a;font-weight:bold;">${escapeHtml(salesEmail)}</a>.
    </p>
    <p style="margin:0 0 8px;">
      <a href="${escapeHtml(catalogUrl)}" style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:8px;">
        ${isWholesale ? "Browse the wholesale catalog" : "Browse the international orders catalog"}
      </a>
    </p>
  `;
  const footerHtml = `
    <p style="margin:0;color:#475569;font-size:14px;">
      Reference: ${escapeHtml(reference)} · ${escapeHtml(ATHLETONIC_OFFICE_ADDRESS_TEXT)}
    </p>
  `;

  const textLines = [
    isWholesale ? "Athletonic Wholesale" : "Athletonic International Orders",
    "",
    `Hi ${request.name},`,
    "",
    isWholesale
      ? `Thank you for your wholesale inquiry from ${request.company_name}.`
      : "Thank you for your Athletonic order request.",
    isWholesale
      ? `Your quotation ${reference} is attached as a PDF (${itemCount} product line${itemCount === 1 ? "" : "s"}).`
      : `Your order confirmation ${reference} is attached as a PDF (${itemCount} product line${itemCount === 1 ? "" : "s"}).`,
    `This is a proforma, not a final invoice — our sales team will confirm ${confirmCopy} before you pay.`,
    "",
    "Items:",
    ...wholesaleQuoteItemsText(request.items),
    estimatedTotalCents ? `${isWholesale ? "Estimated wholesale total" : "Estimated total"}: ${formatMoney(estimatedTotalCents, "usd")}` : null,
    bankDetails ? "" : null,
    bankDetails ? "Payment instructions (ATHLETONIC LLC):" : null,
    ...(bankDetails ? bankDetailsText(bankDetails) : []),
    bankDetails ? WHOLESALE_PAYMENT_INSTRUCTIONS_NOTE : null,
    "",
    `Our sales team will contact you shortly on WhatsApp (${request.whatsapp}) or by email to confirm ${confirmCopy} to ${request.country}.`,
    `Contact us: ${salesEmail}`,
    "",
    `Catalog: ${catalogUrl}`,
    `Reference: ${reference}`,
    ATHLETONIC_OFFICE_ADDRESS_TEXT,
  ].filter((line) => line !== null);

  return sendEmail({
    to: request.email,
    subject: isWholesale ? `Your Athletonic wholesale quotation ${reference}` : `Your Athletonic order confirmation ${reference}`,
    html: internationalEmailShell({
      siteUrl,
      eyebrow: isWholesale ? "Athletonic Wholesale" : "Athletonic International Orders",
      title: isWholesale ? "Your quotation is ready" : "Your order confirmation",
      introHtml,
      bodyHtml,
      footerHtml,
    }),
    text: textLines.join("\n"),
    replyTo: salesEmail,
    ...(quotePdf && quotePdf.buffer
      ? { attachments: [{ filename: quotePdf.filename, content: quotePdf.buffer.toString("base64") }] }
      : {}),
  });
}

function wholesaleOrderItemsHtml(order) {
  return order.items
    .map((item) => {
      const options =
        item.selected_options && Object.keys(item.selected_options).length
          ? Object.entries(item.selected_options)
              .map(([key, value]) => `${key}: ${value}`)
              .join(" / ")
          : "";
      const unit = itemUnitCents(item);
      const quantity = Math.max(1, Number(item.quantity) || 1);
      return `
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #e2e8f0;">
            <strong>${escapeHtml(item.name)}</strong>
            <div style="color:#64748b;font-size:14px;">${escapeHtml(item.brand || "Pending")} · Qty ${quantity}</div>
            ${options ? `<div style="color:#475569;font-size:13px;margin-top:4px;">${escapeHtml(options)}</div>` : ""}
            ${item.notes ? `<div style="color:#475569;font-size:13px;margin-top:4px;">${escapeHtml(item.notes)}</div>` : ""}
          </td>
          <td style="padding:10px 0 10px 16px;border-bottom:1px solid #e2e8f0;text-align:right;white-space:nowrap;">
            ${unit ? escapeHtml(formatMoney(unit * quantity, "usd")) : "Pending"}
          </td>
        </tr>
      `;
    })
    .join("");
}

function wholesaleOrderItemsText(order) {
  return order.items.map((item) => {
    const options =
      item.selected_options && Object.keys(item.selected_options).length
        ? ` (${Object.entries(item.selected_options)
            .map(([key, value]) => `${key}: ${value}`)
            .join(" / ")})`
        : "";
    const unit = itemUnitCents(item);
    const quantity = Math.max(1, Number(item.quantity) || 1);
    const total = unit ? ` - ${formatMoney(unit * quantity, "usd")}` : " - Pending";
    return `- ${item.brand || "Pending"} ${item.name}${options} x${quantity}${total}`;
  });
}

const WHOLESALE_PAYMENT_INSTRUCTIONS_NOTE =
  "Please use the banking information above for USD wire transfers and ACH payments. If you require an invoice or additional payment information, please contact Athletonic LLC before sending funds.";

function bankDetailsHtml(bankDetails) {
  return `
    <table style="width:100%;border-collapse:collapse;">
      <tr><td style="padding:4px 10px 4px 0;color:#64748b;">Company</td><td style="padding:4px 0;"><strong>${escapeHtml(bankDetails.company_name)}</strong></td></tr>
      <tr><td style="padding:4px 10px 4px 0;color:#64748b;">Account</td><td style="padding:4px 0;"><strong>${escapeHtml(bankDetails.account_number)}</strong></td></tr>
      <tr><td style="padding:4px 10px 4px 0;color:#64748b;">ACH / wire routing</td><td style="padding:4px 0;"><strong>${escapeHtml(bankDetails.routing_number)}</strong></td></tr>
      <tr><td style="padding:4px 10px 4px 0;color:#64748b;">SWIFT / BIC</td><td style="padding:4px 0;"><strong>${escapeHtml(bankDetails.swift_bic)}</strong></td></tr>
      <tr><td style="padding:4px 10px 4px 0;color:#64748b;">Bank</td><td style="padding:4px 0;"><strong>${escapeHtml(bankDetails.bank_name)}</strong></td></tr>
      <tr><td style="padding:4px 10px 4px 0;color:#64748b;vertical-align:top;">Bank address</td><td style="padding:4px 0;"><strong>${escapeHtml(bankDetails.bank_address).replaceAll("\n", "<br />")}</strong></td></tr>
      <tr><td style="padding:4px 10px 4px 0;color:#64748b;vertical-align:top;">Company address</td><td style="padding:4px 0;"><strong>${escapeHtml(bankDetails.company_address).replaceAll("\n", "<br />")}</strong></td></tr>
    </table>
  `;
}

function bankDetailsText(bankDetails) {
  return [
    `Company: ${bankDetails.company_name}`,
    `Account: ${bankDetails.account_number}`,
    `ACH / wire routing: ${bankDetails.routing_number}`,
    `SWIFT / BIC: ${bankDetails.swift_bic}`,
    `Receiving bank: ${bankDetails.bank_name}`,
    "Bank address:",
    bankDetails.bank_address,
    "Company address:",
    bankDetails.company_address,
  ];
}

function itemUnitCents(item) {
  const value = Number(item && (item.unit_price_cents || item.retail_price_cents));
  return Number.isInteger(value) && value > 0 ? value : null;
}

async function sendWholesaleOrderBuyerEmail({ order, bankDetails, siteUrl, invoicePdf }) {
  if (!order || !order.email) return null;

  const reference = order.invoice_reference || order.id;
  const totalText = order.estimated_total_cents
    ? formatMoney(order.estimated_total_cents, "usd")
    : "Pending";
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a;padding:24px;">
      <p style="margin:0 0 12px;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#64748b;">
        Athletonic
      </p>
      <h1 style="margin:0 0 16px;font-size:28px;line-height:1.2;">Your invoice is attached.</h1>
      <p style="margin:0 0 16px;">
        Hi ${escapeHtml(order.name)}, your Athletonic order <strong>${escapeHtml(reference)}</strong> for
        <strong>${escapeHtml(order.company_name)}</strong> is attached as a PDF invoice.
      </p>
      <table style="width:100%;border-collapse:collapse;margin:0 0 20px;">
        ${wholesaleOrderItemsHtml(order)}
      </table>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;padding:16px;margin:0 0 20px;">
        <p style="margin:0 0 8px;"><strong>Estimated total:</strong> ${escapeHtml(totalText)}</p>
        <p style="margin:0 0 10px;color:#475569;">Your payment proof was received and remains subject to bank reconciliation.</p>
        ${bankDetailsHtml(bankDetails)}
      </div>
      <p style="margin:0 0 16px;color:#475569;">
        Athletonic sales will confirm availability, freight, taxes, and any line marked as pending.
        You can reply to this email or write to
        <a href="mailto:sales@athletonic.com" style="color:#0f172a;font-weight:bold;">sales@athletonic.com</a>.
      </p>
      <p style="margin:0;color:#64748b;font-size:13px;">
        Reference: ${escapeHtml(reference)} · ${escapeHtml(siteUrl)}
      </p>
    </div>
  `;

  const text = [
    `Athletonic invoice ${reference}`,
    "",
    `Hi ${order.name}, your order for ${order.company_name} is attached as a PDF invoice.`,
    `Estimated total: ${totalText}`,
    "",
    "Items:",
    ...wholesaleOrderItemsText(order),
    "",
    "Payment details:",
    ...bankDetailsText(bankDetails),
    "",
    "Your payment proof was received and remains subject to bank reconciliation.",
    "Athletonic sales will confirm availability, freight, and taxes.",
    "Contact: sales@athletonic.com",
  ].join("\n");

  return sendEmail({
    from: getSalesFromAddress(),
    to: order.email,
    subject: `Athletonic Invoice ${reference}`,
    html,
    text,
    replyTo: process.env.ATHLETONIC_SALES_EMAIL || "sales@athletonic.com",
    ...(invoicePdf && invoicePdf.buffer
      ? { attachments: [{ filename: invoicePdf.filename, content: invoicePdf.buffer.toString("base64") }] }
      : {}),
  });
}

async function sendWholesaleOrderSalesEmail({
  order,
  bankDetails,
  recipientEmail,
  siteUrl,
  invoicePdf,
  proofAttachment,
}) {
  if (!recipientEmail) return null;

  const reference = order.invoice_reference || order.id;
  const adminUrl = `${siteUrl}/pages/admin/index.html#/wholesaleQuotes/${encodeURIComponent(order.id)}`;
  const totalText = order.estimated_total_cents
    ? formatMoney(order.estimated_total_cents, "usd")
    : "Pending";
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a;padding:24px;">
      <p style="margin:0 0 12px;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#64748b;">
        Athletonic order
      </p>
      <h1 style="margin:0 0 16px;font-size:28px;line-height:1.2;">New unit order with payment proof</h1>
      <p style="margin:0 0 12px;">
        <strong>${escapeHtml(reference)}</strong> was sent by
        <a href="mailto:${escapeHtml(order.email)}" style="color:#0f172a;font-weight:bold;">${escapeHtml(order.email)}</a>.
      </p>
      <p style="margin:0 0 18px;color:#475569;">
        Company: ${escapeHtml(order.company_name)} · WhatsApp: ${escapeHtml(order.whatsapp)} · Estimated total: ${escapeHtml(totalText)}
      </p>
      <table style="width:100%;border-collapse:collapse;margin:0 0 20px;">
        ${wholesaleOrderItemsHtml(order)}
      </table>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;padding:16px;margin:0 0 20px;">
        <p style="margin:0 0 8px;"><strong>Invoice:</strong> ${escapeHtml(reference)}</p>
        <p style="margin:0 0 8px;"><strong>Payment:</strong> ${escapeHtml(order.payment_method === "cash_deposit" ? "Cash deposit" : "Bank transfer")}</p>
        <p style="margin:0 0 8px;"><strong>Proof:</strong> ${escapeHtml(order.payment_proof_storage && order.payment_proof_storage.path ? order.payment_proof_storage.path : "attached")}</p>
        ${bankDetailsHtml(bankDetails)}
      </div>
      <p style="margin:0 0 24px;">
        <a href="${escapeHtml(adminUrl)}" style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:8px;">
          Open in admin
        </a>
      </p>
      <p style="margin:0;color:#475569;font-size:14px;">Request ID: ${escapeHtml(order.id)}</p>
    </div>
  `;

  const attachments = [];
  if (invoicePdf && invoicePdf.buffer) {
    attachments.push({ filename: invoicePdf.filename, content: invoicePdf.buffer.toString("base64") });
  }
  if (proofAttachment && proofAttachment.content) {
    attachments.push({ filename: proofAttachment.filename || `Comprobante-${reference}`, content: proofAttachment.content });
  }

  const text = [
    `New Athletonic order: ${reference}`,
    "",
    `Company: ${order.company_name}`,
    `Contact: ${order.name} <${order.email}>`,
    `WhatsApp: ${order.whatsapp}`,
    `Estimated total: ${totalText}`,
    `Payment: ${order.payment_method === "cash_deposit" ? "Cash deposit" : "Bank transfer"}`,
    "",
    "Items:",
    ...wholesaleOrderItemsText(order),
    "",
    `Admin: ${adminUrl}`,
    `Request ID: ${order.id}`,
  ].join("\n");

  return sendEmail({
    from: getSalesFromAddress(),
    to: recipientEmail,
    subject: `New Athletonic Order ${reference}`,
    html,
    text,
    replyTo: order.email,
    ...(attachments.length ? { attachments } : {}),
  });
}

function absoluteLogoUrl(siteUrl) {
  return `${String(siteUrl || "").replace(/\/$/, "")}/assets/logo.png`;
}

function moneyOrPending(cents, currency) {
  return Number.isInteger(cents) && cents > 0
    ? formatMoney(cents, currency)
    : "Price to be confirmed";
}

function customerMetaRows(order) {
  return [
    ["Customer", order.customer.name],
    ["Email", order.customer.email],
    ["WhatsApp / Phone", order.customer.phone],
    ["Country", order.customer.country],
    ["City", order.customer.city],
    ["Shipping address", order.customer.shipping_address],
    ["Notes", order.customer.notes || "None"],
  ];
}

function internationalEmailBankDetailsHtml(bankDetails) {
  return `
    <table role="presentation" style="width:100%;border-collapse:collapse;">
      <tr><td style="padding:0 0 8px;"><strong>Company name:</strong> ${escapeHtml(bankDetails.companyName)}</td></tr>
      <tr><td style="padding:0 0 8px;"><strong>Account number:</strong> ${escapeHtml(bankDetails.accountNumber)}</td></tr>
      <tr><td style="padding:0 0 8px;"><strong>Routing number (ACH and wire):</strong> ${escapeHtml(bankDetails.routingNumber)}</td></tr>
      <tr><td style="padding:0 0 8px;"><strong>SWIFT / BIC:</strong> ${escapeHtml(bankDetails.swiftBic)}</td></tr>
      <tr><td style="padding:0 0 8px;"><strong>Receiving bank:</strong> ${escapeHtml(bankDetails.bankName)}</td></tr>
      <tr><td style="padding:0 0 8px;"><strong>Bank address:</strong><br />${escapeHtml(bankDetails.bankAddress.join("\n")).replaceAll("\n", "<br />")}</td></tr>
      <tr><td style="padding:0;"><strong>Company address:</strong><br />${escapeHtml(bankDetails.companyAddress.join("\n")).replaceAll("\n", "<br />")}</td></tr>
    </table>
  `;
}

function internationalEmailBankDetailsText(bankDetails) {
  return [
    `Company name: ${bankDetails.companyName}`,
    `Account number: ${bankDetails.accountNumber}`,
    `Routing number (ACH and wire): ${bankDetails.routingNumber}`,
    `SWIFT / BIC: ${bankDetails.swiftBic}`,
    `Receiving bank: ${bankDetails.bankName}`,
    "Bank address:",
    ...bankDetails.bankAddress,
    "Company address:",
    ...bankDetails.companyAddress,
    "",
    bankDetails.paymentInstructions,
  ];
}

function internationalOrderItemsHtml(order) {
  return order.items
    .map((item) => {
      const options = Object.entries(item.selected_options || {})
        .map(([name, value]) => `<div style="margin:2px 0;"><strong>${escapeHtml(name)}:</strong> ${escapeHtml(value)}</div>`)
        .join("");
      const note = item.reference_image_note
        ? `<p style="margin:8px 0 0;color:#92400e;font-size:12px;">${escapeHtml(item.reference_image_note)}</p>`
        : "";
      const image = item.image_url
        ? `<img src="${escapeHtml(item.image_url)}" alt="${escapeHtml(item.name)}" width="96" style="display:block;width:96px;height:96px;object-fit:cover;border-radius:12px;border:1px solid #e2e8f0;" />`
        : `<div style="width:96px;height:96px;border-radius:12px;background:#f8fafc;border:1px solid #e2e8f0;color:#64748b;font-size:12px;display:flex;align-items:center;justify-content:center;text-align:center;padding:10px;box-sizing:border-box;">Athletonic</div>`;
      return `
        <tr>
          <td style="padding:18px 0;border-bottom:1px solid #e2e8f0;vertical-align:top;width:112px;">${image}</td>
          <td style="padding:18px 0;border-bottom:1px solid #e2e8f0;vertical-align:top;">
            <div style="font-size:18px;font-weight:700;color:#0f172a;">${escapeHtml(item.name)}</div>
            <div style="margin:4px 0 8px;color:#475569;font-size:14px;">${escapeHtml(item.brand)} · Qty ${escapeHtml(item.quantity)}</div>
            ${options || '<div style="color:#64748b;font-size:14px;">No variant details selected.</div>'}
            ${note}
          </td>
          <td style="padding:18px 0 18px 16px;border-bottom:1px solid #e2e8f0;vertical-align:top;text-align:right;white-space:nowrap;">
            <div style="font-size:14px;color:#475569;">Catalog price</div>
            <div style="font-weight:700;color:#0f172a;">${escapeHtml(moneyOrPending(item.unit_price_cents, item.currency))}</div>
            <div style="margin-top:10px;font-size:14px;color:#475569;">Estimated line subtotal</div>
            <div style="font-weight:700;color:#0f172a;">${escapeHtml(moneyOrPending(item.line_subtotal_cents, item.currency))}</div>
          </td>
        </tr>
      `;
    })
    .join("");
}

function internationalOrderItemsText(order) {
  return order.items.map((item) => {
    const options = Object.entries(item.selected_options || {})
      .map(([name, value]) => `${name}: ${value}`)
      .join(" / ");
    return [
      `- ${item.name} (${item.brand}) x${item.quantity}`,
      options ? `  ${options}` : null,
      item.reference_image_note ? `  ${item.reference_image_note}` : null,
      `  Catalog price: ${moneyOrPending(item.unit_price_cents, item.currency)}`,
      `  Estimated line subtotal: ${moneyOrPending(item.line_subtotal_cents, item.currency)}`,
    ]
      .filter(Boolean)
      .join("\n");
  });
}

function internationalEmailShell({ siteUrl, eyebrow, title, introHtml, bodyHtml, footerHtml }) {
  return `
    <div style="margin:0;padding:24px;background:#f3f4f6;font-family:Arial,sans-serif;color:#0f172a;">
      <table role="presentation" style="width:100%;max-width:760px;margin:0 auto;border-collapse:collapse;background:#ffffff;border-radius:24px;overflow:hidden;">
        <tr>
          <td style="padding:32px 32px 24px;background:linear-gradient(135deg,#0f172a 0%,#1f2937 100%);">
            <img src="${escapeHtml(absoluteLogoUrl(siteUrl))}" alt="Athletonic" width="164" style="display:block;width:164px;height:auto;" />
            <p style="margin:24px 0 8px;color:#cbd5e1;font-size:12px;letter-spacing:0.18em;text-transform:uppercase;">${escapeHtml(eyebrow)}</p>
            <h1 style="margin:0;color:#ffffff;font-size:30px;line-height:1.2;">${escapeHtml(title)}</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;">
            ${introHtml}
            ${bodyHtml}
            ${footerHtml}
          </td>
        </tr>
      </table>
    </div>
  `;
}

async function sendInternationalOrderCustomerEmail({ order, bankDetails, siteUrl }) {
  const receiptStatus = order.receipt_status || "not requested yet";
  const subject = "Athletonic International Order Request Received";
  const metaRows = customerMetaRows(order)
    .map(
      ([label, value]) => `
        <tr>
          <td style="padding:10px 12px;border:1px solid #e2e8f0;background:#f8fafc;font-weight:700;width:180px;">${escapeHtml(label)}</td>
          <td style="padding:10px 12px;border:1px solid #e2e8f0;">${escapeHtml(value)}</td>
        </tr>
      `
    )
    .join("");
  const introHtml = `
    <p style="margin:0 0 12px;font-size:16px;">Hello ${escapeHtml(order.customer.name)},</p>
    <p style="margin:0 0 24px;font-size:16px;line-height:1.7;">
      We received your Athletonic international order request and our team is reviewing it now.
      Your reference number is <strong>${escapeHtml(order.reference)}</strong>.
    </p>
    <p style="margin:0 0 24px;font-size:16px;line-height:1.7;color:#475569;">
      This is not a final invoice yet. Our team will review availability, shipping, customs and final cost before confirming your official quote.
    </p>
  `;
  const subtotalHtml = Number.isInteger(order.subtotal_cents)
    ? `<p style="margin:0;"><strong>Estimated product subtotal:</strong> ${escapeHtml(moneyOrPending(order.subtotal_cents, order.currency))}</p>`
    : `<p style="margin:0;"><strong>Estimated product subtotal:</strong> Price to be confirmed</p>`;
  const bodyHtml = `
    <table role="presentation" style="width:100%;border-collapse:collapse;margin:0 0 24px;">${metaRows}</table>
    <table role="presentation" style="width:100%;border-collapse:collapse;margin:0 0 24px;">
      ${internationalOrderItemsHtml(order)}
    </table>
    <div style="margin:0 0 24px;padding:20px;border:1px solid #e2e8f0;border-radius:18px;background:#f8fafc;">
      <p style="margin:0 0 10px;font-size:18px;font-weight:700;">Order summary</p>
      <p style="margin:0 0 8px;"><strong>Reference:</strong> ${escapeHtml(order.reference)}</p>
      <p style="margin:0 0 8px;"><strong>Receipt status:</strong> ${escapeHtml(receiptStatus)}</p>
      ${subtotalHtml}
      <p style="margin:10px 0 0;color:#475569;">Final quote pending manual review.</p>
    </div>
    <div style="margin:0 0 24px;padding:24px;border-radius:20px;background:#fff7ed;border:1px solid #fdba74;">
      <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.16em;text-transform:uppercase;color:#9a3412;">Payment details</p>
      <p style="margin:0 0 14px;font-size:22px;font-weight:700;">ATHLETONIC LLC</p>
      <p style="margin:0 0 16px;font-size:16px;font-weight:700;">Datos para Transferencia Bancaria</p>
      ${internationalEmailBankDetailsHtml(bankDetails)}
      <p style="margin:16px 0 0;font-size:14px;color:#7c2d12;">${escapeHtml(bankDetails.paymentInstructions)}</p>
    </div>
    <div style="margin:0 0 24px;padding:20px;border:1px solid #e2e8f0;border-radius:18px;background:#ffffff;">
      <p style="margin:0 0 12px;font-size:18px;font-weight:700;">Next step</p>
      <p style="margin:0;font-size:15px;line-height:1.7;">
        After sending payment, please reply to this email with your payment receipt or proof of transfer.
      </p>
    </div>
  `;
  const footerHtml = `
    <p style="margin:0;font-size:14px;color:#475569;">
      Athletonic Sales · <a href="mailto:sales@athletonic.com" style="color:#0f172a;">sales@athletonic.com</a> ·
      <a href="${escapeHtml(siteUrl)}/international_orders" style="color:#0f172a;">athletonic.com/international_orders</a>
    </p>
  `;
  const text = [
    "International Order Request Received",
    `Reference: ${order.reference}`,
    "",
    `Customer: ${order.customer.name}`,
    `Email: ${order.customer.email}`,
    `WhatsApp / Phone: ${order.customer.phone}`,
    `Country: ${order.customer.country}`,
    `City: ${order.customer.city}`,
    `Shipping address: ${order.customer.shipping_address}`,
    `Notes: ${order.customer.notes || "None"}`,
    "",
    "Products:",
    ...internationalOrderItemsText(order),
    "",
    `Receipt status: ${receiptStatus}`,
    `Estimated product subtotal: ${moneyOrPending(order.subtotal_cents, order.currency)}`,
    "Final quote pending manual review.",
    "This is not a final invoice yet. Our team will review availability, shipping, customs and final cost before confirming your official quote.",
    "",
    ...internationalEmailBankDetailsText(bankDetails),
    "",
    "After sending payment, please reply to this email with your payment receipt or proof of transfer.",
  ].join("\n");

  return sendEmail({
    to: order.customer.email,
    subject,
    html: internationalEmailShell({
      siteUrl,
      eyebrow: "Athletonic International Orders",
      title: "International Order Request Received",
      introHtml,
      bodyHtml,
      footerHtml,
    }),
    text,
    replyTo: "sales@athletonic.com",
  });
}

async function sendInternationalOrderSalesEmail({ order, bankDetails, siteUrl, recipientEmail }) {
  const receiptStatus = order.receipt_status || "not requested yet";
  const subject = "New International Quote Request";
  const customerDetails = customerMetaRows(order)
    .map(
      ([label, value]) => `
        <tr>
          <td style="padding:10px 12px;border:1px solid #e2e8f0;background:#f8fafc;font-weight:700;width:180px;">${escapeHtml(label)}</td>
          <td style="padding:10px 12px;border:1px solid #e2e8f0;">${escapeHtml(value)}</td>
        </tr>
      `
    )
    .join("");
  const introHtml = `
    <p style="margin:0 0 24px;font-size:16px;line-height:1.7;">
      A new international quote request has been submitted. Reference <strong>${escapeHtml(order.reference)}</strong>.
    </p>
  `;
  const salesSubtotalHtml = Number.isInteger(order.subtotal_cents)
    ? `<p style="margin:0 0 8px;"><strong>Estimated product subtotal:</strong> ${escapeHtml(moneyOrPending(order.subtotal_cents, order.currency))}</p>`
    : `<p style="margin:0 0 8px;"><strong>Estimated product subtotal:</strong> Price to be confirmed</p>`;
  const bodyHtml = `
    <table role="presentation" style="width:100%;border-collapse:collapse;margin:0 0 24px;">${customerDetails}</table>
    <table role="presentation" style="width:100%;border-collapse:collapse;margin:0 0 24px;">
      ${internationalOrderItemsHtml(order)}
    </table>
    <div style="margin:0 0 24px;padding:20px;border:1px solid #e2e8f0;border-radius:18px;background:#f8fafc;">
      <p style="margin:0 0 8px;"><strong>Receipt status:</strong> ${escapeHtml(receiptStatus)}</p>
      ${salesSubtotalHtml}
      <p style="margin:0;"><strong>Manual review required:</strong> confirm availability, shipping, customs/duties and final quote before asking customer to pay.</p>
    </div>
  `;
  const footerHtml = `
    <p style="margin:0;font-size:14px;color:#475569;">Reply directly to ${escapeHtml(order.customer.email)} to continue the payment follow-up.</p>
  `;
  const text = [
    "New International Quote Request",
    `Reference: ${order.reference}`,
    "",
    `Customer: ${order.customer.name} <${order.customer.email}>`,
    `WhatsApp / Phone: ${order.customer.phone}`,
    `Country: ${order.customer.country}`,
    `City: ${order.customer.city}`,
    `Shipping address: ${order.customer.shipping_address}`,
    `Notes: ${order.customer.notes || "None"}`,
    "",
    "Products:",
    ...internationalOrderItemsText(order),
    "",
    `Receipt status: ${receiptStatus}`,
    `Estimated product subtotal: ${moneyOrPending(order.subtotal_cents, order.currency)}`,
    "Manual review required: confirm availability, shipping, customs/duties and final quote before asking customer to pay.",
  ].join("\n");

  return sendEmail({
    from: getSalesFromAddress(),
    to: recipientEmail,
    subject,
    html: internationalEmailShell({
      siteUrl,
      eyebrow: "Athletonic Sales",
      title: "New International Quote Request",
      introHtml,
      bodyHtml,
      footerHtml,
    }),
    text,
    replyTo: order.customer.email,
  });
}

module.exports = {
  sendNewsletterWelcomeEmail,
  sendOrderConfirmationEmail,
  sendBankTransferOrderCustomerEmail,
  sendBankTransferOrderSalesEmail,
  sendInternationalOrderCustomerEmail,
  sendInternationalOrderSalesEmail,
  sendWholesaleApplicationDecisionEmail,
  sendWholesaleQuoteRequestEmail,
  sendWholesaleQuoteBuyerEmail,
  sendWholesaleOrderBuyerEmail,
  sendWholesaleOrderSalesEmail,
};
