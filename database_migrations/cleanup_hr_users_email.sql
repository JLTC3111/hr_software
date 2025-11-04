-- Clean up hr_users.email column to only contain the primary email
-- The user_emails table should handle multiple emails per user

-- 1. Check current state
SELECT 'Current hr_users with multiple emails:' as info;
SELECT id, email, first_name, last_name, full_name 
FROM hr_users 
WHERE email LIKE '%;%'
ORDER BY email;

-- 2. Update each user to only have their primary email from user_emails table
-- For user 08cf9a70-7e89-4e0a-a5cf-8bc0a21dbc25 (dungminh/billing)
UPDATE hr_users
SET email = (
  SELECT email 
  FROM user_emails 
  WHERE hr_user_id = '08cf9a70-7e89-4e0a-a5cf-8bc0a21dbc25' 
    AND is_primary = true 
  LIMIT 1
)
WHERE id = '08cf9a70-7e89-4e0a-a5cf-8bc0a21dbc25';

-- 3. Update any other users with semicolon-separated emails
-- For user aa3466eb-5f14-4977-883e-f27773732668 (dinhtungduong/support)
UPDATE hr_users
SET email = (
  SELECT email 
  FROM user_emails 
  WHERE hr_user_id = 'aa3466eb-5f14-4977-883e-f27773732668' 
    AND is_primary = true 
  LIMIT 1
)
WHERE id = 'aa3466eb-5f14-4977-883e-f27773732668'
  AND email LIKE '%;%';

-- 4. Update user e753bd94-fa4c-4cde-b140-d7733c047924 (lynguyen/support)
UPDATE hr_users
SET email = (
  SELECT email 
  FROM user_emails 
  WHERE hr_user_id = 'e753bd94-fa4c-4cde-b140-d7733c047924' 
    AND is_primary = true 
  LIMIT 1
)
WHERE id = 'e753bd94-fa4c-4cde-b140-d7733c047924'
  AND email LIKE '%;%';

-- 5. Update user e7ce8878-e664-4bc1-9b4a-dd8d3bcbe311 (info/trinhthitinh)
UPDATE hr_users
SET email = (
  SELECT email 
  FROM user_emails 
  WHERE hr_user_id = 'e7ce8878-e664-4bc1-9b4a-dd8d3bcbe311' 
    AND is_primary = true 
  LIMIT 1
)
WHERE id = 'e7ce8878-e664-4bc1-9b4a-dd8d3bcbe311'
  AND email LIKE '%;%';

-- 6. Generic update for any remaining users with semicolons (fallback to first email)
UPDATE hr_users
SET email = SPLIT_PART(email, ';', 1)
WHERE email LIKE '%;%';

-- 7. Verify the cleanup
SELECT 'After cleanup:' as info;
SELECT id, email, first_name, last_name, full_name 
FROM hr_users 
WHERE id IN (
  '08cf9a70-7e89-4e0a-a5cf-8bc0a21dbc25',
  'aa3466eb-5f14-4977-883e-f27773732668',
  'e753bd94-fa4c-4cde-b140-d7733c047924',
  'e7ce8878-e664-4bc1-9b4a-dd8d3bcbe311'
)
ORDER BY email;

-- 8. Show the user_emails mapping to confirm multiple emails are preserved there
SELECT 'user_emails still has all emails:' as info;
SELECT hr_user_id, email, is_primary 
FROM user_emails 
WHERE hr_user_id IN (
  '08cf9a70-7e89-4e0a-a5cf-8bc0a21dbc25',
  'aa3466eb-5f14-4977-883e-f27773732668',
  'e753bd94-fa4c-4cde-b140-d7733c047924',
  'e7ce8878-e664-4bc1-9b4a-dd8d3bcbe311'
)
ORDER BY hr_user_id, is_primary DESC;
