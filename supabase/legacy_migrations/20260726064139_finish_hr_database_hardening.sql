-- Finish hardening HR-specific objects reported by the Supabase database
-- advisor. Objects belonging to other applications in the shared project are
-- intentionally out of scope.

ALTER VIEW IF EXISTS public.proof_file_statistics SET (security_invoker = true);

ALTER FUNCTION public.add_user_email(uuid, uuid, character varying, boolean)
  SET search_path = public, pg_temp;
ALTER FUNCTION public.admin_reset_user_password(uuid, text, uuid)
  SET search_path = public, auth, pg_temp;
ALTER FUNCTION public.auto_close_expired_jobs()
  SET search_path = public, pg_temp;
ALTER FUNCTION public.calculate_leave_days()
  SET search_path = public, pg_temp;
ALTER FUNCTION public.check_orphaned_time_entries()
  SET search_path = public, pg_temp;
ALTER FUNCTION public.clean_orphaned_records()
  SET search_path = public, pg_temp;
ALTER FUNCTION public.cleanup_old_notifications(integer)
  SET search_path = public, pg_temp;
ALTER FUNCTION public.create_notification(
  uuid,
  character varying,
  text,
  character varying,
  character varying,
  character varying,
  character varying,
  jsonb,
  timestamp with time zone
) SET search_path = public, pg_temp;
ALTER FUNCTION public.create_user_settings()
  SET search_path = public, pg_temp;
ALTER FUNCTION public.ensure_single_current_photo()
  SET search_path = public, pg_temp;
ALTER FUNCTION public.find_orphaned_photos()
  SET search_path = public, pg_temp;
ALTER FUNCTION public.get_employee_photo_history(integer)
  SET search_path = public, pg_temp;
ALTER FUNCTION public.get_hr_user_id_from_auth(uuid)
  SET search_path = public, pg_temp;
ALTER FUNCTION public.get_primary_email(uuid)
  SET search_path = public, pg_temp;
ALTER FUNCTION public.is_admin()
  SET search_path = public, auth, pg_temp;
ALTER FUNCTION public.is_admin(uuid)
  SET search_path = public, pg_temp;
ALTER FUNCTION public.mark_all_notifications_read(uuid)
  SET search_path = public, pg_temp;
ALTER FUNCTION public.mark_notification_read(uuid)
  SET search_path = public, pg_temp;
ALTER FUNCTION public.record_visit(
  text,
  text,
  text,
  text,
  text,
  boolean,
  boolean,
  boolean,
  text,
  boolean,
  text
) SET search_path = public, auth, pg_temp;
ALTER FUNCTION public.soft_delete_photo(bigint)
  SET search_path = public, pg_temp;
ALTER FUNCTION public.sync_employee_photo()
  SET search_path = public, pg_temp;
ALTER FUNCTION public.sync_employee_to_hr_user(character varying)
  SET search_path = public, pg_temp;
ALTER FUNCTION public.update_hr_users_updated_at()
  SET search_path = public, pg_temp;
ALTER FUNCTION public.update_performance_reviews_updated_at()
  SET search_path = public, pg_temp;
ALTER FUNCTION public.update_timestamp()
  SET search_path = public, pg_temp;
