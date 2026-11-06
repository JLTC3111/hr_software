import { normalizeRecoveryEmail } from './recoveryEmail.mjs';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store',
};
const reply = (status, body) => new Response(JSON.stringify(body), { status, headers });
const fail = (status, code) => reply(status, { success: false, code });

/** Fail closed before contacting Auth. No retries: recovery sends are side effects. */
export function createPasswordRecoveryHandler({ supabaseUrl, anonKey, serviceRoleKey, redirectTo, fetchImpl = fetch }) {
  return async (request) => {
    if (request.method === 'OPTIONS') return new Response('ok', { headers });
    if (request.method !== 'POST') return fail(405, 'method_not_allowed');
    let body;
    try { body = await request.json(); } catch { return fail(400, 'email_address_invalid'); }
    const email = normalizeRecoveryEmail(body?.email);
    if (!email) return fail(400, 'email_address_invalid');
    if (!supabaseUrl || !anonKey || !serviceRoleKey || !redirectTo) return fail(503, 'unexpected_failure');
    try {
      // This RPC is executable only by service_role, never anon/authenticated.
      const lookup = await fetchImpl(`${supabaseUrl}/rest/v1/rpc/password_recovery_email`, {
        method: 'POST',
        headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_email: email }),
        signal: AbortSignal.timeout(10000),
      });
      if (!lookup.ok) return fail(503, 'unexpected_failure');
      const registeredEmail = await lookup.json();
      if (registeredEmail === null) return fail(404, 'user_not_found');
      if (normalizeRecoveryEmail(registeredEmail) !== email) return fail(503, 'unexpected_failure');

      // Use the stored address and native Auth delivery/templates/rate limits.
      // The redirect is fixed by the function, never supplied by the caller.
      const sent = await fetchImpl(`${supabaseUrl}/auth/v1/recover?redirect_to=${encodeURIComponent(redirectTo)}`, {
        method: 'POST',
        headers: { apikey: anonKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: registeredEmail }),
        signal: AbortSignal.timeout(20000),
      });
      if (!sent.ok) {
        const provider = await sent.json().catch(() => ({}));
        const code = provider.code || provider.error_code;
        const safeCodes = ['over_email_send_rate_limit', 'over_request_rate_limit', 'email_address_invalid', 'user_banned', 'email_not_confirmed', 'user_not_found'];
        return fail(sent.status === 429 ? 429 : 502, safeCodes.includes(code) ? code : 'unexpected_failure');
      }
      return reply(200, { success: true });
    } catch {
      return fail(503, 'unexpected_failure');
    }
  };
}
