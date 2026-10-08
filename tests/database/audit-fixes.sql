-- Reproduce the audit's permission gaps and verify the intended allow paths.
BEGIN;
CREATE SCHEMA audit_fixes;
CREATE TABLE audit_fixes.results(label text);
GRANT USAGE ON SCHEMA audit_fixes TO authenticated;
GRANT INSERT, SELECT ON audit_fixes.results TO authenticated;
CREATE FUNCTION audit_fixes.assert(ok boolean, label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAILED: %', label; END IF;
  INSERT INTO audit_fixes.results VALUES (label);
END $$;
CREATE FUNCTION audit_fixes.denied(statement text, label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE statement;
    RAISE EXCEPTION 'FAILED: %', label;
  EXCEPTION WHEN insufficient_privilege THEN
    PERFORM audit_fixes.assert(true, label);
  END;
END $$;

INSERT INTO auth.users(id, email)
SELECT ('91000000-0000-0000-0000-' || lpad(n::text,12,'0'))::uuid, 'audit-auth-' || n || '@example.test'
FROM generate_series(1,8) n;
INSERT INTO public.employees(id, name, email, department) VALUES
 ('audit-admin','Admin','audit-admin@example.test','HR'),
 ('audit-manager','Manager','audit-manager@example.test','Alpha'),
 ('audit-alpha','Alpha','audit-alpha@example.test','Alpha'),
 ('audit-beta','Beta','audit-beta@example.test','Beta'),
 ('audit-peer','Peer Manager','audit-peer@example.test','Alpha');
INSERT INTO public.hr_users(id,email,first_name,role,employee_id,department,is_active) VALUES
 ('91000000-0000-0000-0000-000000000001','audit-admin@example.test','Admin','admin','audit-admin','HR',true),
 ('91000000-0000-0000-0000-000000000002','audit-manager@example.test','Manager','manager','audit-manager','Alpha',true),
 ('91000000-0000-0000-0000-000000000003','audit-alpha@example.test','Alpha','employee','audit-alpha','Alpha',true),
 ('91000000-0000-0000-0000-000000000004','audit-beta@example.test','Beta','employee','audit-beta','Beta',true),
 ('91000000-0000-0000-0000-000000000005','audit-inactive@example.test','Inactive','admin',null,'HR',false),
 ('92000000-0000-0000-0000-000000000006','audit-mapped@example.test','Mapped','admin',null,'HR',true),
 ('91000000-0000-0000-0000-000000000007','audit-peer@example.test','Peer','manager','audit-peer','Alpha',true);
INSERT INTO public.user_emails(hr_user_id,auth_user_id,email,is_primary) VALUES
 ('92000000-0000-0000-0000-000000000006','91000000-0000-0000-0000-000000000006','audit-mapped@example.test',true);
INSERT INTO public.performance_goals(id, employee_id, title) VALUES
 ('93000000-0000-0000-0000-000000000001','audit-beta','Beta goal'),
 ('93000000-0000-0000-0000-000000000002','audit-alpha','Alpha goal');
INSERT INTO public.performance_comments(id, goal_id, author, author_id, comment) VALUES
 ('94000000-0000-0000-0000-000000000001','93000000-0000-0000-0000-000000000001','Admin','91000000-0000-0000-0000-000000000001','Private discussion'),
 ('94000000-0000-0000-0000-000000000002','93000000-0000-0000-0000-000000000002','Admin','91000000-0000-0000-0000-000000000001','Alpha discussion');
INSERT INTO public.goal_check_ins(id,goal_id,employee_id,author_auth_id,note) VALUES
 ('95000000-0000-0000-0000-000000000001','93000000-0000-0000-0000-000000000001','audit-beta','91000000-0000-0000-0000-000000000004','Beta check-in');
INSERT INTO public.workload_tasks(id,employee_id,title) VALUES (910001,'audit-beta','Beta task');
INSERT INTO public.performance_reviews(id,employee_id,review_period) VALUES
 ('96000000-0000-0000-0000-000000000001','audit-beta','2028-Q1');
INSERT INTO public.leave_requests(id,employee_id,leave_type,start_date,end_date,reason) VALUES
 (910001,'audit-beta','annual','2028-01-10','2028-01-10','Beta leave');
INSERT INTO public.hr_ugc_translations(entity_type,entity_id,field,locale,body,source_text) VALUES
 ('task','910001','title','en','Task translation','Beta task'),
 ('goal','93000000-0000-0000-0000-000000000001','title','en','Goal translation','Beta goal'),
 ('review','96000000-0000-0000-0000-000000000001','comments','en','Review translation','Beta review'),
 ('leave','910001','reason','en','Leave translation','Beta leave'),
 ('goal_comment','94000000-0000-0000-0000-000000000001','comment','en','Comment translation','Private discussion'),
 ('goal_check_in','95000000-0000-0000-0000-000000000001','note','en','Check-in translation','Beta check-in'),
 ('goal','93000000-0000-0000-0000-000000000002','title','en','Alpha translation','Alpha goal');
INSERT INTO public.time_entries(employee_id,date,clock_in,clock_out,hours) VALUES ('audit-beta','2028-01-11','09:00','17:00',8);
INSERT INTO public.skills_assessments(employee_id,skill_name,rating,assessed_by) VALUES ('audit-beta','Keep this history',3,'audit-manager');
INSERT INTO public.proof_file_audit(operation,entity_type,entity_id,employee_id,performed_by) VALUES
 ('upload','leave','910001','audit-beta','audit-admin');

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims='{"role":"authenticated","sub":"91000000-0000-0000-0000-000000000002"}';
SELECT audit_fixes.assert(NOT private.can_manage_employee('audit-beta'), 'manager begins outside Beta scope');
SELECT audit_fixes.denied($q$UPDATE public.hr_users SET department='Beta' WHERE id='91000000-0000-0000-0000-000000000002'$q$, 'manager cannot change own department');
SELECT audit_fixes.denied($q$UPDATE public.hr_users SET manager_id='91000000-0000-0000-0000-000000000007' WHERE id='91000000-0000-0000-0000-000000000002'$q$, 'manager cannot change own manager');
SELECT audit_fixes.denied($q$UPDATE public.hr_users SET department='Beta' WHERE id='91000000-0000-0000-0000-000000000007'$q$, 'manager cannot alter a peer manager scope');
SELECT audit_fixes.denied($q$UPDATE public.hr_users SET department='Beta',manager_id=null WHERE employee_id='audit-alpha'$q$, 'manager cannot move a subordinate outside scope');
UPDATE public.hr_users SET position='Senior',phone='fixture' WHERE employee_id='audit-alpha';
SELECT audit_fixes.assert((SELECT position='Senior' FROM public.hr_users WHERE employee_id='audit-alpha'), 'manager can update organization placement within scope');
UPDATE public.hr_users SET phone='self contact' WHERE employee_id='audit-manager';
SELECT audit_fixes.assert((SELECT phone='self contact' FROM public.hr_users WHERE employee_id='audit-manager'), 'manager can edit own contact details');
SELECT audit_fixes.assert((SELECT count(*)=0 FROM public.time_entries WHERE employee_id='audit-beta'), 'blocked self-scope change does not reveal Beta attendance');
SELECT audit_fixes.assert((SELECT count(*)=1 FROM public.performance_comments), 'manager sees only Alpha discussion');
SELECT audit_fixes.assert((SELECT count(*)=1 FROM public.hr_ugc_translations), 'manager sees only Alpha translations');
SELECT audit_fixes.assert(NOT public.hr_can_translate('goal','93000000-0000-0000-0000-000000000002'), 'manager cannot publish even in own scope');
WITH changed AS (UPDATE public.hr_ugc_translations SET body='Unpermitted' RETURNING *)
SELECT audit_fixes.assert((SELECT count(*)=0 FROM changed), 'manager translation writes affect zero rows');
SELECT audit_fixes.denied($q$INSERT INTO public.performance_comments(goal_id,author,author_id,comment) VALUES ('93000000-0000-0000-0000-000000000002','Admin','91000000-0000-0000-0000-000000000001','Forged')$q$, 'manager cannot impersonate an admin in visible discussion');
SELECT audit_fixes.assert((SELECT count(*)=0 FROM public.proof_file_audit), 'manager cannot read proof history outside scope');

SET LOCAL request.jwt.claims='{"role":"authenticated","sub":"91000000-0000-0000-0000-000000000008"}';
SELECT audit_fixes.assert((SELECT count(*)=0 FROM public.performance_comments), 'non-HR Auth account cannot read comments');
SELECT audit_fixes.assert((SELECT count(*)=0 FROM public.hr_ugc_translations), 'non-HR Auth account cannot read translated HR text');
SELECT audit_fixes.denied($q$INSERT INTO public.performance_comments(goal_id,author,comment) VALUES ('93000000-0000-0000-0000-000000000001','Admin','Forged')$q$, 'non-HR Auth account cannot post comments');
SELECT audit_fixes.assert((SELECT count(*)=0 FROM public.proof_file_audit), 'non-HR Auth account cannot read proof history');
SELECT audit_fixes.denied($q$INSERT INTO public.proof_file_audit(operation,entity_type,entity_id,employee_id) VALUES ('upload','leave','910001','audit-beta')$q$, 'non-HR Auth account cannot forge proof history');
SELECT audit_fixes.denied('TRUNCATE public.proof_file_audit', 'authenticated callers cannot truncate proof history');

SET LOCAL request.jwt.claims='{"role":"authenticated","sub":"91000000-0000-0000-0000-000000000005"}';
SELECT audit_fixes.assert((SELECT count(*)=0 FROM public.hr_ugc_translations), 'inactive admin cannot read translations');
SELECT audit_fixes.assert(NOT public.hr_can_translate('goal','93000000-0000-0000-0000-000000000001'), 'inactive admin cannot publish translations');
SELECT audit_fixes.denied($q$INSERT INTO public.hr_ugc_translations(entity_type,entity_id,field,locale,body) VALUES ('goal','93000000-0000-0000-0000-000000000001','title','vn','Denied')$q$, 'inactive admin translation insert is denied');
WITH changed AS (UPDATE public.hr_ugc_translations SET body='Inactive write' RETURNING *)
SELECT audit_fixes.assert((SELECT count(*)=0 FROM changed), 'inactive admin translation update is denied');

SET LOCAL request.jwt.claims='{"role":"authenticated","sub":"91000000-0000-0000-0000-000000000004"}';
SELECT audit_fixes.assert((SELECT count(*)=6 FROM public.hr_ugc_translations), 'owner reads translations for all six source types');
SELECT audit_fixes.assert((SELECT count(*)=1 FROM public.performance_comments), 'owner reads own goal discussion');
SELECT audit_fixes.assert(NOT public.hr_can_translate('goal','93000000-0000-0000-0000-000000000001'), 'owner reading permission does not grant publishing');
INSERT INTO public.performance_comments(goal_id,author,comment) VALUES ('93000000-0000-0000-0000-000000000001','Untrusted caller name','Legitimate reply');
SELECT audit_fixes.assert((SELECT author='Beta' AND author_id='91000000-0000-0000-0000-000000000004' FROM public.performance_comments WHERE comment='Legitimate reply'), 'server derives comment author identity and display name');
SELECT audit_fixes.denied($q$INSERT INTO public.performance_comments(goal_id,author,comment) VALUES ('93000000-0000-0000-0000-000000000002','Beta','Outside reply')$q$, 'employee cannot comment on an invisible goal');
SELECT audit_fixes.assert(NOT private.can_read_hr_translation('goal','not-a-uuid'), 'malformed translation key is a clean denial');
SELECT audit_fixes.assert(NOT private.can_read_hr_translation('unknown','910001'), 'unknown translation source is a clean denial');
SELECT audit_fixes.assert((SELECT count(*)=1 FROM public.proof_file_audit), 'employee reads own proof history');
INSERT INTO public.proof_file_audit(operation,entity_type,entity_id,employee_id,performed_by) VALUES
 ('upload','leave','910001','audit-beta','audit-beta');
SELECT audit_fixes.assert((SELECT count(*)=2 FROM public.proof_file_audit), 'employee can append proof history as self');
SELECT audit_fixes.denied($q$INSERT INTO public.proof_file_audit(operation,entity_type,entity_id,employee_id,performed_by) VALUES ('upload','leave','910001','audit-beta','audit-admin')$q$, 'employee cannot impersonate proof operator');
SELECT audit_fixes.denied($q$UPDATE public.proof_file_audit SET file_name='rewritten'$q$, 'proof history cannot be rewritten by a caller');
SELECT audit_fixes.denied('DELETE FROM public.proof_file_audit', 'proof history cannot be deleted by a caller');

SET LOCAL request.jwt.claims='{"role":"authenticated","sub":"91000000-0000-0000-0000-000000000006"}';
SELECT audit_fixes.assert(private.current_hr_role()='admin', 'mapped administrator resolves active role');
SELECT audit_fixes.assert((SELECT count(*)=2 FROM public.proof_file_audit), 'mapped administrator can read proof history');
SELECT audit_fixes.assert(public.hr_can_translate('goal','93000000-0000-0000-0000-000000000001'), 'mapped administrator can publish translations');
UPDATE public.hr_ugc_translations SET body='Mapped admin wording' WHERE entity_type='goal' AND entity_id='93000000-0000-0000-0000-000000000001';
SELECT audit_fixes.assert((SELECT body='Mapped admin wording' FROM public.hr_ugc_translations WHERE entity_type='goal' AND entity_id='93000000-0000-0000-0000-000000000001'), 'mapped administrator translation update persists');
INSERT INTO public.performance_comments(goal_id,author,comment) VALUES ('93000000-0000-0000-0000-000000000001','Caller','Mapped reply');
SELECT audit_fixes.assert((SELECT author_id='92000000-0000-0000-0000-000000000006' FROM public.performance_comments WHERE comment='Mapped reply'), 'mapped comment author is stable HR identity');
UPDATE public.hr_users SET department='Beta' WHERE employee_id='audit-manager';
SELECT audit_fixes.assert((SELECT department='Beta' FROM public.hr_users WHERE employee_id='audit-manager'), 'admin retains manager scope editing');
DELETE FROM public.employees WHERE id='audit-manager';
SELECT audit_fixes.assert(NOT EXISTS(SELECT 1 FROM public.employees WHERE id='audit-manager'), 'admin can delete an employee who assessed a colleague');
SELECT audit_fixes.assert((SELECT assessed_by IS NULL AND rating=3 FROM public.skills_assessments WHERE skill_name='Keep this history'), 'colleague skill history survives assessor deletion');
RESET ROLE;
SELECT audit_fixes.assert(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='visits' AND column_name='anonymized_ip'), 'visit schema accepts anonymized IP');
INSERT INTO public.visits(ip,anonymized_ip,path) VALUES ('192.0.2.7','192.0.2.0','/audit-fixture');
SELECT audit_fixes.assert((SELECT anonymized_ip='192.0.2.0' FROM public.visits WHERE path='/audit-fixture'), 'visit payload persists against migrated schema');
SELECT count(*) || ' audit repair database assertions passed' FROM audit_fixes.results;
ROLLBACK;
