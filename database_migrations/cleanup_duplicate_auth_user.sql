-- Clean up the duplicate auth user created for info@icue.vn
-- This user was created by mistake when login failed to resolve to trinhthitinh@icue.vn

-- 1. First, check what we have
SELECT 'Current state - Auth Users:' as info;
SELECT id, email, created_at FROM auth.users WHERE email IN ('info@icue.vn', 'trinhthitinh@icue.vn');

SELECT 'Current state - HR Users:' as info;
SELECT id, email, first_name, last_name FROM hr_users WHERE id IN (
  '4a2c397d-b10d-448b-9978-b632c756f677',
  'e7ce8878-e664-4bc1-9b4a-dd8d3bcbe311'
);

SELECT 'Current state - User Emails:' as info;
SELECT email, hr_user_id, auth_user_id, is_primary FROM user_emails 
WHERE email IN ('info@icue.vn', 'trinhthitinh@icue.vn');

-- 2. Delete the duplicate hr_users record
DELETE FROM hr_users WHERE id = '4a2c397d-b10d-448b-9978-b632c756f677';

-- 3. Delete the duplicate auth user (this will cascade delete related records)
DELETE FROM auth.users WHERE id = '4a2c397d-b10d-448b-9978-b632c756f677';

-- 4. Verify cleanup
SELECT 'After cleanup - Auth Users:' as info;
SELECT id, email, created_at FROM auth.users WHERE email IN ('info@icue.vn', 'trinhthitinh@icue.vn');

SELECT 'After cleanup - User Emails (should still have both):' as info;
SELECT email, hr_user_id, auth_user_id, is_primary FROM user_emails 
WHERE email IN ('info@icue.vn', 'trinhthitinh@icue.vn');

-- NOTE: After this cleanup:
-- - Only auth user trinhthitinh@icue.vn (e7ce8878...) will exist
-- - user_emails has both info@icue.vn and trinhthitinh@icue.vn pointing to e7ce8878...
-- - Login with info@icue.vn will resolve to trinhthitinh@icue.vn and authenticate successfully
