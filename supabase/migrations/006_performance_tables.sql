-- Performance Management Module Tables for HR Software
-- This migration creates tables for performance reviews, goals, and skills assessments

-- ============================================
-- 1. PERFORMANCE REVIEWS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS performance_reviews (
  id BIGSERIAL PRIMARY KEY,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  reviewer_id INTEGER REFERENCES employees(id),
  review_period VARCHAR(50) NOT NULL, -- Q1-2024, Q2-2024, Annual-2024, etc.
  review_type VARCHAR(50) NOT NULL DEFAULT 'quarterly', -- quarterly, annual, mid-year, probation, project
  overall_rating DECIMAL(3,2) CHECK (overall_rating >= 1.0 AND overall_rating <= 5.0),
  technical_skills_rating DECIMAL(3,2) CHECK (technical_skills_rating >= 1.0 AND technical_skills_rating <= 5.0),
  communication_rating DECIMAL(3,2) CHECK (communication_rating >= 1.0 AND communication_rating <= 5.0),
  leadership_rating DECIMAL(3,2) CHECK (leadership_rating >= 1.0 AND leadership_rating <= 5.0),
  teamwork_rating DECIMAL(3,2) CHECK (teamwork_rating >= 1.0 AND teamwork_rating <= 5.0),
  problem_solving_rating DECIMAL(3,2) CHECK (problem_solving_rating >= 1.0 AND problem_solving_rating <= 5.0),
  strengths TEXT,
  areas_for_improvement TEXT,
  achievements TEXT,
  comments TEXT,
  employee_comments TEXT, -- Employee's self-assessment or response
  goals_met INTEGER DEFAULT 0,
  goals_total INTEGER DEFAULT 0,
  status VARCHAR(50) DEFAULT 'draft', -- draft, submitted, approved, acknowledged
  review_date DATE DEFAULT CURRENT_DATE,
  due_date DATE,
  submitted_at TIMESTAMP WITH TIME ZONE,
  approved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_employee_review_period UNIQUE(employee_id, review_period)
);

-- ============================================
-- 2. PERFORMANCE GOALS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS performance_goals (
  id BIGSERIAL PRIMARY KEY,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(50) DEFAULT 'general', -- technical, leadership, project, learning, process_improvement, personal_development
  target_date DATE,
  status VARCHAR(50) DEFAULT 'pending', -- pending, in_progress, completed, cancelled, blocked
  progress_percentage INTEGER DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
  priority VARCHAR(50) DEFAULT 'medium', -- low, medium, high, critical
  assigned_by INTEGER REFERENCES employees(id),
  assigned_date DATE DEFAULT CURRENT_DATE,
  started_date DATE,
  completed_date DATE,
  notes TEXT,
  success_criteria TEXT,
  related_review_id BIGINT REFERENCES performance_reviews(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 3. GOAL MILESTONES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS goal_milestones (
  id BIGSERIAL PRIMARY KEY,
  goal_id BIGINT NOT NULL REFERENCES performance_goals(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  due_date DATE,
  status VARCHAR(50) DEFAULT 'pending', -- pending, in_progress, completed, cancelled
  completed_date DATE,
  notes TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 4. SKILLS ASSESSMENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS skills_assessments (
  id BIGSERIAL PRIMARY KEY,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  skill_name VARCHAR(255) NOT NULL,
  skill_category VARCHAR(50) DEFAULT 'technical', -- technical, soft_skill, leadership, domain_knowledge, tool, language
  rating DECIMAL(3,2) NOT NULL CHECK (rating >= 1.0 AND rating <= 5.0),
  proficiency_level VARCHAR(50), -- beginner, intermediate, advanced, expert
  years_experience DECIMAL(4,1),
  assessed_by INTEGER REFERENCES employees(id),
  assessment_date DATE DEFAULT CURRENT_DATE,
  notes TEXT,
  certification_url TEXT,
  last_used_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_employee_skill UNIQUE(employee_id, skill_name)
);

-- ============================================
-- 5. FEEDBACK TABLE (360-degree feedback)
-- ============================================
CREATE TABLE IF NOT EXISTS employee_feedback (
  id BIGSERIAL PRIMARY KEY,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  feedback_from INTEGER REFERENCES employees(id),
  feedback_type VARCHAR(50) DEFAULT 'peer', -- peer, manager, subordinate, self, client
  rating DECIMAL(3,2) CHECK (rating >= 1.0 AND rating <= 5.0),
  feedback_text TEXT NOT NULL,
  is_anonymous BOOLEAN DEFAULT FALSE,
  related_review_id BIGINT REFERENCES performance_reviews(id) ON DELETE SET NULL,
  feedback_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- INDEXES for better query performance
-- ============================================
CREATE INDEX IF NOT EXISTS idx_reviews_employee ON performance_reviews(employee_id);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewer ON performance_reviews(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_reviews_period ON performance_reviews(review_period);
CREATE INDEX IF NOT EXISTS idx_reviews_status ON performance_reviews(status);
CREATE INDEX IF NOT EXISTS idx_reviews_date ON performance_reviews(review_date DESC);

CREATE INDEX IF NOT EXISTS idx_goals_employee ON performance_goals(employee_id);
CREATE INDEX IF NOT EXISTS idx_goals_status ON performance_goals(status);
CREATE INDEX IF NOT EXISTS idx_goals_category ON performance_goals(category);
CREATE INDEX IF NOT EXISTS idx_goals_target_date ON performance_goals(target_date);
CREATE INDEX IF NOT EXISTS idx_goals_assigned_by ON performance_goals(assigned_by);

CREATE INDEX IF NOT EXISTS idx_milestones_goal ON goal_milestones(goal_id);
CREATE INDEX IF NOT EXISTS idx_milestones_status ON goal_milestones(status);
CREATE INDEX IF NOT EXISTS idx_milestones_due_date ON goal_milestones(due_date);

CREATE INDEX IF NOT EXISTS idx_skills_employee ON skills_assessments(employee_id);
CREATE INDEX IF NOT EXISTS idx_skills_category ON skills_assessments(skill_category);
CREATE INDEX IF NOT EXISTS idx_skills_name ON skills_assessments(skill_name);

CREATE INDEX IF NOT EXISTS idx_feedback_employee ON employee_feedback(employee_id);
CREATE INDEX IF NOT EXISTS idx_feedback_from ON employee_feedback(feedback_from);
CREATE INDEX IF NOT EXISTS idx_feedback_type ON employee_feedback(feedback_type);

-- ============================================
-- TRIGGERS: Auto-update timestamps
-- ============================================
CREATE TRIGGER update_performance_reviews_updated_at BEFORE UPDATE ON performance_reviews
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_performance_goals_updated_at BEFORE UPDATE ON performance_goals
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_goal_milestones_updated_at BEFORE UPDATE ON goal_milestones
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_skills_assessments_updated_at BEFORE UPDATE ON skills_assessments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_employee_feedback_updated_at BEFORE UPDATE ON employee_feedback
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- FUNCTIONS: Auto-calculate overall rating
-- ============================================
CREATE OR REPLACE FUNCTION calculate_overall_rating()
RETURNS TRIGGER AS $$
BEGIN
    -- Calculate average of all rating fields if they exist
    IF NEW.technical_skills_rating IS NOT NULL 
       OR NEW.communication_rating IS NOT NULL 
       OR NEW.leadership_rating IS NOT NULL 
       OR NEW.teamwork_rating IS NOT NULL 
       OR NEW.problem_solving_rating IS NOT NULL THEN
        
        NEW.overall_rating := (
            COALESCE(NEW.technical_skills_rating, 0) +
            COALESCE(NEW.communication_rating, 0) +
            COALESCE(NEW.leadership_rating, 0) +
            COALESCE(NEW.teamwork_rating, 0) +
            COALESCE(NEW.problem_solving_rating, 0)
        ) / (
            CASE WHEN NEW.technical_skills_rating IS NOT NULL THEN 1 ELSE 0 END +
            CASE WHEN NEW.communication_rating IS NOT NULL THEN 1 ELSE 0 END +
            CASE WHEN NEW.leadership_rating IS NOT NULL THEN 1 ELSE 0 END +
            CASE WHEN NEW.teamwork_rating IS NOT NULL THEN 1 ELSE 0 END +
            CASE WHEN NEW.problem_solving_rating IS NOT NULL THEN 1 ELSE 0 END
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auto_calculate_overall_rating BEFORE INSERT OR UPDATE ON performance_reviews
    FOR EACH ROW EXECUTE FUNCTION calculate_overall_rating();

-- ============================================
-- FUNCTIONS: Auto-update goal progress
-- ============================================
CREATE OR REPLACE FUNCTION update_goal_progress()
RETURNS TRIGGER AS $$
DECLARE
    total_milestones INTEGER;
    completed_milestones INTEGER;
    new_progress INTEGER;
BEGIN
    -- Count total and completed milestones
    SELECT 
        COUNT(*),
        COUNT(*) FILTER (WHERE status = 'completed')
    INTO total_milestones, completed_milestones
    FROM goal_milestones
    WHERE goal_id = COALESCE(NEW.goal_id, OLD.goal_id);
    
    -- Calculate progress percentage
    IF total_milestones > 0 THEN
        new_progress := ROUND((completed_milestones::DECIMAL / total_milestones) * 100);
        
        -- Update the goal's progress
        UPDATE performance_goals
        SET progress_percentage = new_progress,
            status = CASE 
                WHEN new_progress = 100 THEN 'completed'
                WHEN new_progress > 0 THEN 'in_progress'
                ELSE status
            END
        WHERE id = COALESCE(NEW.goal_id, OLD.goal_id);
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auto_update_goal_progress AFTER INSERT OR UPDATE OR DELETE ON goal_milestones
    FOR EACH ROW EXECUTE FUNCTION update_goal_progress();

-- ============================================
-- FUNCTIONS: Auto-complete goal when 100%
-- ============================================
CREATE OR REPLACE FUNCTION auto_complete_goal()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.progress_percentage = 100 AND OLD.progress_percentage < 100 THEN
        NEW.status := 'completed';
        NEW.completed_date := CURRENT_DATE;
    ELSIF NEW.progress_percentage < 100 AND OLD.status = 'completed' THEN
        NEW.status := 'in_progress';
        NEW.completed_date := NULL;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_goal_completion BEFORE UPDATE ON performance_goals
    FOR EACH ROW EXECUTE FUNCTION auto_complete_goal();

-- ============================================
-- ROW LEVEL SECURITY (RLS) Policies
-- ============================================

-- Enable RLS on all tables
ALTER TABLE performance_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE goal_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE skills_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_feedback ENABLE ROW LEVEL SECURITY;

-- Performance Reviews Policies
CREATE POLICY "Employees can view their own reviews" ON performance_reviews
    FOR SELECT USING (
        employee_id = (current_setting('app.current_user_id')::INTEGER)
        OR reviewer_id = (current_setting('app.current_user_id')::INTEGER)
        OR EXISTS (
            SELECT 1 FROM employees 
            WHERE id = (current_setting('app.current_user_id')::INTEGER)
            AND position IN ('hr_specialist', 'general_manager', 'managing_director')
        )
    );

CREATE POLICY "Managers and HR can create reviews" ON performance_reviews
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM employees 
            WHERE id = (current_setting('app.current_user_id')::INTEGER)
            AND position IN ('hr_specialist', 'general_manager', 'managing_director', 'senior_developer')
        )
    );

CREATE POLICY "Reviewers can update their reviews" ON performance_reviews
    FOR UPDATE USING (
        reviewer_id = (current_setting('app.current_user_id')::INTEGER)
        OR EXISTS (
            SELECT 1 FROM employees 
            WHERE id = (current_setting('app.current_user_id')::INTEGER)
            AND position IN ('hr_specialist', 'general_manager', 'managing_director')
        )
    );

-- Performance Goals Policies
CREATE POLICY "Employees can view their own goals" ON performance_goals
    FOR SELECT USING (
        employee_id = (current_setting('app.current_user_id')::INTEGER)
        OR assigned_by = (current_setting('app.current_user_id')::INTEGER)
        OR EXISTS (
            SELECT 1 FROM employees 
            WHERE id = (current_setting('app.current_user_id')::INTEGER)
            AND position IN ('hr_specialist', 'general_manager', 'managing_director')
        )
    );

CREATE POLICY "Managers can assign goals" ON performance_goals
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM employees 
            WHERE id = (current_setting('app.current_user_id')::INTEGER)
            AND position IN ('hr_specialist', 'general_manager', 'managing_director', 'senior_developer')
        )
    );

CREATE POLICY "Employees can update their goal progress" ON performance_goals
    FOR UPDATE USING (
        employee_id = (current_setting('app.current_user_id')::INTEGER)
        OR assigned_by = (current_setting('app.current_user_id')::INTEGER)
        OR EXISTS (
            SELECT 1 FROM employees 
            WHERE id = (current_setting('app.current_user_id')::INTEGER)
            AND position IN ('hr_specialist', 'general_manager', 'managing_director')
        )
    );

-- Goal Milestones Policies
CREATE POLICY "Employees can view milestones for their goals" ON goal_milestones
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM performance_goals 
            WHERE id = goal_milestones.goal_id 
            AND (
                employee_id = (current_setting('app.current_user_id')::INTEGER)
                OR assigned_by = (current_setting('app.current_user_id')::INTEGER)
            )
        )
        OR EXISTS (
            SELECT 1 FROM employees 
            WHERE id = (current_setting('app.current_user_id')::INTEGER)
            AND position IN ('hr_specialist', 'general_manager', 'managing_director')
        )
    );

CREATE POLICY "Employees can manage milestones for their goals" ON goal_milestones
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM performance_goals 
            WHERE id = goal_milestones.goal_id 
            AND employee_id = (current_setting('app.current_user_id')::INTEGER)
        )
        OR EXISTS (
            SELECT 1 FROM employees 
            WHERE id = (current_setting('app.current_user_id')::INTEGER)
            AND position IN ('hr_specialist', 'general_manager', 'managing_director')
        )
    );

-- Skills Assessments Policies
CREATE POLICY "Employees can view their own skills" ON skills_assessments
    FOR SELECT USING (
        employee_id = (current_setting('app.current_user_id')::INTEGER)
        OR EXISTS (
            SELECT 1 FROM employees 
            WHERE id = (current_setting('app.current_user_id')::INTEGER)
            AND position IN ('hr_specialist', 'general_manager', 'managing_director')
        )
    );

CREATE POLICY "Employees can manage their own skills" ON skills_assessments
    FOR ALL USING (
        employee_id = (current_setting('app.current_user_id')::INTEGER)
        OR EXISTS (
            SELECT 1 FROM employees 
            WHERE id = (current_setting('app.current_user_id')::INTEGER)
            AND position IN ('hr_specialist', 'general_manager', 'managing_director')
        )
    );

-- Employee Feedback Policies
CREATE POLICY "Employees can view feedback about them" ON employee_feedback
    FOR SELECT USING (
        employee_id = (current_setting('app.current_user_id')::INTEGER)
        OR (feedback_from = (current_setting('app.current_user_id')::INTEGER) AND NOT is_anonymous)
        OR EXISTS (
            SELECT 1 FROM employees 
            WHERE id = (current_setting('app.current_user_id')::INTEGER)
            AND position IN ('hr_specialist', 'general_manager', 'managing_director')
        )
    );

CREATE POLICY "Employees can give feedback" ON employee_feedback
    FOR INSERT WITH CHECK (
        feedback_from = (current_setting('app.current_user_id')::INTEGER)
        OR EXISTS (
            SELECT 1 FROM employees 
            WHERE id = (current_setting('app.current_user_id')::INTEGER)
            AND position IN ('hr_specialist', 'general_manager', 'managing_director')
        )
    );

-- ============================================
-- VIEWS for easier querying
-- ============================================

-- View: Employee performance summary
CREATE OR REPLACE VIEW employee_performance_summary AS
SELECT 
    e.id as employee_id,
    e.name as employee_name,
    e.position,
    e.department,
    AVG(pr.overall_rating) as avg_rating,
    COUNT(pr.id) as total_reviews,
    COUNT(pg.id) as total_goals,
    COUNT(*) FILTER (WHERE pg.status = 'completed') as completed_goals,
    COUNT(*) FILTER (WHERE pg.status = 'in_progress') as in_progress_goals,
    MAX(pr.review_date) as last_review_date
FROM employees e
LEFT JOIN performance_reviews pr ON e.id = pr.employee_id AND pr.status = 'approved'
LEFT JOIN performance_goals pg ON e.id = pg.employee_id
GROUP BY e.id, e.name, e.position, e.department;

-- View: Goals with milestones progress
CREATE OR REPLACE VIEW goals_with_progress AS
SELECT 
    pg.id as goal_id,
    pg.employee_id,
    e.name as employee_name,
    pg.title,
    pg.category,
    pg.status,
    pg.progress_percentage,
    pg.target_date,
    COUNT(gm.id) as total_milestones,
    COUNT(*) FILTER (WHERE gm.status = 'completed') as completed_milestones,
    pg.assigned_date,
    pg.completed_date
FROM performance_goals pg
JOIN employees e ON pg.employee_id = e.id
LEFT JOIN goal_milestones gm ON pg.id = gm.goal_id
GROUP BY pg.id, pg.employee_id, e.name, pg.title, pg.category, 
         pg.status, pg.progress_percentage, pg.target_date, 
         pg.assigned_date, pg.completed_date;

-- View: Skills matrix
CREATE OR REPLACE VIEW skills_matrix AS
SELECT 
    e.id as employee_id,
    e.name as employee_name,
    e.department,
    e.position,
    sa.skill_name,
    sa.skill_category,
    sa.rating,
    sa.proficiency_level,
    sa.years_experience,
    sa.assessment_date
FROM employees e
JOIN skills_assessments sa ON e.id = sa.employee_id
ORDER BY e.department, e.name, sa.skill_category, sa.rating DESC;

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON TABLE performance_reviews IS 'Stores employee performance review records';
COMMENT ON TABLE performance_goals IS 'Tracks employee goals and objectives';
COMMENT ON TABLE goal_milestones IS 'Milestones and sub-tasks for performance goals';
COMMENT ON TABLE skills_assessments IS 'Employee skills inventory and ratings';
COMMENT ON TABLE employee_feedback IS '360-degree feedback from peers and managers';

COMMENT ON VIEW employee_performance_summary IS 'Aggregated performance metrics per employee';
COMMENT ON VIEW goals_with_progress IS 'Goals with milestone completion progress';
COMMENT ON VIEW skills_matrix IS 'Skills inventory across all employees';
