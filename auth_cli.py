"""
Minimal CLI for testing the auth flow.

Usage:
    python3 auth_cli.py signup <email> <password> [full_name]
    python3 auth_cli.py login  <email> <password>
    python3 auth_cli.py whoami
    python3 auth_cli.py logout
"""
import sys
import auth


def _print_user(user):
    if not user:
        print("No active user.")
        return
    profile = auth.get_profile(user.id)
    print(f"id:    {user.id}")
    print(f"email: {user.email}")
    if profile:
        print(f"role:  {profile.get('role')}")
        print(f"name:  {profile.get('full_name')}")
    print(f"admin: {auth.is_admin(user)}")


def main(argv):
    if len(argv) < 2:
        print(__doc__)
        return 1

    cmd = argv[1]

    if cmd == "signup":
        if len(argv) < 4:
            print("Usage: signup <email> <password> [full_name]")
            return 1
        email, password = argv[2], argv[3]
        full_name = argv[4] if len(argv) > 4 else None
        res = auth.signup(email, password, full_name)
        print("Signup OK." if res["user"] else "Signup pending email confirmation.")
        _print_user(res["user"])

    elif cmd == "login":
        if len(argv) < 4:
            print("Usage: login <email> <password>")
            return 1
        res = auth.login(argv[2], argv[3])
        print("Login OK.")
        _print_user(res["user"])

    elif cmd == "whoami":
        _print_user(auth.get_current_user())

    elif cmd == "logout":
        auth.logout()
        print("Logged out.")

    else:
        print(f"Unknown command: {cmd}")
        print(__doc__)
        return 1

    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
