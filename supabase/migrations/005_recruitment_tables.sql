-- Recruitment Module Tables for HR Software
-- This migration creates tables for job postings, applications, and interview management

-- ============================================
-- 1. JOB POSTINGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS job_postings (
  id BIGSERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  department VARCHAR(100) NOT NULL,
  position_type VARCHAR(50) NOT NULL DEFAULT 'full-time', -- full-time, part-time, contract, internship
  description TEXT,
  requirements TEXT,
  responsibilities TEXT,
  salary_range VARCHAR(100),
  location VARCHAR(255) DEFAULT 'Office',
  posted_by INTEGER REFERENCES employees(id),
  status VARCHAR(50) DEFAULT 'active', -- active, paused, closed, filled
  posted_date DATE DEFAULT CURRENT_DATE,
  closing_date DATE,
  openings INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 2. JOB APPLICATIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS job_applications (
  id BIGSERIAL PRIMARY KEY,
  job_posting_id BIGINT REFERENCES job_postings(id) ON DELETE CASCADE,
  candidate_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  resume_url TEXT,
  cover_letter TEXT,
  portfolio_url TEXT,
  linkedin_url TEXT,
  experience_years INTEGER DEFAULT 0,
  current_company VARCHAR(255),
  current_position VARCHAR(255),
  expected_salary VARCHAR(100),
  notice_period VARCHAR(50),
  status VARCHAR(50) DEFAULT 'applied', -- applied, screening, interview_scheduled, technical, hr_round, offer, hired, rejected, withdrawn
  stage VARCHAR(50) DEFAULT 'screening', -- screening, phone_screen, technical, hr_round, final, offer, hired
  applied_date DATE DEFAULT CURRENT_DATE,
  notes TEXT,
  rating DECIMAL(3,2), -- 1.00 to 5.00
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_application UNIQUE(job_posting_id, email)
);

-- ============================================
-- 3. INTERVIEW SCHEDULES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS interview_schedules (
  id BIGSERIAL PRIMARY KEY,
  application_id BIGINT NOT NULL REFERENCES job_applications(id) ON DELETE CASCADE,
  interviewer_id INTEGER REFERENCES employees(id),
  interview_type VARCHAR(50) NOT NULL, -- phone, video, technical, hr, panel, final
  scheduled_time TIMESTAMP WITH TIME ZONE NOT NULL,
  duration_minutes INTEGER DEFAULT 60,
  location VARCHAR(255), -- Office, Google Meet, Zoom, etc.
  meeting_link TEXT,
  notes TEXT,
  status VARCHAR(50) DEFAULT 'scheduled', -- scheduled, completed, cancelled, rescheduled, no_show
  feedback TEXT,
  rating DECIMAL(3,2), -- 1.00 to 5.00
  recommendation VARCHAR(50), -- strong_hire, hire, neutral, no_hire
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- INDEXES for better query performance
-- ============================================
CREATE INDEX IF NOT EXISTS idx_job_postings_status ON job_postings(status);
CREATE INDEX IF NOT EXISTS idx_job_postings_department ON job_postings(department);
CREATE INDEX IF NOT EXISTS idx_job_postings_posted_date ON job_postings(posted_date DESC);

CREATE INDEX IF NOT EXISTS idx_applications_job ON job_applications(job_posting_id);
CREATE INDEX IF NOT EXISTS idx_applications_status ON job_applications(status);
CREATE INDEX IF NOT EXISTS idx_applications_stage ON job_applications(stage);
CREATE INDEX IF NOT EXISTS idx_applications_email ON job_applications(email);
CREATE INDEX IF NOT EXISTS idx_applications_applied_date ON job_applications(applied_date DESC);

CREATE INDEX IF NOT EXISTS idx_interviews_application ON interview_schedules(application_id);
CREATE INDEX IF NOT EXISTS idx_interviews_interviewer ON interview_schedules(interviewer_id);
CREATE INDEX IF NOT EXISTS idx_interviews_scheduled_time ON interview_schedules(scheduled_time);
CREATE INDEX IF NOT EXISTS idx_interviews_status ON interview_schedules(status);

-- ============================================
-- TRIGGERS: Auto-update timestamps
-- ============================================
CREATE TRIGGER update_job_postings_updated_at BEFORE UPDATE ON job_postings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_job_applications_updated_at BEFORE UPDATE ON job_applications
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_interview_schedules_updated_at BEFORE UPDATE ON interview_schedules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- FUNCTIONS: Auto-close job postings
-- ============================================
CREATE OR REPLACE FUNCTION auto_close_expired_jobs()
RETURNS TRIGGER AS $$
BEGIN
    -- Auto close jobs past closing date
    IF NEW.closing_date < CURRENT_DATE AND NEW.status = 'active' THEN
        NEW.status := 'closed';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_job_closing_date BEFORE UPDATE ON job_postings
    FOR EACH ROW EXECUTE FUNCTION auto_close_expired_jobs();

-- ============================================
-- FUNCTIONS: Update application stage based on status
-- ============================================
CREATE OR REPLACE FUNCTION update_application_stage()
RETURNS TRIGGER AS $$
BEGIN
    -- Auto-update stage based on status
    IF NEW.status IN ('applied', 'screening') THEN
        NEW.stage := 'screening';
    ELSIF NEW.status = 'interview_scheduled' THEN
        -- Keep existing stage or set to phone_screen
        IF NEW.stage IS NULL OR NEW.stage = 'screening' THEN
            NEW.stage := 'phone_screen';
        END IF;
    ELSIF NEW.status = 'technical' THEN
        NEW.stage := 'technical';
    ELSIF NEW.status = 'hr_round' THEN
        NEW.stage := 'hr_round';
    ELSIF NEW.status = 'offer' THEN
        NEW.stage := 'offer';
    ELSIF NEW.status = 'hired' THEN
        NEW.stage := 'hired';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auto_update_stage BEFORE INSERT OR UPDATE ON job_applications
    FOR EACH ROW EXECUTE FUNCTION update_application_stage();

-- ============================================
-- ROW LEVEL SECURITY (RLS) Policies
-- ============================================

-- Enable RLS on all tables
ALTER TABLE job_postings ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE interview_schedules ENABLE ROW LEVEL SECURITY;

-- Job Postings Policies
CREATE POLICY "Anyone can view active job postings" ON job_postings
    FOR SELECT USING (status = 'active');

CREATE POLICY "HR can manage job postings" ON job_postings
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM employees 
            WHERE id = (current_setting('app.current_user_id')::INTEGER)
            AND position IN ('hr_specialist', 'general_manager', 'managing_director')
        )
    );

-- Job Applications Policies
CREATE POLICY "HR can view all applications" ON job_applications
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM employees 
            WHERE id = (current_setting('app.current_user_id')::INTEGER)
            AND position IN ('hr_specialist', 'general_manager', 'managing_director')
        )
    );

CREATE POLICY "HR can manage applications" ON job_applications
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM employees 
            WHERE id = (current_setting('app.current_user_id')::INTEGER)
            AND position IN ('hr_specialist', 'general_manager', 'managing_director')
        )
    );

-- Interview Schedules Policies
CREATE POLICY "Interviewers can view their interviews" ON interview_schedules
    FOR SELECT USING (
        interviewer_id = (current_setting('app.current_user_id')::INTEGER)
        OR EXISTS (
            SELECT 1 FROM employees 
            WHERE id = (current_setting('app.current_user_id')::INTEGER)
            AND position IN ('hr_specialist', 'general_manager', 'managing_director')
        )
    );

CREATE POLICY "HR can manage interviews" ON interview_schedules
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM employees 
            WHERE id = (current_setting('app.current_user_id')::INTEGER)
            AND position IN ('hr_specialist', 'general_manager', 'managing_director')
        )
    );

-- ============================================
-- VIEWS for easier querying
-- ============================================

-- View: Applications with job details
CREATE OR REPLACE VIEW applications_detailed AS
SELECT 
    ja.id,
    ja.candidate_name,
    ja.email,
    ja.phone,
    ja.experience_years,
    ja.status,
    ja.stage,
    ja.applied_date,
    ja.rating,
    jp.title as job_title,
    jp.department,
    jp.position_type,
    jp.location,
    COUNT(ist.id) as interview_count,
    MAX(ist.scheduled_time) as last_interview_date
FROM job_applications ja
JOIN job_postings jp ON ja.job_posting_id = jp.id
LEFT JOIN interview_schedules ist ON ja.id = ist.application_id
GROUP BY ja.id, ja.candidate_name, ja.email, ja.phone, ja.experience_years, 
         ja.status, ja.stage, ja.applied_date, ja.rating,
         jp.title, jp.department, jp.position_type, jp.location;

-- View: Recruitment pipeline summary
CREATE OR REPLACE VIEW recruitment_pipeline AS
SELECT 
    jp.id as job_id,
    jp.title as job_title,
    jp.department,
    jp.status as job_status,
    COUNT(ja.id) as total_applications,
    COUNT(*) FILTER (WHERE ja.status = 'applied') as applied,
    COUNT(*) FILTER (WHERE ja.status = 'screening') as screening,
    COUNT(*) FILTER (WHERE ja.status = 'interview_scheduled') as interview_scheduled,
    COUNT(*) FILTER (WHERE ja.status = 'technical') as technical,
    COUNT(*) FILTER (WHERE ja.status = 'hr_round') as hr_round,
    COUNT(*) FILTER (WHERE ja.status = 'offer') as offer,
    COUNT(*) FILTER (WHERE ja.status = 'hired') as hired,
    COUNT(*) FILTER (WHERE ja.status = 'rejected') as rejected
FROM job_postings jp
LEFT JOIN job_applications ja ON jp.id = ja.job_posting_id
GROUP BY jp.id, jp.title, jp.department, jp.status;

-- View: Upcoming interviews
CREATE OR REPLACE VIEW upcoming_interviews AS
SELECT 
    ist.id as interview_id,
    ist.scheduled_time,
    ist.interview_type,
    ist.duration_minutes,
    ist.location,
    ist.status,
    ja.candidate_name,
    ja.email as candidate_email,
    ja.phone as candidate_phone,
    jp.title as job_title,
    e.name as interviewer_name,
    e.email as interviewer_email
FROM interview_schedules ist
JOIN job_applications ja ON ist.application_id = ja.id
JOIN job_postings jp ON ja.job_posting_id = jp.id
LEFT JOIN employees e ON ist.interviewer_id = e.id
WHERE ist.status = 'scheduled' 
    AND ist.scheduled_time >= CURRENT_TIMESTAMP
ORDER BY ist.scheduled_time;

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON TABLE job_postings IS 'Stores job openings and position details';
COMMENT ON TABLE job_applications IS 'Tracks candidate applications for job postings';
COMMENT ON TABLE interview_schedules IS 'Manages interview scheduling and feedback';

COMMENT ON VIEW applications_detailed IS 'Detailed view of applications with job information';
COMMENT ON VIEW recruitment_pipeline IS 'Summary of recruitment funnel by job posting';
COMMENT ON VIEW upcoming_interviews IS 'List of scheduled upcoming interviews';
