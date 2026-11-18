-- Run against both the captured hosted catalog and the hardened repository schema.
INSERT INTO auth.users (id, email)
VALUES ('90000000-0000-0000-0000-000000000006', 'bulk-admin@example.test');
INSERT INTO public.hr_users (id, email, role, is_active)
VALUES ('90000000-0000-0000-0000-000000000006', 'bulk-admin@example.test', 'admin', true);

INSERT INTO public.employees (id, name, email, status, start_date) VALUES
  ('bulk-active', 'Bulk Active', 'bulk-active@example.test', 'On Leave', date '2020-01-01'),
  ('bulk-inactive', 'Bulk Inactive', 'bulk-inactive@example.test', 'Inactive', date '2020-01-01'),
  ('bulk-historical', 'Bulk Former', 'bulk-former@example.test', 'Active', date '2020-01-01'),
  ('bulk-reactivated', 'Bulk Reactivated', 'bulk-reactivated@example.test', 'Inactive', date '2020-01-01'),
  ('bulk-new', 'Bulk New', 'bulk-new@example.test', 'Active', (clock_timestamp() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date),
  ('bulk-race', 'Bulk Race', 'bulk-race@example.test', 'Active', date '2020-01-01');

INSERT INTO private.employee_attendance_status_changes (employee_id, effective_on, was_active, is_active)
VALUES ('bulk-reactivated', (clock_timestamp() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date - 4, true, false);

CREATE FUNCTION attendance_audit.bulk_entry(employee_id text, attendance_date date)
RETURNS jsonb LANGUAGE sql AS $$
  SELECT jsonb_build_object('employee_id', employee_id, 'date', attendance_date, 'clock_in', '09:00',
    'clock_out', '17:00', 'hours', 8, 'hour_type', 'regular', 'status', 'approved',
    'notes', 'Standard hours filled by admin: bulk eligibility test');
$$;

BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"role":"authenticated","sub":"90000000-0000-0000-0000-000000000006"}';
UPDATE public.employees SET status = ' Terminated ' WHERE id = 'bulk-historical';
UPDATE public.employees SET status = 'Active' WHERE id = 'bulk-reactivated';

DO $$
DECLARE
  today date := (clock_timestamp() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date;
  roster jsonb;
  result jsonb;
BEGIN
  roster := public.bulk_attendance_roster(ARRAY[today, today - 1], ARRAY['bulk-active','bulk-inactive','bulk-new','bulk-historical']);
  PERFORM attendance_audit.assert(
    (SELECT array_agg(row ->> 'id' ORDER BY row ->> 'id') FROM jsonb_array_elements(roster) row
      WHERE NOT ((row -> 'exclusions') ? today::text)) = ARRAY['bulk-active','bulk-new'],
    'Bulk roster includes active and On Leave employees, and excludes inactive employees for today');
  PERFORM attendance_audit.assert(
    (SELECT row -> 'exclusions' ->> (today - 1)::text FROM jsonb_array_elements(roster) row
      WHERE row ->> 'id' = 'bulk-new') = 'before_start',
    'Bulk roster excludes dates before the first day of employment');

  result := public.create_bulk_time_entries(jsonb_build_array(
    attendance_audit.bulk_entry('bulk-active', today),
    attendance_audit.bulk_entry('bulk-inactive', today),
    attendance_audit.bulk_entry('bulk-inactive', today - 1),
    attendance_audit.bulk_entry('bulk-historical', today),
    attendance_audit.bulk_entry('bulk-historical', today - 1),
    attendance_audit.bulk_entry('bulk-reactivated', today),
    attendance_audit.bulk_entry('bulk-reactivated', today - 1),
    attendance_audit.bulk_entry('bulk-reactivated', today - 5),
    attendance_audit.bulk_entry('bulk-new', today),
    attendance_audit.bulk_entry('bulk-new', today - 1),
    attendance_audit.bulk_entry('bulk-unknown', today)
  ));
  PERFORM attendance_audit.assert(
    jsonb_array_length(result -> 'data') = 5 AND jsonb_array_length(result -> 'excluded') = 6
      AND (result -> 'excluded') @> jsonb_build_array(
        jsonb_build_object('employee_id', 'bulk-inactive', 'date', today - 1, 'reason', 'inactive'),
        jsonb_build_object('employee_id', 'bulk-reactivated', 'date', today - 1, 'reason', 'inactive'),
        jsonb_build_object('employee_id', 'bulk-historical', 'date', today, 'reason', 'inactive'),
        jsonb_build_object('employee_id', 'bulk-new', 'date', today - 1, 'reason', 'before_start'),
        jsonb_build_object('employee_id', 'bulk-unknown', 'date', today, 'reason', 'not_permitted')),
    'Mixed bulk RPC returns stored rows and explains employment and roster exclusions');
  PERFORM attendance_audit.assert(
    (result -> 'data') @> jsonb_build_array(
      jsonb_build_object('employee_id', 'bulk-historical', 'date', today - 1),
      jsonb_build_object('employee_id', 'bulk-reactivated', 'date', today - 5),
      jsonb_build_object('employee_id', 'bulk-new', 'date', today)),
    'Historical attendance is accepted in proven active periods, including the exact start date');
END $$;

WITH inserted AS (
  INSERT INTO public.time_entries (employee_id, date, clock_in, clock_out, hours, hour_type, status, notes)
  VALUES ('bulk-inactive', date '2026-10-05', time '09:00', time '17:00', 8, 'regular', 'approved', 'Standard hours filled by admin: legacy'),
         ('bulk-inactive', date '2026-10-05', time '13:00', time '17:00', 4, 'regular', 'approved', 'Custom bulk legacy'),
         ('bulk-active', date '2026-10-05', time '09:00', time '17:00', 8, 'regular', 'approved', 'Standard hours filled by admin: legacy')
  RETURNING employee_id
)
SELECT attendance_audit.assert(array_agg(employee_id) = ARRAY['bulk-active'],
  'Legacy table inserts also skip inactive employees') FROM inserted;
COMMIT;

SELECT attendance_audit.assert(
  NOT EXISTS (SELECT 1 FROM public.time_entries WHERE employee_id IN ('bulk-inactive','bulk-unknown'))
  AND NOT EXISTS (SELECT 1 FROM public.time_tracking_summary WHERE employee_id = 'bulk-inactive'),
  'Excluded employees get neither attendance rows nor generated summaries');

INSERT INTO public.leave_requests (employee_id, leave_type, start_date, end_date, status)
VALUES ('bulk-active', 'annual', date '2026-10-07', date '2026-10-07', 'approved');
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"role":"authenticated","sub":"90000000-0000-0000-0000-000000000006"}';
SELECT attendance_audit.assert(
  public.create_bulk_time_entries(jsonb_build_array(attendance_audit.bulk_entry('bulk-active', date '2026-10-07')))
    = '{"data":[],"excluded":[]}'::jsonb,
  'An otherwise eligible employee still receives no generated hours on approved leave');
COMMIT;

BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"role":"authenticated","sub":"90000000-0000-0000-0000-000000000003"}';
WITH result AS (
  SELECT public.create_bulk_time_entries(jsonb_build_array(
    attendance_audit.bulk_entry('att-b', date '2028-10-02'),
    attendance_audit.bulk_entry('att-outside', date '2028-10-02')
  )) AS value
)
SELECT attendance_audit.assert(
  (value -> 'data') @> '[{"employee_id":"att-b"}]' AND jsonb_array_length(value -> 'data') = 1
  AND (value -> 'excluded') @> '[{"employee_id":"att-outside","reason":"not_permitted"}]',
  'A manager can create rows for their roster and a mixed batch excludes an out-of-scope employee')
FROM result;
COMMIT;

BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"role":"authenticated","sub":"90000000-0000-0000-0000-000000000001"}';
SELECT attendance_audit.assert(public.bulk_attendance_roster(ARRAY[date '2026-10-05']) = '[]'::jsonb,
  'Employees cannot enumerate bulk attendance eligibility');
SELECT attendance_audit.denied(
  $q$SELECT public.create_bulk_time_entries(jsonb_build_array(attendance_audit.bulk_entry('att-a', date '2026-10-05')))$q$,
  'Employees cannot create bulk attendance');
SELECT attendance_audit.denied(
  $q$INSERT INTO private.employee_attendance_status_changes VALUES ('att-a', date '2026-01-01', true, true)$q$,
  'Users cannot forge status history to change their eligibility');
COMMIT;

SELECT 'Bulk eligibility, historical status intervals, managed scope, and legacy inserts verified';
