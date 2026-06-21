// Shared admin client utilities (ES module, no build step).
// Loads supabase-js from CDN and exposes a configured client + helpers.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.108.2?bundle";

const SUPABASE_URL = window.ATHLETONIC_SUPABASE_URL;
const SUPABASE_KEY = window.ATHLETONIC_SUPABASE_KEY;

export const LOGIN_PATH = "./login.html";

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export async function getAccessToken() {
  const { data } = await supabase.auth.getSession();
  return data && data.session ? data.session.access_token : null;
}

/**
 * Fetch wrapper that attaches the Supabase bearer token and parses JSON.
 * Throws an Error with .code / .status on non-2xx responses.
 */
export async function authFetch(path, options = {}) {
  const token = options.accessToken || await getAccessToken();
  if (!token) {
    redirectToLogin();
    throw new Error("not_authenticated");
  }

  const fetchOptions = { ...options };
  delete fetchOptions.accessToken;
  const headers = Object.assign(
    { Accept: "application/json" },
    fetchOptions.headers || {}
  );
  headers.Authorization = `Bearer ${token}`;
  if (fetchOptions.body && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(path, { ...fetchOptions, headers });
  let payload = null;
  try {
    payload = await res.json();
  } catch {
    payload = null;
  }

  if (!res.ok) {
    if (res.status === 401) redirectToLogin();
    const err = new Error((payload && payload.message) || "Request failed");
    err.code = payload && payload.error;
    err.status = res.status;
    throw err;
  }
  return payload;
}

export function redirectToLogin() {
  if (!window.location.pathname.endsWith("login.html")) {
    window.location.replace(LOGIN_PATH);
  }
}

/* ---------- Formatting helpers ---------- */
export function escapeHtml(value) {
  if (value == null) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function formatMoney(cents, currency = "USD") {
  const amount = Number(cents || 0) / 100;
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);
  } catch {
    return `$${amount.toFixed(2)}`;
  }
}

export function formatDecimalMoney(amount, currency = "USD") {
  const number = Number(amount || 0);
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(number);
  } catch {
    return `$${number.toFixed(2)}`;
  }
}

export function formatDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function statusBadge(status) {
  const safe = escapeHtml(status || "—");
  return `<span class="admin-badge s-${escapeHtml(status || "")}">${safe}</span>`;
}

export function compactJson(value) {
  if (value == null) return "—";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

// SINGLE SOURCE OF TRUTH for shopper role naming.
// DB/role value = 'user'; human label = 'Customer'; 'user' is internal only.
// Never store 'customer' as a role (DB constraint allows only user|admin|super_admin).
const ROLE_LABELS = {
  user: "Customer",
  admin: "Admin",
  super_admin: "Super admin",
};

export function roleLabel(role) {
  return ROLE_LABELS[role] || role || "";
}

export function roleBadge(role) {
  return `<span class="admin-badge role-${escapeHtml(role || "")}">${escapeHtml(roleLabel(role))}</span>`;
}

let toastTimer = null;
export function toast(message, type = "") {
  const el = document.getElementById("admin-toast");
  if (!el) return;
  el.textContent = message;
  el.className = "admin-toast" + (type ? ` is-${type}` : "");
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.hidden = true;
  }, 3800);
}
