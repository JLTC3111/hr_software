-- Sample Performance Reviews Data
-- Run this AFTER running PERFORMANCE_REVIEWS_TABLE_SETUP.sql
-- This will create sample performance review data for testing

-- Note: Replace the employee_id values with actual UUIDs from your employees table
-- You can get employee IDs by running: SELECT id, name FROM employees;

-- Insert sample reviews for the last 6 months
-- Adjust dates and employee IDs as needed

DO $$
DECLARE
  emp_record RECORD;
  review_date DATE;
  reviewer_uuid UUID;
BEGIN
  -- Get a reviewer (admin or manager from hr_users)
  SELECT id INTO reviewer_uuid 
  FROM hr_users 
  WHERE role IN ('admin', 'manager') 
  LIMIT 1;
  
  -- If no reviewer found, raise an error
  IF reviewer_uuid IS NULL THEN
    RAISE EXCEPTION 'No admin or manager found in hr_users table';
  END IF;

  -- Loop through each employee and create reviews for the last 6 months
  FOR emp_record IN SELECT id FROM employees LIMIT 7 LOOP
    -- Create reviews for the past 6 months
    FOR i IN 0..5 LOOP
      review_date := CURRENT_DATE - ((i + 1) * 30);
      
      INSERT INTO performance_reviews (
        employee_id,
        reviewer_id,
        review_date,
        review_period,  -- Changed from review_period_start/end
        review_type,    -- Added required field
        overall_rating,
        technical_skills_rating,  -- Changed from technical_skills
        communication_rating,     -- Changed from communication
        teamwork_rating,          -- Changed from teamwork
        leadership_rating,        -- Changed from leadership
        problem_solving_rating,   -- Changed from productivity
        strengths,
        areas_for_improvement,
        achievements,             -- Changed from goals
        goals_met,                -- Added
        goals_total,              -- Added
        status
      ) VALUES (
        emp_record.id,
        (SELECT id::text FROM employees WHERE id = emp_record.id LIMIT 1), -- Get employee's own id as text for reviewer
        review_date,
        'Q' || EXTRACT(QUARTER FROM review_date) || ' ' || EXTRACT(YEAR FROM review_date), -- e.g., "Q3 2024"
        'quarterly',              -- or 'annual', 'probation', 'mid-year'
        3.5 + (RANDOM() * 1.5),   -- Random rating between 3.5 and 5.0
        3.5 + (RANDOM() * 1.5),
        3.5 + (RANDOM() * 1.5),
        3.5 + (RANDOM() * 1.5),
        3.0 + (RANDOM() * 2.0),
        3.5 + (RANDOM() * 1.5),
        CASE 
          WHEN RANDOM() > 0.5 THEN 'Strong technical skills, excellent problem solver, meets deadlines consistently'
          ELSE 'Great team player, proactive communication, delivers quality work'
        END,
        CASE 
          WHEN RANDOM() > 0.5 THEN 'Could improve time management, more proactive communication needed'
          ELSE 'Work on delegation skills, improve documentation practices'
        END,
        CASE 
          WHEN RANDOM() > 0.5 THEN 'Led a project successfully, mentored junior team members'
          ELSE 'Developed new technical skills, improved cross-team collaboration'
        END,
        FLOOR(RANDOM() * 5 + 3)::INTEGER,  -- goals_met: 3-8
        FLOOR(RANDOM() * 3 + 5)::INTEGER,  -- goals_total: 5-8
        'approved'                         -- Changed from 'completed' to match your schema
      );
    END LOOP;
  END LOOP;
  
  RAISE NOTICE 'Successfully created reviews for 7 employees over 6 months';
END $$;
-- Verify the data was inserted
SELECT 
  e.name as employee_name,
  pr.review_date,
  pr.overall_rating,
  pr.status
FROM performance_reviews pr
JOIN employees e ON pr.employee_id = e.id
ORDER BY pr.review_date DESC
LIMIT 20;

-- Check the performance summary view
SELECT * FROM employee_performance_summary ORDER BY avg_rating DESC;
