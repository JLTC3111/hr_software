# Migration Guide: Hardcoded Employees to Database

This guide explains how to migrate the hardcoded employee data from `App.jsx` to the database tables (`employees` and `hr_users`).

## Overview

The hardcoded `Employees` array in `App.jsx` (lines 13-112) contains 7 employees:
1. Trịnh Thị Tình (info@icue.vn) - General Manager
2. Đỗ Bảo Long (dev@icue.vn) - Senior Developer
3. Nguyễn Thị Ly (support@icue.vn) - HR Specialist
4. Nguyễn Thị Hiến (billing@icue.vn) - Accountant
5. Nguyễn Quỳnh Ly (contract@icue.vn) - Contract Manager
6. Nguyễn Hồng Hạnh (hanhnguyen@icue.vn) - Managing Director
7. Đinh Tùng Dương (duong@icue.vn) - Support Staff

## Prerequisites

1. ✅ Completed database fixes from `comprehensive_fix_2024.sql`
2. ✅ Have Supabase Service Role Key (for creating auth users)
3. ✅ Node.js installed
4. ✅ npm packages installed

## Migration Steps

### Step 1: Install Dependencies

```bash
npm install
```

This will install the required `dotenv` package.

### Step 2: Configure Service Role Key

Add your Supabase Service Role Key to `.env`:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

**⚠️ IMPORTANT**: The Service Role Key is in Supabase Dashboard > Settings > API > Service Role Key

### Step 3: Run SQL Migration

Execute in Supabase SQL Editor:

```sql
-- This creates employees records and helper functions
-- File: database_migrations/seed_employees_and_users.sql
```

Copy and paste the entire content of `seed_employees_and_users.sql` into the SQL Editor and run it.

**What this does:**
- ✅ Inserts all 7 employees into `employees` table
- ✅ Updates any existing `hr_users` with employee data
- ✅ Creates helper function `sync_employee_to_hr_user()`

### Step 4: Run JavaScript Seeding Script

```bash
npm run seed:users
```

**What this does:**
- ✅ Creates auth users for each employee (via Supabase Auth)
- ✅ Creates corresponding `hr_users` records
- ✅ Links `hr_users` to `employees` table
- ✅ Assigns appropriate roles based on position

**Default Password**: All users will have password `IcueHR2024!`  
Users should change this on first login.

### Step 5: Verify Migration

1. **Check Supabase Dashboard**:
   - Go to Authentication > Users
   - You should see 7 users created

2. **Run verification query** in SQL Editor:
   ```sql
   SELECT 
       e.id as employee_id,
       e.email,
       e.name,
       hu.full_name as hr_user_name,
       hu.role,
       hu.is_active,
       CASE 
           WHEN hu.id IS NOT NULL THEN '✅ Synced'
           ELSE '❌ Not Synced'
       END as sync_status
   FROM employees e
   LEFT JOIN hr_users hu ON e.email = hu.email
   ORDER BY e.id;
   ```

3. **Test Login**:
   - Try logging in with any employee email
   - Password: `IcueHR2024!`
   - Verify profile loads correctly

### Step 6: Update App.jsx

Once verified, remove or comment out the hardcoded `Employees` array:

```javascript
// src/App.jsx
// Lines 13-112

// ❌ DELETE OR COMMENT OUT THIS:
// const Employees = [
//   { id: 1, name: 'Trịnh Thị Tình', ... },
//   ...
// ];

// ✅ Data is now in database
```

### Step 7: Update Components

Ensure all components fetch from database instead of using hardcoded data:

**Already using database** ✅:
- `src/components/employee.jsx`
- `src/components/dashboard.jsx`
- `src/components/userManagement.jsx`

**May need updates** ⚠️:
- Check if `App.jsx` is passing hardcoded data to any components
- Search for references to the `Employees` constant

## Database Schema Mapping

### App.jsx → employees table

| App.jsx Field | employees Column | Notes |
|---------------|------------------|-------|
| `id` | `id` | Integer |
| `name` | `name` | VARCHAR(255) |
| `position` | `position` | VARCHAR(100) |
| `department` | `department` | VARCHAR(100) |
| `email` | `email` | VARCHAR(255), UNIQUE |
| `dob` | `dob` | DATE |
| `address` | `address` | TEXT |
| `phone` | `phone` | VARCHAR(50) |
| `startDate` | `start_date` | DATE |
| `status` | `status` | VARCHAR(50) |
| `performance` | `performance` | DECIMAL(3,2) |
| `photo` | `photo` | TEXT |

### App.jsx → hr_users table

| App.jsx Field | hr_users Column | Transformation |
|---------------|-----------------|----------------|
| `email` | `email` | Direct |
| `name` | `full_name` | Direct |
| `name` | `first_name` | Split by space (first part) |
| `name` | `last_name` | Split by space (remaining) |
| `phone` | `phone` | Direct |
| `position` | `position` | Direct |
| `department` | `department` | Direct |
| `photo` | `avatar_url` | Direct |
| `startDate` | `hire_date` | Renamed |
| `status` | `employment_status` | Mapped (see below) |
| `status` | `is_active` | Mapped (see below) |
| `position` | `role` | Mapped (see below) |

### Status Mapping

| App.jsx Status | employment_status | is_active |
|----------------|-------------------|-----------|
| `Active` | `active` | `true` |
| `onLeave` | `on_leave` | `true` |
| `Inactive` | `terminated` | `false` |

### Role Mapping

| Position | Role |
|----------|------|
| `general_manager` | `admin` |
| `managing_director` | `admin` |
| `hr_specialist` | `hr_manager` |
| `senior_developer` | `manager` |
| `contract_manager` | `manager` |
| `accountant` | `employee` |
| `support_staff` | `employee` |

## Troubleshooting

### Error: "Missing environment variables"
**Solution**: Make sure `SUPABASE_SERVICE_ROLE_KEY` is set in `.env`

### Error: "Auth user already exists"
**Solution**: This is normal if running multiple times. The script will skip and sync existing users.

### Error: "Employee record not found"
**Solution**: Run the SQL migration (`seed_employees_and_users.sql`) first.

### Error: "Permission denied"
**Solution**: 
- Verify you're using Service Role Key, not Anon Key
- Check RLS policies are disabled for admin operations

### Users can't log in
**Solution**:
1. Check auth users exist in Supabase Dashboard
2. Verify `email_confirm: true` was set during creation
3. Reset password via Supabase Dashboard if needed

## Manual Sync (Alternative Method)

If you prefer to create users manually in Supabase Dashboard:

1. Go to Authentication > Users > Add User
2. Enter email and password for each employee
3. After creating, run this SQL for each:

```sql
SELECT sync_employee_to_hr_user('info@icue.vn');
SELECT sync_employee_to_hr_user('dev@icue.vn');
SELECT sync_employee_to_hr_user('support@icue.vn');
SELECT sync_employee_to_hr_user('billing@icue.vn');
SELECT sync_employee_to_hr_user('contract@icue.vn');
SELECT sync_employee_to_hr_user('hanhnguyen@icue.vn');
SELECT sync_employee_to_hr_user('duong@icue.vn');
```

## Security Recommendations

1. **Change Default Passwords**: 
   - Force password change on first login
   - Implement password reset functionality

2. **Protect Service Role Key**:
   - Never commit `.env` to git
   - Store securely (use secrets manager in production)

3. **Audit Logging**:
   - Track who created/modified users
   - Monitor login attempts

4. **Remove Seeding Script in Production**:
   - Only use for initial setup
   - Delete or restrict access after migration

## Rollback Plan

If migration fails:

1. **Delete auth users** (via Supabase Dashboard)
2. **Clear hr_users**:
   ```sql
   DELETE FROM hr_users WHERE email IN (
     'info@icue.vn', 'dev@icue.vn', 'support@icue.vn',
     'billing@icue.vn', 'contract@icue.vn', 'hanhnguyen@icue.vn', 'duong@icue.vn'
   );
   ```
3. **Clear employees** (optional):
   ```sql
   DELETE FROM employees WHERE id BETWEEN 1 AND 7;
   ```
4. Restore hardcoded data in `App.jsx`

## Success Criteria

✅ All 7 employees exist in `employees` table  
✅ All 7 auth users created in Supabase Auth  
✅ All 7 hr_users records linked correctly  
✅ Users can log in successfully  
✅ Profile data loads correctly  
✅ No hardcoded data in `App.jsx`  

## Next Steps After Migration

1. **Test all features**:
   - Login/Logout
   - Dashboard displays
   - Employee management
   - User management

2. **Configure password policies**:
   - Implement password reset
   - Add password strength requirements

3. **Add more employees**:
   - Use the employee management interface
   - New employees will auto-sync with hr_users when they log in

4. **Clean up**:
   - Archive seeding scripts
   - Update documentation

## Support

If you encounter issues:
1. Check the console logs from the seeding script
2. Review Supabase logs in Dashboard
3. Verify all prerequisite migrations ran successfully
4. Refer to `DATABASE_FIXES_README.md` for related issues

---

**Migration Date**: {{ date }}  
**Version**: 1.0  
**Last Updated**: {{ date }}
