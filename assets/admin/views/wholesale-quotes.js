// Wholesale quote requests view (super_admin only): line-sheet inquiries and requested products.
import { escapeHtml, formatDate, toast } from "../admin-core.js?v=20260623-magic-link";
import { listView, openModal } from "./_ui.js";

const STATUSES = [
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "quoted", label: "Quoted" },
  { value: "closed", label: "Closed" },
  { value: "spam", label: "Spam" },
];

const STATUS_LABELS = Object.fromEntries(STATUSES.map((status) => [status.value, status.label]));

function statusBadge(status) {
  const value = String(status || "");
  return `<span class="admin-badge s-${escapeHtml(value)}">${escapeHtml(STATUS_LABELS[value] || value || "—")}</span>`;
}

function paragraph(value) {
  return escapeHtml(value || "—").replaceAll("\n", "<br />");
}

function itemOptions(item) {
  const selected = item && item.selected_options && typeof item.selected_options === "object"
    ? Object.entries(item.selected_options)
    : [];
  if (!selected.length) return "";
  return selected.map(([key, value]) => `${escapeHtml(key)}: ${escapeHtml(value)}`).join(" / ");
}

function itemsTable(items) {
  if (!Array.isArray(items) || !items.length) return '<div class="admin-empty">No products saved.</div>';
  return `
    <div class="admin-table-wrap">
      <table class="admin-table">
        <thead>
          <tr>
            <th>Product</th>
            <th>Brand</th>
            <th>Category</th>
            <th>Options</th>
            <th>Qty</th>
          </tr>
        </thead>
        <tbody>
          ${items
            .map(
              (item) => `
                <tr>
                  <td>
                    <strong>${escapeHtml(item.name)}</strong>
                    ${item.url ? `<div><a class="admin-link" href="${escapeHtml(item.url)}" target="_blank" rel="noopener">Open product</a></div>` : ""}
                  </td>
                  <td>${escapeHtml(item.brand)}</td>
                  <td>${escapeHtml(item.category_label || item.product_type || "—")}</td>
                  <td>${itemOptions(item) || "—"}</td>
                  <td>${escapeHtml(item.quantity)}</td>
                </tr>
              `
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

async function updateStatus(app, quoteRequest, status, reload, modal) {
  try {
    const result = await app.authFetch(`/api/admin/wholesale-quote-requests/${quoteRequest.id}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
    toast("Quote updated", "success");
    modal.close();
    reload();
    return result;
  } catch (err) {
    toast(err.message || "Could not update the quote", "error");
    return null;
  }
}

async function openQuoteRequest(app, row, reload) {
  const result = await app.authFetch(`/api/admin/wholesale-quote-requests/${row.id}`);
  const quoteRequest = result.quote_request;

  const modal = openModal(`Quote mayorista: ${quoteRequest.company_name}`, `
    <div class="admin-detail-grid">
      <div>
        <dl class="admin-kv">
          <dt>Status</dt><dd>${statusBadge(quoteRequest.status)}</dd>
          <dt>Nombre</dt><dd>${escapeHtml(quoteRequest.name)}</dd>
          <dt>Empresa</dt><dd>${escapeHtml(quoteRequest.company_name)}</dd>
          <dt>Email</dt><dd><a class="admin-link" href="mailto:${escapeHtml(quoteRequest.email)}">${escapeHtml(quoteRequest.email)}</a></dd>
          <dt>WhatsApp</dt><dd>${escapeHtml(quoteRequest.whatsapp)}</dd>
          <dt>Country</dt><dd>${escapeHtml(quoteRequest.country)}</dd>
          <dt>Products</dt><dd>${escapeHtml(quoteRequest.item_count)} lines / ${escapeHtml(quoteRequest.quantity_count)} units</dd>
          <dt>Origen</dt><dd>${escapeHtml(quoteRequest.source_page || "—")}</dd>
          <dt>Created</dt><dd>${formatDate(quoteRequest.created_at)}</dd>
          <dt>Actualizado</dt><dd>${formatDate(quoteRequest.updated_at)}</dd>
        </dl>

        <h3 style="margin:1.1rem 0 0.4rem;font-size:0.95rem;">Mensaje</h3>
        <p class="admin-callout">${paragraph(quoteRequest.notes)}</p>
      </div>
      <div>
        <div class="admin-field">
          <label>Update status</label>
          <select data-quote-status>
            ${STATUSES.map((status) => `<option value="${escapeHtml(status.value)}"${status.value === quoteRequest.status ? " selected" : ""}>${escapeHtml(status.label)}</option>`).join("")}
          </select>
        </div>
        <button type="button" class="admin-btn admin-btn-primary" data-save-status>Save status</button>
      </div>
    </div>
    <h3 style="margin:1.2rem 0 0.5rem;font-size:1rem;">Requested products</h3>
    ${itemsTable(quoteRequest.items)}
  `);

  modal.body.querySelector("[data-save-status]").addEventListener("click", () => {
    const status = modal.body.querySelector("[data-quote-status]").value;
    updateStatus(app, quoteRequest, status, reload, modal);
  });
}

export default {
  title: "Wholesale quote requests",
  async render(mount, app, context = {}) {
    if (context.actions) {
      context.actions.innerHTML =
        '<a class="admin-btn admin-btn-primary" href="/catalog/wholesale-muay-thai" target="_blank" rel="noopener">Open catalog</a>';
    }

    let controls;
    controls = await listView({
      mount,
      app,
      endpoint: "/api/admin/wholesale-quote-requests",
      dataKey: "quote_requests",
      statuses: STATUSES,
      statusEmptyLabel: "All statuses",
      searchPlaceholder: "Search company, email, country...",
      columns: [
        { label: "Empresa", render: (r) => escapeHtml(r.company_name) },
        { label: "Contacto", render: (r) => escapeHtml(r.name) },
        { label: "Email", render: (r) => escapeHtml(r.email) },
        { label: "Country", render: (r) => escapeHtml(r.country) },
        { label: "Líneas", render: (r) => escapeHtml(r.item_count) },
        { label: "Unidades", render: (r) => escapeHtml(r.quantity_count) },
        { label: "Status", render: (r) => statusBadge(r.status) },
        { label: "Created", render: (r) => formatDate(r.created_at) },
      ],
      onRowClick: (row) => openQuoteRequest(app, row, () => controls.reload()),
    });

    if (context.param) {
      try {
        await openQuoteRequest(app, { id: context.param }, () => controls.reload());
      } catch (err) {
        toast(err.message || "Could not open the quote", "error");
      }
    }
  },
};
