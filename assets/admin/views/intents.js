// Checkout intents view: conversion follow-up.
import { escapeHtml, formatMoney, formatDate, statusBadge, toast } from "../admin-core.js";
import { listView, openModal, optionList } from "./_ui.js";

const INTENT_STATUSES = ["new", "contacted", "converted", "cancelled"].map((v) => ({
  value: v,
  label: v,
}));

async function openIntent(app, id, reload) {
  const { intent } = await app.authFetch(`/api/admin/checkout-intents/${id}`);
  const cart = Array.isArray(intent.cart) ? intent.cart : [];
  const items = cart
    .map(
      (it) =>
        `<li>${escapeHtml(it.name || it.productId || "Item")}${
          it.quantity ? ` × ${escapeHtml(String(it.quantity))}` : ""
        }</li>`
    )
    .join("");

  const modal = openModal("Checkout intent", `
    <dl class="admin-kv">
      <dt>Email</dt><dd>${escapeHtml(intent.email)}</dd>
      <dt>Subtotal</dt><dd>${formatMoney(Math.round((intent.subtotal || 0) * 100), intent.currency)}</dd>
      <dt>Status</dt><dd>${statusBadge(intent.status)}</dd>
      <dt>Created</dt><dd>${formatDate(intent.created_at)}</dd>
    </dl>
    <h3 style="margin:1rem 0 0.4rem;font-size:0.95rem;">Cart</h3>
    <ul style="padding-left:1rem;font-size:0.85rem;">${items || "<li>—</li>"}</ul>
    <form id="intent-edit" style="margin-top:1rem;">
      <div class="admin-field">
        <label>Status</label>
        <select name="status">${optionList(INTENT_STATUSES, intent.status)}</select>
      </div>
      <div class="admin-field">
        <label>Notes</label>
        <textarea name="notes">${escapeHtml(intent.notes || "")}</textarea>
      </div>
      <button type="submit" class="admin-btn admin-btn-primary">Save</button>
    </form>
  `);

  modal.body.querySelector("#intent-edit").addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      await app.authFetch(`/api/admin/checkout-intents/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: fd.get("status"), notes: fd.get("notes") }),
      });
      toast("Intent updated", "success");
      modal.close();
      reload();
    } catch (err) {
      toast(err.message || "Update failed", "error");
    }
  });
}

export default {
  title: "Checkout intents",
  async render(mount, app) {
    let controls;
    controls = await listView({
      mount,
      app,
      endpoint: "/api/admin/checkout-intents",
      dataKey: "intents",
      statuses: INTENT_STATUSES,
      searchPlaceholder: "Search email…",
      columns: [
        { label: "Email", render: (r) => escapeHtml(r.email) },
        { label: "Subtotal", render: (r) => formatMoney(Math.round((r.subtotal || 0) * 100), r.currency) },
        { label: "Status", render: (r) => statusBadge(r.status) },
        { label: "Created", render: (r) => formatDate(r.created_at) },
      ],
      onRowClick: (row) => openIntent(app, row.id, () => controls.reload()),
    });
  },
};
