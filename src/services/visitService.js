import { supabase } from '../config/supabaseClient';
import { isDemoMode } from '../utils/demoHelper';

const edgeUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/record-visit`;
const summaryUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/visit-summary`;

const fetchWithTimeout = async (url, options = {}, timeoutMs = 6000) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
};

export const logVisit = async () => {
  const path = typeof window !== 'undefined' ? window.location.pathname + window.location.search : null;
  const referrer = typeof document !== 'undefined' ? document.referrer || null : null;
  const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : null;

  try {

    // Get session (optional). We still send visits without a session.
    const { data: { session } } = await supabase.auth.getSession();

    const headers = {
      'Content-Type': 'application/json',
      'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
    };

    // Add Authorization header if user is logged in
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`;
    }

    // Avoid custom headers in demo to prevent CORS issues; simply log anonymously when in demo

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
    // Use direct Supabase queries (JS client handles auth automatically, no CORS issues)

    // Total count
    const totalResp = await supabase.from('visits').select('id', { count: 'exact', head: true });
    summary.total = totalResp.count ?? 0;

    // Last 24h count
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const lastResp = await supabase
      .from('visits')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', since);
    summary.last24h = lastResp.count ?? 0;

    // Distinct IP count (approx via grouping)
    const distinctResp = await supabase
      .from('visits')
      .select('ip')
      .not('ip', 'is', null)
      .limit(1000);
    const uniqueIps = new Set((distinctResp.data || []).map((r) => r.ip));
    summary.distinctIps = uniqueIps.size;

    // Demo visits count (marked by is_demo boolean)
    try {
      const demoResp = await supabase
        .from('visits')
        .select('id', { count: 'exact', head: true })
        .eq('is_demo', true);
      summary.demoCount = demoResp.count ?? 0;
    } catch {
      summary.demoCount = 0;
    }

    // Authorized sessions: visits where a user_id is present
    try {
      const authResp = await supabase
        .from('visits')
        .select('id', { count: 'exact', head: true })
        .not('user_id', 'is', null);
      summary.authorizedSessions = authResp.count ?? 0;
    } catch {
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
