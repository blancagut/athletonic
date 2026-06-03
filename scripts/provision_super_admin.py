"""
Provision a super admin account using the Supabase service role.

Creates the auth user (email pre-confirmed so passwordless magic-link sign-in
works immediately) and ensures the profile role is 'super_admin'. Safe to run
repeatedly — it elevates the account if it already exists.

Usage:
    python3 scripts/provision_super_admin.py <email>

Reads SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from .env. Never logs secrets.
"""
import os
import sys

from dotenv import load_dotenv
from supabase import create_client

load_dotenv()


def main(argv):
    if len(argv) < 2:
        print("Usage: python3 scripts/provision_super_admin.py <email>")
        return 1

    email = argv[1].strip().lower()
    url = os.environ.get("SUPABASE_URL")
    service_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not service_key:
        print("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.")
        return 1

    sb = create_client(url, service_key)

    # Find an existing auth user with this email.
    user_id = None
    try:
        page = sb.auth.admin.list_users()
        users = page if isinstance(page, list) else getattr(page, "users", [])
        for u in users:
            if (getattr(u, "email", "") or "").lower() == email:
                user_id = u.id
                break
    except Exception as exc:  # noqa: BLE001
        print(f"Could not list users: {exc}")

    if user_id is None:
        created = sb.auth.admin.create_user(
            {
                "email": email,
                "email_confirm": True,
                "user_metadata": {"full_name": "Super Admin"},
            }
        )
        user_id = created.user.id
        print(f"Created auth user: {email}")
    else:
        print(f"Auth user already exists: {email}")

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
    print("Done. Sign in via the magic link at /pages/admin/login.html")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
