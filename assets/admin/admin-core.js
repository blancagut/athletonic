// Shared admin client utilities (ES module, no build step).
// Uses Supabase Auth/PostgREST directly so admin boot has no external module CDN dependency.

const SUPABASE_URL = window.ATHLETONIC_SUPABASE_URL;
const SUPABASE_KEY = window.ATHLETONIC_SUPABASE_KEY;
const PROJECT_REF = (() => {
  try {
    return new URL(SUPABASE_URL).hostname.split(".")[0];
  } catch {
    return "athletonic";
  }
})();
const SESSION_STORAGE_KEY = `sb-${PROJECT_REF}-auth-token`;
const authListeners = new Set();

export const LOGIN_PATH = "./login.html";

function authHeaders(extra = {}) {
  return {
    apikey: SUPABASE_KEY,
    ...extra,
  };
}

function normalizeSession(payload) {
  if (!payload || !payload.access_token) return null;
  const expiresAt = payload.expires_at || (
    payload.expires_in ? Math.floor(Date.now() / 1000) + Number(payload.expires_in) : null
  );
  return {
    access_token: payload.access_token,
    refresh_token: payload.refresh_token || null,
    expires_in: payload.expires_in || null,
    expires_at: expiresAt,
    token_type: payload.token_type || "bearer",
    user: payload.user || null,
  };
}

function readStoredSession() {
  try {
    return normalizeSession(JSON.parse(window.localStorage.getItem(SESSION_STORAGE_KEY) || "null"));
  } catch {
    return null;
  }
}

function storeSession(session) {
  if (!session) return;
  window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
}

function clearSession() {
  window.localStorage.removeItem(SESSION_STORAGE_KEY);
}

function notifyAuth(event, session = null) {
  authListeners.forEach((listener) => {
    try {
      listener(event, session);
    } catch {
      // Auth listeners must never break navigation.
    }
  });
}

async function parseJsonResponse(res) {
  let payload = null;
  try {
    payload = await res.json();
  } catch {
    payload = null;
  }
  return payload;
}

function authError(payload, fallback = "Authentication failed.") {
  return {
    message: (payload && (payload.error_description || payload.msg || payload.message || payload.error)) || fallback,
    status: payload && payload.status,
  };
}

async function refreshSession(session) {
  if (!session || !session.refresh_token) return null;
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ refresh_token: session.refresh_token }),
  });
  const payload = await parseJsonResponse(res);
  if (!res.ok) {
    clearSession();
    return null;
  }
  const nextSession = normalizeSession(payload);
  storeSession(nextSession);
  return nextSession;
}

async function getCurrentSession() {
  const session = readStoredSession();
  if (!session) return null;
  const now = Math.floor(Date.now() / 1000);
  if (session.expires_at && session.expires_at - now < 60) {
    return refreshSession(session);
  }
  return session;
}

function createQuery(table) {
  const params = new URLSearchParams();
  const filters = [];
  return {
    select(columns) {
      params.set("select", columns);
      return this;
    },
    eq(column, value) {
      filters.push([column, `eq.${value}`]);
      return this;
    },
    async maybeSingle() {
      filters.forEach(([column, value]) => params.set(column, value));
      params.set("limit", "1");
      const session = await getCurrentSession();
      if (!session) {
        return { data: null, error: { message: "Authentication required.", status: 401 } };
      }
      const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params.toString()}`, {
        headers: authHeaders({
          Accept: "application/json",
          Authorization: `Bearer ${session.access_token}`,
        }),
      });
      const payload = await parseJsonResponse(res);
      if (!res.ok) {
        return { data: null, error: { ...authError(payload, "Request failed."), status: res.status } };
      }
      return { data: Array.isArray(payload) ? payload[0] || null : payload || null, error: null };
    },
  };
}

export const supabase = {
  auth: {
    async getSession() {
      return { data: { session: await getCurrentSession() }, error: null };
    },
    async signInWithPassword({ email, password }) {
      const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
        method: "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ email, password }),
      });
      const payload = await parseJsonResponse(res);
      if (!res.ok) {
        return { data: { session: null, user: null }, error: authError(payload, "Could not sign in.") };
      }
      const session = normalizeSession(payload);
      storeSession(session);
      notifyAuth("SIGNED_IN", session);
      return { data: { session, user: session.user }, error: null };
    },
    async signOut() {
      const session = readStoredSession();
      clearSession();
      if (session && session.access_token) {
        fetch(`${SUPABASE_URL}/auth/v1/logout`, {
          method: "POST",
          headers: authHeaders({ Authorization: `Bearer ${session.access_token}` }),
        }).catch(() => {});
      }
      notifyAuth("SIGNED_OUT", null);
      return { error: null };
    },
    onAuthStateChange(listener) {
      authListeners.add(listener);
      return {
        data: {
          subscription: {
            unsubscribe() {
              authListeners.delete(listener);
            },
          },
        },
      };
    },
  },
  from: createQuery,
};

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
