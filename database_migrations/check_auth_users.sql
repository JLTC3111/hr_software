-- Check which emails exist in auth.users vs user_emails table
SELECT 
  ue.email,
  ue.hr_user_id,
  ue.auth_user_id as expected_auth_id,
  ue.is_primary,
  au.id as actual_auth_id,
  CASE 
    WHEN au.id IS NULL THEN '❌ Auth user missing'
    WHEN au.id = ue.auth_user_id THEN '✅ Matches'
    ELSE '⚠️ Mismatch'
  END as status
FROM user_emails ue
LEFT JOIN auth.users au ON au.email = ue.email
ORDER BY ue.hr_user_id, ue.is_primary DESC;
