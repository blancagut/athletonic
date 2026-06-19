// Private pricing view (super_admin only): grant, revoke, and rotate access codes.
import { escapeHtml, formatDate, statusBadge, toast } from "../admin-core.js";
import { listView, openModal } from "./_ui.js";

const STATUSES = [
  { value: "active", label: "Active" },
  { value: "revoked", label: "Revoked" },
];

function codeBlock(accessCode) {
  return `
    <div class="admin-callout">
      <p class="admin-metric-sub">This access code is shown once. Share it securely with the approved customer.</p>
      <p class="admin-mono admin-code-display">${escapeHtml(accessCode)}</p>
    </div>
  `;
}

function openCreateGrant(app, reload) {
  const modal = openModal("Create private pricing access", `
    <form id="private-pricing-create">
      <div class="admin-field">
        <label>Email</label>
        <input name="email" type="email" autocomplete="off" required />
      </div>
      <div class="admin-field">
        <label>Profile</label>
        <input name="profile" value="private_access" />
      </div>
      <div class="admin-field">
        <label>Expires at (optional)</label>
        <input name="expires_at" type="datetime-local" />
      </div>
      <button type="submit" class="admin-btn admin-btn-primary">Create access</button>
    </form>
  `);

  modal.body.querySelector("#private-pricing-create").addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const payload = {
      email: fd.get("email"),
      profile: fd.get("profile"),
      expires_at: fd.get("expires_at") || null,
    };

    try {
      const result = await app.authFetch("/api/admin/private-pricing", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      toast("Access created", "success");
      modal.body.innerHTML = `
        ${codeBlock(result.access_code)}
        <dl class="admin-kv" style="margin-top:1rem;">
          <dt>Email</dt><dd>${escapeHtml(result.grant.email)}</dd>
          <dt>Status</dt><dd>${statusBadge(result.grant.status)}</dd>
          <dt>Profile</dt><dd>${escapeHtml(result.grant.profile)}</dd>
        </dl>
      `;
      reload();
    } catch (err) {
      toast(err.message || "Create failed", "error");
    }
  });
}

async function openGrant(app, grant, reload) {
  const modal = openModal(`Private access for ${grant.email}`, `
    <dl class="admin-kv">
      <dt>Email</dt><dd>${escapeHtml(grant.email)}</dd>
      <dt>Status</dt><dd>${statusBadge(grant.status)}</dd>
      <dt>Code hint</dt><dd>${grant.code_hint ? `Ends in ${escapeHtml(grant.code_hint)}` : "—"}</dd>
      <dt>Profile</dt><dd>${escapeHtml(grant.profile || "private_access")}</dd>
      <dt>Usage</dt><dd>${Number(grant.usage_count || 0)}</dd>
      <dt>Last used</dt><dd>${formatDate(grant.last_used_at)}</dd>
      <dt>Expires</dt><dd>${formatDate(grant.expires_at)}</dd>
      <dt>Updated</dt><dd>${formatDate(grant.updated_at)}</dd>
    </dl>
    <form id="private-pricing-edit" style="margin-top:1rem;">
      <div class="admin-field">
        <label>Profile</label>
        <input name="profile" value="${escapeHtml(grant.profile || "private_access")}" />
      </div>
      <div class="admin-field">
        <label>Status</label>
        <select name="status">
          ${STATUSES.map((s) => `<option value="${s.value}"${s.value === grant.status ? " selected" : ""}>${s.label}</option>`).join("")}
        </select>
      </div>
      <div class="admin-field">
        <label>Expires at (optional)</label>
        <input name="expires_at" type="datetime-local" />
      </div>
      <div class="admin-actions-row">
        <button type="submit" class="admin-btn admin-btn-primary">Save changes</button>
        <button type="button" class="admin-btn" data-act="regenerate">Regenerate code</button>
        <button type="button" class="admin-btn admin-btn-danger" data-act="revoke">Revoke</button>
      </div>
      <div data-code-result></div>
    </form>
  `);

  const form = modal.body.querySelector("#private-pricing-edit");
  const resultEl = modal.body.querySelector("[data-code-result]");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    try {
      await app.authFetch(`/api/admin/private-pricing/${grant.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          action: "update",
          profile: fd.get("profile"),
          status: fd.get("status"),
          expires_at: fd.get("expires_at") || undefined,
        }),
      });
      toast("Access updated", "success");
      modal.close();
      reload();
    } catch (err) {
      toast(err.message || "Update failed", "error");
    }
  });

  form.querySelector('[data-act="regenerate"]').addEventListener("click", async () => {
    if (!window.confirm("Regenerate this access code? The previous code will stop working.")) return;
    try {
      const result = await app.authFetch(`/api/admin/private-pricing/${grant.id}`, {
        method: "PATCH",
        body: JSON.stringify({ action: "regenerate" }),
      });
      resultEl.innerHTML = codeBlock(result.access_code);
      toast("Code regenerated", "success");
      reload();
    } catch (err) {
      toast(err.message || "Regenerate failed", "error");
    }
  });

  form.querySelector('[data-act="revoke"]').addEventListener("click", async () => {
    if (!window.confirm("Revoke this access code?")) return;
    try {
      await app.authFetch(`/api/admin/private-pricing/${grant.id}`, {
        method: "PATCH",
        body: JSON.stringify({ action: "revoke" }),
      });
      toast("Access revoked", "success");
      modal.close();
      reload();
    } catch (err) {
      toast(err.message || "Revoke failed", "error");
    }
  });
}

export default {
  title: "Private pricing",
  async render(mount, app, context = {}) {
    let controls;

    if (context.actions) {
      context.actions.innerHTML =
        '<button class="admin-btn admin-btn-primary" data-act="create-private-access">Create access</button>';
      context.actions
        .querySelector("[data-act='create-private-access']")
        .addEventListener("click", () => openCreateGrant(app, () => {
          if (controls) controls.reload();
        }));
    }

    controls = await listView({
      mount,
      app,
      endpoint: "/api/admin/private-pricing",
      dataKey: "grants",
      statuses: STATUSES,
      searchPlaceholder: "Search email or profile...",
      columns: [
        { label: "Email", render: (r) => escapeHtml(r.email) },
        { label: "Status", render: (r) => statusBadge(r.status) },
        { label: "Hint", render: (r) => (r.code_hint ? `Ends ${escapeHtml(r.code_hint)}` : "—") },
        { label: "Profile", render: (r) => escapeHtml(r.profile || "private_access") },
        { label: "Usage", render: (r) => String(Number(r.usage_count || 0)) },
        { label: "Last used", render: (r) => formatDate(r.last_used_at) },
        { label: "Expires", render: (r) => formatDate(r.expires_at) },
      ],
      onRowClick: (row) => openGrant(app, row, () => controls.reload()),
    });
  },
};
