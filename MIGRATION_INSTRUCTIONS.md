# Migration Instructions - HR Software Supabase Upgrade

## 🎯 Overview
This document provides step-by-step instructions to complete the migration from localStorage/mock data to a fully Supabase-backed HR Management System.

---

## 📋 Prerequisites

Before starting, ensure you have:

1. ✅ **Supabase Project** - Active Supabase project with credentials
2. ✅ **Environment Variables** - `.env` file with Supabase URL and keys
3. ✅ **Database Access** - Access to Supabase SQL Editor or CLI
4. ✅ **Backup** - Backup of any existing data in localStorage

---

## 🚀 Step-by-Step Migration Process

### Step 1: Run SQL Migrations

You need to run the migration files in Supabase to create the new tables.

#### Option A: Using Supabase SQL Editor (Recommended)

1. **Open Supabase Dashboard**
   - Go to https://app.supabase.com
   - Select your project
   - Navigate to **SQL Editor** from the left sidebar

2. **Run Migration 005 - Recruitment Tables**
   ```
   - Open file: supabase/migrations/005_recruitment_tables.sql
   - Copy the entire content
   - Paste in SQL Editor
   - Click "Run" or press Ctrl+Enter
   - Wait for success message
   ```

3. **Run Migration 006 - Performance Tables**
   ```
   - Open file: supabase/migrations/006_performance_tables.sql
   - Copy the entire content
   - Paste in SQL Editor
   - Click "Run"
   - Wait for success message
   ```

4. **Verify Tables Created**
   ```sql
   -- Run this query to verify all tables exist
   SELECT table_name 
   FROM information_schema.tables 
   WHERE table_schema = 'public' 
   AND table_name IN (
     'employees',
     'time_entries',
     'leave_requests',
     'overtime_logs',
     'time_tracking_summary',
     'job_postings',
     'job_applications',
     'interview_schedules',
     'performance_reviews',
     'performance_goals',
     'goal_milestones',
     'skills_assessments',
     'employee_feedback'
   )
   ORDER BY table_name;
   ```
   
   **Expected result:** Should return 13 rows (all table names)

#### Option B: Using Supabase CLI

If you have Supabase CLI installed:

```bash
# Make sure you're in the project directory
cd /Users/skycastle3/Desktop/hr_software

# Run migrations
supabase db push

# Or run specific migrations
supabase migration up
```

---

### Step 2: Verify Database Schema

After running migrations, verify the schema:

1. **Check Tables**
   ```sql
   -- View all tables
   SELECT 
     table_name,
     (SELECT COUNT(*) FROM information_schema.columns 
      WHERE table_name = t.table_name) as column_count
   FROM information_schema.tables t
   WHERE table_schema = 'public'
   ORDER BY table_name;
   ```

2. **Check Views**
   ```sql
   -- View all created views
   SELECT table_name 
   FROM information_schema.views 
   WHERE table_schema = 'public';
   ```
   
   **Expected views:**
   - `applications_detailed`
   - `recruitment_pipeline`
   - `upcoming_interviews`
   - `employee_performance_summary`
   - `goals_with_progress`
   - `skills_matrix`
   - `time_entries_detailed`
   - `monthly_attendance_summary`

3. **Check Row Level Security (RLS)**
   ```sql
   -- Verify RLS is enabled
   SELECT tablename, rowsecurity 
   FROM pg_tables 
   WHERE schemaname = 'public' 
   AND rowsecurity = true;
   ```

---

### Step 3: Seed Initial Data

The application will automatically seed employee data on first run, but you can manually seed if needed:

#### Automatic Seeding (Recommended)
- The app will detect if the `employees` table is empty
- It will automatically insert the 7 default employees from the hardcoded array
- No action needed - just start the app!

#### Manual Seeding (Optional)

If you want to manually seed data:

```sql
-- Seed employees (already in migration if you ran 001_time_tracking_tables.sql)
INSERT INTO employees (name, position, department, email, dob, address, phone, start_date, status, performance, photo) 
VALUES
  ('Trịnh Thị Tình', 'general_manager', 'legal_compliance', 'info@icue.vn', '2000-01-01', 'Hà Nội', '+84 909 999 999', '2015-01-15', 'Active', 4.2, 'employeeProfilePhotos/tinh.png'),
  ('Đỗ Bảo Long', 'senior_developer', 'internal_ affairs', 'dev@icue.vn', '2000-01-01', 'Hà Nội', '+84 375889900', '2017-08-20', 'onLeave', 4.6, 'employeeProfilePhotos/longdo.jpg'),
  ('Nguyễn Thị Ly', 'hr_specialist', 'human_resources', 'support@icue.vn', '2000-01-01', 'Hà Nội', '+84 909 999 999', '2023-03-10', 'Active', 4.1, 'employeeProfilePhotos/lyly.png'),
  ('Nguyễn Thị Hiến', 'accountant', 'finance', 'billing@icue.vn', '2000-01-01', 'Hà Nội', '+84 909 999 999', '2021-11-05', 'Active', 4.3, 'employeeProfilePhotos/hien.png'),
  ('Nguyễn Quỳnh Ly', 'contract_manager', 'office_unit', 'contract@icue.vn', '2000-01-01', 'Hà Nội', '+84 909 999 999', '2023-06-01', 'Active', 3.4, 'employeeProfilePhotos/quynhly.png'),
  ('Nguyễn Hồng Hạnh', 'managing_director', 'board_of_directors', 'hanhnguyen@icue.vn', '2000-01-01', 'Hà Nội', '+84 909 999 999', '2017-08-20', 'Active', 4.4, 'employeeProfilePhotos/nguyenhonghanh.jpg'),
  ('Đinh Tùng Dương', 'support_staff', 'office_unit', 'support@icue.vn', '2000-01-01', 'Hà Nội', '+84 909 999 999', '2017-08-20', 'Inactive', 3.0, 'employeeProfilePhotos/duong.png')
ON CONFLICT (email) DO NOTHING;
```

---

### Step 4: Configure Supabase Storage

Set up storage bucket for employee photos and documents:

1. **Create Storage Bucket**
   - Go to **Storage** in Supabase Dashboard
   - Click "New bucket"
   - Name: `hr-documents`
   - Set to **Public** (for employee photos)
   - Click "Create bucket"

2. **Set Bucket Policies**
   ```sql
   -- Allow public read access to photos
   CREATE POLICY "Public Access for Employee Photos"
   ON storage.objects FOR SELECT
   USING (bucket_id = 'hr-documents' AND (storage.foldername(name))[1] = 'employee-photos');

   -- Allow authenticated users to upload
   CREATE POLICY "Authenticated users can upload"
   ON storage.objects FOR INSERT
   WITH CHECK (bucket_id = 'hr-documents' AND auth.role() = 'authenticated');
   ```

---

### Step 5: Test the Application

1. **Start the Development Server**
   ```bash
   npm run dev
   ```

2. **Verify Employee Data**
   - Navigate to `/employees`
   - Confirm employees are loaded from Supabase
   - Check that all 7 employees are displayed
   - Try searching and filtering

3. **Test Adding New Employee**
   - Click "Add Employee"
   - Fill in all required fields
   - Submit form
   - Verify employee appears in list
   - Check Supabase dashboard to confirm data is saved

4. **Test Photo Upload**
   - Click on an employee card
   - Upload a new photo
   - Verify photo is uploaded to Supabase Storage
   - Check Storage bucket in Supabase dashboard

5. **Test Dashboard**
   - Navigate to `/dashboard`
   - Verify real-time data is displayed
   - Check that statistics are accurate
   - Confirm charts render correctly

6. **Test Time Tracking**
   - Navigate to `/time-clock`
   - Submit a time entry
   - Verify it saves to Supabase
   - Check time tracking summary updates

---

### Step 6: Clean Up (Optional)

Once you've verified everything works:

1. **Remove localStorage Data**
   ```javascript
   // Open browser console on your app
   localStorage.removeItem('employees');
   localStorage.removeItem('employeePhotos');
   localStorage.clear(); // Remove all localStorage data
   ```

2. **Remove Hardcoded Arrays**
   - The `Employees` and `Applications` arrays in `App.jsx` can stay as fallback seed data
   - Or you can remove them after confirming seeding works

---

## 🔍 Troubleshooting

### Issue: "Error fetching employees"

**Cause:** Connection to Supabase failed

**Solution:**
1. Check `.env` file has correct credentials
2. Verify Supabase project is active
3. Check RLS policies allow reading employees table
4. Temporarily disable RLS for testing:
   ```sql
   ALTER TABLE employees DISABLE ROW LEVEL SECURITY;
   ```

### Issue: "No employees displayed"

**Cause:** Table is empty and seeding didn't work

**Solution:**
1. Check browser console for errors
2. Manually run seed SQL (see Step 3)
3. Verify `getAllEmployees` service call works:
   ```javascript
   // In browser console
   import { getAllEmployees } from './services/employeeService';
   getAllEmployees().then(console.log);
   ```

### Issue: "Photo upload fails"

**Cause:** Storage bucket not configured

**Solution:**
1. Verify `hr-documents` bucket exists
2. Check bucket is set to public
3. Verify storage policies are created
4. Test upload manually in Supabase dashboard

### Issue: "RLS prevents data access"

**Cause:** Row Level Security policies are too restrictive

**Solution:**
1. For development, temporarily disable RLS:
   ```sql
   -- Run this for ALL tables
   ALTER TABLE employees DISABLE ROW LEVEL SECURITY;
   ALTER TABLE job_postings DISABLE ROW LEVEL SECURITY;
   ALTER TABLE job_applications DISABLE ROW LEVEL SECURITY;
   -- etc...
   ```

2. Or update policies to be more permissive:
   ```sql
   -- Allow all authenticated users to read employees
   CREATE POLICY "Allow read for authenticated users" ON employees
     FOR SELECT USING (auth.role() = 'authenticated');
   ```

### Issue: "Migration fails with foreign key error"

**Cause:** Tables referenced in foreign keys don't exist yet

**Solution:**
1. Ensure migrations run in correct order
2. Run `001_time_tracking_tables.sql` first (creates employees table)
3. Then run `005_recruitment_tables.sql` and `006_performance_tables.sql`

---

## ✅ Verification Checklist

Use this checklist to ensure migration is complete:

### Database
- [ ] All 13 tables created successfully
- [ ] All 8 views created successfully
- [ ] RLS enabled on all tables
- [ ] Triggers and functions created
- [ ] Storage bucket `hr-documents` created
- [ ] Employee data seeded (7 employees minimum)

### Application
- [ ] App starts without errors
- [ ] Employees load from Supabase
- [ ] Can add new employees
- [ ] Can upload employee photos
- [ ] Dashboard shows real data
- [ ] Time tracking works
- [ ] No console errors
- [ ] Loading states work correctly

### Features
- [ ] Employee CRUD operations work
- [ ] Search and filter work
- [ ] Photo upload/update works
- [ ] Dashboard analytics accurate
- [ ] Time clock entry works
- [ ] Leave requests work
- [ ] Overtime logs work

---

## 📊 What's Been Upgraded

### ✅ Phase 1 Completed

| Component | Before | After | Status |
|-----------|--------|-------|--------|
| **App.jsx** | localStorage + hardcoded arrays | Supabase `employeeService` + `recruitmentService` | ✅ Done |
| **Employee Data** | localStorage only | PostgreSQL database | ✅ Done |
| **Applications Data** | Hardcoded array | `job_applications` table | ✅ Done |
| **Photo Storage** | localStorage base64 | Supabase Storage | ✅ Done |

### ⏳ Phase 2 Pending (Next Steps)

Still need to update these components:

1. **recruitment.jsx** - Update to use `recruitmentService`
2. **performanceAppraisal.jsx** - Update to use `performanceService`
3. **reports.jsx** - Update to use real aggregated data
4. **addEmployeeModal.jsx** - Add photo upload during creation

---

## 🎯 Next Development Tasks

After completing this migration:

1. **Update Recruitment Component**
   ```bash
   # File: src/components/recruitment.jsx
   - Replace Applications array with recruitmentService calls
   - Add job posting management
   - Implement interview scheduling
   ```

2. **Update Performance Component**
   ```bash
   # File: src/components/performanceAppraisal.jsx
   - Replace mock data with performanceService calls
   - Implement goal management
   - Add skills assessment UI
   ```

3. **Enhance Reports**
   ```bash
   # File: src/components/reports.jsx
   - Use real aggregated data from views
   - Add export functionality
   - Implement custom report builder
   ```

4. **Add Real-time Features**
   ```javascript
   - Subscribe to employee changes
   - Live dashboard updates
   - Real-time notifications
   ```

---

## 📚 Additional Resources

- **Supabase Documentation:** https://supabase.com/docs
- **PostgreSQL Docs:** https://www.postgresql.org/docs/
- **Service Files:**
  - `src/services/employeeService.js`
  - `src/services/recruitmentService.js`
  - `src/services/performanceService.js`
  - `src/services/timeTrackingService.js` (existing)

---

## 🆘 Getting Help

If you encounter issues:

1. Check browser console for errors
2. Check Supabase logs in dashboard
3. Review RLS policies
4. Test service functions individually
5. Verify environment variables

---

## 🎉 Success!

Once all checklist items are complete, your HR Management System is fully migrated to Supabase!

**Key Benefits Achieved:**
- ✅ Persistent data storage
- ✅ Multi-user support
- ✅ Real-time synchronization
- ✅ Scalable architecture
- ✅ Professional-grade database
- ✅ Automatic backups
- ✅ Row-level security

---

*Last Updated: October 20, 2025*  
*Migration Version: 1.0*
