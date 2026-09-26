-- Approved leave / attendance. Run transactionally; never run the old draft.
-- Production audit (2026-09-26): public.update_time_tracking_summary is an
-- INVOKER owned by postgres, with PUBLIC/anon/authenticated/service_role EXECUTE.
-- Its source tables are scoped by RLS; summary writes are allowed. Preserve that
-- privilege boundary, owner and ACL. Source objects are schema-qualified.
--
-- The repository also contains an UNDEPLOYED access-hardening migration: there
-- public.update is a SQL wrapper over a same-owner private DEFINER, and direct
-- summary writes are revoked. Only that exact wrapper (or an existing public
-- definer) retains its existing effective elevation when consolidating the body.
-- This does NOT upgrade production's invoker function to definer.
--
-- One calculation body, mirrored by src/utils/attendanceRules.js. Approved
-- standalone leave entries count as leave without suppressing regular hours.
-- No holiday calendar; leave requests cover distinct inclusive Mon-Fri dates.

DO $migration$
DECLARE
  preserve_definer boolean;
BEGIN
  SELECT p.prosecdef OR (
    l.lanname = 'sql'
    AND pg_catalog.btrim(pg_catalog.regexp_replace(p.prosrc, '\s+', ' ', 'g')) =
      'SELECT private.refresh_time_tracking_summary(p_employee_id, p_month, p_year);'
    AND EXISTS (
      SELECT 1 FROM pg_catalog.pg_proc helper
      WHERE helper.oid = pg_catalog.to_regprocedure('private.refresh_time_tracking_summary(text,integer,integer)')
        AND helper.prosecdef AND helper.proowner = p.proowner
    )
  ) INTO STRICT preserve_definer
  FROM pg_catalog.pg_proc p
  JOIN pg_catalog.pg_language l ON l.oid = p.prolang
  WHERE p.oid = 'public.update_time_tracking_summary(text,integer,integer)'::regprocedure;

  EXECUTE $definition$
CREATE OR REPLACE FUNCTION public.update_time_tracking_summary(p_employee_id text, p_month integer, p_year integer)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $summary$
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
  -- SQL role is checked, not a caller-writable JWT role claim. SET ROLE is
  -- permission-checked by PostgreSQL, including inside a definer function.
  IF COALESCE(NULLIF(pg_catalog.current_setting('role', true), 'none'), session_user)
       NOT IN ('postgres', 'supabase_admin', 'service_role') THEN
    IF COALESCE(NULLIF(pg_catalog.current_setting('role', true), 'none'), session_user) <> 'authenticated'
       OR NOT COALESCE(p_employee_id = private.current_employee_id()
                       OR private.can_manage_employee(p_employee_id), false) THEN
      RAISE EXCEPTION 'Attendance summary is outside the current user scope' USING ERRCODE = '42501';
    END IF;
  END IF;

  -- Shared with generated inserts and leave reconciliation. At READ COMMITTED
  -- the query following a wait sees committed changes before computing totals.
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('hr.attendance:' || p_employee_id, 0));

  -- A summary row references employees(id); nothing to store for a deleted one.
  IF NOT EXISTS (SELECT 1 FROM public.employees WHERE id = p_employee_id) THEN
    RETURN;
  END IF;

  WITH covered AS (
    -- Approved-leave weekdays of this month, each date once however many
    -- approved requests overlap it.
    SELECT DISTINCT d::date AS day
    FROM public.leave_requests lr
    CROSS JOIN LATERAL generate_series(
      greatest(lr.start_date, v_period_start)::timestamp,
      least(lr.end_date, v_period_end - 1)::timestamp,
      interval '1 day'
    ) d
    WHERE lr.employee_id = p_employee_id
      AND lr.status = 'approved'
      AND lr.start_date < v_period_end
      AND lr.end_date >= v_period_start
      AND extract(isodow FROM d) BETWEEN 1 AND 5
  ),
  entries AS (
    SELECT
      te.date,
      te.hours,
      te.status,
      lower(coalesce(te.hour_type, 'regular')) AS hour_type,
      EXISTS (SELECT 1 FROM covered c WHERE c.day = te.date) AS on_leave
    FROM public.time_entries te
    WHERE te.employee_id = p_employee_id
      AND te.date >= v_period_start
      AND te.date < v_period_end
      AND te.status IN ('pending', 'approved')
  ),
  worked AS (
    -- Leave-type entries (on_leave, vacation, sick_leave) are never hours.
    SELECT * FROM entries WHERE hour_type NOT IN ('on_leave', 'vacation', 'sick_leave')
  ),
  leave_dates AS (
    SELECT day FROM covered
    UNION
    -- Leave filed through the time-entry form counts once approved.
    SELECT date FROM entries
    WHERE hour_type IN ('on_leave', 'vacation', 'sick_leave') AND status = 'approved'
  )
  SELECT
    (SELECT count(*) FROM leave_dates),
    COUNT(DISTINCT w.date) FILTER (WHERE NOT w.on_leave),
    COALESCE(SUM(w.hours) FILTER (
      WHERE NOT w.on_leave
        AND w.hour_type NOT IN ('overtime', 'weekend', 'bonus', 'holiday')
    ), 0),
    COALESCE(SUM(w.hours) FILTER (WHERE w.hour_type IN ('weekend', 'bonus', 'overtime')), 0),
    COALESCE(SUM(w.hours) FILTER (WHERE w.hour_type = 'holiday'), 0),
    COALESCE(SUM(w.hours) FILTER (
      WHERE NOT w.on_leave
        OR w.hour_type IN ('overtime', 'weekend', 'bonus', 'holiday')
    ), 0)
  INTO
    v_leave_days,
    v_days_worked,
    v_regular_hours,
    v_overtime_hours,
    v_holiday_overtime_hours,
    v_total_hours
  FROM worked w;

  SELECT
    COALESCE(SUM(hours) FILTER (WHERE overtime_type IS DISTINCT FROM 'holiday'), 0),
    COALESCE(SUM(hours) FILTER (WHERE overtime_type = 'holiday'), 0)
  INTO
    v_overtime_log_hours,
    v_holiday_overtime_log_hours
  FROM public.overtime_logs
  WHERE employee_id = p_employee_id
    AND date >= v_period_start
    AND date < v_period_end
    AND status IN ('pending', 'approved');

  v_overtime_hours := v_overtime_hours + v_overtime_log_hours;
  v_holiday_overtime_hours := v_holiday_overtime_hours + v_holiday_overtime_log_hours;
  v_total_hours := v_total_hours + v_overtime_log_hours + v_holiday_overtime_log_hours;

  IF v_working_days > 0 THEN
    v_attendance_rate := LEAST(((v_days_worked + v_leave_days) / v_working_days::numeric) * 100, 100);
  END IF;

  INSERT INTO public.time_tracking_summary (
    employee_id, month, year, days_worked, leave_days, regular_hours,
    overtime_hours, holiday_overtime_hours, total_hours, attendance_rate
  )
  VALUES (
    p_employee_id, p_month, p_year, v_days_worked, v_leave_days, v_regular_hours,
    v_overtime_hours, v_holiday_overtime_hours, v_total_hours, v_attendance_rate
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
$summary$;

$definition$;
  IF preserve_definer THEN
    ALTER FUNCTION public.update_time_tracking_summary(text, integer, integer) SECURITY DEFINER;
  END IF;
END;
$migration$;

-- Existing leave/overtime row triggers retain their names and bindings.
CREATE OR REPLACE FUNCTION public.trigger_update_summary()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $trigger$
DECLARE
  old_row jsonb;
  new_row jsonb;
  affected record;
BEGIN
  IF TG_OP <> 'INSERT' THEN old_row := pg_catalog.to_jsonb(OLD); END IF;
  IF TG_OP <> 'DELETE' THEN new_row := pg_catalog.to_jsonb(NEW); END IF;

  -- Lock both employees in a stable order, also used by the insert guard.
  FOR affected IN
    SELECT DISTINCT r.row_data ->> 'employee_id' AS employee_id
    FROM (VALUES (old_row), (new_row)) r(row_data)
    WHERE r.row_data ->> 'employee_id' IS NOT NULL ORDER BY 1
  LOOP
    PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('hr.attendance:' || affected.employee_id, 0));
  END LOOP;

  IF TG_TABLE_NAME = 'leave_requests' THEN
    -- Cleanup and approval commit together. A second approval is harmless.
    -- Preserve EVERY predicate: manual rows and non-regular rows stay stored.
    IF new_row ->> 'status' = 'approved' THEN
      DELETE FROM public.time_entries te
      WHERE te.employee_id = new_row ->> 'employee_id'
        AND te.date BETWEEN (new_row ->> 'start_date')::date AND (new_row ->> 'end_date')::date
        AND extract(isodow FROM te.date) BETWEEN 1 AND 5
        AND te.hour_type = 'regular'
        AND te.clock_in = time '09:00'
        AND te.clock_out = time '17:00'
        AND te.notes LIKE 'Standard hours filled by admin:%';
    END IF;

    -- Only changed approved weekday coverage needs invalidation. Ignore reason,
    -- days_count and pending/rejected range edits. Exclude dates still covered
    -- by another approved request. Include OLD and NEW employees and dates.
    FOR affected IN
      WITH coverage AS (
        SELECT r.version, r.row_data ->> 'employee_id' AS employee_id, d::date AS day
        FROM (VALUES ('old', old_row), ('new', new_row)) r(version, row_data)
        CROSS JOIN LATERAL pg_catalog.generate_series(
          (r.row_data ->> 'start_date')::timestamp,
          (r.row_data ->> 'end_date')::timestamp, interval '1 day'
        ) d
        WHERE r.row_data ->> 'status' = 'approved'
          AND extract(isodow FROM d) BETWEEN 1 AND 5
      ), changed AS (
        SELECT employee_id, day FROM coverage GROUP BY employee_id, day HAVING count(*) = 1
      )
      SELECT DISTINCT c.employee_id, pg_catalog.date_trunc('month', c.day)::date AS month_start
      FROM changed c
      WHERE NOT EXISTS (
        SELECT 1 FROM public.leave_requests lr
        WHERE lr.employee_id = c.employee_id AND lr.status = 'approved'
          AND lr.id::text <> COALESCE(new_row ->> 'id', old_row ->> 'id')
          AND c.day BETWEEN lr.start_date AND lr.end_date
      )
      ORDER BY 1, 2
    LOOP
      PERFORM public.update_time_tracking_summary(affected.employee_id,
        extract(month FROM affected.month_start)::integer, extract(year FROM affected.month_start)::integer);
    END LOOP;
  ELSE
    -- Overtime logs retain their existing pending/approved contribution.
    FOR affected IN
      WITH contributions AS (
        SELECT r.row_data ->> 'employee_id' AS employee_id,
          (r.row_data ->> 'date')::date AS day,
          r.row_data ->> 'hours' AS hours,
          COALESCE(r.row_data ->> 'overtime_type', 'regular') AS overtime_type
        FROM (VALUES (old_row), (new_row)) r(row_data)
        WHERE r.row_data ->> 'status' IN ('pending', 'approved')
      ), changed AS (
        SELECT employee_id, day, hours, overtime_type FROM contributions
        GROUP BY employee_id, day, hours, overtime_type HAVING count(*) = 1
      )
      SELECT DISTINCT employee_id, pg_catalog.date_trunc('month', day)::date AS month_start
      FROM changed ORDER BY 1, 2
    LOOP
      PERFORM public.update_time_tracking_summary(affected.employee_id,
        extract(month FROM affected.month_start)::integer, extract(year FROM affected.month_start)::integer);
    END LOOP;
  END IF;
  RETURN NULL;
END;
$trigger$;

-- The old local wrapper is now disconnected and can be removed. No CASCADE:
-- an unexpected dependent caller makes the migration fail instead of deleting it.
DROP FUNCTION IF EXISTS private.refresh_time_tracking_summary(text, integer, integer);

CREATE OR REPLACE FUNCTION public.skip_generated_hours_on_approved_leave()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $guard$
BEGIN
  IF NEW.hour_type = 'regular'
     AND NEW.clock_in = time '09:00'
     AND NEW.clock_out = time '17:00'
     AND NEW.notes LIKE 'Standard hours filled by admin:%'
     AND extract(isodow FROM NEW.date) BETWEEN 1 AND 5 THEN
    PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('hr.attendance:' || NEW.employee_id, 0));
    IF EXISTS (
      SELECT 1 FROM public.leave_requests lr
      WHERE lr.employee_id = NEW.employee_id AND lr.status = 'approved'
        AND NEW.date BETWEEN lr.start_date AND lr.end_date
    ) THEN
      -- INSERT RETURNING includes only stored rows; fill counts that result.
      RETURN NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$guard$;

DROP TRIGGER IF EXISTS time_entries_skip_bulk_fill_on_leave ON public.time_entries;
CREATE TRIGGER time_entries_skip_bulk_fill_on_leave
  BEFORE INSERT ON public.time_entries FOR EACH ROW
  EXECUTE FUNCTION public.skip_generated_hours_on_approved_leave();

-- Targeted migration repair: ONLY months with approved-request weekdays.
-- Standalone leave entries change future calculations, but are deliberately not
-- grounds for expanding the historical backfill to unrelated months.
DO $backfill$
DECLARE affected record;
BEGIN
  CREATE TEMP TABLE attendance_approved_leave_periods ON COMMIT DROP AS
  SELECT DISTINCT lr.employee_id, pg_catalog.date_trunc('month', d)::date AS month_start
  FROM public.leave_requests lr
  CROSS JOIN LATERAL pg_catalog.generate_series(lr.start_date::timestamp, lr.end_date::timestamp, interval '1 day') d
  WHERE lr.status = 'approved' AND extract(isodow FROM d) BETWEEN 1 AND 5;

  DELETE FROM public.time_entries te
  WHERE te.hour_type = 'regular'
    AND te.clock_in = time '09:00'
    AND te.clock_out = time '17:00'
    AND te.notes LIKE 'Standard hours filled by admin:%'
    AND extract(isodow FROM te.date) BETWEEN 1 AND 5
    AND EXISTS (
      SELECT 1 FROM public.leave_requests lr
      WHERE lr.employee_id = te.employee_id AND lr.status = 'approved'
        AND te.date BETWEEN lr.start_date AND lr.end_date
    );

  FOR affected IN
    SELECT a.employee_id, a.month_start FROM attendance_approved_leave_periods a
    JOIN public.employees e ON e.id = a.employee_id ORDER BY 1, 2
  LOOP
    PERFORM public.update_time_tracking_summary(affected.employee_id,
      extract(month FROM affected.month_start)::integer, extract(year FROM affected.month_start)::integer);
  END LOOP;
  DROP TABLE pg_temp.attendance_approved_leave_periods;
END;
$backfill$;
