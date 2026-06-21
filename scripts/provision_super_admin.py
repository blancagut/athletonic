"""
Provision a super admin account using the Supabase service role.

Creates the auth user (email pre-confirmed) with a password and ensures the
profile role is 'super_admin'. Safe to run repeatedly — it resets the password
and elevates the account if it already exists.

Usage:
    ATHLETONIC_SUPER_ADMIN_PASSWORD='...' python3 scripts/provision_super_admin.py <email>
    python3 scripts/provision_super_admin.py <email> <password>

Reads SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and optionally
ATHLETONIC_SUPER_ADMIN_PASSWORD from .env. Never logs secrets.
"""
import os
import sys
import time

import httpx
from dotenv import load_dotenv
from supabase import ClientOptions, create_client

load_dotenv()


def run_with_retry(label, operation, attempts=3):
    for attempt in range(1, attempts + 1):
        try:
            return operation()
        except Exception as exc:  # noqa: BLE001
            if attempt >= attempts:
                raise
            print(f"{label} failed ({exc.__class__.__name__}); retrying...")
            time.sleep(attempt * 2)


def main(argv):
    if len(argv) < 2:
        print("Usage: python3 scripts/provision_super_admin.py <email> [password]")
        return 1

    email = argv[1].strip().lower()
    password = argv[2] if len(argv) >= 3 else os.environ.get("ATHLETONIC_SUPER_ADMIN_PASSWORD")
    url = os.environ.get("SUPABASE_URL")
    service_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not service_key:
        print("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.")
        return 1
    if not password:
        print("Missing password. Set ATHLETONIC_SUPER_ADMIN_PASSWORD or pass it as the second argument.")
        return 1

    sb = create_client(
        url,
        service_key,
        ClientOptions(httpx_client=httpx.Client(timeout=30)),
    )

    # Find an existing auth user with this email.
    user_id = None
    try:
        page = run_with_retry("List users", lambda: sb.auth.admin.list_users())
        users = page if isinstance(page, list) else getattr(page, "users", [])
        for u in users:
            if (getattr(u, "email", "") or "").lower() == email:
                user_id = u.id
                break
    except Exception as exc:  # noqa: BLE001
        print(f"Could not list users: {exc}")

    if user_id is None:
        created = run_with_retry(
            "Create auth user",
            lambda: sb.auth.admin.create_user(
                {
                    "email": email,
                    "password": password,
                    "email_confirm": True,
                    "user_metadata": {"full_name": "Super Admin"},
                }
            ),
        )
        user_id = created.user.id
        print(f"Created auth user: {email}")
    else:
        run_with_retry(
            "Update auth user",
            lambda: sb.auth.admin.update_user_by_id(
                user_id,
                {
                    "password": password,
                    "email_confirm": True,
                    "user_metadata": {"full_name": "Super Admin"},
                },
            ),
        )
        print(f"Auth user already exists: {email}")
        print("Updated auth password.")

    # Ensure the profile exists and is super_admin (trigger usually handles this,
    # but upsert here guarantees it regardless of trigger timing).
    sb.table("profiles").upsert(
        {"id": user_id, "email": email, "role": "super_admin"},
        on_conflict="id",
    ).execute()

    row = (
        sb.table("profiles")
        .select("email, role")
        .eq("id", user_id)
        .single()
        .execute()
    )
    print(f"Profile: {row.data}")
    print("Done. Sign in with email and password at /pages/admin/login.html")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
