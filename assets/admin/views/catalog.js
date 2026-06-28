// Catalog view: browse products and persist admin overrides.
import { escapeHtml, formatMoney, toast } from "../admin-core.js?v=20260623-magic-link";
import { listView, openModal } from "./_ui.js";

function variantCount(product) {
  if (Number.isInteger(product?.variant_count) && product.variant_count >= 0) return product.variant_count;
  return Array.isArray(product?.variants) ? product.variants.length : 0;
}

function variantLabel(product) {
  const count = variantCount(product);
  if (product.has_variants === false && count === 0) return "No";
  if (!product.has_variants && count === 0) return "—";
  return count === 1 ? "1 variant" : `${count} variants`;
}

function changedFields(product) {
  const fields = [];
  if (!product._override && !product._hidden) return fields;
  if (product.name !== product._source_name) fields.push("name");
  if (product.price_cents !== product._source_price_cents) fields.push("price");
  if (product.available !== product._source_available) fields.push("availability");
  if ((product.image || "") !== (product._source_image || "")) fields.push("image");
  if ((product.url || "") !== (product._source_url || "")) fields.push("URL");
  if (Boolean(product._hidden) !== Boolean(product._source_hidden)) fields.push("visibility");
  if (product._variant_override_count > 0) {
    fields.push(`variants (${product._variant_override_count})`);
  }
  return fields;
}

function renderVariantPreview(product) {
  if (!Array.isArray(product.variants) || product.variants.length === 0) return "";
  const preview = product.variants.slice(0, 5);
  const more = product.variants.length - preview.length;
  return `
    <div class="admin-callout">
      <strong>Variant preview</strong>
      <div class="admin-catalog-variant-list">
        ${preview.map((variant) => `
          <div class="admin-catalog-variant-item">
            <div>
              <div>${escapeHtml(variant.title || variant.variant_id || "Untitled variant")}</div>
              <div class="admin-catalog-variant-meta">
                <span class="admin-mono">${escapeHtml(String(variant.variant_id || "—"))}</span>
                ${variant.available === false ? '<span class="admin-badge s-cancelled">unavailable</span>' : '<span class="admin-badge s-paid">available</span>'}
                ${String(variant.variant_id) === String(product.default_variant_id) ? '<span class="admin-badge s-processing">default</span>' : ""}
              </div>
            </div>
            <div>${formatMoney(variant.price_cents, variant.currency || product.currency)}</div>
          </div>
        `).join("")}
      </div>
      ${more > 0 ? `<div class="admin-catalog-variant-more">+${more} more variants in source catalog</div>` : ""}
    </div>
  `;
}

function renderVariantStageEditor(product, canEdit) {
  if (!Array.isArray(product.variants) || product.variants.length === 0) return "";
  return `
    <div class="admin-callout">
      <strong>Variant override staging</strong>
      <div class="admin-catalog-variant-stage-note">
        Review source variant pricing, availability, and imagery here. Any staged variant changes stay inside <span class="admin-mono">product_overrides.patch.variant_overrides</span> until downstream consumers adopt them.
      </div>
      <div class="admin-catalog-variant-stage-list">
        ${product.variants.map((variant) => {
          const overrideFields = Array.isArray(variant._override_fields) ? variant._override_fields : [];
          const stagePrice = overrideFields.includes("price_cents") ? String(variant.price_cents ?? "") : "";
          const stageAvailable = overrideFields.includes("available") ? String(variant.available) : "";
          const stageImage = overrideFields.includes("image_url") ? (variant.image_url || "") : "";
          const previewImage = variant.image_url || variant._source_image_url || "";
          return `
            <div class="admin-catalog-variant-stage-item" data-variant-id="${escapeHtml(String(variant.variant_id || ""))}">
              <div class="admin-catalog-variant-stage-head">
                <div>
                  <div>${escapeHtml(variant.title || variant.variant_id || "Untitled variant")}</div>
                  <div class="admin-catalog-variant-meta">
                    <span class="admin-mono">${escapeHtml(String(variant.variant_id || "—"))}</span>
                    ${variant.available === false ? '<span class="admin-badge s-cancelled">current unavailable</span>' : '<span class="admin-badge s-paid">current available</span>'}
                    ${overrideFields.length ? `<span class="admin-badge s-processing">staged ${escapeHtml(overrideFields.join(", "))}</span>` : ""}
                    ${String(variant.variant_id) === String(product.default_variant_id) ? '<span class="admin-badge s-processing">default</span>' : ""}
                  </div>
                </div>
                ${previewImage ? `<img class="admin-catalog-variant-stage-image" src="${escapeHtml(previewImage)}" alt="" loading="lazy" onerror="this.hidden=true" />` : ""}
              </div>
              <div class="admin-catalog-variant-stage-grid">
                <div class="admin-catalog-variant-stage-source">
                  <div><strong>Source</strong></div>
                  <div>Price: ${formatMoney(variant._source_price_cents, variant.currency || product.currency)}</div>
                  <div>Availability: ${variant._source_available === false ? "Unavailable" : "Available"}</div>
                  <div class="admin-catalog-variant-stage-url">${variant._source_image_url ? escapeHtml(variant._source_image_url) : "No image URL"}</div>
                </div>
                <div class="admin-catalog-variant-stage-fields">
                  <div class="admin-grid-2">
                    <div class="admin-field">
                      <label>Stage price (cents)</label>
                      <input
                        data-field="price_cents"
                        type="number"
                        min="0"
                        max="1000000"
                        step="1"
                        value="${escapeHtml(stagePrice)}"
                        placeholder="${escapeHtml(String(variant._source_price_cents ?? ""))}"
                        ${canEdit ? "" : "disabled"}
                      />
                    </div>
                    <div class="admin-field">
                      <label>Stage availability</label>
                      <select data-field="available" ${canEdit ? "" : "disabled"}>
                        <option value="">Use source (${variant._source_available === false ? "Unavailable" : "Available"})</option>
                        <option value="true"${stageAvailable === "true" ? " selected" : ""}>Available</option>
                        <option value="false"${stageAvailable === "false" ? " selected" : ""}>Unavailable</option>
                      </select>
                    </div>
                  </div>
                  <div class="admin-field">
                    <label>Stage image URL</label>
                    <input
                      data-field="image_url"
                      value="${escapeHtml(stageImage)}"
                      placeholder="${escapeHtml(variant._source_image_url || "")}"
                      ${canEdit ? "" : "disabled"}
                    />
                  </div>
                </div>
              </div>
            </div>
          `;
        }).join("")}
      </div>
    </div>
  `;
}

function collectVariantOverrides(form) {
  const overrides = {};
  form.querySelectorAll("[data-variant-id]").forEach((row) => {
    const variantId = row.getAttribute("data-variant-id");
    if (!variantId) return;
    const staged = {};
    const priceValue = row.querySelector('[data-field="price_cents"]')?.value.trim() || "";
    const availableValue = row.querySelector('[data-field="available"]')?.value || "";
    const imageValue = row.querySelector('[data-field="image_url"]')?.value.trim() || "";

    if (priceValue !== "") staged.price_cents = Number.parseInt(priceValue, 10);
    if (availableValue !== "") staged.available = availableValue === "true";
    if (imageValue !== "") staged.image_url = imageValue;

    if (Object.keys(staged).length > 0) {
      overrides[variantId] = staged;
    }
  });
  return overrides;
}

async function openProduct(app, product, reload) {
  const canEdit = app.user && app.user.role === "super_admin";
  const changes = changedFields(product);
  const modal = openModal(`${product.brand} — ${product.name}`, `
    <div class="admin-product-summary">
      ${product.image ? `<img class="admin-product-image" src="${escapeHtml(product.image)}" alt="" loading="lazy" onerror="this.hidden=true" />` : ""}
      <dl class="admin-kv">
        <dt>ID</dt><dd><span class="admin-mono">${escapeHtml(String(product.id))}</span></dd>
        <dt>Brand</dt><dd>${escapeHtml(product.brand || "—")}</dd>
        <dt>Category</dt><dd>${escapeHtml(product.section_title || product.section_id || "—")}</dd>
        <dt>Has variants</dt><dd>${product.has_variants ? "Yes" : "No"}</dd>
        <dt>Variant count</dt><dd>${escapeHtml(String(variantCount(product)))}</dd>
        <dt>Default variant</dt><dd>${product.default_variant_id ? `<span class="admin-mono">${escapeHtml(String(product.default_variant_id))}</span>` : "—"}</dd>
        <dt>Source price</dt><dd>${formatMoney(product._source_price_cents ?? product.price_cents, product.currency)}</dd>
        <dt>Override price</dt><dd>${product._override ? formatMoney(product.price_cents, product.currency) : "—"}</dd>
        <dt>Requires selection</dt><dd>${product.requires_variant_selection ? "Yes" : "No"}</dd>
        <dt>State</dt><dd>${product.available === false ? '<span class="admin-badge s-cancelled">unavailable</span>' : '<span class="admin-badge s-paid">available</span>'} ${product._hidden ? '<span class="admin-badge s-rejected">hidden</span>' : ""} ${product._override ? '<span class="admin-badge s-processing">override</span>' : ""}</dd>
        <dt>Override updated</dt><dd>${product._updated_at ? escapeHtml(new Date(product._updated_at).toLocaleString()) : "—"}</dd>
      </dl>
    </div>
    ${changes.length ? `<div class="admin-callout">Override differs from source for: <strong>${escapeHtml(changes.join(", "))}</strong></div>` : ""}
    ${renderVariantPreview(product)}
    ${renderVariantStageEditor(product, canEdit)}
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
      ${canEdit ? `
        <div class="admin-actions-row">
          <button type="submit" class="admin-btn admin-btn-primary">Save override</button>
          <button type="button" class="admin-btn admin-btn-danger" data-act="reset"${product._override ? "" : " disabled"}>Reset to source</button>
        </div>
      ` : '<div class="admin-empty admin-empty-compact">Super admin access is required to edit catalog overrides.</div>'}
    </form>
  `);

  if (!canEdit) return;

  const form = modal.body.querySelector("#catalog-edit");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const body = {
      name: fd.get("name"),
      price_cents: Number.parseInt(fd.get("price_cents"), 10),
      available: fd.get("available") === "true",
      image: fd.get("image"),
      url: fd.get("url"),
      hidden: fd.get("hidden") === "on",
      variant_overrides: collectVariantOverrides(form),
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

  form.querySelector('[data-act="reset"]')?.addEventListener("click", async () => {
    if (!product._override) return;
    if (!window.confirm("Remove this override and restore source catalog values?")) return;
    try {
      await app.authFetch(`/api/admin/catalog/${encodeURIComponent(product.id)}`, {
        method: "DELETE",
      });
      toast("Override removed", "success");
      modal.close();
      reload();
    } catch (err) {
      toast(err.message || "Reset failed", "error");
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
        {
          label: "Variants",
          render: (r) => `
            <div class="admin-catalog-variant-cell">
              <div>${escapeHtml(variantLabel(r))}</div>
              <div class="admin-catalog-variant-meta">
                ${r.default_variant_id ? `<span class="admin-mono">default ${escapeHtml(String(r.default_variant_id))}</span>` : ""}
              </div>
            </div>
          `,
        },
        { label: "Category", render: (r) => escapeHtml(r.section_title || r.section_id || "—") },
        { label: "Price", render: (r) => formatMoney(r.price_cents, r.currency) },
        {
          label: "State",
          render: (r) =>
            (r.available === false ? '<span class="admin-badge s-cancelled">unavailable</span>' : '<span class="admin-badge s-paid">available</span>') +
            (r._hidden ? ' <span class="admin-badge s-rejected">hidden</span>' : "") +
            (r._override ? ' <span class="admin-badge s-processing">edited</span>' : "") +
            (r._variant_override_count ? ` <span class="admin-badge s-processing">${escapeHtml(String(r._variant_override_count))} variant staged</span>` : ""),
        },
      ],
      onRowClick: (row) => openProduct(app, row, () => controls.reload()),
    });
  },
};
