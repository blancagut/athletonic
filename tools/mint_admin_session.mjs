// One-off: confirm role + mint a fresh session for an admin email using the
// service role, then print a console snippet to inject it on the live site.
// Does NOT deploy anything. Reads prod env from .env.
import { readFileSync } from "node:fs";

function loadEnv(path) {
  const env = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    env[m[1]] = v;
  }
  return env;
}

const env = loadEnv(".env");
const SUPABASE_URL = env.SUPABASE_URL;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;
const EMAIL = process.argv[2] || "renvagu1@icloud.com";
const PUBLISHABLE = "sb_publishable_OI_aEjYX0fB4tp7Ui2bk5A_001Jga0T";

if (!SUPABASE_URL || !SERVICE) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env file.");
  process.exit(1);
}

const svcHeaders = {
  apikey: SERVICE,
  Authorization: `Bearer ${SERVICE}`,
  "Content-Type": "application/json",
};

async function main() {
  // 1) Find the auth user by email.
  const userRes = await fetch(
    `${SUPABASE_URL}/auth/v1/admin/users?filter=${encodeURIComponent(EMAIL)}`,
    { headers: svcHeaders }
  );
  const userJson = await userRes.json();
  const users = userJson.users || userJson || [];
  const user = (Array.isArray(users) ? users : []).find(
    (u) => (u.email || "").toLowerCase() === EMAIL.toLowerCase()
  );
  if (!user) {
    console.error(`No auth user found for ${EMAIL}`);
    process.exit(2);
  }

  // 2) Confirm the profile role.
  const profRes = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?id=eq.${user.id}&select=email,role`,
    { headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` } }
  );
  const profile = (await profRes.json())[0] || null;
  console.log(`USER: ${EMAIL}  id=${user.id}`);
  console.log(`PROFILE ROLE: ${profile ? profile.role : "(no profile row)"}`);

  // 3) Generate a magic link (admin) to obtain a verifiable token hash.
  const genRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/generate_link`, {
    method: "POST",
    headers: svcHeaders,
    body: JSON.stringify({ type: "magiclink", email: EMAIL }),
  });
  const gen = await genRes.json();
  const tokenHash = gen.hashed_token || (gen.properties && gen.properties.hashed_token);
  if (!tokenHash) {
    console.error("Could not generate link:", JSON.stringify(gen));
    process.exit(3);
  }

  // 4) Verify the token hash to mint a real session (access + refresh tokens).
  const verRes = await fetch(`${SUPABASE_URL}/auth/v1/verify`, {
    method: "POST",
    headers: { apikey: PUBLISHABLE, "Content-Type": "application/json" },
    body: JSON.stringify({ type: "magiclink", token_hash: tokenHash }),
  });
  const session = await verRes.json();
  if (!session.access_token) {
    console.error("Verify failed:", JSON.stringify(session));
    process.exit(4);
  }

  const stored = {
    access_token: session.access_token,
    refresh_token: session.refresh_token || null,
    expires_in: session.expires_in || 3600,
    expires_at: session.expires_at || Math.floor(Date.now() / 1000) + 3600,
    token_type: session.token_type || "bearer",
    user: {
      id: user.id,
      email: EMAIL,
      aud: "authenticated",
      role: "authenticated",
    },
  };

  const ref = new URL(SUPABASE_URL).hostname.split(".")[0];
  const snippet =
    `localStorage.setItem('sb-${ref}-auth-token', ${JSON.stringify(
      JSON.stringify(stored)
    )}); location.href='/pages/admin/index.html';`;

  const { writeFileSync } = await import("node:fs");
  writeFileSync("tools/session.json", JSON.stringify(stored));
  writeFileSync("tools/storage-key.txt", `sb-${ref}-auth-token`);

  console.log("\n================ PEGA ESTO EN LA CONSOLA DE athletonic.com ================\n");
  console.log(snippet);
  console.log("\n==========================================================================\n");

  // Local panel URL: the patched admin-core captures these tokens from the hash.
  const port = process.env.PORT || "8000";
  const hashUrl =
    `http://localhost:${port}/pages/admin/index.html#access_token=${encodeURIComponent(
      stored.access_token
    )}&refresh_token=${encodeURIComponent(stored.refresh_token || "")}` +
    `&expires_in=3600&token_type=bearer&type=magiclink`;
  console.log("LOCAL_URL:\n" + hashUrl + "\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(99);
});
