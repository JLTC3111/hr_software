CREATE SCHEMA audit_test;
CREATE TABLE audit_test.results (label text);
GRANT USAGE ON SCHEMA audit_test TO anon, authenticated;
GRANT INSERT ON audit_test.results TO anon, authenticated;
CREATE FUNCTION audit_test.assert(ok boolean, label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAILED: %', label; END IF;
  INSERT INTO audit_test.results VALUES (label);
END $$;
CREATE FUNCTION audit_test.denied(statement text, label text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE blocked boolean := false;
BEGIN
  BEGIN EXECUTE statement; EXCEPTION WHEN insufficient_privilege THEN blocked := true; END;
  PERFORM audit_test.assert(blocked, label);
END $$;

SELECT audit_test.assert((SELECT leave_days = 1 FROM public.time_tracking_summary WHERE employee_id = 'upgrade' AND month = 8), 'upgrade repairs existing August leave total');
SELECT audit_test.assert((SELECT leave_days = 2 AND total_hours = 8 FROM public.time_tracking_summary WHERE employee_id = 'upgrade' AND month = 9), 'upgrade repairs existing September total without changing worked hours');
SELECT audit_test.assert((SELECT count(*) = 1 FROM public.job_applications WHERE id = 801), 'upgrade preserves legacy application data');

INSERT INTO auth.users (id, email) SELECT ('10000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid, 'fixture' || n || '@example.test' FROM generate_series(1, 8) n;
INSERT INTO public.hr_users (id, email, first_name, role, department, is_active) VALUES
  ('20000000-0000-0000-0000-000000000001', 'admin@example.test', 'Admin', 'admin', 'HR', true),
  ('20000000-0000-0000-0000-000000000002', 'manager@example.test', 'Manager', 'manager', 'Alpha', true),
  ('20000000-0000-0000-0000-000000000003', 'employee@example.test', 'Employee', 'employee', 'Alpha', true),
  ('10000000-0000-0000-0000-000000000004', 'direct@example.test', 'Direct', 'employee', 'Alpha', true),
  ('20000000-0000-0000-0000-000000000005', 'inactive@example.test', 'Inactive', 'admin', 'HR', false),
  ('20000000-0000-0000-0000-000000000006', 'outside@example.test', 'Outside', 'employee', 'Beta', true),
  ('20000000-0000-0000-0000-000000000007', 'manager-beta@example.test', 'Manager B', 'manager', 'Beta', true);
INSERT INTO public.employees (id, name, email, department) VALUES
  ('admin', 'Admin', 'admin@example.test', 'HR'), ('manager', 'Manager', 'manager@example.test', 'Alpha'),
  ('employee', 'Employee', 'employee@example.test', 'Alpha'), ('direct', 'Direct', 'direct@example.test', 'Alpha'),
  ('inactive', 'Inactive', 'inactive@example.test', 'HR'), ('outside', 'Outside', 'outside@example.test', 'Beta'),
  ('manager-beta', 'Manager B', 'manager-beta@example.test', 'Beta');
UPDATE public.hr_users SET employee_id = split_part(email, '@', 1);
INSERT INTO public.user_emails (hr_user_id, auth_user_id, email, is_primary)
SELECT hu.id, replace(hu.id::text, '20000000-', '10000000-')::uuid, hu.email, true FROM public.hr_users hu WHERE hu.email <> 'direct@example.test';
INSERT INTO storage.buckets VALUES ('other-app', 'other-app', true);
INSERT INTO storage.objects (bucket_id, name, owner_id) VALUES
  ('employee-documents', 'time-proofs/employee_2026-09-01_proof.pdf', '10000000-0000-0000-0000-000000000008'),
  ('employee-documents', '20000000-0000-0000-0000-000000000003_123.pdf', null),
  ('employee-documents', 'request-documents/outside__leave__123.pdf', null),
  ('employee-documents', 'resumes/candidate_123.pdf', null),
  ('other-app', 'public.pdf', null);
-- Deliberately more permissive than production: the restrictive bucket guard
-- must still prevent access via unrelated policies.
CREATE POLICY unrelated_public_read ON storage.objects FOR SELECT TO public USING (true);
INSERT INTO public.performance_reviews (employee_id, reviewer_id, review_period, overall_rating)
VALUES ('employee', 'manager', '2026-Q3', 3), ('outside', 'manager-beta', '2026-Q3', 2);
INSERT INTO public.visits (ip) VALUES ('192.0.2.1');

SET SESSION AUTHORIZATION authenticator;
SET ROLE authenticated;
SET request.jwt.claims = '{"role":"authenticated","sub":"10000000-0000-0000-0000-000000000003"}';
SELECT audit_test.assert(private.current_employee_id() = 'employee', 'mapped login resolves employee');
INSERT INTO public.time_entries (employee_id, date, clock_in, clock_out, hours) VALUES
  ('employee', '2026-09-30', '09:00', '17:00', 8), ('employee', '2026-10-01', '09:00', '13:00', 4);
SELECT audit_test.assert((SELECT total_hours = 8 FROM public.time_tracking_summary WHERE month = 9 AND year = 2026), 'pending time entry updates derived September total');
SELECT audit_test.denied($q$INSERT INTO public.time_entries (employee_id,date,clock_in,clock_out,hours,status) VALUES ('employee','2026-09-01','09:00','17:00',8,'approved')$q$, 'employee cannot insert approved time');
SELECT audit_test.denied($q$INSERT INTO public.leave_requests (employee_id,leave_type,start_date,end_date,status) VALUES ('employee','annual','2026-09-01','2026-09-01','approved')$q$, 'employee cannot insert approved leave');
SELECT audit_test.denied($q$INSERT INTO public.overtime_logs (employee_id,date,hours,reason,status) VALUES ('employee','2026-09-01',2,'test','approved')$q$, 'employee cannot insert approved overtime');
SELECT audit_test.denied($q$INSERT INTO public.time_entries (employee_id,date,clock_in,clock_out,hours,approved_by) VALUES ('employee','2026-09-01','09:00','17:00',8,'manager')$q$, 'employee cannot forge approver on pending insert');
SELECT audit_test.denied($q$UPDATE public.time_tracking_summary SET total_hours = 999$q$, 'employee cannot overwrite summaries');
SELECT audit_test.denied($q$SELECT public.update_time_tracking_summary('outside',9,2026)$q$, 'summary RPC denies outside employee');
SELECT public.update_time_tracking_summary('employee',9,2026);
SELECT audit_test.assert((SELECT total_hours = 8 FROM public.time_tracking_summary WHERE month = 9), 'own summary RPC remains usable');
SELECT audit_test.denied($q$UPDATE public.performance_reviews SET overall_rating = 5 WHERE employee_id = 'employee'$q$, 'employee cannot rewrite manager rating');
SELECT audit_test.denied($q$UPDATE public.performance_reviews SET status = 'approved' WHERE employee_id = 'employee'$q$, 'employee cannot approve manager review');
SELECT audit_test.denied($q$UPDATE public.performance_reviews SET self_assessment_skipped = true WHERE employee_id = 'employee'$q$, 'employee cannot skip own assessment');
UPDATE public.performance_reviews SET employee_comments = 'Acknowledged' WHERE employee_id = 'employee';
SELECT audit_test.assert((SELECT employee_comments = 'Acknowledged' FROM public.performance_reviews WHERE review_period = '2026-Q3'), 'employee response remains writable');
INSERT INTO public.performance_reviews (employee_id, reviewer_id, review_period, review_type, overall_rating)
VALUES ('employee', 'employee', '2026-Q4', 'self', 4);
SELECT audit_test.assert((SELECT count(*) = 2 FROM public.performance_reviews), 'employee can retain separate self-rating history');
SELECT audit_test.denied($q$INSERT INTO public.performance_reviews (employee_id,reviewer_id,review_period,status,overall_rating) VALUES ('employee','employee','2027-Q1','approved',5)$q$, 'employee cannot create approved review');
SELECT audit_test.denied($q$INSERT INTO public.performance_reviews (employee_id,reviewer_id,review_period,review_type,overall_rating) VALUES ('employee','employee','2026-Q3','self',5) ON CONFLICT(employee_id,review_period) DO UPDATE SET review_type='self',overall_rating=5$q$, 'self upsert cannot replace manager review');
WITH deleted AS (DELETE FROM public.performance_reviews RETURNING id) SELECT audit_test.assert((SELECT count(*) = 0 FROM deleted), 'employee cannot delete manager or self review');
SELECT audit_test.assert((SELECT count(*) = 2 FROM storage.objects WHERE bucket_id = 'employee-documents'), 'employee reads own documents including legacy HR-ID names');
SELECT audit_test.denied($q$INSERT INTO storage.objects (bucket_id,name) VALUES ('employee-documents','time-proofs/outside_fake.pdf')$q$, 'global storage upload policy cannot bypass HR scope');
INSERT INTO storage.objects (bucket_id,name) VALUES ('employee-documents','request-documents/employee__leave__123.pdf');
SELECT audit_test.assert((SELECT count(*) = 3 FROM storage.objects WHERE bucket_id = 'employee-documents'), 'employee can upload own document');
SELECT audit_test.assert((SELECT count(*) = 0 FROM public.applicants), 'employee cannot read candidates');
SELECT audit_test.assert((SELECT count(*) = 0 FROM public.visits), 'employee cannot read visit IPs through REST');
SELECT audit_test.denied($q$INSERT INTO public.applicants(full_name,email) VALUES ('Forbidden','forbidden@example.test')$q$, 'employee cannot create candidates');
INSERT INTO public.leave_requests (employee_id, leave_type, start_date, end_date) VALUES ('employee', 'annual', '2026-08-31', '2026-09-02');
RESET ROLE;
RESET SESSION AUTHORIZATION;

SET SESSION AUTHORIZATION authenticator;
SET ROLE authenticated;
SET request.jwt.claims = '{"role":"authenticated","sub":"10000000-0000-0000-0000-000000000002"}';
SELECT audit_test.assert(private.current_hr_role() = 'manager', 'mapped manager recognized');
SELECT audit_test.assert((SELECT count(*) = 2 FROM public.performance_reviews), 'manager sees own department reviews only');
UPDATE public.time_entries SET status = 'approved', approved_by = 'manager', approved_at = now() WHERE employee_id = 'employee';
UPDATE public.leave_requests SET status = 'approved', approved_by = 'manager', approved_at = now() WHERE employee_id = 'employee';
SELECT audit_test.assert((SELECT leave_days = 1 FROM public.time_tracking_summary WHERE month = 8), 'cross-month leave counts August weekday');
SELECT audit_test.assert((SELECT leave_days = 2 FROM public.time_tracking_summary WHERE month = 9), 'cross-month leave counts September weekdays');
UPDATE public.leave_requests SET start_date = '2026-09-29', end_date = '2026-10-02' WHERE employee_id = 'employee';
SELECT audit_test.assert((SELECT leave_days = 0 FROM public.time_tracking_summary WHERE month = 8), 'moving leave clears old start month');
SELECT audit_test.assert((SELECT leave_days = 2 FROM public.time_tracking_summary WHERE month = 10), 'moving leave recalculates new end month');
UPDATE public.performance_reviews SET overall_rating = 4, status = 'approved' WHERE employee_id = 'employee' AND review_period = '2026-Q3';
SELECT audit_test.assert((SELECT overall_rating = 4 AND status = 'approved' FROM public.performance_reviews WHERE review_period = '2026-Q3'), 'manager can rate and approve scoped review');
SELECT audit_test.assert((SELECT count(*) = 0 FROM storage.objects WHERE name LIKE '%outside%'), 'manager cannot download another department documents');
SELECT audit_test.assert((SELECT count(*) = 1 FROM storage.objects WHERE name LIKE 'resumes/%'), 'manager can download candidate resume');
INSERT INTO public.job_postings (id,title,department) VALUES (901,'Fixture job','Alpha'), (902,'Other fixture','Alpha');
INSERT INTO public.applicants (id,full_name,email) VALUES ('30000000-0000-0000-0000-000000000001','Fixture candidate','candidate@example.test');
INSERT INTO public.applications (id,job_posting_id,applicant_id) VALUES ('40000000-0000-0000-0000-000000000001',901,'30000000-0000-0000-0000-000000000001');
SELECT audit_test.assert((SELECT total_applications = 1 AND under_review = 1 FROM public.recruitment_metrics WHERE job_posting_id = 901), 'application insert and metrics commit together');
UPDATE public.applications SET status = 'shortlisted' WHERE job_posting_id = 901;
SELECT audit_test.assert((SELECT shortlisted = 1 AND under_review = 0 FROM public.recruitment_metrics WHERE job_posting_id = 901), 'application stage updates metrics');
INSERT INTO public.interview_schedules (application_id,interview_type,scheduled_time,interviewer_id)
VALUES ('40000000-0000-0000-0000-000000000001','video','2027-01-01 09:00:00+07','manager');
SELECT audit_test.assert((SELECT status = 'interview scheduled' FROM public.applications WHERE job_posting_id = 901), 'interview schedules the UUID application transactionally');
SELECT audit_test.assert((SELECT interviews_scheduled = 1 FROM public.recruitment_metrics WHERE job_posting_id = 901), 'interview updates recruitment metrics');
SELECT audit_test.assert((SELECT count(*) = 1 FROM public.upcoming_interviews), 'upcoming interview view uses candidate relationship');
SELECT audit_test.assert((SELECT interview_count = 1 FROM public.applications_detailed), 'detailed application view uses corrected interview foreign key');
SELECT audit_test.denied($q$UPDATE public.recruitment_metrics SET hired = 900$q$, 'manager cannot forge derived recruitment metrics');
UPDATE public.applications SET job_posting_id = 902;
SELECT audit_test.assert((SELECT total_applications = 0 FROM public.recruitment_metrics WHERE job_posting_id = 901), 'moving application clears old job metrics');
SELECT audit_test.assert((SELECT total_applications = 1 FROM public.recruitment_metrics WHERE job_posting_id = 902), 'moving application updates new job metrics');
DELETE FROM public.applications WHERE job_posting_id = 902;
SELECT audit_test.assert((SELECT total_applications = 0 FROM public.recruitment_metrics WHERE job_posting_id = 902), 'application deletion updates metrics');
SELECT audit_test.assert((SELECT count(*) = 0 FROM public.interview_schedules), 'application deletion cascades interviews');
RESET ROLE;
RESET SESSION AUTHORIZATION;

SET SESSION AUTHORIZATION authenticator;
SET ROLE authenticated;
SET request.jwt.claims = '{"role":"authenticated","sub":"10000000-0000-0000-0000-000000000003"}';
SELECT audit_test.denied($q$UPDATE public.time_entries SET hours = 99 WHERE employee_id = 'employee'$q$, 'employee cannot rewrite approved hours');
SELECT audit_test.denied($q$DELETE FROM public.time_entries WHERE employee_id = 'employee'$q$, 'employee cannot delete approved hours');
SELECT audit_test.denied($q$UPDATE public.leave_requests SET end_date = '2026-10-30' WHERE employee_id = 'employee'$q$, 'employee cannot extend approved leave');
UPDATE public.time_entries SET proof_file_path = 'time-proofs/employee_proof.pdf' WHERE employee_id = 'employee';
SELECT audit_test.assert((SELECT count(*) = 2 FROM public.time_entries WHERE proof_file_path IS NOT NULL), 'employee may still attach supporting proof after review');
SELECT audit_test.assert((SELECT count(*) = 0 FROM public.applicants), 'candidate PII stays hidden after real candidate exists');
RESET ROLE;
RESET SESSION AUTHORIZATION;

SET SESSION AUTHORIZATION authenticator;
SET ROLE authenticated;
SET request.jwt.claims = '{"role":"authenticated","sub":"10000000-0000-0000-0000-000000000004"}';
SELECT audit_test.assert(private.current_employee_id() = 'direct', 'unmapped legacy login still resolves direct profile');
SELECT audit_test.assert((SELECT count(*) = 0 FROM public.time_tracking_summary), 'another employee cannot read colleague summaries');
RESET ROLE;
RESET SESSION AUTHORIZATION;

SET SESSION AUTHORIZATION authenticator;
SET ROLE authenticated;
SET request.jwt.claims = '{"role":"authenticated","sub":"10000000-0000-0000-0000-000000000005"}';
SELECT audit_test.assert(private.current_hr_role() IS NULL, 'inactive admin loses HR role');
SELECT audit_test.assert((SELECT count(*) = 0 FROM storage.objects WHERE bucket_id = 'employee-documents'), 'inactive admin cannot download employee documents');
SELECT audit_test.assert((SELECT count(*) = 0 FROM public.performance_reviews), 'inactive admin cannot read reviews');
SELECT audit_test.assert((SELECT count(*) = 0 FROM public.applicants), 'inactive admin cannot read candidates');
RESET ROLE;
RESET SESSION AUTHORIZATION;

SET SESSION AUTHORIZATION authenticator;
SET ROLE authenticated;
SET request.jwt.claims = '{"role":"authenticated","sub":"10000000-0000-0000-0000-000000000008","user_metadata":{"role":"admin"}}';
SELECT audit_test.assert((SELECT count(*) = 0 FROM public.visits), 'editable metadata cannot grant visit access');
SELECT audit_test.assert((SELECT count(*) = 0 FROM public.applicants), 'other-app login cannot read candidates');
SELECT audit_test.assert((SELECT count(*) = 0 FROM public.time_tracking_summary), 'other-app login cannot read attendance');
WITH deleted AS (DELETE FROM storage.objects WHERE bucket_id = 'employee-documents' RETURNING id)
SELECT audit_test.assert((SELECT count(*) = 0 FROM deleted), 'global owner policy cannot delete HR object without membership');
INSERT INTO storage.objects (bucket_id,name) VALUES ('other-app','allowed-upload.pdf');
SELECT audit_test.assert((SELECT count(*) = 2 FROM storage.objects WHERE bucket_id = 'other-app'), 'other application bucket policies keep working');
RESET ROLE;
RESET SESSION AUTHORIZATION;

SET SESSION AUTHORIZATION authenticator;
SET ROLE anon;
SET request.jwt.claims = '{"role":"anon"}';
SELECT audit_test.denied('SELECT * FROM public.time_tracking_summary', 'anonymous cannot read summaries');
SELECT audit_test.denied('SELECT * FROM public.applicants', 'anonymous cannot read applicants');
SELECT audit_test.assert((SELECT count(*) = 0 FROM storage.objects WHERE bucket_id = 'employee-documents'), 'anonymous cannot list private HR documents despite global read policy');
SELECT audit_test.assert((SELECT count(*) = 2 FROM storage.objects WHERE bucket_id = 'other-app'), 'unrelated public bucket remains readable');
RESET ROLE;
RESET SESSION AUTHORIZATION;

SET SESSION AUTHORIZATION authenticator;
SET ROLE authenticated;
SET request.jwt.claims = '{"role":"authenticated","sub":"10000000-0000-0000-0000-000000000001"}';
SELECT audit_test.assert((SELECT count(*) = 3 FROM public.performance_reviews), 'mapped active administrator reads all reviews');
SELECT audit_test.assert((SELECT count(*) = 1 FROM public.visits), 'mapped active administrator reads visit statistics');
SELECT audit_test.assert((SELECT count(*) = 5 FROM storage.objects WHERE bucket_id = 'employee-documents'), 'administrator can access all employee documents');
RESET ROLE;
RESET SESSION AUTHORIZATION;
SELECT audit_test.assert((SELECT public = false FROM storage.buckets WHERE id = 'employee-documents'), 'employee document bucket is private');
SELECT count(*) || ' database assertions passed' AS result FROM audit_test.results;
