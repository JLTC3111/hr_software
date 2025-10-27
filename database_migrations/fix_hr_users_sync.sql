-- ============================================================
-- FIX HR_USERS SYNC AND MIGRATE ALL EMPLOYEES
-- Fixes the mismatch between auth user IDs and hr_users IDs
-- ============================================================

-- ============================================================
-- STEP 1: CLEAN UP INVALID HR_USERS ENTRIES
-- Remove entries where id is not a valid UUID or doesn't exist in auth.users
-- ============================================================
SELECT 
    au.id,
    au.email,
    -- Get data from hr_users if it exists
    hu.position,
    hu.employee_id,
    CASE 
        WHEN hu.id IS NOT NULL THEN '✅ HR User Exists'
        ELSE '❌ Missing HR User Entry' -- This is the status for your business logic
    END as status
FROM auth.users au -- Start from the AUTH table to get all 9 users
LEFT JOIN hr_users hu ON au.id = hu.id -- Join to hr_users
ORDER BY au.created_at;

-- First, let's see what we have
SELECT 
    hu.id,
    hu.email,
    hu.position,
    hu.employee_id,
    CASE 
        WHEN au.id IS NOT NULL THEN '✅ Valid Auth User'
        WHEN hu.id::text ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN '⚠️ Valid UUID but no Auth User'
        ELSE '❌ Invalid ID (not UUID)'
    END as status
FROM hr_users hu
LEFT JOIN auth.users au ON hu.id = au.id
ORDER BY hu.id;

-- Delete hr_users entries that don't have valid auth user IDs
-- This includes integer IDs like "16" which should never exist
DELETE FROM hr_users
WHERE id NOT IN (
    SELECT id FROM auth.users
);

-- ============================================================
-- STEP 2: CREATE OR UPDATE HR_USERS FOR ALL EMPLOYEES WITH AUTH ACCOUNTS
-- ============================================================

WITH DedupedEmployees AS (
    SELECT
        e.*,
        au.id AS auth_id,
        -- Assign a rank to employee records based on the auth user ID
        -- PRIORITIZE employees with a later start_date (or use created_at)
        ROW_NUMBER() OVER (
            PARTITION BY au.id 
            ORDER BY e.start_date DESC -- You can change this to prioritize another column
        ) as rn
    FROM employees e
    INNER JOIN auth.users au 
        -- This join creates the potential duplicates because one au.email can be in multiple e.email strings
        ON POSITION(au.email IN e.email) > 0 
)
INSERT INTO hr_users (
    id, email, first_name, last_name, phone, avatar_url, role, department, position, employee_id, hire_date, employment_status, is_active, created_at
)
SELECT 
    de.auth_id as id,
    SPLIT_PART(de.email, ',', 1) as email,
    split_part(de.name, ' ', 1) as first_name,
    substring(de.name from length(split_part(de.name, ' ', 1)) + 2) as last_name,
    de.phone,
    de.photo as avatar_url,
    -- NOTE: Ensure 'manager' is used instead of 'hr_manager' if the 'valid_role' constraint forbids 'hr_manager'
    CASE 
        WHEN de.position = 'general_manager' THEN 'admin'
        WHEN de.position = 'managing_director' THEN 'admin'
        WHEN de.position = 'hr_specialist' THEN 'manager' -- Changed to 'manager' to satisfy the CHECK constraint
        WHEN de.position IN ('senior_developer', 'contract_manager') THEN 'manager'
        ELSE 'employee'
    END as role,
    de.department,
    de.position,
    de.id as employee_id,
    de.start_date as hire_date,
    CASE 
        WHEN de.status = 'Active' THEN 'active'
        WHEN de.status = 'onLeave' THEN 'on_leave'
        WHEN de.status = 'Inactive' THEN 'terminated'
        ELSE 'active'
    END as employment_status,
    CASE 
        WHEN de.status = 'Inactive' THEN false
        ELSE true
    END as is_active,
    COALESCE(de.created_at, now()) as created_at
FROM DedupedEmployees de
WHERE de.rn = 1 -- <--- CRITICAL FIX: Only select the first, non-duplicate match
ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    phone = EXCLUDED.phone,
    avatar_url = EXCLUDED.avatar_url,
    role = EXCLUDED.role,
    department = EXCLUDED.department,
    position = EXCLUDED.position,
    employee_id = EXCLUDED.employee_id,
    hire_date = EXCLUDED.hire_date,
    employment_status = EXCLUDED.employment_status,
    is_active = EXCLUDED.is_active,
    updated_at = now();

-- Sync employees to hr_users where auth users exist
INSERT INTO hr_users (
    id,
    email,
    first_name,
    last_name,
    phone,
    avatar_url,
    role,
    department,
    position,
    employee_id,
    hire_date,
    employment_status,
    is_active,
    created_at
)
SELECT 
    au.id as id,
    e.email,
    split_part(e.name, ' ', 1) as first_name,
    substring(e.name from length(split_part(e.name, ' ', 1)) + 2) as last_name,
    e.phone,
    e.photo as avatar_url,
    CASE 
        WHEN e.position = 'general_manager' THEN 'admin'
        WHEN e.position = 'managing_director' THEN 'admin'
        WHEN e.position = 'hr_specialist' THEN 'hr_manager'
        WHEN e.position IN ('senior_developer', 'contract_manager') THEN 'manager'
        ELSE 'employee'
    END as role,
    e.department,
    e.position,
    e.id as employee_id,
    e.start_date as hire_date,
    CASE 
        WHEN e.status = 'Active' THEN 'active'
        WHEN e.status = 'onLeave' THEN 'on_leave'
        WHEN e.status = 'Inactive' THEN 'terminated'
        ELSE 'active'
    END as employment_status,
    CASE 
        WHEN e.status = 'Inactive' THEN false
        ELSE true
    END as is_active,
    COALESCE(e.created_at, now()) as created_at
FROM employees e
INNER JOIN auth.users au ON e.email = au.email
ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    phone = EXCLUDED.phone,
    avatar_url = EXCLUDED.avatar_url,
    role = EXCLUDED.role,
    department = EXCLUDED.department,
    position = EXCLUDED.position,
    employee_id = EXCLUDED.employee_id,
    hire_date = EXCLUDED.hire_date,
    employment_status = EXCLUDED.employment_status,
    is_active = EXCLUDED.is_active,
    updated_at = now();

-- ============================================================
-- STEP 3: IDENTIFY EMPLOYEES WITHOUT AUTH ACCOUNTS
-- ============================================================

-- List employees who don't have auth accounts yet
SELECT 
    e.id,
    e.name,
    e.email,
    e.position,
    e.department,
    '❌ No auth account - needs to be created' as status
FROM employees e
LEFT JOIN auth.users au ON e.email = au.email
WHERE au.id IS NULL
ORDER BY e.id;

-- ============================================================
-- STEP 4: FIX SPECIFIC CASE - dev@icue.vn
-- If you have a user with email dev@email.com but it should be dev@icue.vn
-- ============================================================

-- Check for email mismatches
SELECT 
    'Auth User' as source,
    au.id::text, -- <--- FIX: Explicitly cast UUID to TEXT
    au.email,
    au.created_at
FROM auth.users au
WHERE au.email LIKE '%dev%'

UNION ALL

SELECT 
    'Employee' as source,
    e.id::text,
    e.email,
    e.created_at
FROM employees e
WHERE e.email LIKE '%dev%'

UNION ALL

SELECT 
    'HR User' as source,
    hu.id::text,
    hu.email,
    hu.created_at
FROM hr_users hu
WHERE hu.email LIKE '%dev%'
ORDER BY email, created_at;

-- ============================================================
-- STEP 5: UPDATE AUTH USER EMAIL (IF NEEDED)
-- If you need to change auth user's email from dev@email.com to dev@icue.vn
-- This requires admin privileges
-- ============================================================

-- MANUAL ACTION REQUIRED:
-- If auth user has wrong email (dev@email.com instead of dev@icue.vn),
-- you need to update it via Supabase Dashboard:
-- 1. Go to Authentication > Users
-- 2. Find user with ID: 01616081-0a99-48c9-94e8-f6e57d8c2946
-- 3. Edit and change email to: dev@icue.vn
-- 
-- OR run this if you have service role access:
-- UPDATE auth.users SET email = 'dev@icue.vn' 
-- WHERE id = '01616081-0a99-48c9-94e8-f6e57d8c2946';

-- ============================================================
-- STEP 6: VERIFICATION QUERIES
-- ============================================================

-- Verify all employees are synced
SELECT 
    e.id as employee_id,
    e.name as employee_name,
    e.email,
    e.position,
    au.id as auth_id,
    hu.id as hr_user_id,
    hu.role,
    CASE 
        WHEN au.id IS NULL THEN '❌ No Auth Account'
        WHEN hu.id IS NULL THEN '⚠️ Has Auth but No HR User'
        WHEN au.id = hu.id THEN '✅ Fully Synced'
        ELSE '❌ ID Mismatch'
    END as sync_status
FROM employees e
LEFT JOIN auth.users au ON e.email = au.email
LEFT JOIN hr_users hu ON au.id = hu.id
ORDER BY e.id;

-- Count summary
SELECT 
    COUNT(DISTINCT e.id) as total_employees,
    COUNT(DISTINCT au.id) as employees_with_auth,
    COUNT(DISTINCT hu.id) as employees_with_hr_user,
    COUNT(DISTINCT CASE WHEN au.id = hu.id THEN e.id END) as fully_synced
FROM employees e
LEFT JOIN auth.users au ON e.email = au.email
LEFT JOIN hr_users hu ON au.id = hu.id AND hu.email = e.email;

-- Show any remaining issues
SELECT 
    'Invalid hr_users (no auth)' as issue_type,
    COUNT(*) as count
FROM hr_users hu
LEFT JOIN auth.users au ON hu.id = au.id
WHERE au.id IS NULL

UNION ALL

SELECT 
    'Employees without auth' as issue_type,
    COUNT(*) as count
FROM employees e
LEFT JOIN auth.users au ON e.email = au.email
WHERE au.id IS NULL

UNION ALL

SELECT 
    'Auth users without hr_users' as issue_type,
    COUNT(*) as count
FROM auth.users au
LEFT JOIN hr_users hu ON au.id = hu.id
WHERE hu.id IS NULL;

-- ============================================================
-- SUCCESS MESSAGE
-- ============================================================
SELECT '✅ Migration completed! Review verification queries above.' AS status;
