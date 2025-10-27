-- ============================================================
-- User Deletion Setup - Foreign Key Constraints
-- ============================================================
-- This script sets up proper foreign key constraints to handle
-- user deletion gracefully. Run this in Supabase SQL Editor.
-- ============================================================

-- Option 1: SET NULL on delete (RECOMMENDED - preserves data)
-- When a user is deleted, related records keep their data but lose the user reference
-- ============================================================

-- Drop existing constraints if they exist
ALTER TABLE IF EXISTS employees 
  DROP CONSTRAINT IF EXISTS employees_employee_id_fkey;

ALTER TABLE IF EXISTS time_entries 
  DROP CONSTRAINT IF EXISTS time_entries_user_id_fkey;

ALTER TABLE IF EXISTS leave_requests 
  DROP CONSTRAINT IF EXISTS leave_requests_employee_id_fkey;

ALTER TABLE IF EXISTS overtime_logs 
  DROP CONSTRAINT IF EXISTS overtime_logs_employee_id_fkey;

ALTER TABLE IF EXISTS hr_users 
  DROP CONSTRAINT IF EXISTS hr_users_manager_id_fkey;

-- Add new constraints with ON DELETE SET NULL
-- This means when a user is deleted, the foreign key is set to NULL

-- 1. EMPLOYEES TABLE
-- Note: hr_users already has employee_id that references employees.id
-- We don't need to add another column. The existing employee_id in hr_users
-- should be set to NULL when the linked employee is deleted.

-- First, check if the constraint exists on hr_users.employee_id
-- This links hr_users -> employees (the reverse direction)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'hr_users_employee_id_fkey'
    ) THEN
        ALTER TABLE hr_users
        ADD CONSTRAINT hr_users_employee_id_fkey
        FOREIGN KEY (employee_id)
        REFERENCES employees(id)
        ON DELETE SET NULL;
    END IF;
END $$;

-- 2. TIME ENTRIES
DO $$ 
BEGIN
    -- Check if time_entries table exists and has user_id column
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'time_entries' AND column_name = 'user_id'
    ) THEN
        -- Drop existing constraint if it exists
        IF EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE constraint_name = 'time_entries_user_id_fkey'
        ) THEN
            ALTER TABLE time_entries DROP CONSTRAINT time_entries_user_id_fkey;
        END IF;
        
        -- Add new constraint with SET NULL
        ALTER TABLE time_entries
        ADD CONSTRAINT time_entries_user_id_fkey
        FOREIGN KEY (user_id)
        REFERENCES hr_users(id)
        ON DELETE SET NULL;
    ELSE
        RAISE NOTICE 'time_entries table does not have user_id column, using employee_id instead';
        
        -- Handle employee_id constraint if it exists
        IF EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE constraint_name = 'time_entries_employee_id_fkey'
        ) THEN
            ALTER TABLE time_entries DROP CONSTRAINT time_entries_employee_id_fkey;
        END IF;
        
        -- Add constraint for employee_id to reference employees table
        ALTER TABLE time_entries
        ADD CONSTRAINT time_entries_employee_id_fkey
        FOREIGN KEY (employee_id)
        REFERENCES employees(id)
        ON DELETE CASCADE;
    END IF;
END $$;

-- 3. LEAVE REQUESTS
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'leave_requests_employee_id_fkey'
    ) THEN
        ALTER TABLE leave_requests DROP CONSTRAINT leave_requests_employee_id_fkey;
    END IF;
    
    ALTER TABLE leave_requests
    ADD CONSTRAINT leave_requests_employee_id_fkey
    FOREIGN KEY (employee_id)
    REFERENCES hr_users(id)
    ON DELETE SET NULL;
END $$;

-- 4. OVERTIME LOGS
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'overtime_logs_employee_id_fkey'
    ) THEN
        ALTER TABLE overtime_logs DROP CONSTRAINT overtime_logs_employee_id_fkey;
    END IF;
    
    ALTER TABLE overtime_logs
    ADD CONSTRAINT overtime_logs_employee_id_fkey
    FOREIGN KEY (employee_id)
    REFERENCES hr_users(id)
    ON DELETE SET NULL;
END $$;

-- 5. MANAGER REFERENCE (hr_users self-reference)
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'hr_users_manager_id_fkey'
    ) THEN
        ALTER TABLE hr_users DROP CONSTRAINT hr_users_manager_id_fkey;
    END IF;
    
    ALTER TABLE hr_users
    ADD CONSTRAINT hr_users_manager_id_fkey
    FOREIGN KEY (manager_id)
    REFERENCES hr_users(id)
    ON DELETE SET NULL;
END $$;

-- ============================================================
-- Option 2: CASCADE Delete (CAUTION - deletes related data)
-- Uncomment the code below if you want to delete all related
-- records when a user is deleted. WARNING: This is destructive!
-- ============================================================

-- Drop existing constraints
ALTER TABLE IF EXISTS time_entries 
  DROP CONSTRAINT IF EXISTS time_entries_employee_id_fkey;

ALTER TABLE IF EXISTS leave_requests 
  DROP CONSTRAINT IF EXISTS leave_requests_employee_id_fkey;

ALTER TABLE IF EXISTS overtime_logs 
  DROP CONSTRAINT IF EXISTS overtime_logs_employee_id_fkey;

-- Add CASCADE delete constraints
ALTER TABLE time_entries
  ADD CONSTRAINT time_entries_employee_id_fkey 
  FOREIGN KEY (employee_id) 
  REFERENCES hr_users(id) 
  ON DELETE CASCADE;

ALTER TABLE leave_requests
  ADD CONSTRAINT leave_requests_employee_id_fkey 
  FOREIGN KEY (employee_id) 
  REFERENCES hr_users(id) 
  ON DELETE CASCADE;

ALTER TABLE overtime_logs
  ADD CONSTRAINT overtime_logs_employee_id_fkey 
  FOREIGN KEY (employee_id) 
  REFERENCES hr_users(id) 
  ON DELETE CASCADE;

-- ============================================================
-- Verify constraints
-- ============================================================
-- Run this query to verify the constraints are properly set
SELECT
    tc.table_name, 
    tc.constraint_name, 
    tc.constraint_type,
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
  AND ccu.table_name = 'hr_users'
ORDER BY tc.table_name;

-- ============================================================
-- Create indexes for better performance
-- ============================================================

-- Index on employee_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_employees_employee_id 
  ON employees(employee_id);

-- Index on user_id in time_entries (if column exists)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'time_entries' AND column_name = 'user_id'
    ) THEN
        CREATE INDEX IF NOT EXISTS idx_time_entries_user_id 
          ON time_entries(user_id);
    END IF;
END $$;

-- Index on employee_id in leave_requests
CREATE INDEX IF NOT EXISTS idx_leave_requests_employee_id 
  ON leave_requests(employee_id);

-- Index on employee_id in overtime_logs
CREATE INDEX IF NOT EXISTS idx_overtime_logs_employee_id 
  ON overtime_logs(employee_id);

-- Index on manager_id in hr_users
CREATE INDEX IF NOT EXISTS idx_hr_users_manager_id 
  ON hr_users(manager_id);

-- ============================================================
-- Success message
-- ============================================================
SELECT 'Foreign key constraints updated successfully! ✅' AS status;
