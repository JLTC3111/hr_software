SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'users' AND table_schema = 'public'
ORDER BY ordinal_position;

-- Migration query
INSERT INTO public.hr_users (
    id,
    email,
    first_name,
    last_name,
    role,
    employment_status,
    created_at
)
SELECT 
    id,  -- Using 'id' column
    email,
    -- Split full_name into first_name and last_name
    CASE 
        WHEN full_name IS NOT NULL AND position(' ' in full_name) > 0 
        THEN split_part(full_name, ' ', 1)
        ELSE COALESCE(full_name, split_part(email, '@', 1))
    END as first_name,
    CASE 
        WHEN full_name IS NOT NULL AND position(' ' in full_name) > 0 
        THEN substring(full_name from position(' ' in full_name) + 1)
        ELSE NULL
    END as last_name,
    -- Map old roles to new HR roles
    CASE 
        WHEN role = 'admin' THEN 'hr_admin'
        WHEN role = 'editor' THEN 'hr_manager'
        WHEN role = 'viewer' THEN 'employee'
        WHEN role = 'approver' THEN 'hr_manager'
        ELSE 'employee'
    END as role,
    'active' as employment_status,
    created_at
FROM public.users
WHERE 
    -- Only migrate users that exist in auth.users
    id IN (SELECT id FROM auth.users)
    -- And don't migrate if already exists in hr_users
    AND id NOT IN (SELECT id FROM public.hr_users)
ON CONFLICT (id) DO NOTHING;

-- Continue with the rest of the migration...
UPDATE public.hr_users 
SET 
    department = 'Human Resources',
    position = 'HR Administrator'
WHERE role = 'hr_admin' AND department IS NULL;

UPDATE public.hr_users 
SET 
    department = 'Human Resources',
    position = 'HR Manager'
WHERE role = 'hr_manager' AND department IS NULL;

-- Create employee IDs using a CTE (Common Table Expression)
WITH numbered_users AS (
    SELECT 
        id,
        'EMP' || LPAD(ROW_NUMBER() OVER (ORDER BY created_at)::TEXT, 3, '0') as new_employee_id
    FROM public.hr_users 
    WHERE employee_id IS NULL
)
UPDATE public.hr_users 
SET employee_id = numbered_users.new_employee_id
FROM numbered_users
WHERE public.hr_users.id = numbered_users.id;