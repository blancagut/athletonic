// Orders view: list + detail drawer with status / tracking editing.
import { escapeHtml, formatMoney, formatDate, statusBadge, toast } from "../admin-core.js";
import { listView, openModal, optionList } from "./_ui.js";

const ORDER_STATUSES = [
  "pending_payment",
  "paid",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
  "refunded",
].map((v) => ({ value: v, label: v.replace(/_/g, " ") }));

const FULFILLMENT_STATUSES = [
  "not_started",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
  "returned",
].map((v) => ({ value: v, label: v.replace(/_/g, " ") }));

async function openOrder(app, orderId, reload) {
  const { order } = await app.authFetch(`/api/admin/orders/${orderId}`);
  const items = (order.items || [])
    .map(
      (it) => `
      <tr>
        <td>${escapeHtml(it.brand)} — ${escapeHtml(it.name)}${
        it.variant ? ` <span class="admin-mono">(${escapeHtml(it.variant)})</span>` : ""
      }</td>
        <td>${it.quantity}</td>
        <td>${formatMoney(it.unit_amount_cents, order.currency)}</td>
        <td>${formatMoney(it.line_subtotal_cents, order.currency)}</td>
      </tr>`
    )
    .join("");

  const events = (order.events || [])
    .map(
      (e) =>
        `<li>${statusBadge(e.status)} ${escapeHtml(e.message || "")} <span class="admin-metric-sub">${formatDate(
          e.created_at
        )} · ${escapeHtml(e.created_by || "")}</span></li>`
    )
    .join("");

  const modal = openModal(`Order ${order.order_reference}`, `
    <div class="admin-detail-grid">
      <div>
        <dl class="admin-kv">
          <dt>Customer</dt><dd>${escapeHtml(order.customer_email)}</dd>
          <dt>Order status</dt><dd>${statusBadge(order.order_status)}</dd>
          <dt>Payment</dt><dd>${statusBadge(order.payment_status)}</dd>
          <dt>Fulfillment</dt><dd>${statusBadge(order.fulfillment_status)}</dd>
          <dt>Total</dt><dd>${formatMoney(order.amounts.total_cents, order.currency)}</dd>
          <dt>Placed</dt><dd>${formatDate(order.timestamps.created_at)}</dd>
        </dl>
        <table class="admin-table" style="margin-top:1rem;">
          <thead><tr><th>Item</th><th>Qty</th><th>Unit</th><th>Subtotal</th></tr></thead>
          <tbody>${items}</tbody>
        </table>
        <h3 style="margin:1.2rem 0 0.5rem;font-size:0.95rem;">Timeline</h3>
        <ul style="padding-left:1rem;display:grid;gap:0.4rem;font-size:0.85rem;">${events || "<li>No events</li>"}</ul>
      </div>
      <div>
        <form id="order-edit">
          <div class="admin-field">
            <label>Order status</label>
            <select name="order_status">${optionList(ORDER_STATUSES, order.order_status)}</select>
          </div>
          <div class="admin-field">
            <label>Fulfillment status</label>
            <select name="fulfillment_status">${optionList(FULFILLMENT_STATUSES, order.fulfillment_status)}</select>
          </div>
          <div class="admin-field">
            <label>Tracking carrier</label>
            <input name="tracking_carrier" value="${escapeHtml(order.tracking.carrier || "")}" />
          </div>
          <div class="admin-field">
            <label>Tracking number</label>
            <input name="tracking_number" value="${escapeHtml(order.tracking.number || "")}" />
          </div>
          <div class="admin-field">
            <label>Tracking URL</label>
            <input name="tracking_url" value="${escapeHtml(order.tracking.url || "")}" />
          </div>
          <div class="admin-field">
            <label>Note (optional)</label>
            <input name="message" placeholder="Reason for this update" />
          </div>
          <button type="submit" class="admin-btn admin-btn-primary">Save changes</button>
        </form>
      </div>
    </div>
  `);

  modal.body.querySelector("#order-edit").addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const body = {
      order_status: fd.get("order_status"),
      fulfillment_status: fd.get("fulfillment_status"),
      tracking_carrier: fd.get("tracking_carrier"),
      tracking_number: fd.get("tracking_number"),
      tracking_url: fd.get("tracking_url"),
      message: fd.get("message"),
    };
    try {
      await app.authFetch(`/api/admin/orders/${orderId}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      toast("Order updated", "success");
      modal.close();
      reload();
    } catch (err) {
      toast(err.message || "Update failed", "error");
    }
  });
}

export default {
  title: "Orders",
  async render(mount, app) {
    let controls;
    controls = await listView({
      mount,
      app,
      endpoint: "/api/admin/orders",
      dataKey: "orders",
      statuses: ORDER_STATUSES,
      searchPlaceholder: "Search reference or email…",
      columns: [
        { label: "Reference", render: (r) => `<span class="admin-mono">${escapeHtml(r.order_reference)}</span>` },
        { label: "Customer", render: (r) => escapeHtml(r.customer_email) },
        { label: "Total", render: (r) => formatMoney(r.total_cents, r.currency) },
        { label: "Status", render: (r) => statusBadge(r.order_status) },
        { label: "Payment", render: (r) => statusBadge(r.payment_status) },
        { label: "Placed", render: (r) => formatDate(r.created_at) },
      ],
      onRowClick: (row) => openOrder(app, row.id, () => controls.reload()),
    });
  },
};
