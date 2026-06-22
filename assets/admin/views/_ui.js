// Shared UI building blocks for admin list/detail views.
import { escapeHtml } from "../admin-core.js?v=20260623-no-hang";

export function h(html) {
  const tpl = document.createElement("template");
  tpl.innerHTML = html.trim();
  return tpl.content.firstElementChild;
}

export function optionList(values, selected) {
  return values
    .map(
      (v) =>
        `<option value="${escapeHtml(v.value)}"${
          v.value === selected ? " selected" : ""
        }>${escapeHtml(v.label)}</option>`
    )
    .join("");
}

export function emptyOption(label) {
  return `<option value="">${escapeHtml(label)}</option>`;
}

/**
 * Render a paginated, filterable list view.
 *
 * config = {
 *   mount, app,
 *   endpoint: "/api/admin/orders",
 *   dataKey: "orders",          // key in response holding the array
 *   columns: [{ label, render(row) }],
 *   statuses: [{value,label}],  // optional status filter options
 *   searchPlaceholder,
 *   onRowClick(row),            // optional
 * }
 */
export async function listView(config) {
  const { mount, app } = config;
  const state = { page: 1, search: "", filters: {} };

  mount.innerHTML = "";
  const extraFilters = config.filters || [];
  const toolbar = h(`
    <div class="admin-toolbar">
      ${
        config.searchPlaceholder === null
          ? ""
          : `<input type="search" placeholder="${escapeHtml(
              config.searchPlaceholder || "Search…"
            )}" aria-label="Search" />`
      }
      ${
        config.statuses
          ? `<select aria-label="Filter by status">
               <option value="">All statuses</option>
               ${optionList(config.statuses, "")}
             </select>`
          : ""
      }
      ${extraFilters
        .map((filter) => {
          if (filter.type === "date") {
            return `<input type="date" data-filter="${escapeHtml(filter.name)}" aria-label="${escapeHtml(filter.label)}" />`;
          }
          return `<select data-filter="${escapeHtml(filter.name)}" aria-label="${escapeHtml(filter.label)}">
            ${emptyOption(filter.emptyLabel || filter.label)}
            ${optionList(filter.options || [], "")}
          </select>`;
        })
        .join("")}
      <button class="admin-btn admin-btn-sm" data-act="refresh">Refresh</button>
    </div>
  `);
  const card = h(`
    <div class="admin-card">
      <div class="admin-table-wrap"><div class="admin-empty">Loading…</div></div>
      <div class="admin-pagination" hidden>
        <span class="admin-page-info"></span>
        <span class="admin-page-btns">
          <button class="admin-btn admin-btn-sm" data-page="prev">Prev</button>
          <button class="admin-btn admin-btn-sm" data-page="next">Next</button>
        </span>
      </div>
    </div>
  `);
  mount.append(toolbar, card);

  const searchInput = toolbar.querySelector('input[type="search"]');
  const statusSelect = toolbar.querySelector("select:not([data-filter])");
  const tableWrap = card.querySelector(".admin-table-wrap");
  const pager = card.querySelector(".admin-pagination");
  const pageInfo = card.querySelector(".admin-page-info");
  const prevBtn = card.querySelector('[data-page="prev"]');
  const nextBtn = card.querySelector('[data-page="next"]');

  let total = 0;
  let pageSize = 25;

  async function load() {
    tableWrap.innerHTML = '<div class="admin-empty">Loading…</div>';
    const params = new URLSearchParams({ page: String(state.page) });
    if (state.search) params.set("search", state.search);
    if (state.filters.status) params.set(config.filterParam || "status", state.filters.status);
    for (const [name, value] of Object.entries(state.filters)) {
      if (name !== "status" && value) params.set(name, value);
    }

    const data = await app.authFetch(`${config.endpoint}?${params.toString()}`);
    const rows = data[config.dataKey] || [];
    if (typeof config.afterLoad === "function") config.afterLoad(data);
    total = (data.pagination && data.pagination.total) || rows.length;
    pageSize = (data.pagination && data.pagination.page_size) || 25;

    if (rows.length === 0) {
      tableWrap.innerHTML = '<div class="admin-empty">No records found.</div>';
      pager.hidden = true;
      return;
    }

    const thead = config.columns.map((c) => `<th>${escapeHtml(c.label)}</th>`).join("");
    const tbody = rows
      .map((row, idx) => {
        const cells = config.columns.map((c) => `<td>${c.render(row)}</td>`).join("");
        const clickable = config.onRowClick ? ' class="admin-row-action"' : "";
        return `<tr data-idx="${idx}"${clickable}>${cells}</tr>`;
      })
      .join("");
    tableWrap.innerHTML = `<table class="admin-table"><thead><tr>${thead}</tr></thead><tbody>${tbody}</tbody></table>`;

    if (config.onRowClick) {
      tableWrap.querySelectorAll("tbody tr").forEach((tr) => {
        tr.addEventListener("click", () => config.onRowClick(rows[Number(tr.dataset.idx)]));
      });
    }

    const start = (state.page - 1) * pageSize + 1;
    const end = Math.min(state.page * pageSize, total);
    pageInfo.textContent = `${start}–${end} of ${total}`;
    prevBtn.disabled = state.page <= 1;
    nextBtn.disabled = end >= total;
    pager.hidden = false;
  }

  let searchTimer = null;
  if (searchInput) {
    searchInput.addEventListener("input", () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        state.search = searchInput.value.trim();
        state.page = 1;
        load().catch((e) => (tableWrap.innerHTML = `<div class="admin-error">${e.message}</div>`));
      }, 300);
    });
  }
  if (statusSelect) {
    statusSelect.addEventListener("change", () => {
      state.filters.status = statusSelect.value;
      state.page = 1;
      load().catch((e) => (tableWrap.innerHTML = `<div class="admin-error">${e.message}</div>`));
    });
  }
  toolbar.querySelectorAll("[data-filter]").forEach((filterEl) => {
    filterEl.addEventListener("change", () => {
      state.filters[filterEl.getAttribute("data-filter")] = filterEl.value;
      state.page = 1;
      load().catch((e) => (tableWrap.innerHTML = `<div class="admin-error">${e.message}</div>`));
    });
  });
  toolbar.querySelector('[data-act="refresh"]').addEventListener("click", () => load());
  prevBtn.addEventListener("click", () => {
    if (state.page > 1) {
      state.page -= 1;
      load();
    }
  });
  nextBtn.addEventListener("click", () => {
    state.page += 1;
    load();
  });

  await load();
  return { reload: load };
}

/**
 * Simple modal/drawer for detail editing.
 */
export function openModal(title, bodyHtml) {
  const overlay = h(`
    <div class="admin-modal-overlay">
      <div class="admin-modal" role="dialog" aria-modal="true">
        <div class="admin-modal-head">
          <h2>${escapeHtml(title)}</h2>
          <button class="admin-btn admin-btn-sm admin-btn-ghost" data-act="close">✕</button>
        </div>
        <div class="admin-modal-body">${bodyHtml}</div>
      </div>
    </div>
  `);
  document.body.appendChild(overlay);
  const close = () => overlay.remove();
  overlay.querySelector('[data-act="close"]').addEventListener("click", close);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });
  return { overlay, close, body: overlay.querySelector(".admin-modal-body") };
}
