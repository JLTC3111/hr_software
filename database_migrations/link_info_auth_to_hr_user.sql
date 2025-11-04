-- Link the info@icue.vn auth user (4a2c397d...) to the HR user (e7ce8878...)
-- This allows logging in with info@icue.vn to access the trinhthitinh@icue.vn HR profile

-- 1. Check current state
SELECT 'Current user_emails for info@icue.vn:' as info;
SELECT * FROM user_emails WHERE email = 'info@icue.vn';

-- 2. Update the auth_user_id to point to the actual auth user that logs in with info@icue.vn
UPDATE user_emails 
SET auth_user_id = '4a2c397d-b10d-448b-9978-b632c756f677'
WHERE email = 'info@icue.vn';

-- 3. Verify the update
SELECT 'Updated user_emails:' as info;
SELECT email, hr_user_id, auth_user_id, is_primary 
FROM user_emails 
WHERE email IN ('info@icue.vn', 'trinhthitinh@icue.vn')
ORDER BY is_primary DESC;

-- 4. Check the mapping
SELECT 'Email to HR User mapping:' as info;
SELECT 
  ue.email,
  ue.auth_user_id,
  au.email as auth_email,
  ue.hr_user_id,
  hu.email as hr_email,
  ue.is_primary
FROM user_emails ue
LEFT JOIN auth.users au ON au.id = ue.auth_user_id
LEFT JOIN hr_users hu ON hu.id = ue.hr_user_id
WHERE ue.email IN ('info@icue.vn', 'trinhthitinh@icue.vn')
ORDER BY ue.is_primary DESC;

-- After this change:
-- - info@icue.vn auth user (4a2c397d...) → HR user e7ce8878...
-- - trinhthitinh@icue.vn auth user (e7ce8878...) → HR user e7ce8878...
-- - Both auth users map to the SAME HR profile
-- - fetchUserProfile will resolve both correctly
