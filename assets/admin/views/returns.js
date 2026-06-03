// Returns view: list + approve/reject with admin notes.
import { escapeHtml, formatDate, statusBadge, toast } from "../admin-core.js";
import { listView, openModal, optionList } from "./_ui.js";

const RETURN_STATUSES = [
  "requested",
  "under_review",
  "approved",
  "rejected",
  "received",
  "refunded",
  "replaced",
].map((v) => ({ value: v, label: v.replace(/_/g, " ") }));

async function openReturn(app, id, reload) {
  const { return: r } = await app.authFetch(`/api/admin/returns/${id}`);
  const items = (r.return_request_items || [])
    .map((it) => `<li>Item ${escapeHtml(it.order_item_id)} × ${it.quantity}${it.reason ? ` — ${escapeHtml(it.reason)}` : ""}</li>`)
    .join("");
  const photos = (r.return_request_photos || [])
    .map((p) => `<li>${escapeHtml(p.original_filename || p.storage_path)} <span class="admin-metric-sub">(${escapeHtml(p.mime_type || "")})</span></li>`)
    .join("");

  const modal = openModal(`Return ${r.return_reference}`, `
    <div class="admin-detail-grid">
      <div>
        <dl class="admin-kv">
          <dt>Customer</dt><dd>${escapeHtml(r.customer_email)}</dd>
          <dt>Resolution</dt><dd>${escapeHtml(r.requested_resolution)}</dd>
          <dt>Status</dt><dd>${statusBadge(r.status)}</dd>
          <dt>Reason</dt><dd>${escapeHtml(r.reason || "—")}</dd>
          <dt>Customer notes</dt><dd>${escapeHtml(r.customer_notes || "—")}</dd>
          <dt>Created</dt><dd>${formatDate(r.created_at)}</dd>
        </dl>
        <h3 style="margin:1.1rem 0 0.4rem;font-size:0.95rem;">Items</h3>
        <ul style="padding-left:1rem;font-size:0.85rem;">${items || "<li>—</li>"}</ul>
        <h3 style="margin:1.1rem 0 0.4rem;font-size:0.95rem;">Photos</h3>
        <ul style="padding-left:1rem;font-size:0.85rem;">${photos || "<li>None</li>"}</ul>
      </div>
      <div>
        <form id="return-edit">
          <div class="admin-field">
            <label>Status</label>
            <select name="status">${optionList(RETURN_STATUSES, r.status)}</select>
          </div>
          <div class="admin-field">
            <label>Admin notes</label>
            <textarea name="admin_notes">${escapeHtml(r.admin_notes || "")}</textarea>
          </div>
          <button type="submit" class="admin-btn admin-btn-primary">Save</button>
        </form>
      </div>
    </div>
  `);

  modal.body.querySelector("#return-edit").addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      await app.authFetch(`/api/admin/returns/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: fd.get("status"), admin_notes: fd.get("admin_notes") }),
      });
      toast("Return updated", "success");
      modal.close();
      reload();
    } catch (err) {
      toast(err.message || "Update failed", "error");
    }
  });
}

export default {
  title: "Returns",
  async render(mount, app) {
    let controls;
    controls = await listView({
      mount,
      app,
      endpoint: "/api/admin/returns",
      dataKey: "returns",
      statuses: RETURN_STATUSES,
      searchPlaceholder: "Search reference or email…",
      columns: [
        { label: "Reference", render: (r) => `<span class="admin-mono">${escapeHtml(r.return_reference)}</span>` },
        { label: "Customer", render: (r) => escapeHtml(r.customer_email) },
        { label: "Resolution", render: (r) => escapeHtml(r.requested_resolution) },
        { label: "Status", render: (r) => statusBadge(r.status) },
        { label: "Created", render: (r) => formatDate(r.created_at) },
      ],
      onRowClick: (row) => openReturn(app, row.id, () => controls.reload()),
    });
  },
};
