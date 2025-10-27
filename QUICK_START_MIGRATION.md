# Quick Start: Migrate Hardcoded Employees to Database

## TL;DR - 5 Minute Setup

### 1. Add Service Role Key to .env
```bash
# Add this line to your .env file
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```
Get it from: Supabase Dashboard → Settings → API → Service Role Key

### 2. Run SQL Migration
Open Supabase SQL Editor and execute:
```bash
database_migrations/seed_employees_and_users.sql
```

### 3. Install Dependencies & Run Seeder
```bash
npm install
npm run seed:users
```

### 4. Verify
Login with any of these accounts:
- info@icue.vn
- dev@icue.vn
- support@icue.vn
- billing@icue.vn
- contract@icue.vn
- hanhnguyen@icue.vn
- duong@icue.vn

**Password**: `IcueHR2024!`

### 5. Clean Up App.jsx
Remove or comment out lines 13-112 (the hardcoded Employees array)

---

## What Gets Created

### In Database:
✅ 7 employees in `employees` table  
✅ 7 auth users in Supabase Auth  
✅ 7 linked records in `hr_users` table  

### Role Assignments:
- **Admins**: Trịnh Thị Tình, Nguyễn Hồng Hạnh
- **HR Manager**: Nguyễn Thị Ly
- **Managers**: Đỗ Bảo Long, Nguyễn Quỳnh Ly
- **Employees**: Nguyễn Thị Hiến, Đinh Tùng Dương

---

## If Something Goes Wrong

### Can't create auth users?
→ Check your Service Role Key is correct in `.env`

### Script says "Employee not found"?
→ Run the SQL migration first (step 2)

### Need to start over?
```sql
-- Delete all created data
DELETE FROM hr_users WHERE email LIKE '%@icue.vn';
DELETE FROM employees WHERE id <= 7;
```
Then manually delete auth users from Supabase Dashboard

---

## Files Created

📄 **database_migrations/seed_employees_and_users.sql** - SQL migration  
📄 **scripts/seedUsers.js** - JavaScript seeder  
📄 **MIGRATION_GUIDE.md** - Detailed documentation  
📄 **package.json** - Updated with seed script  

---

## After Migration

1. ✅ Test login with each account
2. ✅ Verify dashboard loads employee data
3. ✅ Check User Management page shows all users
4. ✅ Remove hardcoded array from App.jsx
5. ✅ Commit changes to git

**Default password**: `IcueHR2024!`  
**Important**: Users should change password on first login!
