-- Run after migration on BOTH the production catalog and the repository chain.
SELECT attendance_audit.assert((SELECT p.proowner=b.proowner AND p.proacl IS NOT DISTINCT FROM b.proacl
 AND p.prosecdef=b.effective_definer AND p.proconfig=ARRAY['search_path=""']
 FROM pg_proc p CROSS JOIN attendance_audit.before_function b
 WHERE p.oid='public.update_time_tracking_summary(text,integer,integer)'::regprocedure), 'DB01 owner ACL effective security and empty search_path preserved');
SELECT attendance_audit.assert(to_regprocedure('private.refresh_time_tracking_summary(text,integer,integer)') IS NULL,
 'DB02 no parallel private summary remains');
SELECT attendance_audit.assert((SELECT count(*)=5 FROM pg_trigger t JOIN pg_proc p ON p.oid=t.tgfoid
 WHERE NOT t.tgisinternal AND t.tgrelid IN ('public.time_entries'::regclass,'public.leave_requests'::regclass,'public.overtime_logs'::regclass)
 AND ((t.tgname IN ('update_summary_on_leave','update_summary_on_overtime') AND p.proname='trigger_update_summary')
 OR (t.tgname LIKE 'update_summary_on_time_entry_%' AND p.prosrc LIKE '%public.update_time_tracking_summary(%'))),
 'DB03 actual row and statement trigger bindings use canonical public function');
SELECT attendance_audit.assert((SELECT count(*)=1 FROM pg_trigger t JOIN pg_proc p ON p.oid=t.tgfoid
 WHERE t.tgrelid='public.time_entries'::regclass AND t.tgname='time_entries_skip_bulk_fill_on_leave'
 AND t.tgtype=7 AND NOT p.prosecdef AND p.proconfig=ARRAY['search_path=""']), 'DB04 guard is BEFORE INSERT ROW INVOKER with empty search_path');
SELECT attendance_audit.assert(NOT EXISTS(
 SELECT 1 FROM attendance_audit.before_summaries b JOIN public.time_tracking_summary s USING(employee_id,month,year)
 WHERE NOT (s.employee_id='att-a' AND s.year=2026 AND s.month IN (9,10))
 AND to_jsonb(s) IS DISTINCT FROM to_jsonb(b)), 'DB05 unrelated historical months unchanged byte-for-byte');
SELECT attendance_audit.assert((SELECT count(*)=2 FROM attendance_audit.before_entries b
 WHERE NOT EXISTS(SELECT 1 FROM public.time_entries t WHERE t.id=b.id)) AND
 NOT EXISTS(SELECT 1 FROM attendance_audit.before_entries b WHERE NOT EXISTS(SELECT 1 FROM public.time_entries t WHERE t.id=b.id)
 AND b.notes NOT IN ('Standard hours filled by admin: Exact','Standard hours filled by admin: Last date')),
 'DB06 backfill deletes only exact employee weekday regular 09-17 marker rows including range endpoints');
SELECT attendance_audit.assert((SELECT leave_days=22 AND regular_hours=8 AND overtime_hours=2 AND days_worked=1
 FROM public.time_tracking_summary WHERE employee_id='att-a' AND year=2026 AND month=9), 'DB07 backfill keeps weekends overtime manual storage but excludes weekday regular and WFH');

-- Isolate behavioral assertions from migration fixtures; no user data in this DB.
DELETE FROM public.leave_requests WHERE employee_id LIKE 'att-%';
DELETE FROM public.time_entries WHERE employee_id LIKE 'att-%';
DELETE FROM public.time_tracking_summary WHERE employee_id LIKE 'att-%';
TRUNCATE attendance_audit.refreshes;
INSERT INTO public.leave_requests(employee_id,leave_type,start_date,end_date,status,reason)
 VALUES('att-a','annual','2026-09-30','2026-10-02','pending','transition');
SELECT attendance_audit.assert((SELECT count(*)=0 FROM attendance_audit.refreshes), 'DB08 pending insert does not refresh');
UPDATE public.leave_requests SET status='rejected' WHERE employee_id='att-a';
SELECT attendance_audit.assert((SELECT count(*)=0 FROM attendance_audit.refreshes), 'DB09 pending rejected transition does not refresh');
UPDATE public.leave_requests SET status='approved' WHERE employee_id='att-a';
SELECT attendance_audit.assert((SELECT array_agg(month ORDER BY month)=ARRAY[9,10] FROM attendance_audit.refreshes), 'DB10 rejected approved refreshes Sep and Oct only');
SELECT attendance_audit.assert((SELECT leave_days=1 FROM public.time_tracking_summary WHERE employee_id='att-a' AND month=9)
 AND (SELECT leave_days=2 FROM public.time_tracking_summary WHERE employee_id='att-a' AND month=10), 'DB11 Sep30 Oct2 clips one plus two weekdays');
TRUNCATE attendance_audit.refreshes;
UPDATE public.leave_requests SET reason='metadata',status='approved' WHERE employee_id='att-a';
SELECT attendance_audit.assert((SELECT count(*)=0 FROM attendance_audit.refreshes), 'DB12 repeated approval and metadata do not refresh unchanged coverage');
UPDATE public.leave_requests SET start_date='2026-10-05',end_date='2026-10-07' WHERE employee_id='att-a';
SELECT attendance_audit.assert((SELECT array_agg(month ORDER BY month)=ARRAY[9,10] FROM attendance_audit.refreshes)
 AND (SELECT leave_days=0 FROM public.time_tracking_summary WHERE employee_id='att-a' AND month=9)
 AND (SELECT leave_days=3 FROM public.time_tracking_summary WHERE employee_id='att-a' AND month=10), 'DB13 approved range edit refreshes OLD and NEW months');
TRUNCATE attendance_audit.refreshes;
UPDATE public.leave_requests SET employee_id='att-b' WHERE employee_id='att-a';
SELECT attendance_audit.assert((SELECT array_agg(employee_id||':'||month ORDER BY employee_id)=ARRAY['att-a:10','att-b:10'] FROM attendance_audit.refreshes)
 AND (SELECT leave_days=0 FROM public.time_tracking_summary WHERE employee_id='att-a' AND month=10)
 AND (SELECT leave_days=3 FROM public.time_tracking_summary WHERE employee_id='att-b' AND month=10), 'DB14 employee change refreshes both employees only in changed month');
TRUNCATE attendance_audit.refreshes;
UPDATE public.leave_requests SET status='pending' WHERE employee_id='att-b';
SELECT attendance_audit.assert((SELECT array_agg(employee_id||':'||month)=ARRAY['att-b:10'] FROM attendance_audit.refreshes)
 AND (SELECT leave_days=0 FROM public.time_tracking_summary WHERE employee_id='att-b' AND month=10)
 AND NOT EXISTS(SELECT 1 FROM public.time_entries WHERE employee_id='att-b'), 'DB15 unapprove clears OLD leave without fabricating hours');
UPDATE public.leave_requests SET status='approved' WHERE employee_id='att-b';
TRUNCATE attendance_audit.refreshes;
DELETE FROM public.leave_requests WHERE employee_id='att-b';
SELECT attendance_audit.assert((SELECT array_agg(employee_id||':'||month)=ARRAY['att-b:10'] FROM attendance_audit.refreshes)
 AND (SELECT leave_days=0 FROM public.time_tracking_summary WHERE employee_id='att-b' AND month=10), 'DB16 deletion clears old approved coverage');

INSERT INTO public.leave_requests(employee_id,leave_type,start_date,end_date,status,reason) VALUES
 ('att-a','annual','2026-09-10','2026-09-12','approved','overlap1'),
 ('att-a','annual','2026-09-11','2026-09-15','approved','overlap2');
SELECT attendance_audit.assert((SELECT leave_days=4 FROM public.time_tracking_summary WHERE employee_id='att-a' AND month=9), 'DB17 overlapping requests deduplicate weekdays');
TRUNCATE attendance_audit.refreshes;
INSERT INTO public.leave_requests(employee_id,leave_type,start_date,end_date,status,reason)
 VALUES('att-a','annual','2026-09-11','2026-09-14','approved','contained');
DELETE FROM public.leave_requests WHERE reason='contained';
SELECT attendance_audit.assert((SELECT count(*)=0 FROM attendance_audit.refreshes), 'DB18 coverage already provided by another approval does not refresh');

-- Exact generated identity, multi-row INSERT RETURNING, other employee and weekend.
WITH inserted AS (INSERT INTO public.time_entries(employee_id,date,clock_in,clock_out,hours,hour_type,status,notes) VALUES
 ('att-a','2026-09-14','09:00','17:00',8,'regular','approved','Standard hours filled by admin: skip'),
 ('att-a','2026-09-14','09:12','17:08',7.93,'regular','approved','Standard hours filled by admin: near'),
 ('att-a','2026-09-14','10:00','14:00',4,'wfh','approved','manual wfh'),
 ('att-a','2026-09-14','18:00','20:00',2,'overtime','approved','overtime'),
 ('att-a','2026-09-12','09:00','17:00',8,'regular','approved','Standard hours filled by admin: weekend'),
 ('att-b','2026-09-14','09:00','17:00',8,'regular','approved','Standard hours filled by admin: other') RETURNING *)
 SELECT attendance_audit.assert(count(*)=5,'DB19 INSERT RETURNING excludes only one generated leave row') FROM inserted;
SELECT attendance_audit.assert((SELECT leave_days=4 AND days_worked=1 AND regular_hours=8 AND overtime_hours=2 AND total_hours=10
 FROM public.time_tracking_summary WHERE employee_id='att-a' AND month=9), 'DB20 trigger path counts overtime while regular WFH and worked day stay excluded');
INSERT INTO public.time_entries(employee_id,date,clock_in,clock_out,hours,hour_type,status,notes)
 SELECT 'att-a',date '2026-09-14',time '09:00',time '17:00',8,'regular','approved','Standard hours filled by admin: repeated' FROM generate_series(1,2);
SELECT attendance_audit.assert(NOT EXISTS(SELECT 1 FROM public.time_entries WHERE employee_id='att-a' AND date='2026-09-14' AND clock_in='09:00'), 'DB21 repeated generated insert on leave is harmless');
INSERT INTO public.time_entries(employee_id,date,clock_in,clock_out,hours,hour_type,status,notes) VALUES
 ('att-a','2026-09-14','09:00','17:00',8,'regular','approved','manual exact hours');
SELECT attendance_audit.assert(EXISTS(SELECT 1 FROM public.time_entries WHERE notes='manual exact hours'), 'DB22 guard never swallows manual exact-hours row');

-- Standalone source approved only; same employee/date union with requests.
INSERT INTO public.time_entries(employee_id,date,clock_in,clock_out,hours,hour_type,status,notes) VALUES
 ('att-a','2026-09-14','08:00','08:01',8,'on_leave','approved','duplicate request representation'),
 ('att-a','2026-09-16','08:00','08:01',8,'vacation','approved','standalone'),
 ('att-a','2026-09-16','09:00','17:00',8,'regular','approved','standalone regular'),
 ('att-a','2026-09-17','08:00','08:01',8,'sick_leave','pending','unapproved standalone');
SELECT attendance_audit.assert((SELECT leave_days=5 AND days_worked=2 AND regular_hours=16 AND total_hours=18
 FROM public.time_tracking_summary WHERE employee_id='att-a' AND month=9), 'DB23 standalone approved only no suppression no duplicate request leave');
INSERT INTO public.overtime_logs(employee_id,date,hours,overtime_type,status,reason) VALUES
 ('att-a','2026-09-14',3,'regular','pending','log'),('att-a','2026-09-14',4,'holiday','approved','holiday log'),
 ('att-a','2026-09-14',50,'regular','rejected','excluded log');
SELECT attendance_audit.assert((SELECT overtime_hours=5 AND holiday_overtime_hours=4 AND total_hours=25
 FROM public.time_tracking_summary WHERE employee_id='att-a' AND month=9), 'DB24 overtime-log trigger retains pending regular and approved holiday only');

-- A future approval cleans pre-existing rows in the same transaction.
INSERT INTO public.time_entries(employee_id,date,clock_in,clock_out,hours,hour_type,status,notes)
 SELECT employee_id, date+'1 year'::interval,clock_in,clock_out,hours,hour_type,status,notes
 FROM attendance_audit.before_entries;
INSERT INTO public.leave_requests(employee_id,leave_type,start_date,end_date,status,reason)
 VALUES('att-a','annual','2027-09-01','2027-10-02','approved','new cleanup');
SELECT attendance_audit.assert(NOT EXISTS(SELECT 1 FROM public.time_entries WHERE employee_id='att-a' AND date BETWEEN '2027-09-01' AND '2027-10-02'
 AND extract(isodow FROM date) BETWEEN 1 AND 5 AND hour_type='regular' AND clock_in='09:00' AND clock_out='17:00' AND notes LIKE 'Standard hours filled by admin:%'), 'DB25 future approval cleanup uses full generated predicate');
SELECT attendance_audit.assert(NOT EXISTS(SELECT 1 FROM attendance_audit.before_entries b
 WHERE NOT (b.employee_id='att-a' AND b.date+'1 year'::interval BETWEEN '2027-09-01' AND '2027-10-02'
 AND extract(isodow FROM b.date+'1 year'::interval) BETWEEN 1 AND 5 AND b.hour_type='regular'
 AND b.clock_in='09:00' AND b.clock_out='17:00' AND COALESCE(b.notes LIKE 'Standard hours filled by admin:%',false))
 AND NOT EXISTS(SELECT 1 FROM public.time_entries t WHERE t.employee_id=b.employee_id AND t.date=b.date+'1 year'::interval AND t.clock_in=b.clock_in)), 'DB26 every cleanup near miss survives future approval');

-- Real PostgREST role context, not only SET ROLE on a postgres session.
SET SESSION AUTHORIZATION authenticator;
SET ROLE authenticated;
SET request.jwt.claims='{"role":"authenticated","sub":"90000000-0000-0000-0000-000000000001"}';
SELECT public.update_time_tracking_summary('att-a',9,2026);
SELECT attendance_audit.assert(true, 'DB27 ordinary authenticated own summary RPC works');
SELECT attendance_audit.denied($q$SELECT public.update_time_tracking_summary('att-b',9,2026)$q$, 'DB28 arbitrary employee ID cannot cross scope');
SELECT attendance_audit.denied($q$INSERT INTO public.time_entries(employee_id,date,clock_in,clock_out,hours) VALUES('att-b','2028-01-03','09:00','17:00',8)$q$, 'DB29 source RLS denies another employee insert');
INSERT INTO public.time_entries(employee_id,date,clock_in,clock_out,hours) VALUES('att-a','2028-01-03','09:00','17:00',8);
SELECT attendance_audit.assert((SELECT total_hours=8 FROM public.time_tracking_summary WHERE employee_id='att-a' AND year=2028 AND month=1), 'DB30 own pending write executes summary trigger');
SET request.jwt.claims='{"role":"service_role","sub":"90000000-0000-0000-0000-000000000001"}';
SELECT attendance_audit.denied($q$SELECT public.update_time_tracking_summary('att-b',9,2026)$q$, 'DB31 forged service-role claim cannot elevate SQL role');
SET request.jwt.claims='{}';
SELECT attendance_audit.denied($q$SELECT public.update_time_tracking_summary('att-a',9,2026)$q$, 'DB32 absent identity does not become postgres');
SET request.jwt.claims='{"role":"authenticated","sub":"90000000-0000-0000-0000-000000000005"}';
SELECT attendance_audit.denied($q$SELECT public.update_time_tracking_summary('att-inactive',9,2026)$q$, 'DB33 inactive administrator cannot invoke scoped summary');
SET request.jwt.claims='{"role":"authenticated","sub":"90000000-0000-0000-0000-000000000003"}';
SELECT public.update_time_tracking_summary('att-a',9,2026);
SELECT attendance_audit.assert(true, 'DB34 manager can recalculate managed employee');
SELECT attendance_audit.denied($q$SELECT public.update_time_tracking_summary('att-outside',9,2026)$q$, 'DB35 manager cannot cross department via RPC');
UPDATE public.leave_requests SET employee_id='att-b' WHERE employee_id='att-a' AND reason='new cleanup';
SELECT attendance_audit.assert((SELECT leave_days=0 FROM public.time_tracking_summary WHERE employee_id='att-a' AND year=2027 AND month=9)
 AND (SELECT leave_days>0 FROM public.time_tracking_summary WHERE employee_id='att-b' AND year=2027 AND month=9), 'DB36 manager employee-change trigger recalculates both scopes');
RESET ROLE;
SET ROLE anon;
SELECT attendance_audit.denied($q$SELECT public.update_time_tracking_summary('att-a',9,2026)$q$, 'DB37 anon RPC cannot calculate protected data');
RESET ROLE;
SET ROLE service_role;
SET request.jwt.claims='{}';
SELECT public.update_time_tracking_summary('att-outside',9,2026);
SELECT attendance_audit.assert(true, 'DB38 actual service SQL role works without spoofable JWT role check');
RESET ROLE;
RESET SESSION AUTHORIZATION;
SET ROLE authenticated;
SET request.jwt.claims='{}';
SELECT attendance_audit.denied($q$SELECT public.update_time_tracking_summary('att-a',9,2026)$q$, 'DB39 postgres session with authenticated role and no UID cannot bypass');
RESET ROLE;
-- Temp object cannot shadow schema-qualified attendance sources.
CREATE TEMP TABLE time_entries(employee_id text,date date,hours numeric);
INSERT INTO time_entries VALUES('att-outside','2026-09-01',999);
SELECT public.update_time_tracking_summary('att-outside',9,2026);
SELECT attendance_audit.assert((SELECT total_hours=0 FROM public.time_tracking_summary WHERE employee_id='att-outside' AND year=2026 AND month=9), 'DB40 temporary table cannot shadow canonical source');
DROP TABLE pg_temp.time_entries;
TRUNCATE attendance_audit.refreshes;
UPDATE public.time_entries SET employee_id='att-b',date='2028-02-01'
 WHERE employee_id='att-a' AND date='2028-01-03';
SELECT attendance_audit.assert((SELECT array_agg(employee_id||':'||month ORDER BY employee_id,month)=ARRAY['att-a:1','att-b:2'] FROM attendance_audit.refreshes)
 AND (SELECT total_hours=0 FROM public.time_tracking_summary WHERE employee_id='att-a' AND year=2028 AND month=1)
 AND (SELECT total_hours=8 FROM public.time_tracking_summary WHERE employee_id='att-b' AND year=2028 AND month=2), 'DB43 time-entry UPDATE statement trigger refreshes OLD and NEW employees and months');
DELETE FROM public.time_entries WHERE employee_id='att-b' AND date='2028-02-01';
SELECT attendance_audit.assert((SELECT total_hours=0 FROM public.time_tracking_summary WHERE employee_id='att-b' AND year=2028 AND month=2), 'DB44 time-entry DELETE statement trigger clears stored total');
INSERT INTO public.leave_requests(employee_id,leave_type,start_date,end_date,status,reason)
 VALUES('att-a','annual','2028-09-29','2028-10-02','pending','pending approval');
TRUNCATE attendance_audit.refreshes;
UPDATE public.leave_requests SET status='approved' WHERE reason='pending approval';
SELECT attendance_audit.assert((SELECT array_agg(month ORDER BY month)=ARRAY[9,10] FROM attendance_audit.refreshes)
 AND (SELECT leave_days=1 FROM public.time_tracking_summary WHERE employee_id='att-a' AND year=2028 AND month=9)
 AND (SELECT leave_days=1 FROM public.time_tracking_summary WHERE employee_id='att-a' AND year=2028 AND month=10), 'DB45 pending approved refreshes both months');
TRUNCATE attendance_audit.refreshes;
UPDATE public.leave_requests SET status='rejected' WHERE reason='pending approval';
SELECT attendance_audit.assert((SELECT array_agg(month ORDER BY month)=ARRAY[9,10] FROM attendance_audit.refreshes)
 AND (SELECT bool_and(leave_days=0) FROM public.time_tracking_summary WHERE employee_id='att-a' AND year=2028 AND month IN (9,10)), 'DB46 approved rejected clears both OLD months');
TRUNCATE attendance_audit.refreshes;
UPDATE public.overtime_logs SET employee_id='att-b',date='2028-03-01'
 WHERE employee_id='att-a' AND reason='holiday log';
SELECT attendance_audit.assert((SELECT array_agg(employee_id||':'||year||':'||month ORDER BY employee_id,year,month)=ARRAY['att-a:2026:9','att-b:2028:3'] FROM attendance_audit.refreshes)
 AND (SELECT holiday_overtime_hours=4 FROM public.time_tracking_summary WHERE employee_id='att-b' AND year=2028 AND month=3), 'DB47 overtime UPDATE refreshes both employees and months');
DELETE FROM public.overtime_logs WHERE employee_id='att-b' AND reason='holiday log';
SELECT attendance_audit.assert((SELECT holiday_overtime_hours=0 FROM public.time_tracking_summary WHERE employee_id='att-b' AND year=2028 AND month=3), 'DB48 overtime DELETE clears the old contribution');
INSERT INTO public.time_entries(employee_id,date,clock_in,clock_out,hours,hour_type,status,notes)
 VALUES('att-b','2030-01-07','09:00','17:00',8,'regular','approved','Standard hours filled by admin: unique');
DO $$ DECLARE blocked boolean:=false; BEGIN
 BEGIN
  INSERT INTO public.time_entries(employee_id,date,clock_in,clock_out,hours,hour_type,status,notes)
   VALUES('att-b','2030-01-07','09:00','17:00',8,'regular','approved','Standard hours filled by admin: duplicate');
 EXCEPTION WHEN unique_violation THEN blocked:=true;
 END;
 PERFORM attendance_audit.assert(blocked AND (SELECT count(*)=1 FROM public.time_entries WHERE employee_id='att-b' AND date='2030-01-07'), 'DB49 unique employee date clock-in key prevents duplicate fill');
END $$;
SELECT count(*) || ' attendance database assertions passed' FROM attendance_audit.results;
