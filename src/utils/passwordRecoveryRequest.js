import { normalizeRecoveryEmail } from '../../supabase/functions/_shared/recoveryEmail.mjs';

/** Only the server's verified send result can produce a success notice. */
export async function requestPasswordRecovery(client, value) {
  const email = normalizeRecoveryEmail(value);
  if (!email) throw Object.assign(new Error('Invalid email'), { code: 'email_address_invalid' });
  const { data, error } = await client.functions.invoke('hr-password-recovery', { body: { email } });
  if (error) {
    let details;
    try { details = await error.context?.json(); } catch { /* Use the safe generic error. */ }
    throw Object.assign(new Error('Password recovery request failed'), {
      code: details?.code || (error.name === 'FunctionsFetchError' ? 'network_error' : undefined),
      status: error.context?.status || error.status,
      cause: error,
    });
  }
  if (data?.success !== true) {
    throw Object.assign(new Error('Password recovery request failed'), { code: data?.code });
  }
}
