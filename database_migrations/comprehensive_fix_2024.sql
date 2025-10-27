-- ============================================================
-- COMPREHENSIVE DATABASE FIX MIGRATION
-- Fixes:
-- 1. hr_users table and constraints
-- 2. Foreign key references 
-- 3. User-Employee synchronization
-- 4. Deletion constraints
-- ============================================================

-- Create hr_users table if it doesn't exist
CREATE TABLE IF NOT EXISTS hr_users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255) UNIQUE NOT NULL,
  full_name VARCHAR(255),
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  phone VARCHAR(50),
  avatar_url TEXT,
  role VARCHAR(50) DEFAULT 'employee',
  department VARCHAR(100),
  position VARCHAR(100),
  employee_id INTEGER REFERENCES employees(id) ON DELETE SET NULL,
  manager_id UUID REFERENCES hr_users(id) ON DELETE SET NULL,
  hire_date DATE,
  employment_status VARCHAR(50) DEFAULT 'active',
  salary DECIMAL(12, 2),
  is_active BOOLEAN DEFAULT true,
  last_login TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add missing columns to hr_users if they don't exist
DO $$
BEGIN
    -- Add employee_id column if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'hr_users' AND column_name = 'employee_id') THEN
        ALTER TABLE hr_users ADD COLUMN employee_id INTEGER REFERENCES employees(id) ON DELETE SET NULL;
    END IF;
    
    -- Add full_name column if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'hr_users' AND column_name = 'full_name') THEN
        ALTER TABLE hr_users ADD COLUMN full_name VARCHAR(255);
    END IF;
    
    -- Add position column if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'hr_users' AND column_name = 'position') THEN
        ALTER TABLE hr_users ADD COLUMN position VARCHAR(100);
    END IF;
    
    -- Add department column if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'hr_users' AND column_name = 'department') THEN
        ALTER TABLE hr_users ADD COLUMN department VARCHAR(100);
    END IF;
END $$;

-- ============================================================
-- SYNC EXISTING EMPLOYEES WITH HR_USERS
-- ============================================================

-- First, update existing hr_users records to link with employees
UPDATE hr_users hu
SET 
    employee_id = e.id,
    full_name = COALESCE(hu.full_name, e.name),
    department = COALESCE(hu.department, e.department),
    position = COALESCE(hu.position, e.position)
FROM employees e
WHERE hu.email = e.email 
  AND hu.employee_id IS NULL;

-- Update role based on position for existing users
UPDATE hr_users
SET role = CASE 
    WHEN position = 'general_manager' THEN 'admin'
    WHEN position = 'hr_specialist' THEN 'hr_manager'
    WHEN position IN ('manager', 'senior_developer') THEN 'manager'
    ELSE 'employee'
END
WHERE role IS NULL OR role = 'employee';

-- ============================================================
-- FIX FOREIGN KEY CONSTRAINTS
-- ============================================================

-- Drop problematic constraints
DO $$
BEGIN
    -- Drop time_clock_entries constraint (table doesn't exist)
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints 
               WHERE constraint_name = 'time_clock_entries_user_id_fkey') THEN
        ALTER TABLE time_clock_entries DROP CONSTRAINT time_clock_entries_user_id_fkey;
    END IF;
    
    -- Drop incorrect time_entries constraints
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints 
               WHERE constraint_name = 'time_entries_user_id_fkey') THEN
        ALTER TABLE time_entries DROP CONSTRAINT time_entries_user_id_fkey;
    END IF;
    
    -- Drop and recreate leave_requests constraint
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints 
               WHERE constraint_name = 'leave_requests_employee_id_fkey') THEN
        ALTER TABLE leave_requests DROP CONSTRAINT leave_requests_employee_id_fkey;
    END IF;
    
    -- Drop and recreate overtime_logs constraint
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints 
               WHERE constraint_name = 'overtime_logs_employee_id_fkey') THEN
        ALTER TABLE overtime_logs DROP CONSTRAINT overtime_logs_employee_id_fkey;
    END IF;
END $$;

-- Add proper constraints for time_entries (uses employee_id, not user_id)
ALTER TABLE time_entries 
    DROP CONSTRAINT IF EXISTS time_entries_employee_id_fkey,
    ADD CONSTRAINT time_entries_employee_id_fkey 
    FOREIGN KEY (employee_id) 
    REFERENCES employees(id) 
    ON DELETE CASCADE;

-- Add proper constraints for leave_requests
ALTER TABLE leave_requests 
    ADD CONSTRAINT leave_requests_employee_id_fkey 
    FOREIGN KEY (employee_id) 
    REFERENCES employees(id) 
    ON DELETE CASCADE;

-- Add proper constraints for overtime_logs
ALTER TABLE overtime_logs 
    ADD CONSTRAINT overtime_logs_employee_id_fkey 
    FOREIGN KEY (employee_id) 
    REFERENCES employees(id) 
    ON DELETE CASCADE;

-- Add constraint for hr_users manager reference
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE constraint_name = 'hr_users_manager_id_fkey') THEN
        ALTER TABLE hr_users 
            ADD CONSTRAINT hr_users_manager_id_fkey 
            FOREIGN KEY (manager_id) 
            REFERENCES hr_users(id) 
            ON DELETE SET NULL;
    END IF;
END $$;

-- ============================================================
-- CREATE INDEXES FOR PERFORMANCE
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_hr_users_email ON hr_users(email);
CREATE INDEX IF NOT EXISTS idx_hr_users_employee_id ON hr_users(employee_id);
CREATE INDEX IF NOT EXISTS idx_hr_users_manager_id ON hr_users(manager_id);
CREATE INDEX IF NOT EXISTS idx_employees_email ON employees(email);
CREATE INDEX IF NOT EXISTS idx_time_entries_employee_id ON time_entries(employee_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_employee_id ON leave_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_overtime_logs_employee_id ON overtime_logs(employee_id);

-- ============================================================
-- CREATE TRIGGER FOR UPDATED_AT
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to hr_users if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_hr_users_updated_at') THEN
        CREATE TRIGGER update_hr_users_updated_at 
            BEFORE UPDATE ON hr_users
            FOR EACH ROW 
            EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- ============================================================
-- CLEAN UP DUPLICATE USERS
-- ============================================================

-- Delete duplicate hr_users entries (keep the one with employee_id)
DELETE FROM hr_users
WHERE id IN (
    SELECT id FROM (
        SELECT id,
               ROW_NUMBER() OVER (PARTITION BY email ORDER BY employee_id DESC NULLS LAST, created_at ASC) as rn
        FROM hr_users
    ) t
    WHERE t.rn > 1
);

-- ============================================================
-- VERIFICATION QUERIES
-- ============================================================

-- Query to check user-employee linkage
SELECT 
    hu.id,
    hu.email,
    hu.full_name as user_name,
    hu.employee_id,
    e.name as employee_name,
    hu.role,
    hu.position,
    hu.department
FROM hr_users hu
LEFT JOIN employees e ON hu.employee_id = e.id
ORDER BY hu.email;

-- Query to check constraints
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
  AND tc.table_name IN ('hr_users', 'time_entries', 'leave_requests', 'overtime_logs')
ORDER BY tc.table_name;

-- ============================================================
-- SUCCESS MESSAGE
-- ============================================================
SELECT 'Database fix migration completed successfully! ✅' AS status;
