// Use the same Auth → HR identity mapping as the application. Authorization
// comes only from an active HR profile, never from user-editable metadata.
export async function getActiveHrAdmin(client, authUserId) {
  const { data: links, error: linkError } = await client
    .from('user_emails')
    .select('hr_user_id')
    .eq('auth_user_id', authUserId);
  if (linkError) throw linkError;

  const profileIds = [...new Set((links || []).map(link => link.hr_user_id).filter(Boolean))];
  if (profileIds.length > 1) throw new Error('Ambiguous HR identity');
  const { data: profile, error } = await client
    .from('hr_users')
    .select('id, role, is_active, employment_status')
    .eq('id', profileIds[0] || authUserId)
    .maybeSingle();
  if (error) throw error;

  return profile?.is_active === true
    && String(profile.role).toLowerCase() === 'admin'
    && !['terminated', 'inactive'].includes(String(profile.employment_status || 'active').toLowerCase())
    ? profile
    : null;
}

export async function getHrAuthUserIds(client, hrUserId) {
  const { data: links, error } = await client
    .from('user_emails')
    .select('auth_user_id')
    .eq('hr_user_id', hrUserId);
  if (error) throw error;
  const ids = [...new Set((links || []).map(link => link.auth_user_id).filter(Boolean))];
  return ids.length ? ids : [hrUserId];
}
