-- Performance Reviews Table Setup
-- This table stores employee performance review data

-- Create performance_reviews table
CREATE TABLE IF NOT EXISTS performance_reviews (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id TEXT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  reviewer_id TEXT REFERENCES employees(id) ON DELETE SET NULL,
  review_date DATE NOT NULL DEFAULT CURRENT_DATE,
  review_period_start DATE,
  review_period_end DATE,
  overall_rating DECIMAL(3,2) CHECK (overall_rating >= 0 AND overall_rating <= 5),
  technical_skills DECIMAL(3,2) CHECK (technical_skills >= 0 AND technical_skills <= 5),
  communication DECIMAL(3,2) CHECK (communication >= 0 AND communication <= 5),
  teamwork DECIMAL(3,2) CHECK (teamwork >= 0 AND teamwork <= 5),
  productivity DECIMAL(3,2) CHECK (productivity >= 0 AND productivity <= 5),
  leadership DECIMAL(3,2) CHECK (leadership >= 0 AND leadership <= 5),
  strengths TEXT,
  areas_for_improvement TEXT,
  goals TEXT,
  comments TEXT,
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'completed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_performance_reviews_employee_id ON performance_reviews(employee_id);
CREATE INDEX IF NOT EXISTS idx_performance_reviews_reviewer_id ON performance_reviews(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_performance_reviews_review_date ON performance_reviews(review_date);
CREATE INDEX IF NOT EXISTS idx_performance_reviews_status ON performance_reviews(status);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_performance_reviews_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_performance_reviews_updated_at
  BEFORE UPDATE ON performance_reviews
  FOR EACH ROW
  EXECUTE FUNCTION update_performance_reviews_updated_at();

-- Enable Row Level Security
ALTER TABLE performance_reviews ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Policy: Users can view their own reviews and reviews they conducted
CREATE POLICY "Users can view relevant performance reviews"
  ON performance_reviews
FOR SELECT
USING (
    -- Users can see their own reviews or ones they reviewed
    EXISTS (
        SELECT 1 FROM employees 
        WHERE id = auth.uid()::text 
        AND id IN (performance_reviews.employee_id, performance_reviews.reviewer_id)
    )
    OR 
    -- Admins and HR managers can see all
    EXISTS (
        SELECT 1 FROM hr_users 
        WHERE id = auth.uid() 
        AND role IN ('admin', 'manager')
    )
);

-- Policy: HR managers and admins can insert reviews
-- Policy: Managers and admins can create performance reviews
CREATE POLICY "Managers and admins can create performance reviews"
  ON performance_reviews
FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM hr_users 
        WHERE id = auth.uid() 
        AND role IN ('admin', 'manager')
    )
);

-- Policy: Managers and admins can update reviews
CREATE POLICY "Managers and admins can update performance reviews"
  ON performance_reviews
FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM hr_users 
        WHERE id = auth.uid() 
        AND role IN ('admin', 'manager')
    )
);

-- Policy: Only admins can delete reviews
CREATE POLICY "Only admins can delete performance reviews"
  ON performance_reviews
FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM hr_users 
        WHERE id = auth.uid() 
        AND role = 'admin'
    )
);

-- Create a view for employee performance summary
DROP VIEW IF EXISTS employee_performance_summary CASCADE;

CREATE VIEW employee_performance_summary AS
SELECT 
    e.id as employee_id,
    e.name as employee_name,
    e.department,
    e.position,
    COUNT(pr.id) as total_reviews,
    ROUND(AVG(pr.overall_rating)::numeric, 2) as avg_rating,
    ROUND(AVG(pr.technical_skills_rating)::numeric, 2) as avg_technical_skills,
    ROUND(AVG(pr.communication_rating)::numeric, 2) as avg_communication,
    ROUND(AVG(pr.teamwork_rating)::numeric, 2) as avg_teamwork,
    ROUND(AVG(pr.leadership_rating)::numeric, 2) as avg_leadership,
    ROUND(AVG(pr.problem_solving_rating)::numeric, 2) as avg_problem_solving,
    ROUND(AVG(pr.goals_met::numeric / NULLIF(pr.goals_total, 0))::numeric, 2) as avg_goal_completion_rate,
    MAX(pr.review_date) as last_review_date,
    MIN(pr.review_date) as first_review_date,
    COUNT(CASE WHEN pr.status = 'approved' THEN 1 END) as approved_reviews,
    COUNT(CASE WHEN pr.status = 'pending' THEN 1 END) as pending_reviews
FROM employees e
LEFT JOIN performance_reviews pr ON e.id = pr.employee_id
GROUP BY e.id, e.name, e.department, e.position;

-- Insert sample data for testing (optional - remove in production)
-- Note: This assumes you have existing employee IDs in your database
-- Replace the UUIDs with actual employee IDs from your employees table

-- Example:
-- INSERT INTO performance_reviews (
--   employee_id,
--   reviewer_id,
--   review_date,
--   review_period_start,
--   review_period_end,
--   overall_rating,
--   technical_skills,
--   communication,
--   teamwork,
--   productivity,
--   leadership,
--   strengths,
--   areas_for_improvement,
--   goals,
--   status
-- ) VALUES
-- (
--   'employee-uuid-here',
--   'manager-uuid-here',
--   '2024-10-15',
--   '2024-07-01',
--   '2024-09-30',
--   4.2,
--   4.5,
--   4.0,
--   4.3,
--   4.1,
--   3.8,
--   'Strong technical skills, excellent problem solver, meets deadlines consistently',
--   'Could improve communication with cross-functional teams, delegate more effectively',
--   'Lead a major project in Q4, mentor junior developers, improve presentation skills',
--   'completed'
-- );

COMMENT ON TABLE performance_reviews IS 'Stores employee performance review data and ratings';
COMMENT ON COLUMN performance_reviews.overall_rating IS 'Overall performance rating from 0 to 5';
COMMENT ON COLUMN performance_reviews.status IS 'Review status: draft, submitted, or completed';
