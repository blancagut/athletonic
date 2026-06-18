/**
 * Athletonic login / signup / forgot-password page logic.
 * Depends on: @supabase/supabase-js (loaded via CDN before this script).
 * Requires: window.ATHLETONIC_SUPABASE_URL  and  window.ATHLETONIC_SUPABASE_KEY
 */
(function () {
  "use strict";

  /* ── Supabase client ── */
  var createClient = window.supabase && window.supabase.createClient;
  if (!createClient) {
    console.error("Supabase JS not loaded");
    return;
  }

  var sb = createClient(
    window.ATHLETONIC_SUPABASE_URL,
    window.ATHLETONIC_SUPABASE_KEY
  );

  /* ── Safe redirect target ──
   * Only allow relative URLs or same-origin destinations
   * to prevent open-redirect attacks.
   */
  function safeReturnTo() {
    var params = new URLSearchParams(window.location.search);
    var raw = (params.get("return_to") || "").trim();
    if (!raw) return "../pages/account.html";
    // Allow relative paths and same-origin absolute URLs
    if (/^(\/|\.\.?\/)/i.test(raw)) return raw;
    try {
      var u = new URL(raw);
      if (u.origin === window.location.origin) return raw;
    } catch (e) { /* ignore */ }
    return "../pages/account.html";
  }

  var returnTo = safeReturnTo();

  /* ── If already signed in, go straight to destination ── */
  sb.auth.getSession().then(function (result) {
    var session = result && result.data && result.data.session;
    if (session) {
      window.location.replace(returnTo);
    }
  });

  /* ── "Continue as guest" link keeps return_to if provided ── */
  var guestLink = document.getElementById("guest-link");
  if (guestLink) {
    var params2 = new URLSearchParams(window.location.search);
    var rt = params2.get("return_to");
    if (rt) {
      // Go back to where they came from rather than just home
      try {
        var u2 = new URL(rt, window.location.origin);
        if (u2.origin === window.location.origin) {
          guestLink.href = rt;
        }
      } catch (e) { /* keep default */ }
    }
  }

  /* ── View / tab helpers ── */
  var viewAuth   = document.getElementById("view-auth");
  var viewForgot = document.getElementById("view-forgot");
  var tabSignin  = document.getElementById("tab-signin");
  var tabCreate  = document.getElementById("tab-create");
  var panelSignin = document.getElementById("panel-signin");
  var panelCreate = document.getElementById("panel-create");

  function showAuthView(tabId) {
    if (viewAuth)   viewAuth.hidden   = false;
    if (viewForgot) viewForgot.hidden = true;

    var isSignin = tabId !== "create";
    if (panelSignin) panelSignin.hidden = !isSignin;
    if (panelCreate) panelCreate.hidden =  isSignin;
    if (tabSignin)  tabSignin.setAttribute("aria-selected",  isSignin ? "true" : "false");
    if (tabCreate)  tabCreate.setAttribute("aria-selected", !isSignin ? "true" : "false");
  }

  function showForgotView() {
    if (viewAuth)   viewAuth.hidden   = true;
    if (viewForgot) viewForgot.hidden = false;
    var el = document.getElementById("forgot-email");
    if (el) el.focus();
  }

  if (tabSignin) tabSignin.addEventListener("click", function () { showAuthView("signin"); });
  if (tabCreate) tabCreate.addEventListener("click", function () { showAuthView("create"); });

  var btnToForgot   = document.getElementById("btn-to-forgot");
  var btnBackSignin = document.getElementById("btn-back-signin");

  if (btnToForgot)   btnToForgot.addEventListener("click",   showForgotView);
  if (btnBackSignin) btnBackSignin.addEventListener("click", function () { showAuthView("signin"); });

  /* ── Status helpers ── */
  function setStatus(id, msg, state) {
    var el = document.getElementById(id);
    if (!el) return;
    el.textContent = msg;
    el.dataset.state = state || "";
  }

  function setBtn(id, disabled, label) {
    var el = document.getElementById(id);
    if (!el) return;
    el.disabled  = disabled;
    el.textContent = label;
  }

  /* ── Sign in ── */
  var formSignin = document.getElementById("form-signin");
  if (formSignin) {
    formSignin.addEventListener("submit", function (e) {
      e.preventDefault();
      var email    = (formSignin.elements["email"].value    || "").trim();
      var password = (formSignin.elements["password"].value || "");

      if (!email || !password) {
        setStatus("signin-status", "Please enter your email and password.", "error");
        return;
      }

      setStatus("signin-status", "", "");
      setBtn("btn-signin", true, "Signing in\u2026");

      sb.auth.signInWithPassword({ email: email, password: password }).then(function (result) {
        if (result.error) {
          setStatus("signin-status", result.error.message || "Sign in failed. Please try again.", "error");
          setBtn("btn-signin", false, "Sign in");
          return;
        }
        window.location.replace(returnTo);
      });
    });
  }

  /* ── Create account ── */
  var formCreate = document.getElementById("form-create");
  if (formCreate) {
    formCreate.addEventListener("submit", function (e) {
      e.preventDefault();
      var nameEl     = formCreate.elements["name"];
      var name       = nameEl ? (nameEl.value || "").trim() : "";
      var email      = (formCreate.elements["email"].value    || "").trim();
      var password   = (formCreate.elements["password"].value || "");

      if (!email) {
        setStatus("create-status", "Please enter your email.", "error");
        return;
      }
      if (password.length < 8) {
        setStatus("create-status", "Password must be at least 8 characters.", "error");
        return;
      }

      setStatus("create-status", "", "");
      setBtn("btn-create", true, "Creating account\u2026");

      var options = name ? { data: { full_name: name } } : {};
      sb.auth.signUp({ email: email, password: password, options: options }).then(function (result) {
        if (result.error) {
          setStatus("create-status", result.error.message || "Could not create account. Please try again.", "error");
          setBtn("btn-create", false, "Create account");
          return;
        }
        // Supabase may or may not require email confirmation
        var user = result.data && result.data.user;
        var confirmed = user && user.confirmed_at;
        if (confirmed) {
          // Email confirmation disabled — signed in immediately
          window.location.replace(returnTo);
        } else {
          setStatus(
            "create-status",
            "Account created! Check your email to confirm, then sign in.",
            "success"
          );
          setBtn("btn-create", false, "Create account");
          // Switch to sign-in tab so they can log in after confirming
          setTimeout(function () { showAuthView("signin"); }, 3000);
        }
      });
    });
  }

  /* ── Forgot password ── */
  var formForgot = document.getElementById("form-forgot");
  if (formForgot) {
    formForgot.addEventListener("submit", function (e) {
      e.preventDefault();
      var email = (formForgot.elements["email"].value || "").trim();

      if (!email) {
        setStatus("forgot-status", "Please enter your email.", "error");
        return;
      }

      setStatus("forgot-status", "", "");
      setBtn("btn-forgot-submit", true, "Sending\u2026");

      var redirectUrl = window.location.origin + "/pages/account.html?action=reset-password";
      sb.auth.resetPasswordForEmail(email, { redirectTo: redirectUrl }).then(function (result) {
        if (result.error) {
          setStatus("forgot-status", result.error.message || "Could not send reset link.", "error");
        } else {
          setStatus("forgot-status", "Reset link sent — check your email.", "success");
        }
        setBtn("btn-forgot-submit", false, "Send reset link");
      });
    });
  }

})();
