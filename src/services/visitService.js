import { supabase } from '../config/supabaseClient';

const edgeUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/record-visit`;

export const logVisit = async () => {
  const path = typeof window !== 'undefined' ? window.location.pathname + window.location.search : null;
  const referrer = typeof document !== 'undefined' ? document.referrer || null : null;
  const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : null;

  try {
    await fetch(edgeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ path, referrer, userAgent }),
    });
  } catch (error) {
    console.warn('visitService: logVisit failed', error?.message || error);
  }
};

export const fetchVisitSummary = async () => {
  const summary = {
    total: 0,
    last24h: 0,
    distinctIps: 0,
    recent: [],
  };

  try {
    // Total count
    const totalResp = await supabase.from('visits').select('id', { count: 'exact', head: true });
    summary.total = totalResp.count || 0;

    // Last 24h count
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const lastResp = await supabase
      .from('visits')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', since);
    summary.last24h = lastResp.count || 0;

    // Distinct IP count
    const distinctResp = await supabase
      .from('visits')
      .select('ip', { count: 'exact', head: true, distinct: true });
    summary.distinctIps = distinctResp.count || 0;

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
