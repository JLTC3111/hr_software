-- Existing rows under the old production schema exercise backfill and the
-- refusal to guess a bigint-to-UUID mapping for legacy interviews.
INSERT INTO public.employees (id,name,email) VALUES ('upgrade','Existing employee','upgrade@example.test');
INSERT INTO public.time_entries (employee_id,date,clock_in,clock_out,hours,status)
VALUES ('upgrade','2026-09-30','09:00','17:00',8,'approved');
INSERT INTO public.leave_requests (employee_id,leave_type,start_date,end_date,status)
VALUES ('upgrade','annual','2026-08-31','2026-09-02','approved');
INSERT INTO public.job_postings (id,title,department) VALUES (801,'Legacy fixture','Alpha');
INSERT INTO public.job_applications (id,job_posting_id,candidate_name,email)
VALUES (801,801,'Legacy candidate','legacy@example.test');
INSERT INTO public.interview_schedules (id,application_id,interview_type,scheduled_time)
VALUES (801,801,'video','2027-01-01 09:00:00+07');
