-- =====================================================
-- Migration: 013_performance_goals_system.sql
-- Description: Create tables for performance goals system
-- Author: HR Software Team
-- Date: 2024-10-24
-- =====================================================

-- Create performance_goals table (matching performanceService.js expectations)
DROP TABLE IF EXISTS public.performance_goals CASCADE;
CREATE TABLE IF NOT EXISTS public.performance_goals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id TEXT NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    category TEXT DEFAULT 'general',
    target_date DATE,
    status TEXT NOT NULL DEFAULT 'pending',
    progress_percentage INTEGER DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
    priority TEXT DEFAULT 'medium',
    assigned_by TEXT REFERENCES public.employees(id) ON DELETE SET NULL,
    assigned_date DATE DEFAULT CURRENT_DATE,
    started_date DATE,
    completed_date DATE,
    notes TEXT,
    success_criteria TEXT,
    related_review_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT valid_status CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled', 'on_hold')),
    CONSTRAINT valid_priority CHECK (priority IN ('low', 'medium', 'high', 'critical'))
);

-- Create performance_reviews table (matching performanceService.js expectations)
DROP TABLE IF EXISTS public.performance_reviews CASCADE;
CREATE TABLE IF NOT EXISTS public.performance_reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id TEXT NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    reviewer_id TEXT REFERENCES public.employees(id) ON DELETE SET NULL,
    review_period TEXT,
    review_type TEXT NOT NULL DEFAULT 'quarterly',
    overall_rating DECIMAL(2, 1) CHECK (overall_rating >= 0 AND overall_rating <= 5),
    technical_skills_rating DECIMAL(2, 1) CHECK (technical_skills_rating >= 0 AND technical_skills_rating <= 5),
    communication_rating DECIMAL(2, 1) CHECK (communication_rating >= 0 AND communication_rating <= 5),
    leadership_rating DECIMAL(2, 1) CHECK (leadership_rating >= 0 AND leadership_rating <= 5),
    teamwork_rating DECIMAL(2, 1) CHECK (teamwork_rating >= 0 AND teamwork_rating <= 5),
    problem_solving_rating DECIMAL(2, 1) CHECK (problem_solving_rating >= 0 AND problem_solving_rating <= 5),
    strengths TEXT,
    areas_for_improvement TEXT,
    achievements TEXT,
    comments TEXT,
    employee_comments TEXT,
    goals_met INTEGER DEFAULT 0,
    goals_total INTEGER DEFAULT 0,
    status TEXT DEFAULT 'draft',
    review_date DATE DEFAULT CURRENT_DATE,
    due_date DATE,
    submitted_at TIMESTAMP WITH TIME ZONE,
    approved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT valid_review_type CHECK (review_type IN ('quarterly', 'mid-year', 'annual', 'probation', 'project', 'ad-hoc')),
    CONSTRAINT valid_status CHECK (status IN ('draft', 'submitted', 'approved', 'rejected'))
);

-- Create performance_skills table
DROP TABLE IF EXISTS public.performance_skills CASCADE;
CREATE TABLE IF NOT EXISTS public.performance_skills (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id TEXT NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    skill_name TEXT NOT NULL,
    skill_category TEXT DEFAULT 'technical',
    rating DECIMAL(2, 1) CHECK (rating >= 0 AND rating <= 5),
    proficiency_level TEXT,
    years_experience INTEGER,
    assessed_by TEXT REFERENCES public.employees(id) ON DELETE SET NULL,
    assessment_date DATE DEFAULT CURRENT_DATE,
    notes TEXT,
    certification_url TEXT,
    last_used_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT valid_skill_rating CHECK (rating >= 0 AND rating <= 5),
    CONSTRAINT valid_skill_category CHECK (skill_category IN ('technical', 'soft', 'leadership', 'communication', 'other')),
    UNIQUE (employee_id, skill_name)
);

-- Now create performance_comments
DROP TABLE IF EXISTS public.performance_comments CASCADE;
CREATE TABLE IF NOT EXISTS public.performance_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  goal_id UUID REFERENCES public.performance_goals(id) ON DELETE CASCADE,
  author TEXT NOT NULL,
  author_id TEXT,
  comment TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_performance_goals_employee ON public.performance_goals(employee_id);
CREATE INDEX IF NOT EXISTS idx_performance_goals_status ON public.performance_goals(status);
CREATE INDEX IF NOT EXISTS idx_performance_goals_target_date ON public.performance_goals(target_date);
CREATE INDEX IF NOT EXISTS idx_performance_reviews_employee ON public.performance_reviews(employee_id);
CREATE INDEX IF NOT EXISTS idx_performance_reviews_date ON public.performance_reviews(review_date);
CREATE INDEX IF NOT EXISTS idx_performance_skills_employee ON public.performance_skills(employee_id);
CREATE INDEX IF NOT EXISTS idx_performance_skills_category ON public.performance_skills(skill_category);
CREATE INDEX IF NOT EXISTS idx_performance_comments_goal ON public.performance_comments(goal_id);
CREATE INDEX IF NOT EXISTS idx_goal_milestones_goal ON public.goal_milestones(goal_id);
CREATE INDEX IF NOT EXISTS idx_employee_feedback_employee ON public.employee_feedback(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_feedback_from ON public.employee_feedback(feedback_from);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_performance_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER trigger_performance_goals_updated_at
    BEFORE UPDATE ON public.performance_goals
    FOR EACH ROW
    EXECUTE FUNCTION update_performance_updated_at();

CREATE TRIGGER trigger_performance_reviews_updated_at
    BEFORE UPDATE ON public.performance_reviews
    FOR EACH ROW
    EXECUTE FUNCTION update_performance_updated_at();

CREATE TRIGGER trigger_performance_skills_updated_at
    BEFORE UPDATE ON public.performance_skills
    FOR EACH ROW
    EXECUTE FUNCTION update_performance_updated_at();

CREATE TRIGGER trigger_goal_milestones_updated_at
    BEFORE UPDATE ON public.goal_milestones
    FOR EACH ROW
    EXECUTE FUNCTION update_performance_updated_at();

CREATE TRIGGER trigger_employee_feedback_updated_at
    BEFORE UPDATE ON public.employee_feedback
    FOR EACH ROW
    EXECUTE FUNCTION update_performance_updated_at();

-- Enable Row Level Security
ALTER TABLE public.performance_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.performance_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.performance_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.performance_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goal_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_feedback ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (adjust based on your auth setup)
-- Allow authenticated users to view all performance data
CREATE POLICY "Allow authenticated users to view performance goals"
    ON public.performance_goals FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Allow authenticated users to insert performance goals"
    ON public.performance_goals FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update performance goals"
    ON public.performance_goals FOR UPDATE
    TO authenticated
    USING (true);

CREATE POLICY "Allow authenticated users to delete performance goals"
    ON public.performance_goals FOR DELETE
    TO authenticated
    USING (true);

-- Similar policies for other tables
CREATE POLICY "Allow authenticated users to view performance reviews"
    ON public.performance_reviews FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Allow authenticated users to insert performance reviews"
    ON public.performance_reviews FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Allow authenticated users to view performance skills"
    ON public.performance_skills FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Allow authenticated users to insert performance skills"
    ON public.performance_skills FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Allow authenticated users to view performance comments"
    ON public.performance_comments FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Allow authenticated users to insert performance comments"
    ON public.performance_comments FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- RLS policies for goal_milestones
CREATE POLICY "Allow authenticated users to view goal milestones"
    ON public.goal_milestones FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Allow authenticated users to insert goal milestones"
    ON public.goal_milestones FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update goal milestones"
    ON public.goal_milestones FOR UPDATE
    TO authenticated
    USING (true);

CREATE POLICY "Allow authenticated users to delete goal milestones"
    ON public.goal_milestones FOR DELETE
    TO authenticated
    USING (true);

-- RLS policies for employee_feedback
CREATE POLICY "Allow authenticated users to view employee feedback"
    ON public.employee_feedback FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Allow authenticated users to insert employee feedback"
    ON public.employee_feedback FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Create goal milestones table
DROP TABLE IF EXISTS public.goal_milestones CASCADE;
CREATE TABLE IF NOT EXISTS public.goal_milestones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    goal_id UUID NOT NULL REFERENCES public.performance_goals(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    due_date DATE,
    status TEXT DEFAULT 'pending',
    completed_date DATE,
    notes TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT valid_milestone_status CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled'))
);

-- Create employee feedback table
DROP TABLE IF EXISTS public.employee_feedback CASCADE;
CREATE TABLE IF NOT EXISTS public.employee_feedback (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id TEXT NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    feedback_from TEXT REFERENCES public.employees(id) ON DELETE SET NULL,
    feedback_type TEXT DEFAULT 'peer',
    rating DECIMAL(2, 1) CHECK (rating >= 0 AND rating <= 5),
    feedback_text TEXT NOT NULL,
    is_anonymous BOOLEAN DEFAULT false,
    related_review_id UUID,
    feedback_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT valid_feedback_type CHECK (feedback_type IN ('peer', 'manager', 'self', '360'))
);

-- Create view for employee performance summary
DROP VIEW IF EXISTS public.employee_performance_summary CASCADE;
DROP VIEW IF EXISTS public.goals_with_progress CASCADE;
DROP VIEW IF EXISTS public.skills_matrix CASCADE;

CREATE OR REPLACE VIEW public.employee_performance_summary AS
SELECT 
    e.id AS employee_id,
    e.name AS employee_name,
    e.department,
    e.position,
    COUNT(DISTINCT pg.id) AS total_goals,
    COUNT(DISTINCT CASE WHEN pg.status = 'completed' THEN pg.id END) AS completed_goals,
    AVG(CASE WHEN pg.status = 'completed' THEN pg.progress_percentage END) AS avg_goal_completion,
    COUNT(DISTINCT pr.id) AS total_reviews,
    AVG(pr.overall_rating) AS avg_rating,
    MAX(pr.review_date) AS last_review_date,
    COUNT(DISTINCT ps.id) AS total_skills_assessed,
    AVG(ps.rating) AS avg_skill_rating
FROM public.employees e
LEFT JOIN public.performance_goals pg ON e.id = pg.employee_id
LEFT JOIN public.performance_reviews pr ON e.id = pr.employee_id
LEFT JOIN public.performance_skills ps ON e.id = ps.employee_id
GROUP BY e.id, e.name, e.department, e.position;

-- Create view for goals with progress
CREATE OR REPLACE VIEW public.goals_with_progress AS
SELECT 
    pg.*,
    e.name AS employee_name,
    e.department,
    e.position,
    COUNT(gm.id) AS total_milestones,
    COUNT(CASE WHEN gm.status = 'completed' THEN gm.id END) AS completed_milestones
FROM public.performance_goals pg
LEFT JOIN public.employees e ON pg.employee_id = e.id
LEFT JOIN public.goal_milestones gm ON pg.id = gm.goal_id
GROUP BY pg.id, e.name, e.department, e.position;

-- Create view for skills matrix
CREATE OR REPLACE VIEW public.skills_matrix AS
SELECT 
    e.department,
    ps.skill_name,
    ps.skill_category,
    AVG(ps.rating) AS avg_rating,
    COUNT(ps.id) AS employee_count,
    MAX(ps.rating) AS max_rating,
    MIN(ps.rating) AS min_rating
FROM public.performance_skills ps
JOIN public.employees e ON ps.employee_id = e.id
GROUP BY e.department, ps.skill_name, ps.skill_category;

-- Grant permissions
GRANT SELECT ON public.employee_performance_summary TO authenticated;

-- Insert sample data for testing (optional - remove in production)
-- Uncomment the following lines if you want sample data

/*
INSERT INTO public.performance_goals (employee_id, title, description, status, progress, deadline, category, priority)
SELECT 
    id,
    'Complete Q4 Project Deliverables',
    'Finish all assigned project tasks for Q4',
    'in-progress',
    65,
    '2024-12-31',
    'project',
    'high'
FROM public.employees
LIMIT 3;
*/

COMMENT ON TABLE public.performance_goals IS 'Stores employee performance goals and objectives';
COMMENT ON TABLE public.performance_reviews IS 'Stores performance review records';
COMMENT ON TABLE public.performance_skills IS 'Stores employee skill assessments';
COMMENT ON TABLE public.performance_comments IS 'Stores comments and updates on performance goals';
