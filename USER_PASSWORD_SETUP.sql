-- Script to set temporary passwords for existing users in hr_users table
-- This should be run AFTER deploying the password management changes

-- Step 1: First, update existing users to require password change
-- This marks all existing users as needing to change their password
UPDATE public.hr_users 
SET 
    must_change_password = TRUE,
    temporary_password_set_at = NOW(),
    updated_at = NOW()
WHERE 
    -- Only update users who haven't already changed their password
    password_changed_at IS NULL 
    AND must_change_password IS NOT TRUE;

-- Step 2: Query to get all users who need temporary passwords
-- Run this to see which users need temporary passwords set
SELECT 
    id,
    email,
    full_name,
    role,
    department,
    must_change_password,
    temporary_password_set_at
FROM public.hr_users 
WHERE must_change_password = TRUE
ORDER BY role, full_name;

-- Step 3: Sample Edge Function call (JavaScript)
-- Use this in your admin panel or run it manually
/*
To set temporary passwords, you'll need to call the Edge Function:

const setTempPasswords = async () => {
  const response = await fetch('YOUR_SUPABASE_URL/functions/v1/set-temp-passwords', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      userEmails: [
        'user1@company.com',
        'user2@company.com',
        // ... add all user emails
      ],
      tempPassword: 'TempPass123!' // Optional: use same password for all users
    })
  });
  
  const result = await response.json();
  console.log('Password setup results:', result);
};
*/

-- Step 4: Verification queries after setting passwords

-- Check how many users still need password changes
SELECT 
    COUNT(*) as users_needing_password_change,
    COUNT(CASE WHEN role = 'hr_admin' THEN 1 END) as admins,
    COUNT(CASE WHEN role = 'hr_manager' THEN 1 END) as managers,
    COUNT(CASE WHEN role = 'employee' THEN 1 END) as employees
FROM public.hr_users 
WHERE must_change_password = TRUE;

-- Check users who have changed their passwords
SELECT 
    COUNT(*) as users_with_permanent_passwords,
    MAX(password_changed_at) as last_password_change
FROM public.hr_users 
WHERE must_change_password = FALSE AND password_changed_at IS NOT NULL;

-- Find users with expired temporary passwords (30+ days)
SELECT 
    id,
    email,
    full_name,
    role,
    temporary_password_set_at,
    NOW() - temporary_password_set_at as time_since_temp_password
FROM public.hr_users 
WHERE 
    must_change_password = TRUE 
    AND temporary_password_set_at IS NOT NULL
    AND (NOW() - temporary_password_set_at) > INTERVAL '30 days'
ORDER BY temporary_password_set_at;

-- Optional: Reset specific users who need new temporary passwords
-- UPDATE public.hr_users 
-- SET 
--     must_change_password = TRUE,
--     temporary_password_set_at = NOW(),
--     updated_at = NOW()
-- WHERE email IN ('specific@user.com', 'another@user.com');