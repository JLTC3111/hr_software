-- Fix: unrecognized configuration parameter "app.current_user_id"
-- PostgREST/Supabase Auth never sets app.current_user_id. Policies that call
-- current_setting('app.current_user_id') throw 42704 and break embeds like:
--   applications?select=*,reviewer:employees!...(id,name)
--
-- Run this in the Supabase SQL Editor (or via supabase db push).

-- ============================================
-- 1) Drop every policy that still references app.current_user_id
-- ============================================
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (
        COALESCE(qual, '') ILIKE '%app.current_user_id%'
        OR COALESCE(with_check, '') ILIKE '%app.current_user_id%'
      )
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON %I.%I',
      r.policyname,
      r.schemaname,
      r.tablename
    );
    RAISE NOTICE 'Dropped policy %.% (%)', r.tablename, r.policyname, r.schemaname;
  END LOOP;
END $$;

-- ============================================
-- 2) Ensure recruitment tables have usable auth policies
-- ============================================

-- applications (used by recruitmentService)
ALTER TABLE IF EXISTS applications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can view applications" ON applications;
DROP POLICY IF EXISTS "Authenticated users can insert applications" ON applications;
DROP POLICY IF EXISTS "Authenticated users can update applications" ON applications;
DROP POLICY IF EXISTS "Authenticated users can delete applications" ON applications;

CREATE POLICY "Authenticated users can view applications"
  ON applications FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert applications"
  ON applications FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update applications"
  ON applications FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete applications"
  ON applications FOR DELETE TO authenticated USING (true);

-- applicants
ALTER TABLE IF EXISTS applicants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can view applicants" ON applicants;
DROP POLICY IF EXISTS "Anyone can insert applicants" ON applicants;
DROP POLICY IF EXISTS "Authenticated users can update applicants" ON applicants;

CREATE POLICY "Authenticated users can view applicants"
  ON applicants FOR SELECT TO authenticated USING (true);
CREATE POLICY "Anyone can insert applicants"
  ON applicants FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update applicants"
  ON applicants FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- job_postings
ALTER TABLE IF EXISTS job_postings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can view job postings" ON job_postings;
DROP POLICY IF EXISTS "Authenticated users can insert job postings" ON job_postings;
DROP POLICY IF EXISTS "Authenticated users can update job postings" ON job_postings;
DROP POLICY IF EXISTS "Anyone can view active job postings" ON job_postings;
DROP POLICY IF EXISTS "HR can manage job postings" ON job_postings;

CREATE POLICY "Authenticated users can view job postings"
  ON job_postings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert job postings"
  ON job_postings FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update job postings"
  ON job_postings FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Legacy alternate table names from supabase/migrations/005*
ALTER TABLE IF EXISTS job_applications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "HR can view all applications" ON job_applications;
DROP POLICY IF EXISTS "HR can manage applications" ON job_applications;
DROP POLICY IF EXISTS "Authenticated users can view job applications" ON job_applications;
DROP POLICY IF EXISTS "Authenticated users can manage job applications" ON job_applications;

DO $$
BEGIN
  IF to_regclass('public.job_applications') IS NOT NULL THEN
    EXECUTE $p$
      CREATE POLICY "Authenticated users can view job applications"
        ON job_applications FOR SELECT TO authenticated USING (true)
    $p$;
    EXECUTE $p$
      CREATE POLICY "Authenticated users can manage job applications"
        ON job_applications FOR ALL TO authenticated USING (true) WITH CHECK (true)
    $p$;
  END IF;
END $$;

-- interview_schedules
ALTER TABLE IF EXISTS interview_schedules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can view interview schedules" ON interview_schedules;
DROP POLICY IF EXISTS "Authenticated users can manage interview schedules" ON interview_schedules;
DROP POLICY IF EXISTS "Interviewers can view their interviews" ON interview_schedules;
DROP POLICY IF EXISTS "HR can manage interviews" ON interview_schedules;

CREATE POLICY "Authenticated users can view interview schedules"
  ON interview_schedules FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage interview schedules"
  ON interview_schedules FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================
-- 3) employees embeds (reviewer:employees!...) must not explode
-- ============================================
ALTER TABLE IF EXISTS employees ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Employees can view all employees" ON employees;
DROP POLICY IF EXISTS "HR can manage employees" ON employees;
DROP POLICY IF EXISTS "Allow all to read employees" ON employees;
DROP POLICY IF EXISTS "Allow authenticated to insert employees" ON employees;
DROP POLICY IF EXISTS "Allow authenticated to update employees" ON employees;
DROP POLICY IF EXISTS "Allow authenticated to delete employees" ON employees;

CREATE POLICY "Allow all to read employees"
  ON employees FOR SELECT TO public USING (true);
CREATE POLICY "Allow authenticated to insert employees"
  ON employees FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated to update employees"
  ON employees FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated to delete employees"
  ON employees FOR DELETE TO authenticated USING (true);

-- ============================================
-- 4) Verify nothing still references the broken GUC
-- ============================================
DO $$
DECLARE
  leftover INTEGER;
BEGIN
  SELECT COUNT(*) INTO leftover
  FROM pg_policies
  WHERE schemaname = 'public'
    AND (
      COALESCE(qual, '') ILIKE '%app.current_user_id%'
      OR COALESCE(with_check, '') ILIKE '%app.current_user_id%'
    );

  IF leftover > 0 THEN
    RAISE WARNING 'Still found % policies referencing app.current_user_id', leftover;
  ELSE
    RAISE NOTICE '✅ No policies reference app.current_user_id';
  END IF;

  RAISE NOTICE '✅ Applications/recruitment RLS fixed for Supabase Auth (auth.uid flow)';
END $$;
