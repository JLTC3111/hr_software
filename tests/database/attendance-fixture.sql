-- Disposable local data, inserted BEFORE the attendance migration.
CREATE SCHEMA attendance_audit;
CREATE TABLE attendance_audit.results(label text);
GRANT USAGE ON SCHEMA attendance_audit TO anon, authenticated, service_role;
GRANT INSERT ON attendance_audit.results TO anon, authenticated, service_role;
CREATE FUNCTION attendance_audit.assert(ok boolean, label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAILED: %', label; END IF;
  INSERT INTO attendance_audit.results VALUES(label);
END $$;
CREATE FUNCTION attendance_audit.denied(statement text, label text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE blocked boolean := false;
BEGIN
  BEGIN EXECUTE statement; EXCEPTION WHEN insufficient_privilege THEN blocked := true; END;
  PERFORM attendance_audit.assert(blocked, label);
END $$;

INSERT INTO auth.users(id,email) SELECT ('90000000-0000-0000-0000-' || lpad(n::text,12,'0'))::uuid,
  'attendance' || n || '@example.test' FROM generate_series(1,5) n;
INSERT INTO public.employees(id,name,email,department) VALUES
 ('att-a','Attendance A','attendance1@example.test','Alpha'),
 ('att-b','Attendance B','attendance2@example.test','Alpha'),
 ('att-manager','Attendance Manager','attendance3@example.test','Alpha'),
 ('att-outside','Attendance Outside','attendance4@example.test','Beta'),
 ('att-inactive','Attendance Inactive','attendance5@example.test','Alpha');
INSERT INTO public.hr_users(id,email,first_name,role,department,is_active,employee_id) VALUES
 ('90000000-0000-0000-0000-000000000001','attendance1@example.test','A','employee','Alpha',true,'att-a'),
 ('90000000-0000-0000-0000-000000000002','attendance2@example.test','B','employee','Alpha',true,'att-b'),
 ('90000000-0000-0000-0000-000000000003','attendance3@example.test','Manager','manager','Alpha',true,'att-manager'),
 ('90000000-0000-0000-0000-000000000004','attendance4@example.test','Outside','employee','Beta',true,'att-outside'),
 ('90000000-0000-0000-0000-000000000005','attendance5@example.test','Inactive','admin','Alpha',false,'att-inactive');

INSERT INTO public.leave_requests(employee_id,leave_type,start_date,end_date,status,reason) VALUES
 ('att-a','annual','2026-09-01','2026-10-02','approved','migration coverage'),
 ('att-b','annual','2021-05-01','2021-05-02','approved','weekend only'),
 ('att-b','annual','2023-01-02','2023-01-03','pending','pending history');
INSERT INTO public.time_entries(employee_id,date,clock_in,clock_out,hours,hour_type,status,notes) VALUES
 ('att-a','2026-09-01','09:00','17:00',8,'regular','approved','Standard hours filled by admin: Exact'),
 ('att-a','2026-09-02','09:00','17:00',8,'regular','approved','Manual 09-17'),
 ('att-a','2026-09-03','09:12','17:08',7.93,'regular','approved','Standard hours filled by admin: Wrong time'),
 ('att-a','2026-09-04','09:00','17:00',8,'wfh','approved','Standard hours filled by admin: WFH'),
 ('att-a','2026-09-05','09:00','17:00',8,'regular','approved','Standard hours filled by admin: Weekend'),
 ('att-a','2026-09-07','09:00','17:01',8.02,'regular','approved','Standard hours filled by admin: Wrong out'),
 ('att-a','2026-09-08','09:00:00.5','17:00',8,'regular','approved','Standard hours filled by admin: Fraction'),
 ('att-a','2026-09-09','09:00','17:00',8,'regular','approved',NULL),
 ('att-a','2026-09-10','09:00','17:00',8,'regular','approved','Standard hours filled by admin No colon'),
 ('att-a','2026-09-11','18:00','20:00',2,'overtime','approved','Standard hours filled by admin: Overtime'),
 ('att-a','2026-10-02','09:00','17:00',8,'regular','approved','Standard hours filled by admin: Last date'),
 ('att-a','2026-10-05','09:00','17:00',8,'regular','approved','Standard hours filled by admin: Outside range'),
 ('att-b','2026-09-01','09:00','17:00',8,'regular','approved','Standard hours filled by admin: Other employee'),
 ('att-b','2022-01-03','09:00','17:00',8,'on_leave','approved','standalone history');
-- Sentinel summaries prove no unrelated historical repair, even when there
-- are pending requests, weekend-only approvals or approved standalone entries.
INSERT INTO public.time_tracking_summary(employee_id,month,year,leave_days,total_hours)
 VALUES ('att-b',5,2021,7,73),('att-b',1,2023,8,83)
 ON CONFLICT(employee_id,month,year) DO UPDATE SET leave_days=excluded.leave_days,total_hours=excluded.total_hours;
CREATE TABLE attendance_audit.before_summaries AS SELECT * FROM public.time_tracking_summary;
CREATE TABLE attendance_audit.before_entries AS SELECT * FROM public.time_entries WHERE employee_id LIKE 'att-%';
CREATE TABLE attendance_audit.before_function AS
 SELECT p.proowner,p.proacl,p.prosecdef OR EXISTS (
   SELECT 1 FROM pg_proc h WHERE h.oid=to_regprocedure('private.refresh_time_tracking_summary(text,integer,integer)') AND h.prosecdef
 ) AS effective_definer FROM pg_proc p WHERE p.oid='public.update_time_tracking_summary(text,integer,integer)'::regprocedure;

CREATE TABLE attendance_audit.refreshes(employee_id text,month integer,year integer);
GRANT INSERT ON attendance_audit.refreshes TO authenticated,service_role;
CREATE FUNCTION attendance_audit.record_refresh() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN INSERT INTO attendance_audit.refreshes VALUES(NEW.employee_id,NEW.month,NEW.year); RETURN NULL; END $$;
CREATE TRIGGER attendance_test_refresh AFTER INSERT OR UPDATE ON public.time_tracking_summary
 FOR EACH ROW EXECUTE FUNCTION attendance_audit.record_refresh();
