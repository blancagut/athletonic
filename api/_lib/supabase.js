const { createClient } = require("@supabase/supabase-js");
const { requireEnv } = require("./http");

let cachedClient;

function getSupabaseAdmin() {
  requireEnv(["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]);

  if (!cachedClient) {
    cachedClient = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );
  }

  return cachedClient;
}

module.exports = { getSupabaseAdmin };
