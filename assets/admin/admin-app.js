// Admin panel bootstrap: session guard, role-aware nav, and hash router.
import { supabase, authFetch, redirectToLogin, roleLabel, toast } from "./admin-core.js?v=20260623-magic-link";
import dashboard from "./views/dashboard.js";
import orders from "./views/orders.js";
import returns from "./views/returns.js";
import intents from "./views/intents.js";
import catalog from "./views/catalog.js";
import users from "./views/users.js";
import settings from "./views/settings.js";
import audit from "./views/audit.js";
import privatePricing from "./views/private-pricing.js";

window.__athletonicAdminModuleLoaded = true;

const VIEWS = {
  dashboard,
  orders,
  returns,
  intents,
  catalog,
  privatePricing,
  users,
  settings,
  audit,
};
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

const ADMIN_ROLES = ["admin", "super_admin"];

function withTimeout(promise, ms, message) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      window.setTimeout(() => reject(new Error(message)), ms);
    }),
  ]);
}

function showBootError(message) {
  window.__athletonicAdminBooted = true;
  els.loading.innerHTML =
    `<p class="admin-error">${message}</p>` +
    '<p><a class="admin-btn" href="./login.html">Back to sign in</a></p>';
}

async function loadAdminProfile(session) {
  const user = session.user;
  const { data, error } = await withTimeout(
    supabase
      .from("profiles")
      .select("email, full_name, role")
      .eq("id", user.id)
      .maybeSingle(),
    6000,
    "Admin profile lookup took too long. Please try signing in again."
  );

  if (error) {
    const err = new Error(error.message || "Could not verify your admin profile.");
    err.status = error.status || 500;
    throw err;
  }
  if (!data || !ADMIN_ROLES.includes(data.role)) {
    const err = new Error("This account does not have admin access.");
    err.status = 403;
    throw err;
  }

  return {
    id: user.id,
    email: data.email || user.email,
    full_name: data.full_name || null,
    role: data.role,
  };
}

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
  if (["users", "settings", "privatePricing"].includes(route) && app.user.role !== "super_admin") {
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
  try {
    const { data } = await withTimeout(
      supabase.auth.getSession(),
      10000,
      "Session verification took too long. Please try signing in again."
    );
    if (!data || !data.session) {
      redirectToLogin();
      return;
    }
    // Fast boot: use the authenticated user's own profile via Supabase RLS.
    // Server-side APIs still enforce admin access for privileged data/actions.
    let user;
    try {
      user = await loadAdminProfile(data.session);
    } catch (err) {
      if (err.status === 403) {
        await supabase.auth.signOut();
        showBootError("This account does not have admin access.");
        return;
      }
      showBootError(err.message || "Could not verify your admin profile.");
      return;
    }

    app.user = user;
    els.email.textContent = user.email;
    els.role.textContent = roleLabel(user.role);
    els.role.className = `admin-badge role-${user.role}`;
    applyRoleVisibility();

    els.loading.hidden = true;
    els.shell.hidden = false;
    window.__athletonicAdminBooted = true;

    window.addEventListener("hashchange", renderRoute);
    await renderRoute();
  } catch (error) {
    showBootError(error.message || "We could not verify your session.");
  }
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
