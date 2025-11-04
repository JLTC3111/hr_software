-- Fix the auth_user_id mismatch for info@icue.vn user
-- Update to match the currently logged-in user UUID
UPDATE user_emails
SET auth_user_id = '4a2c397d-5f14-4977-883e-f27773...'  -- Replace with full UUID
WHERE email IN ('info@icue.vn', 'trinhthitinh@icue.vn')
AND hr_user_id = (SELECT hr_user_id FROM user_emails WHERE email = 'info@icue.vn' LIMIT 1);

-- Verify the update
SELECT email, hr_user_id, auth_user_id, is_primary 
FROM user_emails 
WHERE email IN ('info@icue.vn', 'trinhthitinh@icue.vn');
