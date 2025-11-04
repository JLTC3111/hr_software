-- Split dungminh452012@gmail.com; billing@icue.vn into two separate rows
-- Row 5 in user_emails table

-- 1. Check current state
SELECT 'Current state for dungminh user:' as info;
SELECT * FROM user_emails WHERE email LIKE '%dungminh%' OR email LIKE '%billing@icue.vn%';

-- 2. Only one primary email per user
CREATE UNIQUE INDEX IF NOT EXISTS user_emails_primary_idx 
ON user_emails (auth_user_id) 
WHERE is_primary = true;

-- Then insert your data
DELETE FROM user_emails WHERE email LIKE '%billing@icue.vn%' OR email = 'dungminh452012@gmail.com';

INSERT INTO user_emails (hr_user_id, auth_user_id, email, is_primary)
VALUES 
(
  '08cf9a70-7e89-4e0a-a5cf-8bc0a21dbc25',
  '08cf9a70-7e89-4e0a-a5cf-8bc0a21dbc25',
  'dungminh452012@gmail.com',
  true
),
(
  '08cf9a70-7e89-4e0a-a5cf-8bc0a21dbc25',
  '08cf9a70-7e89-4e0a-a5cf-8bc0a21dbc25',
  'billing@icue.vn',
  false
);

-- 5. Verify the split
SELECT 'After split - both emails:' as info;
SELECT email, hr_user_id, auth_user_id, is_primary 
FROM user_emails 
WHERE email IN ('dungminh452012@gmail.com', 'billing@icue.vn')
ORDER BY is_primary DESC;

-- 6. Check against auth.users to confirm which is primary
SELECT 'Auth user for verification:' as info;
SELECT id, email FROM auth.users WHERE id = '08cf9a70-7e89-4e0a-a5cf-8bc0a21dbc25';
