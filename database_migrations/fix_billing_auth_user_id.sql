-- Fix the auth_user_id for billing@icue.vn to match the actual auth user
-- The actual auth user for billing@icue.vn is d1c70c48-5976-4d3b-b8e7-a0f6305417ad
-- But it should map to hr_user_id 08cf9a70-7e89-4e0a-a5cf-8bc0a21dbc25

-- 1. Check current state
SELECT 'Current user_emails for billing@icue.vn:' as info;
SELECT * FROM user_emails WHERE email = 'billing@icue.vn';

SELECT 'Auth user for billing@icue.vn:' as info;
SELECT id, email FROM auth.users WHERE email = 'billing@icue.vn';

-- 2. Update the auth_user_id to point to the actual auth user
UPDATE user_emails 
SET auth_user_id = 'd1c70c48-5976-4d3b-b8e7-a0f6305417ad'
WHERE email = 'billing@icue.vn';

-- 3. Verify the update
SELECT 'Updated user_emails:' as info;
SELECT email, hr_user_id, auth_user_id, is_primary 
FROM user_emails 
WHERE email IN ('dungminh452012@gmail.com', 'billing@icue.vn')
ORDER BY is_primary DESC;

-- 4. Check the complete mapping
SELECT 'Complete email to HR User mapping:' as info;
SELECT 
  ue.email,
  ue.auth_user_id,
  au.email as auth_email,
  ue.hr_user_id,
  hu.full_name as hr_full_name,
  ue.is_primary
FROM user_emails ue
LEFT JOIN auth.users au ON au.id = ue.auth_user_id
LEFT JOIN hr_users hu ON hu.id = ue.hr_user_id
WHERE ue.email IN ('dungminh452012@gmail.com', 'billing@icue.vn')
ORDER BY ue.is_primary DESC;

-- After this change:
-- - billing@icue.vn auth user (d1c70c48...) → HR user 08cf9a70...
-- - dungminh452012@gmail.com auth user (08cf9a70...) → HR user 08cf9a70...
-- - Both auth users map to the SAME HR profile with the same employee data
