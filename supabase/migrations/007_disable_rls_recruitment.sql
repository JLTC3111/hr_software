-- Disable RLS for Recruitment and Performance Tables (Development)
-- This fixes the 400 error when fetching job applications and performance data
-- ⚠️ For development only! Enable RLS for production!

-- Disable Row Level Security on recruitment tables
ALTER TABLE job_postings DISABLE ROW LEVEL SECURITY;
ALTER TABLE job_applications DISABLE ROW LEVEL SECURITY;
ALTER TABLE interview_schedules DISABLE ROW LEVEL SECURITY;

-- Disable Row Level Security on performance tables
ALTER TABLE performance_reviews DISABLE ROW LEVEL SECURITY;
ALTER TABLE performance_goals DISABLE ROW LEVEL SECURITY;
ALTER TABLE goal_milestones DISABLE ROW LEVEL SECURITY;
ALTER TABLE skills_assessments DISABLE ROW LEVEL SECURITY;
ALTER TABLE employee_feedback DISABLE ROW LEVEL SECURITY;

-- Drop existing RLS policies (optional, but cleaner)
-- Recruitment policies
DROP POLICY IF EXISTS "Anyone can view active job postings" ON job_postings;
DROP POLICY IF EXISTS "HR can manage job postings" ON job_postings;
DROP POLICY IF EXISTS "HR can view all applications" ON job_applications;
DROP POLICY IF EXISTS "HR can manage applications" ON job_applications;
DROP POLICY IF EXISTS "Interviewers can view their interviews" ON interview_schedules;
DROP POLICY IF EXISTS "HR can manage interviews" ON interview_schedules;

-- Performance policies
DROP POLICY IF EXISTS "Employees can view their own reviews" ON performance_reviews;
DROP POLICY IF EXISTS "Managers can view team reviews" ON performance_reviews;
DROP POLICY IF EXISTS "Managers can create and update reviews" ON performance_reviews;
DROP POLICY IF EXISTS "Employees can view their goals" ON performance_goals;
DROP POLICY IF EXISTS "Managers can manage team goals" ON performance_goals;
DROP POLICY IF EXISTS "Employees can view their milestones" ON goal_milestones;
DROP POLICY IF EXISTS "Employees can view their skills" ON skills_assessments;
DROP POLICY IF EXISTS "Managers can view team skills" ON skills_assessments;
DROP POLICY IF EXISTS "Employees can view feedback they gave or received" ON employee_feedback;

-- Verify RLS is disabled
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE tablename IN (
  'job_postings', 'job_applications', 'interview_schedules',
  'performance_reviews', 'performance_goals', 'goal_milestones', 
  'skills_assessments', 'employee_feedback'
)
ORDER BY tablename;

-- Success message
DO $$ 
BEGIN 
  RAISE NOTICE '✅ RLS disabled for all recruitment and performance tables';
  RAISE NOTICE '⚠️ This is for DEVELOPMENT only';
  RAISE NOTICE 'ℹ️ Job applications and performance data should now load without 400 errors';
END $$;
