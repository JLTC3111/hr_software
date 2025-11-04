-- Fix the user_emails table for info@icue.vn user
-- Currently has both emails in one row: "info@icue.vn; trinhthitinh@icue.vn"
-- Need to split into two separate rows

-- First, let's see what we have
SELECT 'BEFORE FIX:' as status, * FROM user_emails WHERE email LIKE '%info@icue.vn%';

-- Get the hr_user_id for this user (should match the auth_user_id)
SELECT 'HR User ID:' as info, id, email FROM hr_users WHERE id = 'e7ce8878-e664-4bc1-9b4a-dd8d3bcbe311';

-- Delete the malformed row
DELETE FROM user_emails WHERE email LIKE '%info@icue.vn%';

-- Insert two proper rows
INSERT INTO user_emails (hr_user_id, auth_user_id, email, is_primary)
VALUES 
  (
    'e7ce8878-e664-4bc1-9b4a-dd8d3bcbe311',  -- hr_user_id (same as auth_user_id)
    'e7ce8878-e664-4bc1-9b4a-dd8d3bcbe311',  -- auth_user_id
    'trinhthitinh@icue.vn',
    true  -- Primary email
  ),
  (
    'e7ce8878-e664-4bc1-9b4a-dd8d3bcbe311',  -- hr_user_id
    'e7ce8878-e664-4bc1-9b4a-dd8d3bcbe311',  -- auth_user_id
    'info@icue.vn',
    false  -- Secondary email
  );

-- Verify the fix
SELECT 'AFTER FIX:' as status, email, hr_user_id, auth_user_id, is_primary 
FROM user_emails 
WHERE email IN ('info@icue.vn', 'trinhthitinh@icue.vn')
ORDER BY is_primary DESC;

-- Clean up: Delete the duplicate auth user that was created (4a2c397d...)
-- First check if it exists
SELECT 'Checking for duplicate auth user:' as info, id, email, created_at 
FROM auth.users 
WHERE email = 'info@icue.vn';

-- Delete it (will also cascade delete from hr_users if exists)
-- Note: You may need to run this manually if there are foreign key constraints
-- DELETE FROM auth.users WHERE email = 'info@icue.vn' AND id LIKE '4a2c397d%';
