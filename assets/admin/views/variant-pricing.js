import { escapeHtml, formatMoney, toast } from "../admin-core.js?v=20260623-magic-link";
import { listView, openModal } from "./_ui.js";

function variantSummary(product) {
  const count = Number(product.variant_count || 0);
  if (count <= 0) return "No variants";
  if (count === 1) return "1 variant";
  return `${count} variants`;
}

function optionSummary(variant) {
  const values = Array.isArray(variant.option_values) ? variant.option_values : [];
  if (!values.length) return "—";
  return values.map((entry) => `${entry.name}: ${entry.value}`).join(" / ");
}

function detailTable(product) {
  return `
    <div class="admin-callout">
      <strong>Product summary</strong>
      <dl class="admin-kv" style="margin-top:0.6rem;">
        <dt>ID</dt><dd><span class="admin-mono">${escapeHtml(String(product.id))}</span></dd>
        <dt>Brand</dt><dd>${escapeHtml(product.brand || "—")}</dd>
        <dt>Name</dt><dd>${escapeHtml(product.name || "—")}</dd>
        <dt>SKU</dt><dd>${escapeHtml(product.sku || "—")}</dd>
        <dt>Variants</dt><dd>${escapeHtml(String(product.variant_count || 0))}</dd>
      </dl>
    </div>
    <form id="variant-pricing-form">
      <div class="admin-table-wrap" style="margin-top:1rem;">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Variant</th>
              <th>Options</th>
              <th>SKU</th>
              <th>Source</th>
              <th>Normal</th>
              <th>Offer</th>
              <th>Active</th>
              <th>Effective</th>
              <th>Reset</th>
            </tr>
          </thead>
          <tbody>
            ${product.variants.map((variant) => `
              <tr data-variant-id="${escapeHtml(String(variant.variant_id || ""))}">
                <td>
                  <div>${escapeHtml(variant.title || "Default")}</div>
                  <div class="admin-catalog-variant-meta">
                    <span class="admin-mono">${escapeHtml(String(variant.variant_id || "—"))}</span>
                    ${variant.available === false ? '<span class="admin-badge s-cancelled">unavailable</span>' : '<span class="admin-badge s-paid">available</span>'}
                  </div>
                </td>
                <td>${escapeHtml(optionSummary(variant))}</td>
                <td><span class="admin-mono">${escapeHtml(variant.sku || "—")}</span></td>
                <td>${formatMoney(variant.source_price_cents, product.currency)}</td>
                <td><input type="number" min="0" step="1" data-field="regular_price_cents" value="${escapeHtml(String(variant.regular_price_cents ?? variant.source_price_cents ?? 0))}" /></td>
                <td><input type="number" min="0" step="1" data-field="offer_price_cents" value="${variant.offer_price_cents == null ? "" : escapeHtml(String(variant.offer_price_cents))}" placeholder="Optional" /></td>
                <td><label class="admin-check"><input type="checkbox" data-field="offer_enabled" ${variant.offer_enabled ? "checked" : ""} /> Offer</label></td>
                <td>
                  <div>${formatMoney(variant.effective_price_cents, product.currency)}</div>
                  <div class="admin-metric-sub">${variant.effective_compare_at_price_cents ? `Compare at ${escapeHtml(formatMoney(variant.effective_compare_at_price_cents, product.currency))}` : "No compare-at"}</div>
                </td>
                <td><button type="button" class="admin-btn admin-btn-sm" data-act="reset"${variant._override ? "" : " disabled"}>Reset</button></td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
      <div class="admin-actions-row" style="margin-top:1rem;">
        <button type="submit" class="admin-btn admin-btn-primary">Save prices</button>
      </div>
    </form>
  `;
}

function collectVariants(form) {
  return Array.from(form.querySelectorAll("[data-variant-id]")).map((row) => ({
    variant_id: row.getAttribute("data-variant-id"),
    regular_price_cents: Number.parseInt(
      row.querySelector('[data-field="regular_price_cents"]')?.value || "",
      10
    ),
    offer_price_cents: row.querySelector('[data-field="offer_price_cents"]')?.value || null,
    offer_enabled: Boolean(row.querySelector('[data-field="offer_enabled"]')?.checked),
  }));
}

async function openProduct(app, row, reload) {
  const detail = await app.authFetch(`/api/admin/variant-pricing/${encodeURIComponent(row.id)}`);
  const product = detail.product;
  const modal = openModal(`${product.brand} — ${product.name}`, detailTable(product));
  const form = modal.body.querySelector("#variant-pricing-form");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      await app.authFetch(`/api/admin/variant-pricing/${encodeURIComponent(product.id)}`, {
        method: "PATCH",
        body: JSON.stringify({ variants: collectVariants(form) }),
      });
      toast("Variant pricing saved", "success");
      modal.close();
      reload();
    } catch (error) {
      toast(error.message || "Save failed", "error");
    }
  });

  form.querySelectorAll('[data-act="reset"]').forEach((button) => {
    button.addEventListener("click", async () => {
      const rowEl = button.closest("[data-variant-id]");
      const variantId = rowEl && rowEl.getAttribute("data-variant-id");
      if (!variantId) return;
      if (!window.confirm("Reset this variant back to the source price?")) return;
      try {
        await app.authFetch(
          `/api/admin/variant-pricing/${encodeURIComponent(product.id)}?variant_id=${encodeURIComponent(variantId)}`,
          { method: "DELETE" }
        );
        toast("Variant reset", "success");
        modal.close();
        reload();
      } catch (error) {
        toast(error.message || "Reset failed", "error");
      }
    });
  });
}

export default {
  title: "Variant pricing",
  async render(mount, app) {
    let controls;
    controls = await listView({
      mount,
      app,
      endpoint: "/api/admin/variant-pricing",
      dataKey: "products",
      searchPlaceholder: "Search product name, brand, SKU or ID…",
      columns: [
        { label: "ID", render: (row) => `<span class="admin-mono">${escapeHtml(String(row.id))}</span>` },
        { label: "Brand", render: (row) => escapeHtml(row.brand || "—") },
        { label: "Name", render: (row) => escapeHtml(row.name || "—") },
        { label: "SKU", render: (row) => `<span class="admin-mono">${escapeHtml(row.sku || "—")}</span>` },
        { label: "Variants", render: (row) => escapeHtml(variantSummary(row)) },
        {
          label: "Price range",
          render: (row) =>
            row.variant_count > 0
              ? `${formatMoney(row.min_variant_price_cents, row.currency)} - ${formatMoney(row.max_variant_price_cents, row.currency)}`
              : formatMoney(row.product_price_cents, row.currency),
        },
        {
          label: "Offers",
          render: (row) =>
            row.active_offer_variant_count
              ? `<span class="admin-badge s-processing">${escapeHtml(String(row.active_offer_variant_count))} active</span>`
              : "—",
        },
      ],
      onRowClick: (clickedRow) => openProduct(app, clickedRow, () => controls.reload()),
    });
  },
};
