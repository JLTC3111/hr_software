-- ============================================================
-- SEED EMPLOYEES AND HR_USERS FROM HARDCODED DATA
-- This migration moves data from App.jsx to database tables
-- ============================================================

-- ============================================================
-- STEP 1: INSERT INTO EMPLOYEES TABLE
-- ============================================================

-- Insert employees with ON CONFLICT to avoid duplicates
INSERT INTO employees (id, name, position, department, email, dob, address, phone, start_date, status, performance, photo)
VALUES
  (1, 'Trịnh Thị Tình', 'general_manager', 'legal_compliance', 'info@icue.vn', '2000-01-01', 'Hà Nội', '+84 909 999 999', '2015-01-15', 'Active', 4.2, 'employeeProfilePhotos/tinh.png'),
  (2, 'Đỗ Bảo Long', 'senior_developer', 'technology', 'dev@icue.vn', '2000-01-01', 'Hà Nội', '+84 375889900', '2017-08-20', 'onLeave', 4.6, 'employeeProfilePhotos/longdo.jpg'),
  (3, 'Nguyễn Thị Ly', 'hr_specialist', 'human_resources', 'support@icue.vn', '2000-01-01', 'Hà Nội', '+84 909 999 999', '2023-03-10', 'Active', 4.1, 'employeeProfilePhotos/lyly.png'),
  (4, 'Nguyễn Thị Hiến', 'accountant', 'finance', 'billing@icue.vn', '2000-01-01', 'Hà Nội', '+84 909 999 999', '2021-11-05', 'Active', 4.3, 'employeeProfilePhotos/hien.png'),
  (5, 'Nguyễn Quỳnh Ly', 'contract_manager', 'office_unit', 'contract@icue.vn', '2000-01-01', 'Hà Nội', '+84 909 999 999', '2023-06-01', 'Active', 3.4, 'employeeProfilePhotos/quynhly.png'),
  (6, 'Nguyễn Hồng Hạnh', 'managing_director', 'board_of_directors', 'hanhnguyen@icue.vn', '2000-01-01', 'Hà Nội', '+84 909 999 999', '2017-08-20', 'Active', 4.4, 'employeeProfilePhotos/nguyenhonghanh.jpg'),
  (7, 'Đinh Tùng Dương', 'support_staff', 'office_unit', 'duong@icue.vn', '2000-01-01', 'Hà Nội', '+84 909 999 999', '2017-08-20', 'Inactive', 3.0, 'employeeProfilePhotos/duong.png')
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  position = EXCLUDED.position,
  department = EXCLUDED.department,
  dob = EXCLUDED.dob,
  address = EXCLUDED.address,
  phone = EXCLUDED.phone,
  start_date = EXCLUDED.start_date,
  status = EXCLUDED.status,
  performance = EXCLUDED.performance,
  photo = EXCLUDED.photo;

-- ============================================================
-- STEP 2: UPDATE EXISTING HR_USERS WITH EMPLOYEE DATA
-- This syncs any existing hr_users with the employee records
-- ============================================================

UPDATE hr_users hu
SET 
    employee_id = e.id,
    full_name = e.name,
    department = e.department,
    position = e.position,
    phone = e.phone,
    hire_date = e.start_date,
    employment_status = CASE 
        WHEN e.status = 'Active' THEN 'active'
        WHEN e.status = 'onLeave' THEN 'on_leave'
        WHEN e.status = 'Inactive' THEN 'terminated'
        ELSE 'active'
    END,
    is_active = CASE 
        WHEN e.status = 'Inactive' THEN false
        ELSE true
    END,
    role = CASE 
        WHEN e.position = 'general_manager' THEN 'admin'
        WHEN e.position = 'managing_director' THEN 'admin'
        WHEN e.position = 'hr_specialist' THEN 'hr_manager'
        WHEN e.position IN ('senior_developer', 'contract_manager') THEN 'manager'
        ELSE 'employee'
    END,
    avatar_url = e.photo
FROM employees e
WHERE hu.email = e.email;

-- ============================================================
-- STEP 3: HELPER FUNCTION TO CREATE HR_USER WHEN AUTH USER EXISTS
-- This function should be called after auth users are created
-- ============================================================

CREATE OR REPLACE FUNCTION sync_employee_to_hr_user(employee_email VARCHAR)
RETURNS VOID AS $$
DECLARE
    emp_record RECORD;
    auth_user_id UUID;
    first_name_part VARCHAR;
    last_name_part VARCHAR;
BEGIN
    -- Get employee record
    SELECT * INTO emp_record
    FROM employees
    WHERE email = employee_email;
    
    IF emp_record IS NULL THEN
        RAISE EXCEPTION 'Employee with email % not found', employee_email;
    END IF;
    
    -- Check if auth user exists
    SELECT id INTO auth_user_id
    FROM auth.users
    WHERE email = employee_email;
    
    IF auth_user_id IS NULL THEN
        RAISE EXCEPTION 'Auth user with email % not found. Create auth user first.', employee_email;
    END IF;
    
    -- Split name into first and last name
    first_name_part := split_part(emp_record.name, ' ', 1);
    last_name_part := substring(emp_record.name from length(split_part(emp_record.name, ' ', 1)) + 2);
    
    -- Insert or update hr_users
    INSERT INTO hr_users (
        id,
        email,
        full_name,
        first_name,
        last_name,
        phone,
        avatar_url,
        role,
        department,
        position,
        employee_id,
        hire_date,
        employment_status,
        is_active
    )
    VALUES (
        auth_user_id,
        emp_record.email,
        emp_record.name,
        first_name_part,
        last_name_part,
        emp_record.phone,
        emp_record.photo,
        CASE 
            WHEN emp_record.position = 'general_manager' THEN 'admin'
            WHEN emp_record.position = 'managing_director' THEN 'admin'
            WHEN emp_record.position = 'hr_specialist' THEN 'hr_manager'
            WHEN emp_record.position IN ('senior_developer', 'contract_manager') THEN 'manager'
            ELSE 'employee'
        END,
        emp_record.department,
        emp_record.position,
        emp_record.id,
        emp_record.start_date,
        CASE 
            WHEN emp_record.status = 'Active' THEN 'active'
            WHEN emp_record.status = 'onLeave' THEN 'on_leave'
            WHEN emp_record.status = 'Inactive' THEN 'terminated'
            ELSE 'active'
        END,
        CASE 
            WHEN emp_record.status = 'Inactive' THEN false
            ELSE true
        END
    )
    ON CONFLICT (id) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        phone = EXCLUDED.phone,
        avatar_url = EXCLUDED.avatar_url,
        role = EXCLUDED.role,
        department = EXCLUDED.department,
        position = EXCLUDED.position,
        employee_id = EXCLUDED.employee_id,
        hire_date = EXCLUDED.hire_date,
        employment_status = EXCLUDED.employment_status,
        is_active = EXCLUDED.is_active;
        
    RAISE NOTICE 'Synced employee % to hr_users', employee_email;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- VERIFICATION QUERIES
-- ============================================================

-- Check employees
SELECT 
    id,
    name,
    email,
    position,
    department,
    status
FROM employees
ORDER BY id;

-- Check hr_users sync status
SELECT 
    e.id as employee_id,
    e.email,
    e.name,
    CASE 
        WHEN hu.id IS NOT NULL THEN '✅ Synced'
        ELSE '❌ Not Synced (need auth user)'
    END as sync_status,
    hu.role,
    hu.is_active
FROM employees e
LEFT JOIN hr_users hu ON e.email = hu.email
ORDER BY e.id;

-- ============================================================
-- USAGE INSTRUCTIONS
-- ============================================================

/*
After running this migration:

1. The employees table will have all 7 employees
2. Any existing hr_users will be updated with employee data
3. For NEW auth users, you need to:
   
   Option A - Use Supabase Dashboard:
   - Go to Authentication > Users
   - Manually create users for each email
   - Then run: SELECT sync_employee_to_hr_user('email@example.com');
   
   Option B - Use the seeding script:
   - Run the JavaScript seeding script (seed_users.js)
   - It will create auth users and sync them automatically

4. To sync a specific employee after creating their auth account:
   SELECT sync_employee_to_hr_user('info@icue.vn');
   SELECT sync_employee_to_hr_user('dev@icue.vn');
   SELECT sync_employee_to_hr_user('support@icue.vn');
   SELECT sync_employee_to_hr_user('billing@icue.vn');
   SELECT sync_employee_to_hr_user('contract@icue.vn');
   SELECT sync_employee_to_hr_user('hanhnguyen@icue.vn');
   SELECT sync_employee_to_hr_user('duong@icue.vn');
*/

SELECT '✅ Migration completed! Check verification queries above.' AS status;
