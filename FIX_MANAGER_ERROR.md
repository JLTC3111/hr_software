# Fix Manager Relationship Error 🔧

## Error You're Seeing

```
Database error: Could not find a relationship between 'hr_users' and 'hr_users' in the schema cache
```

## What's Wrong

The `hr_users` table is missing the foreign key constraint for the `manager_id` column. This constraint allows employees to reference their managers (which are also in the `hr_users` table).

## Quick Fix (5 minutes)

### Option 1: Quick Fix Script (RECOMMENDED)

1. **Go to Supabase Dashboard**
   - Open your project: https://supabase.com/dashboard/project/idkfmgdfzcsydrqnjcla

2. **Open SQL Editor**
   - Click "SQL Editor" in the left sidebar
   - Click "New query"

3. **Run the Quick Fix**
   - Copy the contents of: `database_migrations/quick_fix_manager_constraint.sql`
   - Paste into the SQL Editor
   - Click **"Run"**

4. **Verify Success**
   - You should see: ✅ Manager foreign key constraint fixed!
   - Refresh your app
   - Login should now work

### Option 2: Full Migration Script

If you want to fix ALL foreign key constraints at once:

1. Go to Supabase SQL Editor
2. Copy contents of: `database_migrations/user_deletion_setup.sql`
3. Paste and click "Run"

This will set up:
- ✅ Manager relationships
- ✅ Employee linking
- ✅ Time clock entries
- ✅ Leave requests
- ✅ Overtime logs

## Why This Happened

The database was created without the foreign key constraint for `manager_id`. This is needed for:
- Querying employee managers
- Organizational hierarchy
- Cascading deletes (when a manager is removed)

## Code Changes Made

I've already updated `AuthContext.jsx` to work **with or without** the constraint:

**Before** (fails without constraint):
```javascript
.select(`
  *,
  manager:hr_users!manager_id(...)  // ❌ Requires FK constraint
`)
```

**After** (works without constraint):
```javascript
.select('*')  // ✅ Fetch user first
// Then fetch manager separately if needed
```

## Test After Fix

1. **Login** - Should work without errors
2. **Check console** - Should see: "Fetching user profile for ID: ..."
3. **No errors** - Database error should be gone

## If Still Not Working

### Clear Browser Cache
```bash
# Chrome/Edge
1. Press Ctrl+Shift+Delete (Windows) or Cmd+Shift+Delete (Mac)
2. Clear "Cached images and files"
3. Refresh the page

# Or use Incognito/Private mode
```

### Check Database Constraint

Run this in SQL Editor to verify:
```sql
SELECT 
    constraint_name,
    table_name,
    column_name
FROM information_schema.key_column_usage
WHERE constraint_name = 'hr_users_manager_id_fkey';
```

Should return one row with:
- constraint_name: `hr_users_manager_id_fkey`
- table_name: `hr_users`
- column_name: `manager_id`

## Files Changed

1. ✅ `src/contexts/AuthContext.jsx` - Now works without FK constraint
2. ✅ `database_migrations/quick_fix_manager_constraint.sql` - Quick fix script
3. ✅ `database_migrations/user_deletion_setup.sql` - Full migration script

## Summary

**Problem**: Missing foreign key constraint on `hr_users.manager_id`

**Solution**: 
1. Run `quick_fix_manager_constraint.sql` in Supabase
2. Refresh your app
3. Login should work

**Time**: ~2 minutes

---

**Status**: 🔧 Ready to fix - just run the SQL script!
