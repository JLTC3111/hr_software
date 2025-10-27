-- ============================================================
-- Fix time_tracking_summary Foreign Key Constraint
-- ============================================================
-- This script adds CASCADE delete to time_tracking_summary
-- so that when an employee is deleted, their summary records
-- are also deleted automatically.
-- ============================================================

-- Drop existing constraint if it exists
ALTER TABLE IF EXISTS time_tracking_summary 
  DROP CONSTRAINT IF EXISTS time_tracking_summary_employee_id_fkey;

-- Add new constraint with CASCADE delete
ALTER TABLE time_tracking_summary
  ADD CONSTRAINT time_tracking_summary_employee_id_fkey 
  FOREIGN KEY (employee_id) 
  REFERENCES employees(id) 
  ON DELETE CASCADE;

-- Verify the constraint
SELECT
    tc.table_name, 
    tc.constraint_name, 
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name,
    rc.delete_rule
FROM information_schema.table_constraints AS tc 
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
    LEFT JOIN information_schema.referential_constraints AS rc
      ON tc.constraint_name = rc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND tc.table_name = 'time_tracking_summary'
  AND ccu.table_name = 'employees';

SELECT '✅ time_tracking_summary CASCADE constraint added successfully!' AS status;
