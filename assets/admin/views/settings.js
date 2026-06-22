// Settings view (super_admin only): edit app_settings JSON values.
import { escapeHtml, formatDate, toast } from "../admin-core.js?v=20260623-no-hang";

function input(name, label, value, attrs = "") {
  return `<div class="admin-field"><label>${escapeHtml(label)}</label><input name="${escapeHtml(name)}" value="${escapeHtml(value ?? "")}" ${attrs} /></div>`;
}

function checkbox(name, label, checked) {
  return `<label class="admin-check"><input type="checkbox" name="${escapeHtml(name)}" ${checked ? "checked" : ""} /> ${escapeHtml(label)}</label>`;
}

function settingsForm(setting) {
  const value = setting.value || {};
  if (setting.key === "shipping") {
    return `
      <form data-key="shipping" data-mode="structured">
        <div class="admin-grid-2">
          ${input("flat_amount_cents", "Flat shipping (cents)", value.flat_amount_cents, 'type="number" min="0" max="100000" step="1"')}
          ${input("free_shipping_min_cents", "Free shipping minimum (cents)", value.free_shipping_min_cents, 'type="number" min="0" max="1000000" step="1"')}
        </div>
        ${input("countries", "Countries", (value.countries || []).join(", "))}
        <button type="submit" class="admin-btn admin-btn-primary">Save shipping</button>
      </form>`;
  }
  if (setting.key === "tax") {
    return `
      <form data-key="tax" data-mode="structured">
        ${checkbox("automatic", "Automatic tax", Boolean(value.automatic))}
        ${input("default_rate_bps", "Default rate (basis points)", value.default_rate_bps, 'type="number" min="0" max="10000" step="1"')}
        <button type="submit" class="admin-btn admin-btn-primary">Save tax</button>
      </form>`;
  }
  if (setting.key === "returns") {
    return `
      <form data-key="returns" data-mode="structured">
        ${input("window_days", "Return window days", value.window_days, 'type="number" min="0" max="365" step="1"')}
        <div class="admin-check-row">
          ${checkbox("allow_refund", "Allow refunds", Boolean(value.allow_refund))}
          ${checkbox("allow_replacement", "Allow replacements", Boolean(value.allow_replacement))}
        </div>
        <button type="submit" class="admin-btn admin-btn-primary">Save returns</button>
      </form>`;
  }
  return `<pre class="admin-json-mini">${escapeHtml(JSON.stringify(value, null, 2))}</pre>`;
}

function payloadFromForm(form) {
  const fd = new FormData(form);
  const key = form.getAttribute("data-key");
  if (key === "shipping") {
    return {
      flat_amount_cents: Number.parseInt(fd.get("flat_amount_cents"), 10),
      free_shipping_min_cents: Number.parseInt(fd.get("free_shipping_min_cents"), 10),
      countries: String(fd.get("countries") || "").split(",").map((v) => v.trim().toUpperCase()).filter(Boolean),
    };
  }
  if (key === "tax") {
    return {
      automatic: fd.get("automatic") === "on",
      default_rate_bps: Number.parseInt(fd.get("default_rate_bps"), 10),
    };
  }
  if (key === "returns") {
    return {
      window_days: Number.parseInt(fd.get("window_days"), 10),
      allow_refund: fd.get("allow_refund") === "on",
      allow_replacement: fd.get("allow_replacement") === "on",
    };
  }
  return null;
}

export default {
  title: "Settings",
  async render(mount, app) {
    const { settings } = await app.authFetch("/api/admin/settings");

    if (!settings.length) {
      mount.innerHTML = '<div class="admin-empty">No settings defined.</div>';
      return;
    }

    mount.innerHTML = settings
      .map(
        (s) => `
      <div class="admin-card" style="margin-bottom:1.25rem;">
        <div class="admin-card-head">
          <div>
            <h2>${escapeHtml(s.key)}</h2>
            <div class="admin-metric-sub">${escapeHtml(s.description || "")}</div>
          </div>
          <span class="admin-metric-sub">Updated ${formatDate(s.updated_at)}</span>
        </div>
        <div style="padding:1.25rem;">
          ${settingsForm(s)}
        </div>
      </div>`
      )
      .join("");

    mount.querySelectorAll("form[data-key]").forEach((form) => {
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const key = form.getAttribute("data-key");
        const value = payloadFromForm(form);
        if (!value) {
          toast("Unsupported settings form", "error");
          return;
        }
        try {
          await app.authFetch("/api/admin/settings", {
            method: "PATCH",
            body: JSON.stringify({ key, value }),
          });
          toast(`${key} saved`, "success");
        } catch (err) {
          toast(err.message || "Save failed", "error");
        }
      });
    });
  },
};
