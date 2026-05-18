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

const getDemoVisitSummary = () => {
  const now = Date.now();
  return {
    total: 24,
    last24h: 6,
    distinctIps: 4,
    demoCount: 24,
    authorizedSessions: 0,
    recent: [
      {
        id: 'demo-visit-1',
        ip: '203.0.113.42',
        path: '/control-panel',
        referrer: null,
        created_at: new Date(now - 5 * 60 * 1000).toISOString(),
      },
      {
        id: 'demo-visit-2',
        ip: '198.51.100.7',
        path: '/dashboard',
        referrer: 'https://example.com',
        created_at: new Date(now - 45 * 60 * 1000).toISOString(),
      },
      {
        id: 'demo-visit-3',
        ip: '192.0.2.15',
        path: '/time-clock',
        referrer: null,
        created_at: new Date(now - 3 * 60 * 60 * 1000).toISOString(),
      },
    ],
  };
};

/** Fallback when the visit-summary edge function is unavailable. */
const fetchVisitSummaryDirect = async () => {
  const summary = {
    total: 0,
    last24h: 0,
    distinctIps: 0,
    demoCount: 0,
    authorizedSessions: 0,
    recent: [],
  };

  const totalResp = await supabase.from('visits').select('id', { count: 'exact', head: true });
  if (totalResp.error) throw new Error(totalResp.error.message);

  summary.total = totalResp.count ?? 0;

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const lastResp = await supabase
    .from('visits')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', since);
  if (lastResp.error) throw new Error(lastResp.error.message);

  summary.last24h = lastResp.count ?? 0;

  const distinctResp = await supabase
    .from('visits')
    .select('ip')
    .not('ip', 'is', null)
    .limit(1000);
  if (distinctResp.error) throw new Error(distinctResp.error.message);

  summary.distinctIps = new Set((distinctResp.data || []).map((r) => r.ip)).size;

  const demoResp = await supabase
    .from('visits')
    .select('id', { count: 'exact', head: true })
    .eq('is_demo', true);
  summary.demoCount = demoResp.error ? 0 : (demoResp.count ?? 0);

  const authResp = await supabase
    .from('visits')
    .select('id', { count: 'exact', head: true })
    .not('user_id', 'is', null);
  summary.authorizedSessions = authResp.error ? 0 : (authResp.count ?? 0);

  const recentResp = await supabase
    .from('visits')
    .select('id, ip, path, referrer, user_agent, created_at')
    .order('created_at', { ascending: false })
    .limit(20);
  if (recentResp.error) throw new Error(recentResp.error.message);

  summary.recent = recentResp.data || [];
  return summary;
};

export const logVisit = async () => {
  const path = typeof window !== 'undefined' ? window.location.pathname + window.location.search : null;
  const referrer = typeof document !== 'undefined' ? document.referrer || null : null;
  const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : null;

  try {
    const { data: { session } } = await supabase.auth.getSession();
    const demo = isDemoMode();

    if (!session?.access_token && !demo) {
      console.debug('visitService.logVisit: skipped (no session and not demo mode)');
      return;
    }

    const headers = {
      'Content-Type': 'application/json',
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
    };

    if (session?.access_token) {
      headers.Authorization = `Bearer ${session.access_token}`;
    }

    if (demo) {
      headers['x-demo-mode'] = '1';
    }

    const resp = await fetchWithTimeout(edgeUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ path, referrer, userAgent }),
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => '<no-body>');
      console.warn('visitService.logVisit: record-visit returned', resp.status, text);
    }
  } catch (error) {
    console.warn('visitService.logVisit failed', error?.message || error);
  }
};

export const fetchVisitSummary = async () => {
  if (isDemoMode()) {
    return { success: true, data: getDemoVisitSummary() };
  }

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      return { success: false, error: 'Not authenticated' };
    }

    const headers = {
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      Authorization: `Bearer ${session.access_token}`,
    };

    const resp = await fetchWithTimeout(summaryUrl, { method: 'GET', headers }, 10000);

    if (resp.ok) {
      const payload = await resp.json();
      if (payload?.success && payload.data) {
        return { success: true, data: payload.data };
      }
      return {
        success: false,
        error: payload?.error || 'Invalid visit summary response',
      };
    }

    // Edge function missing or misconfigured — try direct query (RLS allows admins)
    if (resp.status === 404 || resp.status >= 500) {
      console.warn('visitService: visit-summary edge returned', resp.status, '— using direct query');
      const summary = await fetchVisitSummaryDirect();
      return { success: true, data: summary };
    }

    const errText = await resp.text().catch(() => '');
    let errMsg = `Visit summary request failed (${resp.status})`;
    try {
      const parsed = JSON.parse(errText);
      if (parsed?.error) errMsg = parsed.error;
    } catch {
      if (errText) errMsg = errText;
    }
    return { success: false, error: errMsg };
  } catch (error) {
    console.error('visitService: fetchVisitSummary failed', error);
    try {
      const summary = await fetchVisitSummaryDirect();
      return { success: true, data: summary };
    } catch (fallbackErr) {
      return {
        success: false,
        error: fallbackErr?.message || error?.message || 'Failed to fetch visit summary',
      };
    }
  }
};
