-- HR-Specific Users Table
-- This replaces the need to use the existing users table from another app

-- Drop the table if it exists (be careful with this in production!)
-- DROP TABLE IF EXISTS public.hr_users;

-- Create the dedicated HR users table
CREATE TABLE public.hr_users (
    -- Authentication fields
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    
    -- Personal information
    first_name TEXT,
    last_name TEXT,
    full_name TEXT GENERATED ALWAYS AS (
        CASE 
            WHEN first_name IS NOT NULL AND last_name IS NOT NULL 
            THEN first_name || ' ' || last_name
            ELSE COALESCE(first_name, last_name, split_part(email, '@', 1))
        END
    ) STORED,
    phone TEXT,
    avatar_url TEXT,
    
    -- HR-specific fields
    employee_id TEXT UNIQUE, -- Company employee ID
    department TEXT,
    position TEXT,
    manager_id UUID REFERENCES public.hr_users(id),
    hire_date DATE,
    employment_status TEXT DEFAULT 'active' CHECK (employment_status IN ('active', 'inactive', 'terminated', 'on_leave')),
    salary DECIMAL(12,2),
    
    -- System fields
    role TEXT NOT NULL DEFAULT 'employee' CHECK (role IN ('hr_admin', 'hr_manager', 'employee', 'contractor')),
    is_active BOOLEAN DEFAULT TRUE,
    last_login TIMESTAMPTZ,
    
    -- Password management fields
    must_change_password BOOLEAN DEFAULT FALSE,
    temporary_password_set_at TIMESTAMPTZ,
    password_changed_at TIMESTAMPTZ,
    
    -- Audit fields
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES public.hr_users(id),
    updated_by UUID REFERENCES public.hr_users(id)
);

-- Create indexes for better performance
CREATE INDEX idx_hr_users_email ON public.hr_users(email);
CREATE INDEX idx_hr_users_department ON public.hr_users(department);
CREATE INDEX idx_hr_users_role ON public.hr_users(role);
CREATE INDEX idx_hr_users_employee_id ON public.hr_users(employee_id);
CREATE INDEX idx_hr_users_manager_id ON public.hr_users(manager_id);
CREATE INDEX idx_hr_users_active ON public.hr_users(is_active);

-- Update the updated_at timestamp automatically
CREATE OR REPLACE FUNCTION update_hr_users_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_hr_users_updated_at
    BEFORE UPDATE ON public.hr_users
    FOR EACH ROW
    EXECUTE FUNCTION update_hr_users_updated_at();

-- Row Level Security (RLS) policies
ALTER TABLE public.hr_users ENABLE ROW LEVEL SECURITY;

-- Policy for users to read their own data
CREATE POLICY "Users can view their own profile" ON public.hr_users
    FOR SELECT USING (auth.uid() = id);

-- Policy for HR admins and managers to read all user data
CREATE POLICY "HR staff can view all profiles" ON public.hr_users
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.hr_users 
            WHERE id = auth.uid() 
            AND role IN ('hr_admin', 'hr_manager')
            AND is_active = TRUE
        )
    );

-- Policy for HR admins to manage all users
CREATE POLICY "HR admins can manage all users" ON public.hr_users
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.hr_users 
            WHERE id = auth.uid() 
            AND role = 'hr_admin'
            AND is_active = TRUE
        )
    );

-- Policy for HR managers to manage non-admin users
CREATE POLICY "HR managers can manage employees" ON public.hr_users
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.hr_users 
            WHERE id = auth.uid() 
            AND role = 'hr_manager'
            AND is_active = TRUE
        )
        AND role NOT IN ('hr_admin')
    );

-- Policy for users to update their own basic info (limited fields)
CREATE POLICY "Users can update own basic info" ON public.hr_users
    FOR UPDATE USING (auth.uid() = id)
    WITH CHECK (
        -- Prevent users from changing critical fields
        (OLD.role = NEW.role) AND
        (OLD.employee_id = NEW.employee_id) AND
        (OLD.department = NEW.department) AND
        (OLD.position = NEW.position) AND
        (OLD.manager_id = NEW.manager_id) AND
        (OLD.hire_date = NEW.hire_date) AND
        (OLD.employment_status = NEW.employment_status) AND
        (OLD.salary = NEW.salary) AND
        (OLD.is_active = NEW.is_active)
    );

-- Insert a default admin user (update the UUID and email as needed)
-- This is just an example - you'll need to replace with actual values
INSERT INTO public.hr_users (
    id, 
    email, 
    first_name, 
    last_name,
    role, 
    department, 
    position,
    employee_id,
    hire_date
) VALUES (
    -- Replace this UUID with the actual UUID from auth.users for your admin
    '00000000-0000-0000-0000-000000000000', -- REPLACE WITH REAL UUID
    'admin@yourcompany.com', -- REPLACE WITH REAL EMAIL
    'System',
    'Administrator',
    'hr_admin',
    'Human Resources',
    'HR Administrator',
    'EMP001',
    CURRENT_DATE
) ON CONFLICT (id) DO NOTHING;

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hr_users TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;