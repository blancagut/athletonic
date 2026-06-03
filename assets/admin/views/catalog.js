// Catalog view: browse products and persist admin overrides.
import { escapeHtml, formatMoney, toast } from "../admin-core.js";
import { listView, openModal } from "./_ui.js";

async function openProduct(app, product, reload) {
  const modal = openModal(`${product.brand} — ${product.name}`, `
    <form id="catalog-edit">
      <div class="admin-field">
        <label>Name</label>
        <input name="name" value="${escapeHtml(product.name || "")}" />
      </div>
      <div class="admin-grid-2">
        <div class="admin-field">
          <label>Price (cents)</label>
          <input name="price_cents" type="number" min="0" value="${escapeHtml(String(product.price_cents ?? ""))}" />
        </div>
        <div class="admin-field">
          <label>Available</label>
          <select name="available">
            <option value="true"${product.available !== false ? " selected" : ""}>Available</option>
            <option value="false"${product.available === false ? " selected" : ""}>Unavailable</option>
          </select>
        </div>
      </div>
      <div class="admin-field">
        <label>Image URL</label>
        <input name="image" value="${escapeHtml(product.image || "")}" />
      </div>
      <div class="admin-field">
        <label>Product URL</label>
        <input name="url" value="${escapeHtml(product.url || "")}" />
      </div>
      <div class="admin-field">
        <label><input type="checkbox" name="hidden" ${product._hidden ? "checked" : ""} /> Hide from storefront</label>
      </div>
      <p class="admin-metric-sub">Edits are saved as overrides on top of the source catalog.</p>
      <button type="submit" class="admin-btn admin-btn-primary">Save override</button>
    </form>
  `);

  modal.body.querySelector("#catalog-edit").addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const body = {
      name: fd.get("name"),
      price_cents: Number.parseInt(fd.get("price_cents"), 10),
      available: fd.get("available") === "true",
      image: fd.get("image"),
      url: fd.get("url"),
      hidden: fd.get("hidden") === "on",
    };
    try {
      await app.authFetch(`/api/admin/catalog/${encodeURIComponent(product.id)}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      toast("Override saved", "success");
      modal.close();
      reload();
    } catch (err) {
      toast(err.message || "Save failed", "error");
    }
  });
}

export default {
  title: "Catalog",
  async render(mount, app) {
    let controls;
    controls = await listView({
      mount,
      app,
      endpoint: "/api/admin/catalog",
      dataKey: "products",
      searchPlaceholder: "Search name, brand or id…",
      columns: [
        { label: "ID", render: (r) => `<span class="admin-mono">${escapeHtml(String(r.id))}</span>` },
        { label: "Brand", render: (r) => escapeHtml(r.brand) },
        { label: "Name", render: (r) => escapeHtml(r.name) },
        { label: "Price", render: (r) => formatMoney(r.price_cents, r.currency) },
        {
          label: "State",
          render: (r) =>
            (r.available === false ? '<span class="admin-badge s-cancelled">unavailable</span>' : '<span class="admin-badge s-paid">available</span>') +
            (r._hidden ? ' <span class="admin-badge s-rejected">hidden</span>' : "") +
            (r._override ? ' <span class="admin-badge s-processing">edited</span>' : ""),
        },
      ],
      onRowClick: (row) => openProduct(app, row, () => controls.reload()),
    });
  },
};
