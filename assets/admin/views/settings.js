// Settings view (super_admin only): edit app_settings JSON values.
import { escapeHtml, formatDate, toast } from "../admin-core.js";

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
          <form data-key="${escapeHtml(s.key)}">
            <div class="admin-field">
              <label>Value (JSON)</label>
              <textarea name="value" style="min-height:150px;font-family:ui-monospace,monospace;">${escapeHtml(
                JSON.stringify(s.value, null, 2)
              )}</textarea>
            </div>
            <button type="submit" class="admin-btn admin-btn-primary">Save ${escapeHtml(s.key)}</button>
          </form>
        </div>
      </div>`
      )
      .join("");

    mount.querySelectorAll("form[data-key]").forEach((form) => {
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const key = form.getAttribute("data-key");
        let value;
        try {
          value = JSON.parse(form.querySelector("textarea").value);
        } catch {
          toast("Invalid JSON", "error");
          return;
        }
        if (typeof value !== "object" || value === null || Array.isArray(value)) {
          toast("Value must be a JSON object", "error");
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
