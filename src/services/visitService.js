import { supabase } from '../config/supabaseClient';
import { isDemoMode } from '../utils/demoHelper';

const edgeUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/record-visit`;

export const logVisit = async () => {
  const path = typeof window !== 'undefined' ? window.location.pathname + window.location.search : null;
  const referrer = typeof document !== 'undefined' ? document.referrer || null : null;
  const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : null;

  try {

    // In demo mode, skip calling the Edge Function to avoid CORS noise
    if (isDemoMode()) {
      console.debug('visitService.logVisit: demo mode — skipping visit call');
      return;
    }

    // Get session to decide whether to call the function
    const { data: { session } } = await supabase.auth.getSession();

    // If there's no logged-in session, skip sending visits
    if (!session) {
      console.debug('visitService.logVisit: no session — skipping visit call');
      return;
    }

    const headers = {
      'Content-Type': 'application/json',
      'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
    };

    // Add Authorization header if user is logged in
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`;
    }

    // If demo mode is active, mark the request so the function can treat it specially
    // (disabled in demo per above)

    // Debug: report whether Authorization header is present (don't log token value)
    console.debug('visitService.logVisit: sending visit to', edgeUrl, { hasAuthorization: !!headers.Authorization, hasApikey: !!headers.apikey, isDemo: !!headers['x-demo-mode'], demoRole: !!headers['x-demo-role'] });

    const resp = await fetch(edgeUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ path, referrer, userAgent }),
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => '<no-body>');
      console.warn('visitService.logVisit: record-visit returned', resp.status, text);
    } else {
      console.debug('visitService.logVisit: record-visit OK', resp.status);
    }
  } catch (error) {
    // Silently fail - visit tracking is non-critical
    // 401 errors expected until Edge Function is redeployed with correct env vars
  }
};

export const fetchVisitSummary = async () => {
  const summary = {
    total: 0,
    last24h: 0,
    distinctIps: 0,
    demoCount: 0,
    authorizedSessions: 0,
    recent: [],
  };

  try {
    // Total count
    const totalResp = await supabase.from('visits').select('id', { count: 'exact' }).limit(1);
    summary.total = totalResp.count || 0;

    // Last 24h count
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const lastResp = await supabase
      .from('visits')
      .select('id', { count: 'exact' })
      .gte('created_at', since)
      .limit(1);
    summary.last24h = lastResp.count || 0;

    // Distinct IP count
    const distinctResp = await supabase
      .from('visits')
      .select('ip', { count: 'exact', distinct: true })
      .limit(1);
    summary.distinctIps = distinctResp.count || 0;

    // Demo visits count (marked by is_demo boolean)
    try {
      const demoResp = await supabase
        .from('visits')
        .select('id', { count: 'exact' })
        .eq('is_demo', true)
        .limit(1);
      summary.demoCount = demoResp.count || 0;
    } catch (e) {
      summary.demoCount = 0;
    }

    // Authorized sessions: visits where a user_id is present
    try {
      const authResp = await supabase
        .from('visits')
        .select('id', { count: 'exact' })
        .not('user_id', 'is', null)
        .limit(1);
      summary.authorizedSessions = authResp.count || 0;
    } catch (e) {
      summary.authorizedSessions = 0;
    }

    // Recent rows
    const recentResp = await supabase
      .from('visits')
      .select('id, ip, path, referrer, user_agent, created_at')
      .order('created_at', { ascending: false })
      .limit(20);
    summary.recent = recentResp.data || [];

    return { success: true, data: summary };
  } catch (error) {
    console.error('visitService: fetchVisitSummary failed', error);
    return { success: false, error: error?.message || 'Failed to fetch visit summary' };
  }
};
