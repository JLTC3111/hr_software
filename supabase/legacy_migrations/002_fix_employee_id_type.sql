-- Migration to fix employee_id type mismatch
-- Changes employee_id from INTEGER to TEXT to support both integer IDs and UUIDs
-- Run this in Supabase SQL Editor AFTER running 001_time_tracking_tables.sql

-- ============================================
-- STEP 1: Drop existing foreign key constraints
-- ============================================

-- Drop constraints on time_entries
ALTER TABLE time_entries 
DROP CONSTRAINT IF EXISTS time_entries_employee_id_fkey;

ALTER TABLE time_entries 
DROP CONSTRAINT IF EXISTS time_entries_approved_by_fkey;

-- Drop constraints on leave_requests
ALTER TABLE leave_requests 
DROP CONSTRAINT IF EXISTS leave_requests_employee_id_fkey;

ALTER TABLE leave_requests 
DROP CONSTRAINT IF EXISTS leave_requests_approved_by_fkey;

-- Drop constraints on overtime_logs
ALTER TABLE overtime_logs 
DROP CONSTRAINT IF EXISTS overtime_logs_employee_id_fkey;

ALTER TABLE overtime_logs 
DROP CONSTRAINT IF EXISTS overtime_logs_approved_by_fkey;

-- Drop constraints on time_tracking_summary
ALTER TABLE time_tracking_summary 
DROP CONSTRAINT IF EXISTS time_tracking_summary_employee_id_fkey;

-- ============================================
-- STEP 2: Change employee ID type to TEXT
-- ============================================

-- Change employees.id to TEXT
ALTER TABLE employees 
ALTER COLUMN id TYPE TEXT USING id::TEXT;

-- Change time_entries
ALTER TABLE time_entries 
ALTER COLUMN employee_id TYPE TEXT USING employee_id::TEXT;

ALTER TABLE time_entries 
ALTER COLUMN approved_by TYPE TEXT USING approved_by::TEXT;

-- Change leave_requests
ALTER TABLE leave_requests 
ALTER COLUMN employee_id TYPE TEXT USING employee_id::TEXT;

ALTER TABLE leave_requests 
ALTER COLUMN approved_by TYPE TEXT USING approved_by::TEXT;

-- Change overtime_logs
ALTER TABLE overtime_logs 
ALTER COLUMN employee_id TYPE TEXT USING employee_id::TEXT;

ALTER TABLE overtime_logs 
ALTER COLUMN approved_by TYPE TEXT USING approved_by::TEXT;

-- Change time_tracking_summary
ALTER TABLE time_tracking_summary 
ALTER COLUMN employee_id TYPE TEXT USING employee_id::TEXT;

-- ============================================
-- STEP 3: Re-add foreign key constraints
-- ============================================

-- Add constraints back to time_entries
ALTER TABLE time_entries 
ADD CONSTRAINT time_entries_employee_id_fkey 
FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;

ALTER TABLE time_entries 
ADD CONSTRAINT time_entries_approved_by_fkey 
FOREIGN KEY (approved_by) REFERENCES employees(id);

-- Add constraints back to leave_requests
ALTER TABLE leave_requests 
ADD CONSTRAINT leave_requests_employee_id_fkey 
FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;

ALTER TABLE leave_requests 
ADD CONSTRAINT leave_requests_approved_by_fkey 
FOREIGN KEY (approved_by) REFERENCES employees(id);

-- Add constraints back to overtime_logs
ALTER TABLE overtime_logs 
ADD CONSTRAINT overtime_logs_employee_id_fkey 
FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;

ALTER TABLE overtime_logs 
ADD CONSTRAINT overtime_logs_approved_by_fkey 
FOREIGN KEY (approved_by) REFERENCES employees(id);

-- Add constraints back to time_tracking_summary
ALTER TABLE time_tracking_summary 
ADD CONSTRAINT time_tracking_summary_employee_id_fkey 
FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;

-- ============================================
-- VERIFICATION
-- ============================================

-- Check the updated column types
SELECT 
  table_name, 
  column_name, 
  data_type 
FROM information_schema.columns 
WHERE column_name IN ('id', 'employee_id', 'approved_by')
  AND table_name IN ('employees', 'time_entries', 'leave_requests', 'overtime_logs', 'time_tracking_summary')
ORDER BY table_name, column_name;

-- Success message
DO $$ 
BEGIN 
  RAISE NOTICE '✅ Migration complete! employee_id now supports both integers and UUIDs';
END $$;
