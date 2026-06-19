// Users & admins view (super_admin only): manage roles.
import { escapeHtml, formatDate, roleBadge, roleLabel, toast } from "../admin-core.js";
import { listView, openModal } from "./_ui.js";

const ROLES = ["user", "admin", "super_admin"];
const OWNER_EMAIL = "renvagu1@icloud.com";

async function openUser(app, user, reload) {
  const isSelf = app.user && app.user.id === user.id;
  const isOwner = user.email === OWNER_EMAIL;
  const modal = openModal(`Manage ${user.email}`, `
    <dl class="admin-kv">
      <dt>Email</dt><dd>${escapeHtml(user.email)}</dd>
      <dt>Name</dt><dd>${escapeHtml(user.full_name || "—")}</dd>
      <dt>Current role</dt><dd>${roleBadge(user.role)}</dd>
      <dt>Created</dt><dd>${formatDate(user.created_at)}</dd>
    </dl>
    <form id="user-edit" style="margin-top:1rem;">
      <div class="admin-field">
        <label>Role</label>
        <select name="role" ${isSelf || isOwner ? "disabled" : ""}>
          ${ROLES.filter((r) => r !== "super_admin" || isOwner).map((r) => `<option value="${r}"${r === user.role ? " selected" : ""}>${roleLabel(r)}</option>`).join("")}
        </select>
      </div>
      ${isSelf ? '<p class="admin-metric-sub">You cannot change your own role.</p>' : ""}
      ${isOwner ? '<p class="admin-metric-sub">Owner account is locked to Super admin.</p>' : ""}
      <button type="submit" class="admin-btn admin-btn-primary" ${isSelf || isOwner ? "disabled" : ""}>Update role</button>
    </form>
  `);

  modal.body.querySelector("#user-edit").addEventListener("submit", async (e) => {
    e.preventDefault();
    const role = new FormData(e.target).get("role");
    if (role !== user.role && !window.confirm(`Change ${user.email} from ${roleLabel(user.role)} to ${roleLabel(role)}?`)) return;
    try {
      await app.authFetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        body: JSON.stringify({ role, confirmation: `${user.email}:${role}` }),
      });
      toast("Role updated", "success");
      modal.close();
      reload();
    } catch (err) {
      toast(err.message || "Update failed", "error");
    }
  });
}

export default {
  title: "Users & admins",
  async render(mount, app) {
    let controls;
    controls = await listView({
      mount,
      app,
      endpoint: "/api/admin/users",
      dataKey: "users",
      statuses: ROLES.map((r) => ({ value: r, label: roleLabel(r) })),
      filterParam: "role",
      searchPlaceholder: "Search email or name…",
      columns: [
        { label: "Email", render: (r) => escapeHtml(r.email) },
        { label: "Name", render: (r) => escapeHtml(r.full_name || "—") },
        { label: "Role", render: (r) => roleBadge(r.role) },
        { label: "Created", render: (r) => formatDate(r.created_at) },
      ],
      onRowClick: (row) => openUser(app, row, () => controls.reload()),
    });
  },
};
