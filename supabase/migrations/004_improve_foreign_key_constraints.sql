-- ============================================
-- IMPROVED FOREIGN KEY CONSTRAINTS
-- This migration ensures proper handling of employee deletions
-- ============================================

-- ============================================
-- 1. VERIFY AND FIX EXISTING CONSTRAINTS
-- ============================================

-- Drop existing constraints if they exist
ALTER TABLE IF EXISTS time_entries 
  DROP CONSTRAINT IF EXISTS time_entries_employee_id_fkey;

ALTER TABLE IF EXISTS time_entries 
  DROP CONSTRAINT IF EXISTS time_entries_approved_by_fkey;

ALTER TABLE IF EXISTS leave_requests 
  DROP CONSTRAINT IF EXISTS leave_requests_employee_id_fkey;

ALTER TABLE IF EXISTS leave_requests 
  DROP CONSTRAINT IF EXISTS leave_requests_approved_by_fkey;

ALTER TABLE IF EXISTS overtime_logs 
  DROP CONSTRAINT IF EXISTS overtime_logs_employee_id_fkey;

ALTER TABLE IF EXISTS overtime_logs 
  DROP CONSTRAINT IF EXISTS overtime_logs_approved_by_fkey;

ALTER TABLE IF EXISTS time_tracking_summary 
  DROP CONSTRAINT IF EXISTS time_tracking_summary_employee_id_fkey;

-- ============================================
-- 2. ADD IMPROVED CONSTRAINTS WITH CASCADE
-- ============================================

-- Time Entries: When employee is deleted, delete all their time entries
ALTER TABLE time_entries 
  ADD CONSTRAINT time_entries_employee_id_fkey 
  FOREIGN KEY (employee_id) 
  REFERENCES employees(id) 
  ON DELETE CASCADE;

-- Time Entries: When approver is deleted, set approved_by to NULL
ALTER TABLE time_entries 
  ADD CONSTRAINT time_entries_approved_by_fkey 
  FOREIGN KEY (approved_by) 
  REFERENCES employees(id) 
  ON DELETE SET NULL;

-- Leave Requests: When employee is deleted, delete all their leave requests
ALTER TABLE leave_requests 
  ADD CONSTRAINT leave_requests_employee_id_fkey 
  FOREIGN KEY (employee_id) 
  REFERENCES employees(id) 
  ON DELETE CASCADE;

-- Leave Requests: When approver is deleted, set approved_by to NULL
ALTER TABLE leave_requests 
  ADD CONSTRAINT leave_requests_approved_by_fkey 
  FOREIGN KEY (approved_by) 
  REFERENCES employees(id) 
  ON DELETE SET NULL;

-- Overtime Logs: When employee is deleted, delete all their overtime logs
ALTER TABLE overtime_logs 
  ADD CONSTRAINT overtime_logs_employee_id_fkey 
  FOREIGN KEY (employee_id) 
  REFERENCES employees(id) 
  ON DELETE CASCADE;

-- Overtime Logs: When approver is deleted, set approved_by to NULL
ALTER TABLE overtime_logs 
  ADD CONSTRAINT overtime_logs_approved_by_fkey 
  FOREIGN KEY (approved_by) 
  REFERENCES employees(id) 
  ON DELETE SET NULL;

-- Time Tracking Summary: When employee is deleted, delete their summary
ALTER TABLE time_tracking_summary 
  ADD CONSTRAINT time_tracking_summary_employee_id_fkey 
  FOREIGN KEY (employee_id) 
  REFERENCES employees(id) 
  ON DELETE CASCADE;

-- ============================================
-- 3. CREATE FUNCTION TO CHECK FOR ORPHANED RECORDS
-- ============================================

CREATE OR REPLACE FUNCTION check_orphaned_time_entries()
RETURNS TABLE (
  table_name TEXT,
  record_id BIGINT,
  employee_id INTEGER,
  message TEXT
) AS $$
BEGIN
  -- Check time_entries
  RETURN QUERY
  SELECT 
    'time_entries'::TEXT,
    te.id,
    te.employee_id,
    'Time entry exists for non-existent employee'::TEXT
  FROM time_entries te
  LEFT JOIN employees e ON te.employee_id = e.id
  WHERE e.id IS NULL;

  -- Check leave_requests
  RETURN QUERY
  SELECT 
    'leave_requests'::TEXT,
    lr.id,
    lr.employee_id,
    'Leave request exists for non-existent employee'::TEXT
  FROM leave_requests lr
  LEFT JOIN employees e ON lr.employee_id = e.id
  WHERE e.id IS NULL;

  -- Check overtime_logs
  RETURN QUERY
  SELECT 
    'overtime_logs'::TEXT,
    ol.id,
    ol.employee_id,
    'Overtime log exists for non-existent employee'::TEXT
  FROM overtime_logs ol
  LEFT JOIN employees e ON ol.employee_id = e.id
  WHERE e.id IS NULL;

  -- Check time_tracking_summary
  RETURN QUERY
  SELECT 
    'time_tracking_summary'::TEXT,
    ts.id,
    ts.employee_id,
    'Summary exists for non-existent employee'::TEXT
  FROM time_tracking_summary ts
  LEFT JOIN employees e ON ts.employee_id = e.id
  WHERE e.id IS NULL;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 4. CREATE FUNCTION TO CLEAN ORPHANED RECORDS
-- ============================================

CREATE OR REPLACE FUNCTION clean_orphaned_records()
RETURNS TABLE (
  table_name TEXT,
  records_deleted BIGINT
) AS $$
DECLARE
  deleted_count BIGINT;
BEGIN
  -- Clean time_entries
  DELETE FROM time_entries te
  WHERE NOT EXISTS (
    SELECT 1 FROM employees e WHERE e.id = te.employee_id
  );
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RETURN QUERY SELECT 'time_entries'::TEXT, deleted_count;

  -- Clean leave_requests
  DELETE FROM leave_requests lr
  WHERE NOT EXISTS (
    SELECT 1 FROM employees e WHERE e.id = lr.employee_id
  );
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RETURN QUERY SELECT 'leave_requests'::TEXT, deleted_count;

  -- Clean overtime_logs
  DELETE FROM overtime_logs ol
  WHERE NOT EXISTS (
    SELECT 1 FROM employees e WHERE e.id = ol.employee_id
  );
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RETURN QUERY SELECT 'overtime_logs'::TEXT, deleted_count;

  -- Clean time_tracking_summary
  DELETE FROM time_tracking_summary ts
  WHERE NOT EXISTS (
    SELECT 1 FROM employees e WHERE e.id = ts.employee_id
  );
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RETURN QUERY SELECT 'time_tracking_summary'::TEXT, deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 5. CREATE INDEXES FOR PERFORMANCE
-- ============================================

-- Index on employee_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_time_entries_employee_id ON time_entries(employee_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_employee_id ON leave_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_overtime_logs_employee_id ON overtime_logs(employee_id);
CREATE INDEX IF NOT EXISTS idx_time_tracking_summary_employee_id ON time_tracking_summary(employee_id);

-- Index on approved_by for faster lookups
CREATE INDEX IF NOT EXISTS idx_time_entries_approved_by ON time_entries(approved_by) WHERE approved_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leave_requests_approved_by ON leave_requests(approved_by) WHERE approved_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_overtime_logs_approved_by ON overtime_logs(approved_by) WHERE approved_by IS NOT NULL;

-- ============================================
-- 6. USAGE EXAMPLES (COMMENTED OUT)
-- ============================================

-- To check for orphaned records:
-- SELECT * FROM check_orphaned_time_entries();

-- To clean orphaned records (use with caution):
-- SELECT * FROM clean_orphaned_records();

-- ============================================
-- MIGRATION NOTES:
-- ============================================
-- 1. This migration sets up proper CASCADE behavior for employee deletions
-- 2. When an employee is deleted, all their time entries, leave requests, 
--    overtime logs, and summaries are automatically deleted
-- 3. When an approver employee is deleted, the approved_by field is set to NULL
--    (records are preserved but approver info is removed)
-- 4. Helper functions are provided to check for and clean orphaned records
-- 5. Indexes improve query performance for foreign key lookups
