-- ============================================================
-- CLEANUP TEST USERS AND FIX DELETION ISSUES
-- This script helps delete test users and fix constraint issues
-- ============================================================

-- Step 1: Find and list test users
SELECT 
    hu.id as user_id,
    hu.email,
    hu.full_name,
    hu.employee_id,
    e.name as employee_name
FROM hr_users hu
LEFT JOIN employees e ON hu.employee_id = e.id
WHERE hu.email LIKE '%test%' OR hu.email LIKE '%example%';

-- Step 2: Clean up orphaned records before deletion
DO $$
DECLARE
    test_user_id UUID;
    test_employee_id INTEGER;
BEGIN
    -- Find test@example.com user
    SELECT id, employee_id INTO test_user_id, test_employee_id
    FROM hr_users 
    WHERE email = 'test@example.com';
    
    IF test_user_id IS NOT NULL THEN
        RAISE NOTICE 'Found test user: %', test_user_id;
        
        -- Clean up time_entries if employee_id exists
        IF test_employee_id IS NOT NULL THEN
            DELETE FROM time_entries WHERE employee_id = test_employee_id;
            DELETE FROM leave_requests WHERE employee_id = test_employee_id;
            DELETE FROM overtime_logs WHERE employee_id = test_employee_id;
            DELETE FROM time_tracking_summary WHERE employee_id = test_employee_id;
            DELETE FROM employees_performance_summary WHERE employee_id = test_employee_id;
            
            RAISE NOTICE 'Cleaned up employee records for employee_id: %', test_employee_id;
        END IF;
        
        -- Remove manager references
        UPDATE hr_users SET manager_id = NULL WHERE manager_id = test_user_id;
        
        -- Delete from hr_users
        DELETE FROM hr_users WHERE id = test_user_id;
        
        -- Delete from employees table if exists
        IF test_employee_id IS NOT NULL THEN
            DELETE FROM employees WHERE id = test_employee_id;
        END IF;
        
        -- Try to delete from auth.users (may require admin privileges)
        -- This will only work if you have service_role key
        -- PERFORM auth.delete_user(test_user_id);
        
        RAISE NOTICE 'Successfully deleted test user';
    ELSE
        RAISE NOTICE 'No test@example.com user found';
    END IF;
END $$;

-- Step 3: Delete all test users (be careful!)
-- Uncomment and run only if you want to delete ALL test users

/*
DO $$
DECLARE
    rec RECORD;
BEGIN
    FOR rec IN 
        SELECT id, email, employee_id 
        FROM hr_users 
        WHERE email LIKE '%test%' OR email LIKE '%example%'
    LOOP
        RAISE NOTICE 'Deleting user: %', rec.email;
        
        -- Clean up related records
        IF rec.employee_id IS NOT NULL THEN
            DELETE FROM time_entries WHERE employee_id = rec.employee_id;
            DELETE FROM leave_requests WHERE employee_id = rec.employee_id;
            DELETE FROM overtime_logs WHERE employee_id = rec.employee_id;
            DELETE FROM time_tracking_summary WHERE employee_id = rec.employee_id;
            DELETE FROM employees_performance_summary WHERE employee_id = rec.employee_id;
        END IF;
        
        -- Remove manager references
        UPDATE hr_users SET manager_id = NULL WHERE manager_id = rec.id;
        
        -- Delete user
        DELETE FROM hr_users WHERE id = rec.id;
        
        -- Delete employee if exists
        IF rec.employee_id IS NOT NULL THEN
            DELETE FROM employees WHERE id = rec.employee_id;
        END IF;
    END LOOP;
END $$;
*/

-- Step 4: Verify deletion
SELECT 
    'Remaining test users:' as status,
    COUNT(*) as count
FROM hr_users 
WHERE email LIKE '%test%' OR email LIKE '%example%';

-- Step 5: Clean up orphaned employees (employees without corresponding hr_users)
SELECT 
    e.id,
    e.name,
    e.email,
    'No hr_user linked' as status
FROM employees e
LEFT JOIN hr_users hu ON hu.employee_id = e.id
WHERE hu.id IS NULL;

-- Optional: Delete orphaned employees
-- DELETE FROM employees
-- WHERE id IN (
--     SELECT e.id
--     FROM employees e
--     LEFT JOIN hr_users hu ON hu.employee_id = e.id
--     WHERE hu.id IS NULL
-- );

-- ============================================================
-- VERIFY CURRENT STATE
-- ============================================================

-- Show all users with their employee linkage
SELECT 
    hu.email,
    hu.full_name,
    hu.role,
    CASE 
        WHEN hu.employee_id IS NOT NULL THEN 'Linked'
        ELSE 'Not Linked'
    END as employee_link_status,
    e.name as employee_name
FROM hr_users hu
LEFT JOIN employees e ON hu.employee_id = e.id
ORDER BY hu.email;

-- Show constraint status
SELECT 
    'Constraints fixed and ready for deletion' as status,
    COUNT(*) as total_constraints
FROM information_schema.table_constraints
WHERE constraint_type = 'FOREIGN KEY' 
  AND table_name IN ('hr_users', 'time_entries', 'leave_requests', 'overtime_logs');
