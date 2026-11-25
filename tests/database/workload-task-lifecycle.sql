BEGIN;
SET LOCAL TIME ZONE 'America/Los_Angeles';

CREATE FUNCTION pg_temp.assert_task(ok boolean, label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAILED: %', label; END IF;
END;
$$;

CREATE FUNCTION pg_temp.reject_task(sql text, error_code text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE sql;
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = error_code THEN RETURN; END IF;
    RAISE;
  END;
  RAISE EXCEPTION 'Expected SQLSTATE % from %', error_code, sql;
END;
$$;

INSERT INTO public.employees (id, name, email, department) VALUES
  ('task-owner', 'Task Owner', 'task-owner@example.test', 'Alpha'),
  ('task-other', 'Task Other', 'task-other@example.test', 'Beta');
INSERT INTO auth.users (id, email) VALUES
  ('80000000-0000-0000-0000-000000000001', 'task-owner@example.test'),
  ('80000000-0000-0000-0000-000000000002', 'task-admin@example.test');
INSERT INTO public.hr_users (id, employee_id, email, role, department, is_active)
VALUES ('80000000-0000-0000-0000-000000000001', 'task-owner', 'task-owner@example.test', 'employee', 'Alpha', true),
  ('80000000-0000-0000-0000-000000000002', NULL, 'task-admin@example.test', 'admin', 'HR', true);

SELECT pg_temp.reject_task($sql$INSERT INTO public.workload_tasks(employee_id, title, status)
  VALUES ('task-owner','Missing finish','completed')$sql$, '23514');
SELECT pg_temp.reject_task($sql$INSERT INTO public.workload_tasks(employee_id, title, status, completion_date)
  VALUES ('task-owner','Future finish','completed', (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date + 1)$sql$, '23514');
SELECT pg_temp.reject_task($sql$INSERT INTO public.workload_tasks(employee_id, title, status, completion_date)
  VALUES ('task-owner','Open with finish','pending',date '2026-01-10')$sql$, '23514');

INSERT INTO public.workload_tasks(id, employee_id, title, status, completion_date) VALUES
  (740001,'task-owner','Backdated work','completed',date '2026-01-10'),
  (740002,'task-owner','Assigned work','pending',null),
  (740003,'task-other','Outside assignment','pending',null);
UPDATE public.workload_tasks SET comments='Review entered later' WHERE id=740001;
SELECT pg_temp.assert_task((SELECT completion_date=date '2026-01-10' FROM public.workload_tasks WHERE id=740001), 'review edits preserve reported completion');
UPDATE public.workload_tasks SET comments='Historical review' WHERE id IN (739998,739999);
SELECT pg_temp.assert_task((SELECT completion_date IS NULL FROM public.workload_tasks WHERE id=739998), 'legacy missing date survives unrelated edit');
SELECT pg_temp.assert_task((SELECT completion_date=date '2099-01-01' FROM public.workload_tasks WHERE id=739999), 'legacy future date survives unrelated edit');

SET SESSION AUTHORIZATION authenticator;
SET ROLE authenticated;
SET request.jwt.claims = '{"role":"authenticated","sub":"80000000-0000-0000-0000-000000000001"}';
SELECT pg_temp.assert_task((SELECT count(*)=0 FROM public.workload_tasks WHERE id=740003), 'employee cannot read outside task');
SELECT pg_temp.reject_task($sql$UPDATE public.workload_tasks SET status='completed' WHERE id=740002$sql$, '23514');
SELECT pg_temp.reject_task($sql$SELECT * FROM public.set_workload_task_status(ARRAY[740002,740003]::bigint[], 'completed')$sql$, '42501');
SELECT pg_temp.assert_task((SELECT status='pending' AND completion_date IS NULL FROM public.workload_tasks WHERE id=740002), 'mixed authorization rolls back entire bulk update');
SELECT pg_temp.assert_task((SELECT completion_date=date '2026-01-10' FROM public.set_workload_task_status(ARRAY[740001]::bigint[], 'completed')), 'repeated complete preserves backdated date');
SELECT pg_temp.assert_task((SELECT status='pending' AND completion_date IS NULL FROM public.set_workload_task_status(ARRAY[740001]::bigint[], 'pending')), 'reopen clears completion atomically');
SELECT pg_temp.assert_task((SELECT status='completed' AND completion_date=(statement_timestamp() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date FROM public.set_workload_task_status(ARRAY[740001]::bigint[], 'completed')), 'complete now uses Vietnam calendar');
UPDATE public.workload_tasks SET status='cancelled' WHERE id=740001;
SELECT pg_temp.assert_task((SELECT completion_date IS NULL FROM public.workload_tasks WHERE id=740001), 'cancelling clears any existing finish');
SELECT pg_temp.reject_task($sql$UPDATE public.workload_tasks SET title='Forbidden' WHERE id=740001$sql$, 'P0001');

SET realtime.topic = 'hr:workload:task-owner';
SELECT pg_temp.assert_task((SELECT count(*)>0 AND bool_and(payload='{}'::jsonb AND private) FROM realtime.messages), 'authorized subscriber sees only empty private invalidations');
SET realtime.topic = 'hr:workload:task-other';
SELECT pg_temp.assert_task((SELECT count(*)=0 FROM realtime.messages), 'subscriber cannot read another employee topic');
SELECT pg_temp.reject_task($sql$INSERT INTO realtime.messages VALUES ('{}','changed','hr:workload:task-other',true,'broadcast')$sql$, '42501');
SET request.jwt.claims = '{"role":"authenticated","sub":"80000000-0000-0000-0000-000000000002"}';
UPDATE public.workload_tasks SET employee_id='task-other' WHERE id=740002;
DELETE FROM public.workload_tasks WHERE id=740002;
SELECT pg_temp.assert_task((SELECT count(*) >= 3 FROM realtime.messages WHERE topic='hr:workload:task-other'), 'new owner receives reassignment and deletion invalidations');
SET realtime.topic = 'hr:workload:task-owner';
SELECT pg_temp.assert_task((SELECT count(*) >= 7 FROM realtime.messages WHERE topic='hr:workload:task-owner'), 'old owner receives reassignment invalidation');
ROLLBACK;
SELECT 'Task lifecycle, permissions and private invalidation checks passed';
