-- Quick Fix: Disable RLS for Development
-- This allows the dashboard to read data without authentication issues
-- ⚠️ For development only! Enable RLS for production!

-- Disable Row Level Security on all tables
ALTER TABLE employees DISABLE ROW LEVEL SECURITY;
ALTER TABLE time_entries DISABLE ROW LEVEL SECURITY;
ALTER TABLE leave_requests DISABLE ROW LEVEL SECURITY;
ALTER TABLE overtime_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE time_tracking_summary DISABLE ROW LEVEL SECURITY;

-- Verify RLS is disabled
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE tablename IN ('employees', 'time_entries', 'leave_requests', 'overtime_logs', 'time_tracking_summary')
ORDER BY tablename;

-- Success message
DO $$ 
BEGIN 
  RAISE NOTICE '✅ RLS disabled for all time tracking tables';
  RAISE NOTICE '⚠️ This is for DEVELOPMENT only';
  RAISE NOTICE 'ℹ️ Your dashboard should now load without 406 errors';
END $$;
