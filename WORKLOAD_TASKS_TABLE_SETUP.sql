-- =============================================
-- Workload Tasks Table Setup for HR Software
-- =============================================
-- This script creates the workload_tasks table for task management
-- Run this in Supabase SQL Editor

-- Drop existing table if needed (CAUTION: removes all data)
-- DROP TABLE IF EXISTS public.workload_tasks CASCADE;

-- Create workload_tasks table
CREATE TABLE IF NOT EXISTS public.workload_tasks (
    id BIGSERIAL PRIMARY KEY,
    employee_id TEXT NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    due_date DATE,
    priority TEXT CHECK (priority IN ('low', 'medium', 'high')) DEFAULT 'medium',
    status TEXT CHECK (status IN ('pending', 'in-progress', 'completed', 'cancelled')) DEFAULT 'pending',
    self_assessment TEXT,
    quality_rating INTEGER CHECK (quality_rating >= 0 AND quality_rating <= 5) DEFAULT 0,
    comments TEXT,
    created_by TEXT REFERENCES public.employees(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_workload_tasks_employee_id ON public.workload_tasks(employee_id);
CREATE INDEX IF NOT EXISTS idx_workload_tasks_status ON public.workload_tasks(status);
CREATE INDEX IF NOT EXISTS idx_workload_tasks_due_date ON public.workload_tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_workload_tasks_priority ON public.workload_tasks(priority);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_workload_tasks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_workload_tasks_updated_at
    BEFORE UPDATE ON public.workload_tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_workload_tasks_updated_at();

-- =============================================
-- Row Level Security (RLS) Policies
-- =============================================

-- Enable RLS
ALTER TABLE public.workload_tasks ENABLE ROW LEVEL SECURITY;

-- Policy: Allow authenticated users to view all tasks
CREATE POLICY "Users can view all workload tasks"
    ON public.workload_tasks
    FOR SELECT
    USING (auth.role() = 'authenticated');

-- Policy: Allow users to create tasks for any employee (managers/admins assign tasks)
CREATE POLICY "Authenticated users can create workload tasks"
    ON public.workload_tasks
    FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

-- Policy: Allow users to update tasks
-- Employees can update their own tasks, managers/admins can update all tasks
CREATE POLICY "Users can update workload tasks"
    ON public.workload_tasks
    FOR UPDATE
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

-- Policy: Allow managers/admins to delete tasks
CREATE POLICY "Users can delete workload tasks"
    ON public.workload_tasks
    FOR DELETE
    USING (auth.role() = 'authenticated');

-- =============================================
-- Sample Data (Optional - for testing)
-- =============================================

-- Insert sample tasks (uncomment to use)
-- INSERT INTO public.workload_tasks (employee_id, title, description, due_date, priority, status, quality_rating)
-- VALUES 
--     (1, 'Complete Q4 Performance Reviews', 'Review and complete performance evaluations for all team members', '2025-11-15', 'high', 'in-progress', 0),
--     (1, 'Update Employee Handbook', 'Revise sections on remote work policy and benefits', '2025-11-30', 'medium', 'pending', 0),
--     (2, 'Process October Payroll', 'Ensure all time entries are approved and process monthly payroll', '2025-11-05', 'high', 'completed', 5),
--     (2, 'Conduct Exit Interviews', 'Schedule and complete exit interviews for departing employees', '2025-11-10', 'medium', 'in-progress', 0);

-- =============================================
-- Verification Queries
-- =============================================

-- Check table structure
-- SELECT column_name, data_type, is_nullable, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'workload_tasks'
-- ORDER BY ordinal_position;

-- Check RLS policies
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
-- FROM pg_policies
-- WHERE tablename = 'workload_tasks';

-- Count tasks
-- SELECT COUNT(*) FROM public.workload_tasks;

-- View all tasks with employee names
-- SELECT 
--     wt.*,
--     e.name as employee_name,
--     e.department
-- FROM public.workload_tasks wt
-- JOIN public.employees e ON wt.employee_id = e.id
-- ORDER BY wt.due_date ASC;
