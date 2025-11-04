-- Clean up employees.email column to remove semicolon-separated emails
-- Split emails into individual rows or keep only the first/primary email

-- 1. Check current state
SELECT 'Employees with multiple emails:' as info;
SELECT id, name, email, position, department 
FROM employees 
WHERE email LIKE '%;%'
ORDER BY name;

-- 2. Update employees table to only keep the first email (before semicolon)
UPDATE employees
SET email = TRIM(SPLIT_PART(email, ';', 1))
WHERE email LIKE '%;%';

-- 3. Verify the cleanup
SELECT 'After cleanup:' as info;
SELECT id, name, email, position, department 
FROM employees 
WHERE id IN (
  '08cf9a70-7e89-4e0a-a5cf-8bc0a21dbc25',
  'aa3466eb-5f14-4977-883e-f27773732668',
  'e753bd94-fa4c-4cde-b140-d7733c047924',
  'e7ce8878-e664-4bc1-9b4a-dd8d3bcbe311'
)
ORDER BY name;

-- 4. Show all employees to verify
SELECT 'All employees after cleanup:' as info;
SELECT id, name, email, position 
FROM employees 
ORDER BY name
LIMIT 20;
