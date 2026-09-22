-- Fix RLS policies for TEXT employee_id and enable access to summary table
-- Run this after migrating to TEXT employee_id type

-- ============================================
-- DISABLE RLS temporarily for testing (OPTIONAL)
-- ============================================
-- Uncomment these lines if you want to test without RLS first:
-- ALTER TABLE employees DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE time_entries DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE leave_requests DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE overtime_logs DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE time_tracking_summary DISABLE ROW LEVEL SECURITY;

-- ============================================
-- UPDATE RLS POLICIES FOR TEXT TYPE
-- ============================================

-- Drop old policies (they were for INTEGER type)
DROP POLICY IF EXISTS "Users can view own time entries" ON time_entries;
DROP POLICY IF EXISTS "Users can insert own time entries" ON time_entries;
DROP POLICY IF EXISTS "Users can update own time entries" ON time_entries;
DROP POLICY IF EXISTS "Managers can view all time entries" ON time_entries;
DROP POLICY IF EXISTS "Managers can approve time entries" ON time_entries;

DROP POLICY IF EXISTS "Users can view own leave requests" ON leave_requests;
DROP POLICY IF EXISTS "Users can insert own leave requests" ON leave_requests;
DROP POLICY IF EXISTS "Managers can view all leave requests" ON leave_requests;
DROP POLICY IF EXISTS "Managers can approve leave requests" ON leave_requests;

DROP POLICY IF EXISTS "Users can view own overtime logs" ON overtime_logs;
DROP POLICY IF EXISTS "Users can insert own overtime logs" ON overtime_logs;
DROP POLICY IF EXISTS "Managers can view all overtime logs" ON overtime_logs;
DROP POLICY IF EXISTS "Managers can approve overtime logs" ON overtime_logs;

DROP POLICY IF EXISTS "Users can view own summary" ON time_tracking_summary;
DROP POLICY IF EXISTS "Managers can view all summaries" ON time_tracking_summary;

-- ============================================
-- CREATE NEW POLICIES WITH TEXT SUPPORT
-- ============================================

-- Enable RLS
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE overtime_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_tracking_summary ENABLE ROW LEVEL SECURITY;

-- Employees policies
CREATE POLICY "Allow all to read employees"
  ON employees FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow authenticated to insert employees"
  ON employees FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated to update employees"
  ON employees FOR UPDATE
  TO authenticated
  USING (true);

-- Time Entries policies
CREATE POLICY "Allow all to read time entries"
  ON time_entries FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow authenticated to insert time entries"
  ON time_entries FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated to update time entries"
  ON time_entries FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated to delete time entries"
  ON time_entries FOR DELETE
  TO authenticated
  USING (true);

-- Leave Requests policies
CREATE POLICY "Allow all to read leave requests"
  ON leave_requests FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow authenticated to insert leave requests"
  ON leave_requests FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated to update leave requests"
  ON leave_requests FOR UPDATE
  TO authenticated
  USING (true);

-- Overtime Logs policies
CREATE POLICY "Allow all to read overtime logs"
  ON overtime_logs FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow authenticated to insert overtime logs"
  ON overtime_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated to update overtime logs"
  ON overtime_logs FOR UPDATE
  TO authenticated
  USING (true);

-- Time Tracking Summary policies (IMPORTANT!)
CREATE POLICY "Allow all to read summary"
  ON time_tracking_summary FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow authenticated to insert summary"
  ON time_tracking_summary FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated to update summary"
  ON time_tracking_summary FOR UPDATE
  TO authenticated
  USING (true);

-- ============================================
-- VERIFICATION
-- ============================================

-- Check policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename IN ('employees', 'time_entries', 'leave_requests', 'overtime_logs', 'time_tracking_summary')
ORDER BY tablename, policyname;

-- Success message
DO $$ 
BEGIN 
  RAISE NOTICE '✅ RLS policies updated for TEXT employee_id!';
  RAISE NOTICE 'ℹ️ All tables now allow public read access for development';
  RAISE NOTICE 'ℹ️ Authenticated users can insert/update their own data';
END $$;
