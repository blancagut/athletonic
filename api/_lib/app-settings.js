async function loadAppSettings(supabase, keys = []) {
  if (!supabase) {
    return {};
  }

  let query = supabase.from("app_settings").select("key, value");
  if (Array.isArray(keys) && keys.length > 0) {
    query = query.in("key", keys);
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }

  return Array.isArray(data)
    ? data.reduce((result, row) => {
        if (row && row.key) {
          result[row.key] = row.value || {};
        }
        return result;
      }, {})
    : {};
}

module.exports = {
  loadAppSettings,
};
