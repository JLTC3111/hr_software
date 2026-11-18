-- Attendance dates use the employee's start date and roster status. Track the
-- effective date of future status changes without inferring past changes from
-- profile timestamps or rewriting existing attendance.
CREATE TABLE private.employee_attendance_status_changes (
  employee_id text NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  effective_on date NOT NULL,
  was_active boolean NOT NULL,
  is_active boolean NOT NULL,
  PRIMARY KEY (employee_id, effective_on)
);

ALTER TABLE private.employee_attendance_status_changes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.employee_attendance_status_changes FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON private.employee_attendance_status_changes TO authenticated, service_role;
CREATE POLICY employee_attendance_status_scoped_read
  ON private.employee_attendance_status_changes FOR SELECT TO authenticated
  USING (private.can_manage_employee(employee_id));

CREATE FUNCTION private.attendance_status_is_active(p_status text)
RETURNS boolean
LANGUAGE sql IMMUTABLE SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT regexp_replace(lower(btrim(coalesce(p_status, ''))), '[[:space:]_-]+', '', 'g')
    NOT IN ('inactive', 'terminated', 'former');
$$;

CREATE FUNCTION private.record_employee_attendance_status()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  previously_active boolean := private.attendance_status_is_active(OLD.status);
  currently_active boolean := private.attendance_status_is_active(NEW.status);
BEGIN
  IF previously_active <> currently_active THEN
    IF (SELECT auth.uid()) IS NOT NULL AND NOT private.can_manage_employee(NEW.id) THEN
      RAISE EXCEPTION 'Attendance status changes require employee management permission' USING ERRCODE = '42501';
    END IF;
    INSERT INTO private.employee_attendance_status_changes (employee_id, effective_on, was_active, is_active)
    VALUES (NEW.id, (clock_timestamp() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date, previously_active, currently_active)
    ON CONFLICT (employee_id, effective_on) DO UPDATE SET is_active = EXCLUDED.is_active;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER employee_attendance_status_changed
  AFTER UPDATE OF status ON public.employees
  FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION private.record_employee_attendance_status();

CREATE FUNCTION private.bulk_attendance_exclusion(
  p_employee_id text, p_status text, p_start_date date, p_attendance_date date
)
RETURNS text
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT CASE
    WHEN p_attendance_date < p_start_date THEN 'before_start'
    WHEN NOT coalesce(
      (SELECT change.is_active FROM private.employee_attendance_status_changes change
        WHERE change.employee_id = p_employee_id AND change.effective_on <= p_attendance_date
        ORDER BY change.effective_on DESC LIMIT 1),
      (SELECT change.was_active FROM private.employee_attendance_status_changes change
        WHERE change.employee_id = p_employee_id
        ORDER BY change.effective_on LIMIT 1),
      private.attendance_status_is_active(p_status)
    ) THEN 'inactive'
    ELSE NULL
  END;
$$;

CREATE FUNCTION public.bulk_attendance_roster(p_dates date[], p_employee_ids text[] DEFAULT NULL)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT coalesce(jsonb_agg(roster ORDER BY roster.name, roster.id), '[]'::jsonb)
  FROM (
    SELECT e.id, e.name, e.email, e.position, e.department,
      coalesce((
        SELECT jsonb_object_agg(d.attendance_date, eligibility.reason)
        FROM unnest(p_dates) AS d(attendance_date)
        CROSS JOIN LATERAL (
          SELECT private.bulk_attendance_exclusion(e.id, e.status, e.start_date, d.attendance_date) AS reason
        ) eligibility
        WHERE eligibility.reason IS NOT NULL
      ), '{}'::jsonb) AS exclusions
    FROM public.employees e
    WHERE (p_employee_ids IS NULL OR e.id = ANY(p_employee_ids))
      AND private.can_manage_employee(e.id)
  ) roster;
$$;

CREATE FUNCTION public.create_bulk_time_entries(p_entries jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  locked_ids text[];
  result jsonb;
BEGIN
  IF coalesce(private.current_hr_role(), '') NOT IN ('admin', 'manager') THEN
    RAISE EXCEPTION 'Bulk time entries require time management permission' USING ERRCODE = '42501';
  END IF;
  IF jsonb_typeof(p_entries) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Time entries must be an array' USING ERRCODE = '22023';
  END IF;

  -- Lock in employee order. A concurrent status change and its history write
  -- must finish before eligibility is read, or wait until this insert commits.
  SELECT array_agg(locked.id) INTO locked_ids
  FROM (
    SELECT e.id FROM public.employees e
    JOIN (SELECT DISTINCT employee_id FROM jsonb_to_recordset(p_entries) AS item(employee_id text)) requested
      ON requested.employee_id = e.id
    WHERE private.can_manage_employee(e.id)
    ORDER BY e.id
    FOR SHARE OF e
  ) locked;

  WITH checked AS MATERIALIZED (
    SELECT item.*,
      CASE WHEN e.id IS NULL THEN 'not_permitted'
        ELSE private.bulk_attendance_exclusion(e.id, e.status, e.start_date, item.date)
      END AS reason
    FROM jsonb_populate_recordset(NULL::public.time_entries, p_entries) AS item
    LEFT JOIN public.employees e ON e.id = item.employee_id AND e.id = ANY(locked_ids)
  ), inserted AS (
    INSERT INTO public.time_entries (
      employee_id, date, clock_in, clock_out, hours, hour_type, notes,
      proof_file_url, proof_file_name, proof_file_type, proof_file_path, status
    )
    SELECT employee_id, date, clock_in, clock_out, hours, hour_type, notes,
      proof_file_url, proof_file_name, proof_file_type, proof_file_path, status
    FROM checked WHERE reason IS NULL
    ORDER BY employee_id, date, clock_in
    RETURNING id, employee_id, date
  )
  SELECT jsonb_build_object(
    'data', coalesce((SELECT jsonb_agg(inserted) FROM inserted), '[]'::jsonb),
    'excluded', coalesce((
      SELECT jsonb_agg(jsonb_build_object('employee_id', employee_id, 'date', date, 'reason', reason))
      FROM checked WHERE reason IS NOT NULL
    ), '[]'::jsonb)
  ) INTO result;
  RETURN result;
END;
$$;

-- Older clients insert approved and standard-fill rows through the table API.
-- Protect those writes too. Regular self entries keep their current workflow.
CREATE FUNCTION private.guard_bulk_attendance_insert()
RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE employee public.employees%ROWTYPE;
BEGIN
  IF NEW.notes LIKE 'Standard hours filled by admin:%'
     AND (SELECT auth.uid()) IS NOT NULL AND NOT private.can_manage_employee(NEW.employee_id) THEN
    RAISE EXCEPTION 'Bulk time entries require time management permission' USING ERRCODE = '42501';
  END IF;

  SELECT e.* INTO employee FROM public.employees e WHERE e.id = NEW.employee_id FOR SHARE;
  IF NOT FOUND THEN
    -- A scoped bulk insert needs a locked employee. Other inserts still
    -- pass through the existing foreign key and row policies.
    IF private.can_manage_employee(NEW.employee_id) THEN RETURN NULL; END IF;
    RETURN NEW;
  END IF;

  IF private.bulk_attendance_exclusion(employee.id, employee.status, employee.start_date, NEW.date) IS NOT NULL THEN
    RETURN NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER time_entries_guard_bulk_attendance
  BEFORE INSERT ON public.time_entries
  FOR EACH ROW WHEN (NEW.status = 'approved' OR NEW.notes LIKE 'Standard hours filled by admin:%')
  EXECUTE FUNCTION private.guard_bulk_attendance_insert();

REVOKE ALL ON FUNCTION private.record_employee_attendance_status(), private.guard_bulk_attendance_insert()
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.attendance_status_is_active(text), private.bulk_attendance_exclusion(text, text, date, date)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.attendance_status_is_active(text), private.bulk_attendance_exclusion(text, text, date, date)
  TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.bulk_attendance_roster(date[], text[]), public.create_bulk_time_entries(jsonb)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.bulk_attendance_roster(date[], text[]), public.create_bulk_time_entries(jsonb)
  TO authenticated;
