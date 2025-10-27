# Fix User Sync Issues Guide

## Problem Overview

Based on the screenshot, there are several issues in the `hr_users` table:

1. **Invalid ID Type**: Row with `id=16` (integer) - should be UUID
2. **Email Mismatch**: Auth user `01616081-0a99-48c9-94e8-f6e57d8c2946` has email `dev@email.com` but should be `dev@icue.vn`
3. **Missing Sync**: Many employees in the `employees` table are not in `hr_users`

## Root Cause

The `hr_users.id` column must ALWAYS be a UUID that references `auth.users(id)`. It should NEVER be an integer. The integer ID from employees table should go in the `employee_id` column.

## Solution - Step by Step

### Step 1: Fix Auth User Email (Supabase Dashboard)

**Option A - Via Dashboard (Recommended)**:
1. Go to Supabase Dashboard → Authentication → Users
2. Find user with ID: `01616081-0a99-48c9-94e8-f6e57d8c2946`
3. Click Edit
4. Change email from `dev@email.com` to `dev@icue.vn`
5. Save

**Option B - Via SQL (requires service_role)**:
```sql
UPDATE auth.users 
SET email = 'dev@icue.vn'
WHERE id = '01616081-0a99-48c9-94e8-f6e57d8c2946';
```

### Step 2: Run Fix Script

Execute the fix script in Supabase SQL Editor:

```bash
# File: database_migrations/fix_hr_users_sync.sql
```

This script will:
- ✅ Delete invalid entries (like id=16)
- ✅ Sync all employees with existing auth accounts
- ✅ Update hr_users with correct UUIDs
- ✅ Show which employees still need auth accounts

### Step 3: For dev@icue.vn Specifically

If the email change didn't propagate, run:

```bash
# File: database_migrations/fix_dev_email.sql
```

### Step 4: Create Auth Accounts for Remaining Employees

After running the sync script, check which employees don't have auth accounts:

```sql
SELECT 
    e.id,
    e.name,
    e.email,
    '❌ Needs auth account' as status
FROM employees e
LEFT JOIN auth.users au ON e.email = au.email
WHERE au.id IS NULL;
```

For each missing employee, create an auth account:

**Via Supabase Dashboard**:
1. Go to Authentication → Users → Add User
2. Enter the employee's email
3. Set a password (e.g., `IcueHR2024!`)
4. Check "Auto Confirm Email"
5. Click Create

**Or use the seeding script**:
```bash
npm run seed:users
```

### Step 5: Verify Everything is Synced

Run this verification query:

```sql
SELECT 
    e.id as employee_id,
    e.name,
    e.email,
    au.id as auth_id,
    hu.id as hr_user_id,
    CASE 
        WHEN au.id IS NULL THEN '❌ No Auth Account'
        WHEN hu.id IS NULL THEN '⚠️ Has Auth but No HR User'
        WHEN au.id = hu.id THEN '✅ Fully Synced'
        ELSE '❌ ID Mismatch'
    END as status
FROM employees e
LEFT JOIN auth.users au ON e.email = au.email
LEFT JOIN hr_users hu ON au.id = hu.id
ORDER BY e.id;
```

Expected result: All employees should show "✅ Fully Synced"

## Understanding the Schema

### Correct Structure

```
employees (id=1, email=dev@icue.vn)
    ↓
auth.users (id=01616081-..., email=dev@icue.vn)
    ↓
hr_users (id=01616081-..., employee_id=2, email=dev@icue.vn)
```

### What Was Wrong

```
employees (id=2, email=dev@icue.vn)
    ↓
auth.users (id=01616081-..., email=dev@email.com) ❌ Wrong email
    ↓
hr_users (id=16, employee_id=2) ❌ Wrong ID type (integer instead of UUID)
```

## Common Issues and Solutions

### Issue 1: "Cannot insert duplicate key value"
**Cause**: Trying to insert an hr_users entry that already exists  
**Solution**: Use `ON CONFLICT (id) DO UPDATE` in the insert statement (already in fix script)

### Issue 2: "Email already exists"
**Cause**: Two employees with same email, or auth user already exists  
**Solution**: Ensure emails are unique in employees table

### Issue 3: "Foreign key violation"
**Cause**: Trying to set employee_id that doesn't exist in employees table  
**Solution**: Verify employee exists before syncing

### Issue 4: "Invalid UUID"
**Cause**: Trying to use integer ID where UUID is required  
**Solution**: Delete invalid entries and recreate with proper UUIDs

## Manual Cleanup (If Needed)

If automatic scripts fail, manually clean up:

```sql
-- 1. Delete all invalid hr_users entries
DELETE FROM hr_users 
WHERE id NOT IN (SELECT id FROM auth.users);

-- 2. Delete specific problematic entry
DELETE FROM hr_users WHERE id::text = '16';

-- 3. Start fresh for specific email
DELETE FROM hr_users WHERE email = 'dev@icue.vn';
DELETE FROM auth.users WHERE email = 'dev@icue.vn';
-- Then recreate via Dashboard
```

## Data Integrity Checks

After fixing, run these checks:

### Check 1: No Invalid IDs
```sql
-- Should return 0 rows
SELECT * FROM hr_users 
WHERE id NOT IN (SELECT id FROM auth.users);
```

### Check 2: All UUIDs
```sql
-- Should return 0 rows
SELECT * FROM hr_users 
WHERE id::text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
```

### Check 3: Email Consistency
```sql
-- Should return 0 rows (all emails match)
SELECT hu.id, hu.email as hr_email, au.email as auth_email
FROM hr_users hu
JOIN auth.users au ON hu.id = au.id
WHERE hu.email != au.email;
```

### Check 4: Employee Linkage
```sql
-- All hr_users should have valid employee_id
SELECT hu.id, hu.email, hu.employee_id
FROM hr_users hu
LEFT JOIN employees e ON hu.employee_id = e.id
WHERE hu.employee_id IS NOT NULL AND e.id IS NULL;
```

## Prevention

To prevent this issue in the future:

1. **Always use AuthContext**: The updated `AuthContext.jsx` now handles this correctly
2. **Never manually set hr_users.id**: It should always come from auth.users
3. **Use the seeding script**: For bulk operations, use `npm run seed:users`
4. **Email consistency**: Ensure auth.users.email matches employees.email

## Expected Final State

After completing all steps:

| employee | auth.users | hr_users | Status |
|----------|------------|----------|--------|
| id=2, dev@icue.vn | id=UUID, dev@icue.vn | id=UUID, employee_id=2, dev@icue.vn | ✅ Synced |

All three tables linked by email, with proper UUID in hr_users.id

## Testing

Test the fix by:

1. **Logout**: Clear any cached sessions
2. **Login**: Try logging in with `dev@icue.vn`
3. **Verify**: Check that profile loads correctly
4. **Check Dashboard**: Verify employee data displays properly

## Support

If you still have issues after following this guide:
1. Check the console logs for error messages
2. Review Supabase logs in Dashboard → Logs
3. Verify all foreign key constraints are properly set
4. Ensure RLS policies aren't blocking operations

---

**Remember**: The `hr_users.id` is ALWAYS a UUID from `auth.users`. The `employee_id` is the integer from `employees`.
