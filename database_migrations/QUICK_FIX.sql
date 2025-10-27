-- ============================================================
-- QUICK FIX FOR USER SYNC ISSUES
-- Run this immediately in Supabase SQL Editor
-- ============================================================

-- ============================================================
-- BEFORE YOU RUN THIS:
-- 1. Go to Supabase Dashboard → Authentication → Users
-- 2. Find user ID: 01616081-0a99-48c9-94e8-f6e57d8c2946
-- 3. Change email from "dev@email.com" to "dev@icue.vn"
-- 4. Then come back and run this script
-- ============================================================

BEGIN;

-- Step 1: Show current problematic state
SELECT '=== BEFORE FIX ===' as stage;

SELECT 
    'Invalid hr_users entries' as issue,
    id,
    email,
    employee_id
FROM hr_users 
WHERE id::text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
   OR id NOT IN (SELECT id FROM auth.users);

-- Step 2: Delete invalid entries (like id=16)
DELETE FROM hr_users 
WHERE id::text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

DELETE FROM hr_users 
WHERE id NOT IN (SELECT id FROM auth.users);

-- Step 3: Sync all employees that have auth accounts
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
    au.id,
    e.email,
    split_part(e.name, ' ', 1),
    NULLIF(substring(e.name from length(split_part(e.name, ' ', 1)) + 2), ''),
    e.phone,
    e.photo,
    CASE 
        WHEN e.position IN ('general_manager', 'managing_director') THEN 'admin'
        WHEN e.position = 'hr_specialist' THEN 'hr_manager'
        WHEN e.position IN ('senior_developer', 'contract_manager') THEN 'manager'
        ELSE 'employee'
    END,
    e.department,
    e.position,
    e.id,
    e.start_date,
    CASE 
        WHEN e.status = 'Active' THEN 'active'
        WHEN e.status = 'onLeave' THEN 'on_leave'
        WHEN e.status = 'Inactive' THEN 'terminated'
        ELSE 'active'
    END,
    CASE 
        WHEN e.status = 'Inactive' THEN false
        ELSE true
    END,
    COALESCE(e.created_at, now())
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

-- Step 4: Show results
SELECT '=== AFTER FIX ===' as stage;

SELECT 
    e.id as employee_id,
    e.name,
    e.email,
    substring(au.id::text, 1, 8) || '...' as auth_id,
    substring(hu.id::text, 1, 8) || '...' as hr_user_id,
    hu.role,
    CASE 
        WHEN au.id IS NULL THEN '❌ No Auth'
        WHEN hu.id IS NULL THEN '⚠️ No HR User'
        WHEN au.id = hu.id AND au.email = hu.email AND hu.email = e.email THEN '✅ Synced'
        ELSE '⚠️ Mismatch'
    END as status
FROM employees e
LEFT JOIN auth.users au ON e.email = au.email
LEFT JOIN hr_users hu ON au.id = hu.id
ORDER BY 
    CASE 
        WHEN au.id IS NULL THEN 1
        WHEN hu.id IS NULL THEN 2
        WHEN au.id = hu.id THEN 3
        ELSE 4
    END,
    e.id;

-- Step 5: Show employees that still need auth accounts
SELECT '=== NEEDS AUTH ACCOUNTS ===' as stage;

SELECT 
    e.id,
    e.name,
    e.email,
    e.position,
    '👉 Create auth account in Supabase Dashboard' as action
FROM employees e
LEFT JOIN auth.users au ON e.email = au.email
WHERE au.id IS NULL;

-- Step 6: Summary statistics
SELECT '=== SUMMARY ===' as stage;

SELECT 
    (SELECT COUNT(*) FROM employees) as total_employees,
    (SELECT COUNT(*) FROM auth.users WHERE email IN (SELECT email FROM employees)) as employees_with_auth,
    (SELECT COUNT(*) FROM hr_users WHERE employee_id IS NOT NULL) as hr_users_synced,
    (SELECT COUNT(*) 
     FROM employees e
     JOIN auth.users au ON e.email = au.email
     JOIN hr_users hu ON au.id = hu.id
     WHERE hu.employee_id = e.id) as fully_synced;

COMMIT;

SELECT '✅ Quick fix completed! Review the results above.' as status;
