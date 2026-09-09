export function validateDesktopEnv(env) {
  const url = (value, label) => {
    try {
      const parsed = new URL(value);
      if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.search || parsed.hash) throw new Error();
      return parsed.href.replace(/\/$/, '');
    } catch {
      throw new Error(`${label} must be a public HTTPS URL without credentials, query parameters, or a fragment.`);
    }
  };
  const supabaseUrl = url(env.VITE_SUPABASE_URL, 'VITE_SUPABASE_URL');
  const key = env.VITE_SUPABASE_ANON_KEY?.trim();
  if (!key) throw new Error('VITE_SUPABASE_ANON_KEY is required for desktop builds.');
  if (!key.startsWith('sb_publishable_')) {
    let payload;
    try { payload = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString('utf8')); } catch { /* invalid key */ }
    if (payload?.role !== 'anon') throw new Error('Desktop builds require a publishable or anon key, never a service-role/secret key.');
  }
  // Reset emails open the existing HTTPS website in the user's browser.
  // An internal desktop origin cannot be used as an email callback.
  const appUrl = url(env.VITE_APP_URL || env.VITE_SITE_URL, 'VITE_APP_URL (password-reset website)');
  return { VITE_SUPABASE_URL: supabaseUrl, VITE_SUPABASE_ANON_KEY: key, VITE_APP_URL: appUrl };
}
