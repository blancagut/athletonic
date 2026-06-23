// Catalog view: browse products and persist admin overrides.
import { escapeHtml, formatMoney, toast } from "../admin-core.js?v=20260623-magic-link";
import { listView, openModal } from "./_ui.js";

async function openProduct(app, product, reload) {
  const canEdit = app.user && app.user.role === "super_admin";
  const modal = openModal(`${product.brand} — ${product.name}`, `
    <div class="admin-product-summary">
      ${product.image ? `<img class="admin-product-image" src="${escapeHtml(product.image)}" alt="" loading="lazy" onerror="this.hidden=true" />` : ""}
      <dl class="admin-kv">
        <dt>ID</dt><dd><span class="admin-mono">${escapeHtml(String(product.id))}</span></dd>
        <dt>Brand</dt><dd>${escapeHtml(product.brand || "—")}</dd>
        <dt>Category</dt><dd>${escapeHtml(product.section_title || product.section_id || "—")}</dd>
        <dt>Source price</dt><dd>${formatMoney(product._source_price_cents ?? product.price_cents, product.currency)}</dd>
        <dt>Override price</dt><dd>${product._override ? formatMoney(product.price_cents, product.currency) : "—"}</dd>
        <dt>State</dt><dd>${product.available === false ? '<span class="admin-badge s-cancelled">unavailable</span>' : '<span class="admin-badge s-paid">available</span>'} ${product._hidden ? '<span class="admin-badge s-rejected">hidden</span>' : ""} ${product._override ? '<span class="admin-badge s-processing">override</span>' : ""}</dd>
      </dl>
    </div>
    <form id="catalog-edit">
      <div class="admin-field">
        <label>Name</label>
        <input name="name" value="${escapeHtml(product.name || "")}" ${canEdit ? "" : "disabled"} />
      </div>
      <div class="admin-grid-2">
        <div class="admin-field">
          <label>Price (cents)</label>
          <input name="price_cents" type="number" min="0" max="1000000" step="1" value="${escapeHtml(String(product.price_cents ?? ""))}" ${canEdit ? "" : "disabled"} />
        </div>
        <div class="admin-field">
          <label>Available</label>
          <select name="available" ${canEdit ? "" : "disabled"}>
            <option value="true"${product.available !== false ? " selected" : ""}>Available</option>
            <option value="false"${product.available === false ? " selected" : ""}>Unavailable</option>
          </select>
        </div>
      </div>
      <div class="admin-field">
        <label>Image URL</label>
        <input name="image" value="${escapeHtml(product.image || "")}" ${canEdit ? "" : "disabled"} />
      </div>
      <div class="admin-field">
        <label>Product URL</label>
        <input name="url" value="${escapeHtml(product.url || "")}" ${canEdit ? "" : "disabled"} />
      </div>
      <div class="admin-field">
        <label><input type="checkbox" name="hidden" ${product._hidden ? "checked" : ""} ${canEdit ? "" : "disabled"} /> Hide from storefront</label>
      </div>
      <div class="admin-callout admin-callout-warn">Changing price, availability, image, or URL affects storefront merchandising through product_overrides.</div>
      ${canEdit ? '<button type="submit" class="admin-btn admin-btn-primary">Save override</button>' : '<div class="admin-empty admin-empty-compact">Super admin access is required to edit catalog overrides.</div>'}
    </form>
  `);

  if (!canEdit) return;

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
      filters: [
        { name: "brand_slug", label: "Brand", emptyLabel: "All brands", options: [] },
        { name: "section_id", label: "Category", emptyLabel: "All categories", options: [] },
        { name: "availability", label: "Availability", emptyLabel: "All availability", options: [
          { value: "available", label: "Available" },
          { value: "unavailable", label: "Unavailable" },
          { value: "hidden", label: "Hidden" },
        ] },
        { name: "override_state", label: "Override", emptyLabel: "All override states", options: [
          { value: "edited", label: "Edited" },
          { value: "source", label: "Source" },
        ] },
      ],
      afterLoad(data) {
        const brandSelect = mount.querySelector('[data-filter="brand_slug"]');
        const sectionSelect = mount.querySelector('[data-filter="section_id"]');
        if (brandSelect && brandSelect.options.length <= 1 && data.facets?.brands) {
          brandSelect.insertAdjacentHTML("beforeend", data.facets.brands.map((b) => `<option value="${escapeHtml(b.slug)}">${escapeHtml(b.name)}</option>`).join(""));
        }
        if (sectionSelect && sectionSelect.options.length <= 1 && data.facets?.sections) {
          sectionSelect.insertAdjacentHTML("beforeend", data.facets.sections.map((s) => `<option value="${escapeHtml(s.id)}">${escapeHtml(s.title)}</option>`).join(""));
        }
      },
      searchPlaceholder: "Search name, brand or id…",
      columns: [
        { label: "Image", render: (r) => (r.image ? `<img class="admin-thumb" src="${escapeHtml(r.image)}" alt="" loading="lazy" onerror="this.hidden=true" />` : "—") },
        { label: "ID", render: (r) => `<span class="admin-mono">${escapeHtml(String(r.id))}</span>` },
        { label: "Brand", render: (r) => escapeHtml(r.brand) },
        { label: "Name", render: (r) => escapeHtml(r.name) },
        { label: "Category", render: (r) => escapeHtml(r.section_title || r.section_id || "—") },
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
