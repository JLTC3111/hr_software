-- Run on disposable databases for both the production and repository schemas.
-- Roll back fixtures so the existing attendance and workflow tests stay isolated.
BEGIN;
CREATE SCHEMA time_clock_audit;
CREATE FUNCTION time_clock_audit.assert(ok boolean, label text) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAILED: %', label; END IF;
END $$;
GRANT USAGE ON SCHEMA time_clock_audit TO authenticated, anon;

INSERT INTO auth.users(id, email)
SELECT ('92000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid,
  'time-clock-' || n || '@example.test' FROM generate_series(1, 9) n;
INSERT INTO public.employees(id, name, email, department) VALUES
  ('tc-team', 'Clock Team', 'tc-team@example.test', 'Alpha'),
  ('tc-outside', 'Clock Outside', 'tc-outside@example.test', 'Beta'),
  ('tc-report', 'Clock Report', 'tc-report@example.test', 'Beta'),
  ('tc-inactive', 'Clock Inactive', 'tc-inactive@example.test', 'Gamma');
INSERT INTO public.hr_users(id, email, first_name, role, department, employee_id, is_active, employment_status, manager_id) VALUES
  ('91000000-0000-0000-0000-000000000001', 'tc-admin@example.test', 'Admin', 'admin', 'HR', NULL, true, 'active', NULL),
  ('91000000-0000-0000-0000-000000000002', 'tc-manager@example.test', 'Manager', 'manager', 'Alpha', NULL, true, 'active', NULL),
  ('91000000-0000-0000-0000-000000000003', 'tc-team@example.test', 'Team', 'employee', 'Alpha', 'tc-team', true, 'active', NULL),
  ('91000000-0000-0000-0000-000000000004', 'tc-outside@example.test', 'Outside', 'employee', 'Beta', 'tc-outside', true, 'active', NULL),
  ('91000000-0000-0000-0000-000000000005', 'tc-report@example.test', 'Report', 'employee', 'Beta', 'tc-report', true, 'active', '91000000-0000-0000-0000-000000000002'),
  ('91000000-0000-0000-0000-000000000006', 'tc-disabled@example.test', 'Disabled', 'admin', 'Gamma', 'tc-inactive', false, 'active', NULL),
  ('91000000-0000-0000-0000-000000000007', 'tc-terminated@example.test', 'Terminated', 'admin', 'HR', NULL, true, 'terminated', NULL),
  ('91000000-0000-0000-0000-000000000008', 'tc-inactive@example.test', 'Inactive', 'admin', 'HR', NULL, true, 'inactive', NULL);
INSERT INTO public.user_emails(hr_user_id, auth_user_id, email, is_primary)
SELECT id, replace(id::text, '91000000-', '92000000-')::uuid, email, true
FROM public.hr_users WHERE id::text LIKE '91000000-%';
INSERT INTO public.time_entries(employee_id, date, clock_in, clock_out, hours, status, notes)
SELECT id, '2030-01-07', '09:00', '17:00', 8, 'approved', 'Time-clock read fixture'
FROM public.employees WHERE id LIKE 'tc-%';

SET LOCAL SESSION AUTHORIZATION authenticator;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"role":"authenticated","sub":"92000000-0000-0000-0000-000000000001"}';
SELECT time_clock_audit.assert((SELECT count(*) = 4 FROM public.time_entries WHERE employee_id LIKE 'tc-%'), 'mapped admin without employee sees every attendance row');
SELECT time_clock_audit.assert((SELECT count(*) = 4 AND sum(hours) = 32 AND count(employee_name) = 4 FROM public.time_entries_detailed WHERE employee_id LIKE 'tc-%'), 'admin detailed ledger preserves rows, totals and employee names');

SET LOCAL request.jwt.claims = '{"role":"authenticated","sub":"92000000-0000-0000-0000-000000000002"}';
SELECT time_clock_audit.assert((SELECT array_agg(employee_id ORDER BY employee_id) = ARRAY['tc-report','tc-team'] FROM public.time_entries WHERE employee_id LIKE 'tc-%'), 'manager sees same department and cross-department direct report only');
SELECT time_clock_audit.assert((SELECT count(*) = 2 FROM public.time_entries_detailed WHERE employee_id LIKE 'tc-%'), 'detailed view preserves manager scope');

SET LOCAL request.jwt.claims = '{"role":"authenticated","sub":"92000000-0000-0000-0000-000000000003"}';
SELECT time_clock_audit.assert((SELECT array_agg(employee_id) = ARRAY['tc-team'] FROM public.time_entries WHERE employee_id LIKE 'tc-%'), 'employee reads only own attendance');
SELECT time_clock_audit.assert((SELECT count(*) = 1 FROM public.time_entries_detailed WHERE employee_id LIKE 'tc-%'), 'detailed view preserves employee scope');

-- Legacy login whose Auth ID directly matches the HR ID remains supported.
SET LOCAL request.jwt.claims = '{"role":"authenticated","sub":"91000000-0000-0000-0000-000000000004"}';
SELECT time_clock_audit.assert((SELECT array_agg(employee_id) = ARRAY['tc-outside'] FROM public.time_entries WHERE employee_id LIKE 'tc-%'), 'direct HR identity still resolves own attendance');

SET LOCAL request.jwt.claims = '{"role":"authenticated","sub":"92000000-0000-0000-0000-000000000006"}';
SELECT time_clock_audit.assert((SELECT count(*) = 0 FROM public.time_entries), 'disabled admin cannot read attendance including own rows');
SET LOCAL request.jwt.claims = '{"role":"authenticated","sub":"92000000-0000-0000-0000-000000000007"}';
SELECT time_clock_audit.assert((SELECT count(*) = 0 FROM public.time_entries), 'terminated admin cannot read attendance');
SET LOCAL request.jwt.claims = '{"role":"authenticated","sub":"92000000-0000-0000-0000-000000000008"}';
SELECT time_clock_audit.assert((SELECT count(*) = 0 FROM public.time_entries), 'employment-inactive admin cannot read attendance');
SET LOCAL request.jwt.claims = '{"role":"authenticated","sub":"92000000-0000-0000-0000-000000000009","user_metadata":{"role":"admin"}}';
SELECT time_clock_audit.assert((SELECT count(*) = 0 FROM public.time_entries), 'unlinked identity cannot claim admin through user metadata');
SET LOCAL request.jwt.claims = '{"role":"authenticated"}';
SELECT time_clock_audit.assert((SELECT count(*) = 0 FROM public.time_entries), 'missing identity cannot read attendance');

SET LOCAL ROLE anon;
DO $$ BEGIN
  BEGIN
    PERFORM * FROM public.time_entries;
    RAISE EXCEPTION 'Anonymous attendance read unexpectedly allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
RESET ROLE;
RESET SESSION AUTHORIZATION;

-- Measure actual helper calls, rather than asserting a fragile wall-clock time.
-- The table has multiple rows; admin access must not resolve membership per row.
SET LOCAL track_functions = 'all';
SET LOCAL request.jwt.claims = '{"role":"authenticated","sub":"92000000-0000-0000-0000-000000000001"}';
CREATE TEMP TABLE helper_calls_before AS
SELECT funcid, calls FROM pg_stat_xact_user_functions;
SET LOCAL ROLE authenticated;
SELECT count(*) FROM public.time_entries;
RESET ROLE;
SELECT time_clock_audit.assert(
  (SELECT coalesce(sum(s.calls - coalesce(b.calls, 0)), 0) = 1
   FROM pg_stat_xact_user_functions s LEFT JOIN helper_calls_before b USING (funcid)
   WHERE s.funcid = 'private.current_hr_role()'::regprocedure),
  'admin membership is resolved once per query');
SELECT time_clock_audit.assert(
  (SELECT coalesce(sum(s.calls - coalesce(b.calls, 0)), 0) = 0
   FROM pg_stat_xact_user_functions s LEFT JOIN helper_calls_before b USING (funcid)
   WHERE s.funcid = 'private.can_manage_employee(text)'::regprocedure),
  'admin read skips per-row management checks');
ROLLBACK;
SELECT 'Time-clock read policy: access scopes, detailed rows and constant admin-check cost verified';
