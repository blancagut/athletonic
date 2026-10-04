// Dashboard view: high-level ecommerce operations metrics.
import { escapeHtml, formatMoney, formatDate, roleLabel, statusBadge, compactJson } from "../admin-core.js?v=20260623-magic-link";

function metric(label, value, sub) {
  return `
    <div class="admin-metric">
      <div class="admin-metric-label">${label}</div>
      <div class="admin-metric-value">${value}</div>
      ${sub ? `<div class="admin-metric-sub">${sub}</div>` : ""}
    </div>`;
}

export default {
  title: "Dashboard",
  async render(mount, app) {
    const { metrics, recent } = await app.authFetch("/api/admin/metrics");
    const o = metrics.orders;
    const isSuper = app.user && app.user.role === "super_admin";

    const orderRows = (recent.orders || [])
      .map((order) => `
        <tr>
          <td><span class="admin-mono">${escapeHtml(order.order_reference)}</span></td>
          <td>${escapeHtml(order.customer_email)}</td>
          <td>${formatMoney(order.total_cents, order.currency)}</td>
          <td>${statusBadge(order.payment_status)}</td>
          <td>${statusBadge(order.fulfillment_status)}</td>
          <td>${formatDate(order.created_at)}</td>
        </tr>`)
      .join("");

    const returnRows = (recent.returns || [])
      .map((ret) => `
        <tr>
          <td><span class="admin-mono">${escapeHtml(ret.return_reference)}</span></td>
          <td>${escapeHtml(ret.customer_email)}</td>
          <td>${escapeHtml(ret.requested_resolution)}</td>
          <td>${statusBadge(ret.status)}</td>
          <td>${escapeHtml(ret.reason || "—")}</td>
        </tr>`)
      .join("");

    const auditRows = (recent.audit || [])
      .map((event) => `
        <tr>
          <td>${formatDate(event.created_at)}</td>
          <td>${escapeHtml(event.actor_email || "—")}</td>
          <td>${escapeHtml(roleLabel(event.actor_role) || "—")}</td>
          <td><span class="admin-mono">${escapeHtml(event.action)}</span></td>
          <td><span class="admin-mono">${escapeHtml(event.target_type || "")}:${escapeHtml(event.target_id || "")}</span></td>
        </tr>`)
      .join("");

    mount.innerHTML = `
      <div class="admin-metrics">
        ${metric("Today revenue", formatMoney(metrics.today_revenue_cents), "Paid orders since local midnight")}
        ${metric("Paid revenue", formatMoney(metrics.revenue_cents), "Lifetime paid order revenue")}
        ${metric("Total orders", o.total, `${o.paid} paid`)}
        ${metric("Needs action", o.needing_action, "Not started or processing")}
        ${metric("Awaiting payment", o.pending_payment)}
        ${metric("Processing", o.processing)}
        ${metric("Shipped", o.shipped)}
        ${metric("Delivered", o.delivered)}
        ${metric("Open returns", metrics.returns_open)}
        ${metric("Pending intents", metrics.checkout_intents_pending)}
        ${metric("Catalog issues", metrics.catalog_issues)}
        ${metric("Admins", metrics.admins)}
      </div>
      <div class="admin-ops-grid">
        <div class="admin-card admin-card-span-2">
          <div class="admin-card-head"><h2>Recent orders</h2><a class="admin-link" href="#/orders">View all</a></div>
          <div class="admin-table-wrap">
            ${orderRows ? `<table class="admin-table"><thead><tr><th>Reference</th><th>Customer</th><th>Total</th><th>Payment</th><th>Fulfillment</th><th>Placed</th></tr></thead><tbody>${orderRows}</tbody></table>` : '<div class="admin-empty">No orders yet.</div>'}
          </div>
        </div>
        <div class="admin-card">
          <div class="admin-card-head"><h2>Quick actions</h2></div>
          <div class="admin-action-list">
            <a class="admin-btn admin-btn-primary" href="#/orders">Review orders</a>
            <a class="admin-btn" href="#/returns">Work returns</a>
            <a class="admin-btn" href="#/intents">Recover intents</a>
            <a class="admin-btn" href="#/catalog">Inspect catalog</a>
            ${isSuper ? '<a class="admin-btn" href="#/privatePricing">Private pricing</a><a class="admin-btn" href="#/users">Users & admins</a><a class="admin-btn" href="#/settings">Settings</a>' : ""}
          </div>
        </div>
        <div class="admin-card">
          <div class="admin-card-head"><h2>Recent returns</h2><a class="admin-link" href="#/returns">View all</a></div>
          <div class="admin-table-wrap">
            ${returnRows ? `<table class="admin-table"><thead><tr><th>Reference</th><th>Customer</th><th>Request</th><th>Status</th><th>Reason</th></tr></thead><tbody>${returnRows}</tbody></table>` : '<div class="admin-empty">No returns yet.</div>'}
          </div>
        </div>
        <div class="admin-card admin-card-span-2">
          <div class="admin-card-head"><h2>Recent audit events</h2><a class="admin-link" href="#/audit">View all</a></div>
          <div class="admin-table-wrap">
            ${auditRows ? `<table class="admin-table"><thead><tr><th>When</th><th>Actor</th><th>Role</th><th>Action</th><th>Target</th></tr></thead><tbody>${auditRows}</tbody></table>` : '<div class="admin-empty">No audit events yet.</div>'}
          </div>
        </div>
      </div>
      <template data-debug-json>${escapeHtml(compactJson(metrics))}</template>`;
  },
};
