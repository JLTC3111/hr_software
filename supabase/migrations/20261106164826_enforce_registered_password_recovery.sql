-- Shared by HR and Contract, which use the same Supabase Auth project.
-- The browser never receives access to auth.users or this lookup function.
CREATE OR REPLACE FUNCTION public.password_recovery_email(p_email text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT u.email
  FROM auth.users AS u
  WHERE lower(u.email) = lower(btrim(p_email))
    AND u.deleted_at IS NULL
    AND (u.banned_until IS NULL OR u.banned_until <= now())
    AND NOT coalesce(u.is_sso_user, false)
    AND NOT coalesce(u.is_anonymous, false)
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.password_recovery_email(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.password_recovery_email(text) TO service_role;
COMMENT ON FUNCTION public.password_recovery_email(text) IS
  'Server-only exact Auth email lookup for password recovery; excludes deleted, banned, anonymous and SSO-only users.';
