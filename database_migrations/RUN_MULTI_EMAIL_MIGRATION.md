# Multi-Email Support Migration Instructions

## Overview
This migration enables one hr_user to have multiple email addresses. Each email can have its own Supabase auth account with different passwords, but all authenticate as the same hr_user.

## Steps to Run Migration

### 1. Access Supabase SQL Editor
1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor** in the left sidebar
3. Click **New Query**

### 2. Run the Migration
1. Open the file: `database_migrations/multi_email_support.sql`
2. Copy the entire contents
3. Paste into the Supabase SQL Editor
4. Click **Run** or press `Cmd/Ctrl + Enter`

### 3. Verify Migration
After running, verify the following were created:

**Tables:**
```sql
SELECT * FROM user_emails LIMIT 5;
```

**Functions:**
```sql
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_name IN ('get_hr_user_id_from_auth', 'get_primary_email', 'add_user_email');
```

**Views:**
```sql
SELECT * FROM user_emails_view LIMIT 5;
```

### 4. Check Existing Data Migration
Verify that existing hr_users were migrated:
```sql
SELECT 
  u.id,
  u.first_name,
  u.last_name,
  u.email as old_email,
  u.primary_email,
  COUNT(e.id) as email_count
FROM hr_users u
LEFT JOIN user_emails e ON u.id = e.hr_user_id
GROUP BY u.id, u.first_name, u.last_name, u.email, u.primary_email
ORDER BY u.first_name;
```

Each user should have at least 1 email in user_emails table.

## What This Migration Does

1. **Creates `user_emails` table** - Maps auth accounts to hr_users
2. **Adds indexes** - Fast lookups by email, hr_user_id, auth_user_id
3. **Adds `primary_email` column** to hr_users table
4. **Migrates existing users** - Creates user_emails entries for all current users
5. **Creates helper functions:**
   - `get_hr_user_id_from_auth(auth_id)` - Resolve auth ID to hr_user ID
   - `get_primary_email(hr_user_id)` - Get primary email for user
   - `add_user_email(...)` - Link new email to existing user
6. **Creates view** - `user_emails_view` for easier querying

## Post-Migration Testing

### Test 1: Verify Existing Users Still Work
Login with existing credentials - should work normally.

### Test 2: Link Additional Email to User
1. Create new auth account with different email
2. Use admin UI to link to existing hr_user
3. Login with new email - should authenticate as same user

### Test 3: Primary Email Display
Check that user profile shows correct primary email.

## Rollback (if needed)
If you need to rollback:
```sql
DROP VIEW IF EXISTS user_emails_view;
DROP FUNCTION IF EXISTS add_user_email;
DROP FUNCTION IF EXISTS get_primary_email;
DROP FUNCTION IF EXISTS get_hr_user_id_from_auth;
DROP TABLE IF EXISTS user_emails;
ALTER TABLE hr_users DROP COLUMN IF EXISTS primary_email;
```

## Architecture Notes

### Before:
- 1 auth.users → 1 hr_users (1:1)
- Email stored in both tables
- auth.users.id = hr_users.id

### After:
- Multiple auth.users → 1 hr_users (N:1)
- user_emails table maps auth_user_id to hr_user_id
- Each email can have different password
- One email marked as primary

### Auth Flow:
1. User logs in with email/password
2. Supabase returns auth.users.id
3. AuthContext queries user_emails to get hr_user_id
4. User profile loaded using hr_user_id
5. If no mapping found, falls back to auth_id (backward compatibility)

## Support
If migration fails, check:
- Foreign key constraints (auth.users and hr_users must exist)
- Duplicate emails (email column must be unique)
- Permissions (ensure your role has CREATE/ALTER privileges)
