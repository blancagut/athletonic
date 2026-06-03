// Dashboard view: high-level marketplace metrics.
import { formatMoney } from "../admin-core.js";

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
    const { metrics } = await app.authFetch("/api/admin/metrics");
    const o = metrics.orders;

    mount.innerHTML = `
      <div class="admin-metrics">
        ${metric("Revenue (paid)", formatMoney(metrics.revenue_cents))}
        ${metric("Total orders", o.total, `${o.paid} paid`)}
        ${metric("Awaiting payment", o.pending_payment)}
        ${metric("Processing", o.processing)}
        ${metric("Shipped", o.shipped)}
        ${metric("Open returns", metrics.returns_open)}
        ${metric("New checkout intents", metrics.checkout_intents_new)}
        ${metric("Admins", metrics.admins)}
      </div>
      <div class="admin-card">
        <div class="admin-card-head"><h2>Quick actions</h2></div>
        <div class="admin-view" style="padding:1.25rem;display:flex;gap:0.6rem;flex-wrap:wrap;">
          <a class="admin-btn" href="#/orders">Manage orders</a>
          <a class="admin-btn" href="#/returns">Review returns</a>
          <a class="admin-btn" href="#/intents">Follow up intents</a>
          <a class="admin-btn" href="#/catalog">Edit catalog</a>
        </div>
      </div>`;
  },
};
