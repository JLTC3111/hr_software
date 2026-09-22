-- Apply after the frontend supports authenticated document downloads.
-- All authorization uses active HR membership and the Auth-to-HR identity map.

CREATE OR REPLACE FUNCTION private.is_hr_service_context()
RETURNS boolean LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT (SELECT auth.jwt() ->> 'role') = 'service_role'
    OR ((SELECT auth.uid()) IS NULL AND session_user IN ('postgres', 'supabase_admin'));
$$;
REVOKE ALL ON FUNCTION private.is_hr_service_context() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.is_hr_service_context() TO authenticated, service_role;

-- Scope derived summaries and remove every legacy permissive policy.
DO $$ DECLARE p record; BEGIN
  FOR p IN SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'time_tracking_summary'
  LOOP EXECUTE format('DROP POLICY %I ON public.time_tracking_summary', p.policyname); END LOOP;
END $$;
ALTER TABLE public.time_tracking_summary ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.time_tracking_summary FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.time_tracking_summary FROM authenticated;
GRANT SELECT ON public.time_tracking_summary TO authenticated;
CREATE POLICY summary_scoped_read ON public.time_tracking_summary FOR SELECT TO authenticated
  USING (employee_id = (SELECT private.current_employee_id()) OR private.can_manage_employee(employee_id));

-- Employees submit pending records. Approved/rejected business values cannot
-- be rewritten or deleted by the employee after a manager makes a decision.
CREATE OR REPLACE FUNCTION private.enforce_employee_approval_update()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE target_id text;
BEGIN
  target_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.employee_id ELSE NEW.employee_id END;
  IF private.is_hr_service_context() OR (
    private.can_manage_employee(target_id)
    AND (TG_OP = 'INSERT' OR private.can_manage_employee(OLD.employee_id))
  ) THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;
  IF target_id IS DISTINCT FROM private.current_employee_id()
    OR (TG_OP <> 'INSERT' AND OLD.employee_id IS DISTINCT FROM target_id) THEN
    RAISE EXCEPTION 'Employee record is outside the current user scope' USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.status IS DISTINCT FROM 'pending' OR NEW.approved_by IS NOT NULL OR NEW.approved_at IS NOT NULL THEN
      RAISE EXCEPTION 'Employee submissions must be pending and unapproved' USING ERRCODE = '42501';
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.status IS DISTINCT FROM 'pending' THEN
      RAISE EXCEPTION 'Only managers may delete reviewed records' USING ERRCODE = '42501';
    END IF;
    RETURN OLD;
  ELSE
    IF NEW.status IS DISTINCT FROM OLD.status
      OR NEW.approved_by IS DISTINCT FROM OLD.approved_by
      OR NEW.approved_at IS DISTINCT FROM OLD.approved_at THEN
      RAISE EXCEPTION 'Employees cannot change approval fields' USING ERRCODE = '42501';
    END IF;
    IF OLD.status IS DISTINCT FROM 'pending' AND
      (to_jsonb(NEW) - ARRAY['updated_at', 'proof_file_url', 'proof_file_name', 'proof_file_type', 'proof_file_path'])
      IS DISTINCT FROM
      (to_jsonb(OLD) - ARRAY['updated_at', 'proof_file_url', 'proof_file_name', 'proof_file_type', 'proof_file_path']) THEN
      RAISE EXCEPTION 'Only managers may change reviewed records' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.enforce_employee_approval_update() FROM PUBLIC, anon, authenticated;
DO $$ DECLARE table_name text; BEGIN
  FOREACH table_name IN ARRAY ARRAY['time_entries', 'leave_requests', 'overtime_logs'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS employee_approval_update_guard ON public.%I', table_name);
    EXECUTE format('CREATE TRIGGER employee_approval_update_guard BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION private.enforce_employee_approval_update()', table_name);
  END LOOP;
END $$;

-- Employee self-rating history is explicitly marked "self". Once a manager
-- writes the period review, employees may change only their response text.
ALTER TABLE public.performance_reviews DROP CONSTRAINT IF EXISTS performance_reviews_review_type_check;
ALTER TABLE public.performance_reviews DROP CONSTRAINT IF EXISTS valid_review_type;
ALTER TABLE public.performance_reviews ADD CONSTRAINT performance_reviews_review_type_check
  CHECK (review_type IN ('quarterly', 'mid-year', 'annual', 'probation', 'project', 'ad-hoc', 'self'));
CREATE OR REPLACE FUNCTION private.enforce_performance_review_write()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF private.is_hr_service_context() OR (
    private.can_manage_employee(NEW.employee_id)
    AND (TG_OP = 'INSERT' OR private.can_manage_employee(OLD.employee_id))
  ) THEN RETURN NEW; END IF;
  IF NEW.employee_id IS DISTINCT FROM private.current_employee_id() THEN
    RAISE EXCEPTION 'Review is outside the current user scope' USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.review_type <> 'self' OR NEW.status IS DISTINCT FROM 'draft'
      OR NEW.reviewer_id IS DISTINCT FROM NEW.employee_id
      OR NEW.approved_at IS NOT NULL OR NEW.submitted_at IS NOT NULL
      OR NEW.self_assessment_skipped
      OR NEW.technical_skills_rating IS NOT NULL OR NEW.communication_rating IS NOT NULL
      OR NEW.leadership_rating IS NOT NULL OR NEW.teamwork_rating IS NOT NULL
      OR NEW.problem_solving_rating IS NOT NULL
      OR NEW.strengths IS NOT NULL OR NEW.areas_for_improvement IS NOT NULL
      OR NEW.achievements IS NOT NULL OR NEW.comments IS NOT NULL
      OR COALESCE(NEW.goals_met, 0) <> 0 OR COALESCE(NEW.goals_total, 0) <> 0 THEN
      RAISE EXCEPTION 'Employees may create only a draft self-assessment' USING ERRCODE = '42501';
    END IF;
  ELSIF OLD.review_type = 'self' AND OLD.status = 'draft' THEN
    IF (to_jsonb(NEW) - ARRAY['employee_comments', 'overall_rating', 'review_date', 'updated_at'])
      IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['employee_comments', 'overall_rating', 'review_date', 'updated_at']) THEN
      RAISE EXCEPTION 'Employees cannot change manager review fields' USING ERRCODE = '42501';
    END IF;
  ELSIF (to_jsonb(NEW) - ARRAY['employee_comments', 'updated_at'])
    IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['employee_comments', 'updated_at']) THEN
    RAISE EXCEPTION 'Employees may only respond to their manager review' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.enforce_performance_review_write() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER performance_review_write_guard BEFORE INSERT OR UPDATE ON public.performance_reviews
  FOR EACH ROW EXECUTE FUNCTION private.enforce_performance_review_write();

DO $$ DECLARE p record; table_name text; BEGIN
  FOREACH table_name IN ARRAY ARRAY['performance_reviews', 'skills_assessments', 'performance_skills'] LOOP
    FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = table_name LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', p.policyname, table_name);
    END LOOP;
    EXECUTE format('CREATE POLICY employee_scoped_read ON public.%I FOR SELECT TO authenticated USING (employee_id = (SELECT private.current_employee_id()) OR private.can_manage_employee(employee_id))', table_name);
    EXECUTE format('CREATE POLICY employee_scoped_insert ON public.%I FOR INSERT TO authenticated WITH CHECK (employee_id = (SELECT private.current_employee_id()) OR private.can_manage_employee(employee_id))', table_name);
    EXECUTE format('CREATE POLICY employee_scoped_update ON public.%I FOR UPDATE TO authenticated USING (employee_id = (SELECT private.current_employee_id()) OR private.can_manage_employee(employee_id)) WITH CHECK (employee_id = (SELECT private.current_employee_id()) OR private.can_manage_employee(employee_id))', table_name);
    IF table_name = 'performance_reviews' THEN
      EXECUTE format('CREATE POLICY admin_delete ON public.%I FOR DELETE TO authenticated USING ((SELECT private.current_hr_role()) = ''admin'')', table_name);
    ELSE
      EXECUTE format('CREATE POLICY employee_scoped_delete ON public.%I FOR DELETE TO authenticated USING (employee_id = (SELECT private.current_employee_id()) OR private.can_manage_employee(employee_id))', table_name);
    END IF;
  END LOOP;
END $$;

-- Recruitment is an active HR admin/manager capability across the workflow.
DO $$ DECLARE p record; table_name text; BEGIN
  FOREACH table_name IN ARRAY ARRAY['applicants', 'applications', 'job_applications', 'interview_schedules', 'recruitment_metrics'] LOOP
    FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = table_name LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', p.policyname, table_name);
    END LOOP;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', table_name);
    IF table_name = 'recruitment_metrics' THEN
      REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.recruitment_metrics FROM authenticated;
      CREATE POLICY recruitment_read ON public.recruitment_metrics FOR SELECT TO authenticated
        USING ((SELECT private.current_hr_role()) IN ('admin', 'manager'));
    ELSE
      EXECUTE format('CREATE POLICY recruitment_manage ON public.%I FOR ALL TO authenticated USING ((SELECT private.current_hr_role()) IN (''admin'', ''manager'')) WITH CHECK ((SELECT private.current_hr_role()) IN (''admin'', ''manager''))', table_name);
    END IF;
  END LOOP;
END $$;

-- Trigger-only derived metrics. The explicit HR role check is required even
-- though the initiating application's RLS has already authorized the write.
CREATE OR REPLACE FUNCTION private.refresh_recruitment_metrics()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE target_id bigint;
BEGIN
  IF NOT COALESCE(private.is_hr_service_context(), false)
    AND COALESCE(private.current_hr_role(), '') NOT IN ('admin', 'manager') THEN
    RAISE EXCEPTION 'Recruitment management requires an active HR manager' USING ERRCODE = '42501';
  END IF;
  FOR target_id IN
    SELECT DISTINCT id FROM unnest(ARRAY[
      CASE WHEN TG_OP <> 'INSERT' THEN OLD.job_posting_id END,
      CASE WHEN TG_OP <> 'DELETE' THEN NEW.job_posting_id END
    ]) AS affected(id) WHERE id IS NOT NULL ORDER BY id
  LOOP
    -- Serialize competing application changes for this job. A cascading job
    -- deletion leaves no parent and must not recreate a metrics row.
    PERFORM 1 FROM public.job_postings WHERE id = target_id FOR UPDATE;
    IF NOT FOUND THEN CONTINUE; END IF;
    INSERT INTO public.recruitment_metrics (job_posting_id, total_applications, under_review, shortlisted,
      interviews_scheduled, offers_extended, hired, rejected)
    SELECT target_id, count(*), count(*) FILTER (WHERE status = 'under review'),
      count(*) FILTER (WHERE status = 'shortlisted'), count(*) FILTER (WHERE status = 'interview scheduled'),
      count(*) FILTER (WHERE status = 'offer extended'), count(*) FILTER (WHERE status = 'hired'),
      count(*) FILTER (WHERE status = 'rejected') FROM public.applications WHERE job_posting_id = target_id
    ON CONFLICT (job_posting_id) DO UPDATE SET total_applications = EXCLUDED.total_applications,
      under_review = EXCLUDED.under_review, shortlisted = EXCLUDED.shortlisted,
      interviews_scheduled = EXCLUDED.interviews_scheduled, offers_extended = EXCLUDED.offers_extended,
      hired = EXCLUDED.hired, rejected = EXCLUDED.rejected, last_updated = CURRENT_TIMESTAMP;
  END LOOP;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION private.refresh_recruitment_metrics() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trigger_update_recruitment_metrics ON public.applications;
CREATE TRIGGER trigger_update_recruitment_metrics AFTER INSERT OR UPDATE OR DELETE ON public.applications
  FOR EACH ROW EXECUTE FUNCTION private.refresh_recruitment_metrics();
REVOKE ALL ON FUNCTION public.update_recruitment_metrics() FROM PUBLIC, anon, authenticated;

-- Production has no legacy interview rows. Refuse to discard any if that
-- changes before deployment; a populated legacy installation needs a mapping.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public'
    AND table_name = 'interview_schedules' AND column_name = 'application_id' AND data_type <> 'uuid') THEN
    IF EXISTS (SELECT 1 FROM public.interview_schedules) THEN
      RAISE EXCEPTION 'Map existing legacy interviews to applications before running this migration';
    END IF;
    DROP VIEW IF EXISTS public.upcoming_interviews;
    DROP VIEW IF EXISTS public.applications_detailed;
    ALTER TABLE public.interview_schedules DROP CONSTRAINT interview_schedules_application_id_fkey;
    ALTER TABLE public.interview_schedules ALTER COLUMN application_id TYPE uuid USING NULL::uuid;
    ALTER TABLE public.interview_schedules ADD CONSTRAINT interview_schedules_application_id_fkey
      FOREIGN KEY (application_id) REFERENCES public.applications(id) ON DELETE CASCADE;
  END IF;
END $$;
CREATE OR REPLACE VIEW public.applications_detailed WITH (security_invoker = true) AS
SELECT app.id, candidate.full_name AS candidate_name, candidate.email, candidate.phone,
  candidate.years_of_experience AS experience_years, app.status, app.status AS stage,
  app.application_date::date AS applied_date, app.rating, jp.title AS job_title,
  jp.department, jp.position_type, jp.location, count(ist.id) AS interview_count,
  max(ist.scheduled_time) AS last_interview_date
FROM public.applications app
JOIN public.applicants candidate ON candidate.id = app.applicant_id
JOIN public.job_postings jp ON jp.id = app.job_posting_id
LEFT JOIN public.interview_schedules ist ON ist.application_id = app.id
GROUP BY app.id, candidate.id, jp.id;
GRANT SELECT ON public.applications_detailed TO authenticated, service_role;
CREATE OR REPLACE VIEW public.upcoming_interviews WITH (security_invoker = true) AS
SELECT ist.id AS interview_id, ist.scheduled_time, ist.interview_type, ist.duration_minutes,
  ist.location, ist.status, candidate.full_name AS candidate_name, candidate.email AS candidate_email,
  candidate.phone AS candidate_phone, jp.title AS job_title, e.name AS interviewer_name, e.email AS interviewer_email
FROM public.interview_schedules ist
JOIN public.applications app ON app.id = ist.application_id
JOIN public.applicants candidate ON candidate.id = app.applicant_id
JOIN public.job_postings jp ON jp.id = app.job_posting_id
LEFT JOIN public.employees e ON e.id = ist.interviewer_id
WHERE ist.status = 'scheduled' AND ist.scheduled_time >= CURRENT_TIMESTAMP ORDER BY ist.scheduled_time;
GRANT SELECT ON public.upcoming_interviews TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.mark_application_interview_scheduled()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF NEW.status = 'scheduled' THEN
    UPDATE public.applications SET status = 'interview scheduled'
    WHERE id = NEW.application_id AND status IN ('under review', 'shortlisted', 'interview scheduled');
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.mark_application_interview_scheduled() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER mark_application_interview_scheduled AFTER INSERT OR UPDATE OF application_id, status
  ON public.interview_schedules FOR EACH ROW EXECUTE FUNCTION private.mark_application_interview_scheduled();

-- Protect document objects even when another application has a permissive,
-- bucket-agnostic Storage policy in this shared project.
CREATE OR REPLACE FUNCTION private.can_access_hr_document(object_name text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE owner_key text; object_file text;
BEGIN
  IF NOT private.is_active_hr_user() THEN RETURN false; END IF;
  IF private.current_hr_role() = 'admin' THEN RETURN true; END IF;
  IF starts_with(object_name, 'resumes/') THEN RETURN private.current_hr_role() = 'manager'; END IF;
  IF strpos(object_name, '/') > 0 AND NOT starts_with(object_name, 'time-proofs/')
    AND NOT starts_with(object_name, 'request-documents/') THEN RETURN false; END IF;
  object_file := CASE WHEN strpos(object_name, '/') > 0 THEN split_part(object_name, '/', 2) ELSE object_name END;
  owner_key := split_part(object_file, '_', 1);
  RETURN owner_key = private.current_employee_id()
    OR owner_key = private.current_hr_user_id()::text
    OR private.can_manage_employee(owner_key)
    OR EXISTS (SELECT 1 FROM public.hr_users hu WHERE hu.id::text = owner_key AND private.can_manage_employee(hu.employee_id));
END;
$$;
REVOKE ALL ON FUNCTION private.can_access_hr_document(text) FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO anon;
GRANT EXECUTE ON FUNCTION private.can_access_hr_document(text) TO anon, authenticated, service_role;
DO $$ DECLARE p record; BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects'
    AND (qual LIKE '%employee-documents%' OR with_check LIKE '%employee-documents%') LOOP
    EXECUTE format('DROP POLICY %I ON storage.objects', p.policyname);
  END LOOP;
END $$;
CREATE POLICY employee_documents_scope ON storage.objects AS RESTRICTIVE FOR ALL TO public
  USING (bucket_id <> 'employee-documents' OR private.can_access_hr_document(name))
  WITH CHECK (bucket_id <> 'employee-documents' OR private.can_access_hr_document(name));
CREATE POLICY employee_documents_access ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'employee-documents' AND private.can_access_hr_document(name))
  WITH CHECK (bucket_id = 'employee-documents' AND private.can_access_hr_document(name));
UPDATE storage.buckets SET public = false WHERE id = 'employee-documents';

-- The Edge Function's admin check must not be bypassable through direct REST.
DO $$ DECLARE p record; BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'visits' LOOP
    EXECUTE format('DROP POLICY %I ON public.visits', p.policyname);
  END LOOP;
END $$;
ALTER TABLE public.visits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.visits FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.visits FROM authenticated;
CREATE POLICY hr_admin_visit_read ON public.visits FOR SELECT TO authenticated
  USING ((SELECT private.current_hr_role()) = 'admin');
CREATE POLICY service_visit_manage ON public.visits FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Authorized, transactionally maintained monthly attendance totals.
CREATE OR REPLACE FUNCTION private.refresh_time_tracking_summary(
  p_employee_id text,
  p_month integer,
  p_year integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_period_start date := make_date(p_year, p_month, 1);
  v_period_end date := (v_period_start + interval '1 month')::date;
  v_days_worked integer := 0;
  v_leave_days numeric := 0;
  v_regular_hours numeric := 0;
  v_overtime_hours numeric := 0;
  v_holiday_overtime_hours numeric := 0;
  v_overtime_log_hours numeric := 0;
  v_holiday_overtime_log_hours numeric := 0;
  v_total_hours numeric := 0;
  v_attendance_rate numeric := 0;
  v_working_days integer := 22;
BEGIN
  IF NOT COALESCE(private.is_hr_service_context(), false)
    AND NOT COALESCE(p_employee_id = private.current_employee_id() OR private.can_manage_employee(p_employee_id), false) THEN
    RAISE EXCEPTION 'Attendance summary is outside the current user scope' USING ERRCODE = '42501';
  END IF;
  PERFORM 1 FROM public.employees WHERE id = p_employee_id FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  SELECT
    COUNT(DISTINCT date) FILTER (
      WHERE hour_type IS NULL
        OR hour_type NOT IN ('on_leave', 'vacation', 'sick_leave')
    ),
    COALESCE(SUM(hours) FILTER (
      WHERE hour_type IN ('regular', 'wfh')
    ), 0),
    COALESCE(SUM(hours) FILTER (
      WHERE hour_type IN ('weekend', 'bonus', 'overtime')
    ), 0),
    COALESCE(SUM(hours) FILTER (
      WHERE hour_type = 'holiday'
    ), 0),
    COALESCE(SUM(hours) FILTER (
      WHERE hour_type IS NULL
        OR hour_type NOT IN ('on_leave', 'vacation', 'sick_leave')
    ), 0)
  INTO
    v_days_worked,
    v_regular_hours,
    v_overtime_hours,
    v_holiday_overtime_hours,
    v_total_hours
  FROM public.time_entries
  WHERE employee_id = p_employee_id
    AND date >= v_period_start
    AND date < v_period_end
    AND status IN ('pending', 'approved');

  -- Clip overlapping requests to this month and count each date once,
  -- including leave entered through the time-entry form.
  SELECT count(*) INTO v_leave_days FROM (
    SELECT day::date FROM public.leave_requests lr
    CROSS JOIN LATERAL generate_series(
      greatest(lr.start_date, v_period_start)::timestamp,
      least(lr.end_date, v_period_end - 1)::timestamp, interval '1 day'
    ) day
    WHERE lr.employee_id = p_employee_id AND lr.status = 'approved'
      AND lr.start_date < v_period_end AND lr.end_date >= v_period_start
      AND extract(isodow FROM day) BETWEEN 1 AND 5
    UNION
    SELECT date FROM public.time_entries
    WHERE employee_id = p_employee_id AND date >= v_period_start AND date < v_period_end
      AND hour_type IN ('on_leave', 'vacation', 'sick_leave') AND status IN ('pending', 'approved')
  ) leave_dates;

  SELECT
    COALESCE(SUM(hours) FILTER (
      WHERE overtime_type IS DISTINCT FROM 'holiday'
    ), 0),
    COALESCE(SUM(hours) FILTER (
      WHERE overtime_type = 'holiday'
    ), 0)
  INTO
    v_overtime_log_hours,
    v_holiday_overtime_log_hours
  FROM public.overtime_logs
  WHERE employee_id = p_employee_id
    AND date >= v_period_start
    AND date < v_period_end
    AND status IN ('pending', 'approved');

  v_overtime_hours := v_overtime_hours + v_overtime_log_hours;
  v_holiday_overtime_hours :=
    v_holiday_overtime_hours + v_holiday_overtime_log_hours;
  v_total_hours :=
    v_total_hours + v_overtime_log_hours + v_holiday_overtime_log_hours;

  IF v_working_days > 0 THEN
    v_attendance_rate := LEAST(
      ((v_days_worked + v_leave_days) / v_working_days::numeric) * 100,
      100
    );
  END IF;

  INSERT INTO public.time_tracking_summary (
    employee_id,
    month,
    year,
    days_worked,
    leave_days,
    regular_hours,
    overtime_hours,
    holiday_overtime_hours,
    total_hours,
    attendance_rate
  )
  VALUES (
    p_employee_id,
    p_month,
    p_year,
    v_days_worked,
    v_leave_days,
    v_regular_hours,
    v_overtime_hours,
    v_holiday_overtime_hours,
    v_total_hours,
    v_attendance_rate
  )
  ON CONFLICT (employee_id, month, year)
  DO UPDATE SET
    days_worked = EXCLUDED.days_worked,
    leave_days = EXCLUDED.leave_days,
    regular_hours = EXCLUDED.regular_hours,
    overtime_hours = EXCLUDED.overtime_hours,
    holiday_overtime_hours = EXCLUDED.holiday_overtime_hours,
    total_hours = EXCLUDED.total_hours,
    attendance_rate = EXCLUDED.attendance_rate,
    updated_at = CURRENT_TIMESTAMP;
END;
$$;

REVOKE ALL ON FUNCTION private.refresh_time_tracking_summary(text, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.refresh_time_tracking_summary(text, integer, integer) TO authenticated, service_role;

-- Preserve the existing RPC contract; all elevation and scope checks stay in
-- the private function. Clients can request recalculation, never set totals.
CREATE OR REPLACE FUNCTION public.update_time_tracking_summary(p_employee_id text, p_month integer, p_year integer)
RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  SELECT private.refresh_time_tracking_summary(p_employee_id, p_month, p_year);
$$;
REVOKE ALL ON FUNCTION public.update_time_tracking_summary(text, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_time_tracking_summary(text, integer, integer) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.trigger_update_summary()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE old_row jsonb; new_row jsonb; affected record;
BEGIN
  IF TG_OP <> 'INSERT' THEN old_row := to_jsonb(OLD); END IF;
  IF TG_OP <> 'DELETE' THEN new_row := to_jsonb(NEW); END IF;
  FOR affected IN
    SELECT DISTINCT row_data->>'employee_id' AS employee_id, period::date AS period
    FROM (VALUES (old_row), (new_row)) rows(row_data)
    CROSS JOIN LATERAL generate_series(
      date_trunc('month', COALESCE(row_data->>'start_date', row_data->>'date')::date)::timestamp,
      date_trunc('month', COALESCE(row_data->>'end_date', row_data->>'date')::date)::timestamp,
      interval '1 month'
    ) period
    WHERE row_data IS NOT NULL ORDER BY employee_id, period
  LOOP
    PERFORM private.refresh_time_tracking_summary(affected.employee_id,
      extract(month FROM affected.period)::integer, extract(year FROM affected.period)::integer);
  END LOOP;
  RETURN NULL;
END;
$$;

-- Repair existing totals as well as future writes. No source attendance rows
-- are changed; old and new months are both recalculated on later edits.
DO $$ DECLARE affected record; BEGIN
  FOR affected IN
    SELECT DISTINCT dates.employee_id, dates.period FROM (
      SELECT employee_id, make_date(year, month, 1) AS period FROM public.time_tracking_summary
      UNION SELECT employee_id, date_trunc('month', date)::date FROM public.time_entries
      UNION SELECT employee_id, date_trunc('month', date)::date FROM public.overtime_logs
      UNION SELECT lr.employee_id, period::date FROM public.leave_requests lr
        CROSS JOIN LATERAL generate_series(date_trunc('month', start_date)::timestamp,
          date_trunc('month', end_date)::timestamp, interval '1 month') period
    ) dates JOIN public.employees e ON e.id = dates.employee_id ORDER BY dates.employee_id, dates.period
  LOOP
    PERFORM private.refresh_time_tracking_summary(affected.employee_id,
      extract(month FROM affected.period)::integer, extract(year FROM affected.period)::integer);
  END LOOP;
END $$;
