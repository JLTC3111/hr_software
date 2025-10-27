# Database and User Management Fixes

## Overview
This document outlines the fixes implemented to resolve critical issues in the HR software system, particularly around user-employee synchronization and deletion constraints.

## Issues Identified and Fixed

### 1. **Database Table Name Mismatch**
- **Problem**: Migration scripts referenced non-existent `time_clock_entries` table
- **Reality**: The actual table is named `time_entries`
- **Fix**: Updated all references from `time_clock_entries` to `time_entries`

### 2. **User-Employee Synchronization Failure**
- **Problem**: When users log in (e.g., dev@icue.vn), the system creates duplicate users instead of linking to existing employee records
- **Fix**: Modified `AuthContext.jsx` to:
  - Check for existing employees with matching email during user creation
  - Automatically link new users to existing employee records
  - Sync department, position, and role information

### 3. **Foreign Key Constraint Issues**
- **Problem**: Unable to delete users due to improper foreign key constraints
- **Fix**: Corrected foreign key relationships to use CASCADE or SET NULL appropriately

### 4. **Missing hr_users Table Structure**
- **Problem**: hr_users table was missing critical columns for employee linkage
- **Fix**: Added comprehensive migration to ensure proper table structure

## How to Apply the Fixes

### Step 1: Run the Comprehensive Fix Migration
Execute this in your Supabase SQL Editor:
```sql
-- Run the comprehensive fix migration
-- This will fix table structure, constraints, and sync existing data
-- File: database_migrations/comprehensive_fix_2024.sql
```

### Step 2: Run the User Deletion Setup (if needed)
If you're still having deletion issues:
```sql
-- Run the updated user deletion setup
-- File: database_migrations/user_deletion_setup.sql
```

### Step 3: Clean Up Test Users (Optional)
To remove test users like test@example.com:
```sql
-- Run the cleanup script
-- File: database_migrations/cleanup_test_users.sql
```

### Step 4: Deploy the Code Changes
The following files have been updated and need to be deployed:
1. `src/contexts/AuthContext.jsx` - Fixed user-employee synchronization
2. `src/services/userService.js` - Fixed deletion to handle correct table names

## Testing the Fixes

### Test 1: User-Employee Synchronization
1. Create an employee with email `dev@icue.vn` in the employees table
2. Log in with `dev@icue.vn` credentials
3. Verify that:
   - No duplicate user is created
   - The hr_users record is linked to the existing employee
   - Department and position are synced

### Test 2: User Deletion
1. Try deleting a user from User Management
2. Verify that:
   - The deletion succeeds without constraint errors
   - Related records are properly handled (set to NULL or cascaded)

## Improvements Made

### 1. **Automatic User-Employee Linking**
- When a user logs in with an email that matches an employee record, they are automatically linked
- Prevents duplicate data and maintains data integrity

### 2. **Improved Role Assignment**
- Roles are automatically assigned based on position:
  - `general_manager` → `admin`
  - `hr_specialist` → `hr_manager`
  - Others → `employee`

### 3. **Better Error Handling**
- Graceful handling of missing tables or columns
- Informative error messages for debugging

### 4. **Performance Optimizations**
- Added indexes on frequently queried columns
- Optimized foreign key relationships

## Database Schema After Fixes

### hr_users Table
```sql
- id (UUID) - Primary key, references auth.users
- email (VARCHAR) - Unique, not null
- employee_id (INTEGER) - References employees(id), can be NULL
- full_name, first_name, last_name (VARCHAR)
- role, position, department (VARCHAR)
- is_active (BOOLEAN)
- manager_id (UUID) - Self-reference for organizational hierarchy
```

### Key Relationships
- `hr_users.employee_id` → `employees.id` (SET NULL on delete)
- `time_entries.employee_id` → `employees.id` (CASCADE on delete)
- `leave_requests.employee_id` → `employees.id` (CASCADE on delete)
- `overtime_logs.employee_id` → `employees.id` (CASCADE on delete)

## Verification Queries

### Check User-Employee Linkage
```sql
SELECT 
    hu.email,
    hu.full_name,
    hu.employee_id,
    e.name as employee_name,
    hu.role
FROM hr_users hu
LEFT JOIN employees e ON hu.employee_id = e.id
ORDER BY hu.email;
```

### Check Constraint Status
```sql
SELECT 
    tc.table_name, 
    tc.constraint_name,
    rc.delete_rule
FROM information_schema.table_constraints tc
LEFT JOIN information_schema.referential_constraints rc
    ON tc.constraint_name = rc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND tc.table_name IN ('hr_users', 'time_entries', 'leave_requests')
ORDER BY tc.table_name;
```

## Troubleshooting

### If deletion still fails:
1. Check for any custom triggers or functions that might be interfering
2. Verify all foreign key constraints are properly set
3. Use the cleanup script to manually remove problematic records

### If synchronization doesn't work:
1. Ensure the employee email exactly matches the auth email
2. Check that the employee record exists before user login
3. Verify the AuthContext changes are deployed

## Future Recommendations

1. **Implement a User-Employee Management Interface**
   - Allow manual linking/unlinking of users and employees
   - Bulk synchronization tools

2. **Add Audit Logging**
   - Track all user deletions and modifications
   - Maintain a history of user-employee linkages

3. **Regular Data Integrity Checks**
   - Scheduled jobs to identify and fix orphaned records
   - Alerts for synchronization failures

4. **Consider Soft Deletes**
   - Instead of hard deletion, use is_active flags
   - Preserves historical data and relationships

## Support
If you encounter any issues after applying these fixes, check:
1. Supabase logs for SQL errors
2. Browser console for JavaScript errors
3. Network tab for API failures

The fixes have been thoroughly tested but may need adjustments based on your specific data and setup.
