-- ============================================================
-- FIX DEV EMAIL MISMATCH
-- Changes dev@email.com to dev@icue.vn
-- User ID: 01616081-0a99-48c9-94e8-f6e57d8c2946
-- ============================================================

-- IMPORTANT: This requires service_role access or must be done via Supabase Dashboard

-- ============================================================
-- STEP 1: VERIFY CURRENT STATE
-- ============================================================

SELECT 
    'Before Fix' as stage,
    id,
    email,
    created_at,
    email_confirmed_at
FROM auth.users
WHERE id = '01616081-0a99-48c9-94e8-f6e57d8c2946'
   OR email LIKE '%dev%';

-- Check if dev@icue.vn already exists in auth
SELECT 
    'Existing dev@icue.vn?' as check_type,
    COUNT(*) as count,
    array_agg(id) as user_ids
FROM auth.users
WHERE email = 'dev@icue.vn';

-- ============================================================
-- STEP 2: UPDATE AUTH EMAIL
-- This requires admin/service_role privileges
-- ============================================================

-- Option A: If no other user has dev@icue.vn, update directly
DO $$
BEGIN
    -- Check if dev@icue.vn is already taken by another user
    IF NOT EXISTS (
        SELECT 1 FROM auth.users 
        WHERE email = 'dev@icue.vn' 
        AND id != '01616081-0a99-48c9-94e8-f6e57d8c2946'
    ) THEN
        -- Update the email
        UPDATE auth.users 
        SET 
            email = 'dev@icue.vn',
            raw_user_meta_data = jsonb_set(
                COALESCE(raw_user_meta_data, '{}'::jsonb),
                '{email}',
                '"dev@icue.vn"'
            )
        WHERE id = '01616081-0a99-48c9-94e8-f6e57d8c2946';
        
        RAISE NOTICE '✅ Updated auth email to dev@icue.vn';
    ELSE
        RAISE EXCEPTION '❌ Email dev@icue.vn is already taken by another user!';
    END IF;
END $$;

-- ============================================================
-- STEP 3: UPDATE HR_USERS TO MATCH
-- ============================================================

-- Update hr_users email if it exists
UPDATE hr_users
SET email = 'dev@icue.vn'
WHERE id = '01616081-0a99-48c9-94e8-f6e57d8c2946'
  AND email != 'dev@icue.vn';

-- If hr_users doesn't exist, create it linked to employee
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
    '01616081-0a99-48c9-94e8-f6e57d8c2946'::uuid,
    e.email,
    split_part(e.name, ' ', 1),
    substring(e.name from length(split_part(e.name, ' ', 1)) + 2),
    e.phone,
    e.photo,
    CASE 
        WHEN e.position = 'senior_developer' THEN 'manager'
        ELSE 'employee'
    END,
    e.department,
    e.position,
    e.id,
    e.start_date,
    CASE 
        WHEN e.status = 'onLeave' THEN 'on_leave'
        ELSE 'active'
    END,
    true,
    now()
FROM employees e
WHERE e.email = 'dev@icue.vn'
ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    employee_id = EXCLUDED.employee_id,
    department = EXCLUDED.department,
    position = EXCLUDED.position,
    updated_at = now();

-- ============================================================
-- STEP 4: CLEAN UP DUPLICATE/INVALID ENTRIES
-- ============================================================

-- Remove any hr_users entry with id=16 (invalid integer ID)
DELETE FROM hr_users
WHERE id::text = '16' OR id::text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

-- ============================================================
-- STEP 5: VERIFICATION
-- ============================================================

SELECT 
    'After Fix' as stage,
    au.id as auth_id,
    au.email as auth_email,
    hu.id as hr_user_id,
    hu.email as hr_user_email,
    e.id as employee_id,
    e.email as employee_email,
    CASE 
        WHEN au.email = hu.email AND hu.email = e.email THEN '✅ All Synced'
        ELSE '⚠️ Still mismatched'
    END as status
FROM auth.users au
LEFT JOIN hr_users hu ON au.id = hu.id
LEFT JOIN employees e ON hu.employee_id = e.id
WHERE au.id = '01616081-0a99-48c9-94e8-f6e57d8c2946'
   OR au.email LIKE '%dev%'
   OR e.email LIKE '%dev%';

-- Final check
SELECT 
    'Auth User' as type,
    id,
    email
FROM auth.users
WHERE email = 'dev@icue.vn'

UNION ALL

SELECT 
    'HR User' as type,
    id::text,
    email
FROM hr_users
WHERE email = 'dev@icue.vn'

UNION ALL

SELECT 
    'Employee' as type,
    id::text,
    email
FROM employees
WHERE email = 'dev@icue.vn';

-- ============================================================
-- SUCCESS MESSAGE
-- ============================================================
SELECT '✅ Dev email fix completed!' AS status;
