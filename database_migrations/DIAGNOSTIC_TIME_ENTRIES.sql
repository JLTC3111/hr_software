-- ============================================================
-- DIAGNOSTIC SCRIPT FOR TIME TRACKING DATA ISSUES
-- Run this in Supabase SQL Editor to diagnose problems
-- ============================================================

-- 1. Check if time_entries_detailed view exists
SELECT 
    schemaname, 
    viewname, 
    viewowner 
FROM pg_views 
WHERE viewname = 'time_entries_detailed';

-- 2. Check time_entries table structure
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns
WHERE table_name = 'time_entries'
ORDER BY ordinal_position;

-- 3. Count total time entries
SELECT COUNT(*) as total_entries FROM time_entries;

-- 4. Sample of time entries data
SELECT 
    id,
    employee_id,
    date,
    clock_in,
    clock_out,
    hours,
    hour_type,
    status,
    created_at
FROM time_entries
ORDER BY created_at DESC
LIMIT 10;

-- 5. Check employees table
SELECT COUNT(*) as total_employees FROM employees;

-- 6. Check for orphaned time entries (entries without valid employee)
SELECT 
    te.id,
    te.employee_id,
    te.date,
    e.id as employee_exists
FROM time_entries te
LEFT JOIN employees e ON te.employee_id = e.id
WHERE e.id IS NULL
LIMIT 10;

-- 7. Check for time entries by employee
SELECT 
    e.name as employee_name,
    COUNT(te.id) as entry_count
FROM employees e
LEFT JOIN time_entries te ON e.id = te.employee_id
GROUP BY e.id, e.name
ORDER BY entry_count DESC;

-- 8. Check RLS (Row Level Security) policies on time_entries
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'time_entries';

-- 9. Check if authenticated users can select from time_entries
SELECT 
    grantee, 
    privilege_type 
FROM information_schema.role_table_grants 
WHERE table_name = 'time_entries';

-- 10. Test query that the app uses (for admins)
-- If time_entries_detailed view doesn't exist, this will fail
SELECT * FROM time_entries_detailed LIMIT 5;

-- 11. Test query that the app uses (for regular users)
-- Replace '1' with actual employee_id
SELECT * FROM time_entries WHERE employee_id = 1 LIMIT 5;
