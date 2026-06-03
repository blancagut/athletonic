// Audit log view: read-only stream of privileged actions.
import { escapeHtml, formatDate } from "../admin-core.js";
import { listView } from "./_ui.js";

export default {
  title: "Audit log",
  async render(mount, app) {
    await listView({
      mount,
      app,
      endpoint: "/api/admin/audit",
      dataKey: "events",
      searchPlaceholder: "",
      columns: [
        { label: "When", render: (r) => formatDate(r.created_at) },
        { label: "Actor", render: (r) => escapeHtml(r.actor_email || "—") },
        { label: "Role", render: (r) => escapeHtml(r.actor_role || "—") },
        { label: "Action", render: (r) => `<span class="admin-mono">${escapeHtml(r.action)}</span>` },
        {
          label: "Target",
          render: (r) =>
            `${escapeHtml(r.target_type || "")} <span class="admin-mono">${escapeHtml(r.target_id || "")}</span>`,
        },
      ],
    });
  },
};
