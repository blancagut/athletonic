// Wholesale applications view (super_admin only): review, approve, reject, and email decisions.
import { escapeHtml, formatDate, toast } from "../admin-core.js?v=20260623-magic-link";
import { listView, openModal } from "./_ui.js";

const STATUSES = [
  { value: "pending", label: "Pending" },
  { value: "under_review", label: "Under review" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
];

const STATUS_LABELS = Object.fromEntries(STATUSES.map((status) => [status.value, status.label]));

const TYPE_LABELS = {
  retail_store: "Retail store",
  gym_studio: "Gym or studio",
  coach_team: "Coach or team",
  distributor: "Distributor",
  corporate_wellness: "Corporate wellness",
  other: "Other",
};

const YEARS_LABELS = {
  pre_launch: "Pre-launch",
  under_1_year: "Under 1 year",
  "1_2_years": "1 - 2 años",
  "3_5_years": "3 - 5 años",
  "6_10_years": "6 - 10 años",
  "10_plus_years": "10+ años",
};

const PRODUCT_LABELS = {
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

const BUDGET_LABELS = {
  under_1000: "Under $1,000",
  "1000_5000": "$1,000 - $5,000",
  "5000_15000": "$5,000 - $15,000",
  "15000_50000": "$15,000 - $50,000",
  "50000_plus": "$50,000+",
};

const IMPORT_LABELS = {
  none: "No import experience",
  domestic_only: "Solo compras domésticas",
  imported_before: "Ya importó antes",
  currently_importing: "Importa actualmente",
};

const CHANNEL_LABELS = {
  retail_store: "Retail store",
  gym_members: "Miembros de gimnasio",
  online_store: "Online store",
  marketplace: "Marketplace",
  events: "Events or pop-ups",
  mixed: "Mixed channels",
  other: "Other",
};

const REACH_LABELS = {
  under_100: "Under 100",
  "100_500": "100 - 500",
  "500_2500": "500 - 2,500",
  "2500_10000": "2,500 - 10,000",
  "10000_plus": "10,000+",
};

const FREQUENCY_LABELS = {
  one_time: "One-time opening order",
  monthly: "Monthly",
  twice_monthly: "Dos veces al mes",
  weekly: "Weekly",
  as_needed: "As needed",
};

const FULFILLMENT_LABELS = {
  store_pick_pack: "Pick & pack en tienda",
  warehouse: "Own warehouse",
  third_party_logistics: "3PL / fulfillment partner",
  dropship: "Dropship",
  not_set: "Not set yet",
};

function typeLabel(value) {
  return TYPE_LABELS[value] || TYPE_LABELS.other;
}

function labelFrom(labels, value) {
  return labels[value] || value || "—";
}

function productList(products) {
  if (!Array.isArray(products) || products.length === 0) return "—";
  return products.map((product) => PRODUCT_LABELS[product] || product).join(", ");
}

function estadoBadge(status) {
  const value = String(status || "");
  return `<span class="admin-badge s-${escapeHtml(value)}">${escapeHtml(STATUS_LABELS[value] || value || "—")}</span>`;
}

function paragraph(value) {
  return escapeHtml(value || "—").replaceAll("\n", "<br />");
}

function addressBlock(app) {
  return [
    app.address_line1,
    app.address_line2,
    [app.city, app.region, app.postal_code].filter(Boolean).join(", "),
    app.country,
  ]
    .filter(Boolean)
    .map(escapeHtml)
    .join("<br />") || "—";
}

async function submitDecision(app, application, action, reload, modal) {
  const notesEl = modal.body.querySelector("[name='decision_notes']");
  const profileEl = modal.body.querySelector("[name='profile']");
  const statusEl = modal.body.querySelector("[data-review-status]");
  const button = modal.body.querySelector(`[data-action='${action}']`);
  const decisionNotes = notesEl ? notesEl.value.trim() : "";
  const profile = profileEl ? profileEl.value.trim() : "wholesale";

  if (action === "reject" && !decisionNotes) {
    toast("Add decision notes before rejecting", "error");
    if (notesEl) notesEl.focus();
    return;
  }

  const label = action === "approve" ? "approval" : action === "reject" ? "rejection" : "review";
  if (action !== "under_review" && !window.confirm(`¿Enviar email de ${label} a ${application.email}?`)) return;

  try {
    if (button) button.disabled = true;
    if (statusEl) statusEl.textContent = action === "under_review" ? "Guardando..." : "Enviando email...";
    const result = await app.authFetch(`/api/admin/wholesale-applications/${application.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        action,
        decision_notes: decisionNotes,
        profile,
      }),
    });
    toast(
      action === "approve"
        ? "Application approved and email sent"
        : action === "reject"
          ? "Application rejected and email sent"
          : "Application marked under review",
      "success"
    );
    if (statusEl) statusEl.textContent = result.email_sent ? "Decision email sent." : "Saved.";
    modal.close();
    reload();
  } catch (err) {
    toast(err.message || "Could not complete the review", "error");
    if (statusEl) statusEl.textContent = err.message || "Could not complete the review.";
    if (button) button.disabled = false;
  }
}

async function openApplication(app, row, reload) {
  const result = await app.authFetch(`/api/admin/wholesale-applications/${row.id}`);
  const application = result.application;
  const final = ["approved", "rejected"].includes(application.status);

  const modal = openModal(`Solicitud de mayoreo: ${application.company_name}`, `
    <div class="admin-detail-grid">
      <div>
        <dl class="admin-kv">
          <dt>Status</dt><dd>${estadoBadge(application.status)}</dd>
          <dt>Applicant</dt><dd>${escapeHtml(application.full_name)}</dd>
          <dt>Email</dt><dd>${escapeHtml(application.email)}</dd>
          <dt>Business</dt><dd>${escapeHtml(application.company_name)}</dd>
          <dt>Type</dt><dd>${escapeHtml(typeLabel(application.business_type))}</dd>
          <dt>Years operating</dt><dd>${escapeHtml(labelFrom(YEARS_LABELS, application.years_in_business))}</dd>
          <dt>Phone</dt><dd>${escapeHtml(application.phone)}</dd>
          <dt>Website</dt><dd>${application.website_url ? `<a class="admin-link" href="${escapeHtml(application.website_url)}" target="_blank" rel="noopener">Open</a>` : "—"}</dd>
          <dt>Address</dt><dd>${addressBlock(application)}</dd>
          <dt>Products</dt><dd>${escapeHtml(productList(application.desired_products))}</dd>
          <dt>USD investment</dt><dd>${escapeHtml(labelFrom(BUDGET_LABELS, application.investment_budget_usd))}</dd>
          <dt>Import experience</dt><dd>${escapeHtml(labelFrom(IMPORT_LABELS, application.import_experience))}</dd>
          <dt>Main channel</dt><dd>${escapeHtml(labelFrom(CHANNEL_LABELS, application.sales_channel))}</dd>
          <dt>Monthly reach</dt><dd>${escapeHtml(labelFrom(REACH_LABELS, application.customer_reach))}</dd>
          <dt>Frequency</dt><dd>${escapeHtml(labelFrom(FREQUENCY_LABELS, application.order_frequency))}</dd>
          <dt>Regions</dt><dd>${escapeHtml(application.sales_regions || "—")}</dd>
          <dt>Fulfillment</dt><dd>${escapeHtml(labelFrom(FULFILLMENT_LABELS, application.fulfillment_setup))}</dd>
          <dt>Reseller/tax ID</dt><dd>${escapeHtml(application.reseller_or_tax_id || "—")}</dd>
          <dt>Volumen mensual</dt><dd>${escapeHtml(application.monthly_volume)}</dd>
          <dt>Submitted</dt><dd>${formatDate(application.created_at)}</dd>
          <dt>Email sent</dt><dd>${formatDate(application.decision_email_sent_at)}</dd>
        </dl>

        <h3 style="margin:1.1rem 0 0.4rem;font-size:0.95rem;">Product interest</h3>
        <p class="admin-callout">${paragraph(application.product_interest)}</p>

        <h3 style="margin:1.1rem 0 0.4rem;font-size:0.95rem;">Business plan</h3>
        <p class="admin-callout">${paragraph(application.business_plan)}</p>

        <h3 style="margin:1.1rem 0 0.4rem;font-size:0.95rem;">Additional notes</h3>
        <p class="admin-callout">${paragraph(application.notes)}</p>
      </div>
      <div>
        <form id="wholesale-review">
          <div class="admin-field">
            <label>Wholesale profile</label>
            <input name="profile" value="wholesale" ${final ? "disabled" : ""} />
          </div>
          <div class="admin-field">
            <label>Decision notes</label>
            <textarea name="decision_notes" placeholder="Notes for the rejection email and internal record." ${final ? "disabled" : ""}>${escapeHtml(application.decision_notes || "")}</textarea>
          </div>
          ${application.decision_email_error ? `<div class="admin-callout admin-callout-warn">${escapeHtml(application.decision_email_error)}</div>` : ""}
          <p class="admin-metric-sub" data-review-status></p>
          <div class="admin-actions-row">
            <button type="button" class="admin-btn" data-action="under_review" ${final ? "disabled" : ""}>Under review</button>
            <button type="button" class="admin-btn admin-btn-primary" data-action="approve" ${final ? "disabled" : ""}>Approve + email</button>
            <button type="button" class="admin-btn admin-btn-danger" data-action="reject" ${final ? "disabled" : ""}>Reject + email</button>
          </div>
        </form>
      </div>
    </div>
  `);

  modal.body.querySelectorAll("[data-action]").forEach((button) => {
    button.addEventListener("click", () => {
      submitDecision(app, application, button.getAttribute("data-action"), reload, modal);
    });
  });
}

export default {
  title: "Solicitudes de mayoreo",
  async render(mount, app, context = {}) {
    if (context.actions) {
      context.actions.innerHTML =
        '<a class="admin-btn admin-btn-primary" href="/wholesale-application" target="_blank" rel="noopener">Open application form</a>';
    }

    let controls;
    controls = await listView({
      mount,
      app,
      endpoint: "/api/admin/wholesale-applications",
      dataKey: "applications",
      statuses: STATUSES,
      statusEmptyLabel: "All statuses",
      searchPlaceholder: "Search applicant, email, or business...",
      columns: [
        { label: "Business", render: (r) => escapeHtml(r.company_name) },
        { label: "Applicant", render: (r) => escapeHtml(r.full_name) },
        { label: "Email", render: (r) => escapeHtml(r.email) },
        { label: "Type", render: (r) => escapeHtml(typeLabel(r.business_type)) },
        { label: "Products", render: (r) => escapeHtml(productList(r.desired_products)) },
        { label: "Investment", render: (r) => escapeHtml(labelFrom(BUDGET_LABELS, r.investment_budget_usd)) },
        { label: "Status", render: (r) => estadoBadge(r.status) },
        { label: "Email sent", render: (r) => formatDate(r.decision_email_sent_at) },
        { label: "Created", render: (r) => formatDate(r.created_at) },
      ],
      onRowClick: (row) => openApplication(app, row, () => controls.reload()),
    });
  },
};
