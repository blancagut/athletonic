"""
Supabase auth helpers: login, logout, session, current user.
Credentials are loaded from .env — never hardcoded.
"""
import os
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

_client: Client | None = None


def get_client() -> Client:
    global _client
    if _client is None:
        url = os.environ["SUPABASE_URL"]
        key = os.environ["SUPABASE_ANON_KEY"]
        _client = create_client(url, key)
    return _client


def signup(email: str, password: str, full_name: str | None = None) -> dict:
    """Create a new account. Profile row is created automatically by trigger."""
    sb = get_client()
    payload = {"email": email, "password": password}
    if full_name:
        payload["options"] = {"data": {"full_name": full_name}}
    res = sb.auth.sign_up(payload)
    return {"user": res.user, "session": res.session}


def login(email: str, password: str) -> dict:
    """Sign in with email + password. Returns the session dict."""
    sb = get_client()
    res = sb.auth.sign_in_with_password({"email": email, "password": password})
    return {"user": res.user, "session": res.session}


def logout() -> None:
    """Sign out the current user."""
    get_client().auth.sign_out()


def get_profile(user_id: str | None = None) -> dict | None:
    """Fetch the profile row for the given user id (defaults to current user)."""
    sb = get_client()
    if user_id is None:
        user = get_current_user()
        if user is None:
            return None
        user_id = user.id
    res = sb.table("profiles").select("*").eq("id", user_id).maybe_single().execute()
    return res.data if res else None


def get_session():
    """Return the current active session, or None."""
    return get_client().auth.get_session()


def get_current_user():
    """Return the authenticated user object, or None."""
    session = get_session()
    return session.user if session else None


def require_auth():
    """Raise if no active session (use as a guard in scripts)."""
    user = get_current_user()
    if user is None:
        raise PermissionError("Not authenticated. Call login() first.")
    return user


def is_admin(user=None) -> bool:
    """
    Check if the given user (or current user) has the 'admin' role,
    based on the public.profiles table.
    """
    if user is None:
        user = get_current_user()
    if user is None:
        return False
    profile = get_profile(user.id)
    return bool(profile and profile.get("role") == "admin")
