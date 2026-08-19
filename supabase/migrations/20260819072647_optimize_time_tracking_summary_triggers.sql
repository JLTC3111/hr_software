-- Recalculate each employee/month once per statement instead of once per row.
-- The bulk-hours flow inserts many rows in one PostgREST statement; the former
-- row trigger repeatedly scanned the same month until the authenticated role's
-- statement timeout was reached.

CREATE INDEX IF NOT EXISTS idx_leave_requests_employee_start_date
  ON public.leave_requests (employee_id, start_date);

CREATE INDEX IF NOT EXISTS idx_overtime_logs_employee_date
  ON public.overtime_logs (employee_id, date);

CREATE OR REPLACE FUNCTION public.update_time_tracking_summary(
  p_employee_id text,
  p_month integer,
  p_year integer
)
RETURNS void
LANGUAGE plpgsql
SET search_path = public, pg_temp
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

  SELECT COALESCE(SUM(days_count), 0)
  INTO v_leave_days
  FROM public.leave_requests
  WHERE employee_id = p_employee_id
    AND start_date >= v_period_start
    AND start_date < v_period_end
    AND status = 'approved';

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

CREATE OR REPLACE FUNCTION public.refresh_time_entry_summaries_after_insert()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_period record;
BEGIN
  FOR v_period IN
    SELECT DISTINCT
      employee_id,
      EXTRACT(MONTH FROM date)::integer AS month,
      EXTRACT(YEAR FROM date)::integer AS year
    FROM new_time_entries
  LOOP
    PERFORM public.update_time_tracking_summary(
      v_period.employee_id,
      v_period.month,
      v_period.year
    );
  END LOOP;

  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_time_entry_summaries_after_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_period record;
BEGIN
  FOR v_period IN
    SELECT DISTINCT affected.employee_id, affected.month, affected.year
    FROM (
      SELECT
        employee_id,
        EXTRACT(MONTH FROM date)::integer AS month,
        EXTRACT(YEAR FROM date)::integer AS year
      FROM old_time_entries
      UNION
      SELECT
        employee_id,
        EXTRACT(MONTH FROM date)::integer AS month,
        EXTRACT(YEAR FROM date)::integer AS year
      FROM new_time_entries
    ) AS affected
  LOOP
    PERFORM public.update_time_tracking_summary(
      v_period.employee_id,
      v_period.month,
      v_period.year
    );
  END LOOP;

  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_time_entry_summaries_after_delete()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_period record;
BEGIN
  FOR v_period IN
    SELECT DISTINCT
      employee_id,
      EXTRACT(MONTH FROM date)::integer AS month,
      EXTRACT(YEAR FROM date)::integer AS year
    FROM old_time_entries
  LOOP
    PERFORM public.update_time_tracking_summary(
      v_period.employee_id,
      v_period.month,
      v_period.year
    );
  END LOOP;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS update_summary_on_time_entry
  ON public.time_entries;
DROP TRIGGER IF EXISTS update_summary_on_time_entry_insert
  ON public.time_entries;
DROP TRIGGER IF EXISTS update_summary_on_time_entry_update
  ON public.time_entries;
DROP TRIGGER IF EXISTS update_summary_on_time_entry_delete
  ON public.time_entries;

CREATE TRIGGER update_summary_on_time_entry_insert
AFTER INSERT ON public.time_entries
REFERENCING NEW TABLE AS new_time_entries
FOR EACH STATEMENT
EXECUTE FUNCTION public.refresh_time_entry_summaries_after_insert();

CREATE TRIGGER update_summary_on_time_entry_update
AFTER UPDATE ON public.time_entries
REFERENCING OLD TABLE AS old_time_entries NEW TABLE AS new_time_entries
FOR EACH STATEMENT
EXECUTE FUNCTION public.refresh_time_entry_summaries_after_update();

CREATE TRIGGER update_summary_on_time_entry_delete
AFTER DELETE ON public.time_entries
REFERENCING OLD TABLE AS old_time_entries
FOR EACH STATEMENT
EXECUTE FUNCTION public.refresh_time_entry_summaries_after_delete();
