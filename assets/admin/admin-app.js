// Admin panel bootstrap: session guard, role-aware nav, and hash router.
import { supabase, authFetch, redirectToLogin, roleLabel, toast } from "./admin-core.js";
import dashboard from "./views/dashboard.js";
import orders from "./views/orders.js";
import returns from "./views/returns.js";
import intents from "./views/intents.js";
import catalog from "./views/catalog.js";
import users from "./views/users.js";
import settings from "./views/settings.js";
import audit from "./views/audit.js";

const VIEWS = { dashboard, orders, returns, intents, catalog, users, settings, audit };
const DEFAULT_ROUTE = "dashboard";

const app = {
  user: null,
  authFetch,
  toast,
  navigate(route) {
    window.location.hash = `#/${route}`;
  },
};

const els = {
  loading: document.getElementById("admin-loading"),
  shell: document.getElementById("admin-shell"),
  view: document.getElementById("admin-view"),
  title: document.getElementById("admin-view-title"),
  actions: document.getElementById("admin-topbar-actions"),
  nav: document.getElementById("admin-nav"),
  email: document.getElementById("admin-user-email"),
  role: document.getElementById("admin-user-role"),
  signout: document.getElementById("admin-signout"),
};

function parseRoute() {
  const raw = (window.location.hash || "").replace(/^#\//, "").trim();
  const route = raw.split("/")[0] || DEFAULT_ROUTE;
  const param = raw.split("/")[1] || null;
  return { route: VIEWS[route] ? route : DEFAULT_ROUTE, param };
}

function applyRoleVisibility() {
  const isSuper = app.user && app.user.role === "super_admin";
  document.querySelectorAll("[data-requires]").forEach((el) => {
    const needs = el.getAttribute("data-requires");
    const allowed = needs === "super_admin" ? isSuper : true;
    el.classList.toggle("is-hidden", !allowed);
  });
}

function highlightNav(route) {
  els.nav.querySelectorAll(".admin-nav-link").forEach((link) => {
    link.classList.toggle("is-active", link.getAttribute("data-route") === route);
  });
}

async function renderRoute() {
  const { route, param } = parseRoute();
  const view = VIEWS[route];

  // Guard super-admin-only routes.
  if ((route === "users" || route === "settings") && app.user.role !== "super_admin") {
    app.navigate(DEFAULT_ROUTE);
    return;
  }

  highlightNav(route);
  els.title.textContent = view.title;
  els.actions.innerHTML = "";
  els.view.innerHTML = '<div class="admin-empty">Loading…</div>';

  try {
    await view.render(els.view, app, { param, actions: els.actions });
  } catch (err) {
    if (err && err.message === "not_authenticated") return;
    els.view.innerHTML = `<div class="admin-error">${err.message || "Something went wrong."}</div>`;
  }
}

async function boot() {
  const { data } = await supabase.auth.getSession();
  if (!data || !data.session) {
    redirectToLogin();
    return;
  }

  // Confirm the caller actually has admin access (server-side check).
  let me;
  try {
    me = await authFetch("/api/admin/me");
  } catch (err) {
    if (err.status === 403) {
      await supabase.auth.signOut();
      els.loading.innerHTML =
        '<p class="admin-error">This account does not have admin access.</p>' +
        '<p><a class="admin-btn" href="./login.html">Back to sign in</a></p>';
      return;
    }
    redirectToLogin();
    return;
  }

  app.user = me.user;
  els.email.textContent = me.user.email;
  els.role.textContent = roleLabel(me.user.role);
  els.role.className = `admin-badge role-${me.user.role}`;
  applyRoleVisibility();

  els.loading.hidden = true;
  els.shell.hidden = false;

  window.addEventListener("hashchange", renderRoute);
  await renderRoute();
}

els.signout.addEventListener("click", async () => {
  await supabase.auth.signOut();
  redirectToLogin();
});

// React to auth changes (e.g. token expiry).
supabase.auth.onAuthStateChange((event) => {
  if (event === "SIGNED_OUT") redirectToLogin();
});

boot();
