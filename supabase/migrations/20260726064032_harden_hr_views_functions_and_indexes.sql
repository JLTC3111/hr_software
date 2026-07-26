-- Ensure HR reporting views enforce the caller's RLS policies instead of the
-- view owner's privileges.
ALTER VIEW public.applications_detailed SET (security_invoker = true);
ALTER VIEW public.employee_performance_summary SET (security_invoker = true);
ALTER VIEW public.goals_with_progress SET (security_invoker = true);
ALTER VIEW public.monthly_attendance_summary SET (security_invoker = true);
ALTER VIEW public.notification_stats SET (security_invoker = true);
ALTER VIEW public.recruitment_pipeline SET (security_invoker = true);
ALTER VIEW public.skills_matrix SET (security_invoker = true);
ALTER VIEW public.time_entries_detailed SET (security_invoker = true);
ALTER VIEW public.upcoming_interviews SET (security_invoker = true);
ALTER VIEW public.user_emails_view SET (security_invoker = true);

-- Remove browser access to obsolete privileged/debug RPCs. Password resets now
-- use an admin-authorized Edge Function.
REVOKE ALL ON FUNCTION public.admin_reset_user_password(uuid, text, uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.check_auth_uid_type()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.diagnose_user_id_types()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_auth_uid()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_auth_user_id()
  FROM PUBLIC, anon, authenticated;

-- Pin search paths for HR functions to prevent object shadowing.
ALTER FUNCTION public.auto_complete_goal()
  SET search_path = public, pg_temp;
ALTER FUNCTION public.calculate_overall_rating()
  SET search_path = public, pg_temp;
ALTER FUNCTION public.calculate_working_days(date, date)
  SET search_path = public, pg_temp;
ALTER FUNCTION public.trigger_update_summary()
  SET search_path = public, pg_temp;
ALTER FUNCTION public.update_application_stage()
  SET search_path = public, pg_temp;
ALTER FUNCTION public.update_goal_progress()
  SET search_path = public, pg_temp;
ALTER FUNCTION public.update_performance_updated_at()
  SET search_path = public, pg_temp;
ALTER FUNCTION public.update_recruitment_metrics()
  SET search_path = public, pg_temp;
ALTER FUNCTION public.update_time_tracking_summary(text, integer, integer)
  SET search_path = public, pg_temp;
ALTER FUNCTION public.update_updated_at_column()
  SET search_path = public, pg_temp;
ALTER FUNCTION public.update_workload_tasks_updated_at()
  SET search_path = public, pg_temp;

-- Index foreign keys used by common HR joins and policy checks.
CREATE INDEX IF NOT EXISTS idx_employee_feedback_employee_id
  ON public.employee_feedback(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_feedback_feedback_from
  ON public.employee_feedback(feedback_from);
CREATE INDEX IF NOT EXISTS idx_goal_milestones_goal_id
  ON public.goal_milestones(goal_id);
CREATE INDEX IF NOT EXISTS idx_performance_goals_assigned_by
  ON public.performance_goals(assigned_by);
CREATE INDEX IF NOT EXISTS idx_performance_skills_assessed_by
  ON public.performance_skills(assessed_by);
CREATE INDEX IF NOT EXISTS idx_skills_assessments_assessed_by
  ON public.skills_assessments(assessed_by);
CREATE INDEX IF NOT EXISTS idx_applications_reviewed_by
  ON public.applications(reviewed_by);
CREATE INDEX IF NOT EXISTS idx_job_postings_posted_by
  ON public.job_postings(posted_by);
CREATE INDEX IF NOT EXISTS idx_workload_tasks_created_by
  ON public.workload_tasks(created_by);
