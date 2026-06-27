// Wholesale applications view (super_admin only): review, approve, reject, and email decisions.
import { escapeHtml, formatDate, toast } from "../admin-core.js?v=20260623-magic-link";
import { listView, openModal } from "./_ui.js";

const STATUSES = [
  { value: "pending", label: "Pendiente" },
  { value: "under_review", label: "En revisión" },
  { value: "approved", label: "Aprobada" },
  { value: "rejected", label: "Rechazada" },
];

const STATUS_LABELS = Object.fromEntries(STATUSES.map((status) => [status.value, status.label]));

const TYPE_LABELS = {
  retail_store: "Tienda minorista",
  gym_studio: "Gimnasio o estudio",
  coach_team: "Coach o equipo",
  distributor: "Distribuidor",
  corporate_wellness: "Bienestar corporativo",
  other: "Otro",
};

const YEARS_LABELS = {
  pre_launch: "Pre-lanzamiento",
  under_1_year: "Menos de 1 año",
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
  under_1000: "Menos de $1,000",
  "1000_5000": "$1,000 - $5,000",
  "5000_15000": "$5,000 - $15,000",
  "15000_50000": "$15,000 - $50,000",
  "50000_plus": "$50,000+",
};

const IMPORT_LABELS = {
  none: "Sin experiencia importando",
  domestic_only: "Solo compras domésticas",
  imported_before: "Ya importó antes",
  currently_importing: "Importa actualmente",
};

const CHANNEL_LABELS = {
  retail_store: "Tienda física",
  gym_members: "Miembros de gimnasio",
  online_store: "Tienda online",
  marketplace: "Marketplace",
  events: "Eventos o pop-ups",
  mixed: "Canales mixtos",
  other: "Otro",
};

const REACH_LABELS = {
  under_100: "Menos de 100",
  "100_500": "100 - 500",
  "500_2500": "500 - 2,500",
  "2500_10000": "2,500 - 10,000",
  "10000_plus": "10,000+",
};

const FREQUENCY_LABELS = {
  one_time: "Orden inicial única",
  monthly: "Mensual",
  twice_monthly: "Dos veces al mes",
  weekly: "Semanal",
  as_needed: "Según necesidad",
};

const FULFILLMENT_LABELS = {
  store_pick_pack: "Pick & pack en tienda",
  warehouse: "Bodega propia",
  third_party_logistics: "3PL / fulfillment partner",
  dropship: "Dropship",
  not_set: "Aún no definido",
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
    toast("Agrega notas de decisión antes de rechazar", "error");
    if (notesEl) notesEl.focus();
    return;
  }

  const label = action === "approve" ? "aprobación" : action === "reject" ? "rechazo" : "revisión";
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
        ? "Solicitud aprobada y email enviado"
        : action === "reject"
          ? "Solicitud rechazada y email enviado"
          : "Solicitud marcada en revisión",
      "success"
    );
    if (statusEl) statusEl.textContent = result.email_sent ? "Email de decisión enviado." : "Guardado.";
    modal.close();
    reload();
  } catch (err) {
    toast(err.message || "No se pudo completar la revisión", "error");
    if (statusEl) statusEl.textContent = err.message || "No se pudo completar la revisión.";
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
          <dt>Estado</dt><dd>${estadoBadge(application.status)}</dd>
          <dt>Solicitante</dt><dd>${escapeHtml(application.full_name)}</dd>
          <dt>Correo</dt><dd>${escapeHtml(application.email)}</dd>
          <dt>Negocio</dt><dd>${escapeHtml(application.company_name)}</dd>
          <dt>Tipo</dt><dd>${escapeHtml(typeLabel(application.business_type))}</dd>
          <dt>Tiempo operando</dt><dd>${escapeHtml(labelFrom(YEARS_LABELS, application.years_in_business))}</dd>
          <dt>Teléfono</dt><dd>${escapeHtml(application.phone)}</dd>
          <dt>Sitio web</dt><dd>${application.website_url ? `<a class="admin-link" href="${escapeHtml(application.website_url)}" target="_blank" rel="noopener">Abrir</a>` : "—"}</dd>
          <dt>Dirección</dt><dd>${addressBlock(application)}</dd>
          <dt>Productos</dt><dd>${escapeHtml(productList(application.desired_products))}</dd>
          <dt>Inversión USD</dt><dd>${escapeHtml(labelFrom(BUDGET_LABELS, application.investment_budget_usd))}</dd>
          <dt>Importación</dt><dd>${escapeHtml(labelFrom(IMPORT_LABELS, application.import_experience))}</dd>
          <dt>Canal principal</dt><dd>${escapeHtml(labelFrom(CHANNEL_LABELS, application.sales_channel))}</dd>
          <dt>Alcance mensual</dt><dd>${escapeHtml(labelFrom(REACH_LABELS, application.customer_reach))}</dd>
          <dt>Frecuencia</dt><dd>${escapeHtml(labelFrom(FREQUENCY_LABELS, application.order_frequency))}</dd>
          <dt>Regiones</dt><dd>${escapeHtml(application.sales_regions || "—")}</dd>
          <dt>Fulfillment</dt><dd>${escapeHtml(labelFrom(FULFILLMENT_LABELS, application.fulfillment_setup))}</dd>
          <dt>Reseller/tax ID</dt><dd>${escapeHtml(application.reseller_or_tax_id || "—")}</dd>
          <dt>Volumen mensual</dt><dd>${escapeHtml(application.monthly_volume)}</dd>
          <dt>Enviada</dt><dd>${formatDate(application.created_at)}</dd>
          <dt>Email enviado</dt><dd>${formatDate(application.decision_email_sent_at)}</dd>
        </dl>

        <h3 style="margin:1.1rem 0 0.4rem;font-size:0.95rem;">Interés de productos</h3>
        <p class="admin-callout">${paragraph(application.product_interest)}</p>

        <h3 style="margin:1.1rem 0 0.4rem;font-size:0.95rem;">Plan del negocio</h3>
        <p class="admin-callout">${paragraph(application.business_plan)}</p>

        <h3 style="margin:1.1rem 0 0.4rem;font-size:0.95rem;">Notas adicionales</h3>
        <p class="admin-callout">${paragraph(application.notes)}</p>
      </div>
      <div>
        <form id="wholesale-review">
          <div class="admin-field">
            <label>Perfil de mayoreo</label>
            <input name="profile" value="wholesale" ${final ? "disabled" : ""} />
          </div>
          <div class="admin-field">
            <label>Notas de decisión</label>
            <textarea name="decision_notes" placeholder="Notas para el email de rechazo y para el registro interno." ${final ? "disabled" : ""}>${escapeHtml(application.decision_notes || "")}</textarea>
          </div>
          ${application.decision_email_error ? `<div class="admin-callout admin-callout-warn">${escapeHtml(application.decision_email_error)}</div>` : ""}
          <p class="admin-metric-sub" data-review-status></p>
          <div class="admin-actions-row">
            <button type="button" class="admin-btn" data-action="under_review" ${final ? "disabled" : ""}>En revisión</button>
            <button type="button" class="admin-btn admin-btn-primary" data-action="approve" ${final ? "disabled" : ""}>Aprobar + email</button>
            <button type="button" class="admin-btn admin-btn-danger" data-action="reject" ${final ? "disabled" : ""}>Rechazar + email</button>
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
        '<a class="admin-btn admin-btn-primary" href="/wholesale-application" target="_blank" rel="noopener">Abrir solicitud</a>';
    }

    let controls;
    controls = await listView({
      mount,
      app,
      endpoint: "/api/admin/wholesale-applications",
      dataKey: "applications",
      statuses: STATUSES,
      statusEmptyLabel: "Todos los estados",
      searchPlaceholder: "Buscar solicitante, correo o negocio...",
      columns: [
        { label: "Negocio", render: (r) => escapeHtml(r.company_name) },
        { label: "Solicitante", render: (r) => escapeHtml(r.full_name) },
        { label: "Correo", render: (r) => escapeHtml(r.email) },
        { label: "Tipo", render: (r) => escapeHtml(typeLabel(r.business_type)) },
        { label: "Productos", render: (r) => escapeHtml(productList(r.desired_products)) },
        { label: "Inversión", render: (r) => escapeHtml(labelFrom(BUDGET_LABELS, r.investment_budget_usd)) },
        { label: "Estado", render: (r) => estadoBadge(r.status) },
        { label: "Email enviado", render: (r) => formatDate(r.decision_email_sent_at) },
        { label: "Creada", render: (r) => formatDate(r.created_at) },
      ],
      onRowClick: (row) => openApplication(app, row, () => controls.reload()),
    });
  },
};
