-- Recruitment System Database Tables
-- Run this in Supabase SQL Editor

-- ====================================
-- 1. JOB POSTINGS TABLE
-- ====================================
CREATE TABLE IF NOT EXISTS job_postings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  department VARCHAR(100) NOT NULL,
  position VARCHAR(100) NOT NULL,
  description TEXT,
  requirements TEXT,
  min_experience INTEGER DEFAULT 0, -- in years
  max_experience INTEGER,
  salary_min DECIMAL(10, 2),
  salary_max DECIMAL(10, 2),
  employment_type VARCHAR(50) DEFAULT 'full-time', -- full-time, part-time, contract, internship
  location VARCHAR(255),
  status VARCHAR(50) DEFAULT 'active', -- active, closed, draft
  openings INTEGER DEFAULT 1, -- number of positions available
  posted_by UUID REFERENCES employees(id) ON DELETE SET NULL,
  posted_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deadline DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ====================================
-- 2. APPLICANTS TABLE
-- ====================================
CREATE TABLE IF NOT EXISTS applicants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(50),
  address TEXT,
  date_of_birth DATE,
  linkedin_profile VARCHAR(500),
  portfolio_url VARCHAR(500),
  years_of_experience INTEGER DEFAULT 0,
  current_company VARCHAR(255),
  current_position VARCHAR(255),
  education_level VARCHAR(100), -- High School, Bachelor's, Master's, PhD, etc.
  resume_url TEXT, -- link to stored resume file
  cover_letter TEXT,
  skills TEXT[], -- array of skills
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ====================================
-- 3. APPLICATIONS TABLE (Links applicants to job postings)
-- ====================================
CREATE TABLE IF NOT EXISTS applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_posting_id BIGINT REFERENCES job_postings(id) ON DELETE CASCADE,  -- Changed to BIGINT
  applicant_id UUID REFERENCES applicants(id) ON DELETE CASCADE,
  status VARCHAR(50) DEFAULT 'under review',
  application_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  reviewed_by TEXT REFERENCES employees(id) ON DELETE SET NULL,  -- Also changed to TEXT if employees.id is TEXT
  reviewed_date TIMESTAMP,
  notes TEXT,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  rejection_reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(job_posting_id, applicant_id)
);

-- ====================================
-- 4. INTERVIEW SCHEDULES TABLE
-- ====================================
CREATE TABLE IF NOT EXISTS interview_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID REFERENCES applications(id) ON DELETE CASCADE,
  interview_type VARCHAR(50) DEFAULT 'phone', -- phone, video, in-person, technical, hr
  interview_round INTEGER DEFAULT 1,
  scheduled_date TIMESTAMP NOT NULL,
  duration_minutes INTEGER DEFAULT 60,
  location VARCHAR(255), -- for in-person interviews or video link
  interviewer_ids UUID[], -- array of employee IDs
  status VARCHAR(50) DEFAULT 'scheduled', -- scheduled, completed, cancelled, rescheduled
  feedback TEXT,
  outcome VARCHAR(50), -- pass, fail, pending
  created_by UUID REFERENCES employees(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ====================================
-- 5. RECRUITMENT METRICS TABLE (for analytics)
-- ====================================
CREATE TABLE IF NOT EXISTS recruitment_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_posting_id BIGINT REFERENCES job_postings(id) ON DELETE CASCADE,
  total_applications INTEGER DEFAULT 0,
  under_review INTEGER DEFAULT 0,
  shortlisted INTEGER DEFAULT 0,
  interviews_scheduled INTEGER DEFAULT 0,
  offers_extended INTEGER DEFAULT 0,
  hired INTEGER DEFAULT 0,
  rejected INTEGER DEFAULT 0,
  avg_time_to_hire_days DECIMAL(5, 2), -- average days from application to hire
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ====================================
-- INDEXES FOR PERFORMANCE
-- ====================================
CREATE INDEX IF NOT EXISTS idx_job_postings_status ON job_postings(status);
CREATE INDEX IF NOT EXISTS idx_job_postings_department ON job_postings(department);
CREATE INDEX IF NOT EXISTS idx_job_postings_posted_date ON job_postings(posted_date);

CREATE INDEX IF NOT EXISTS idx_applicants_email ON applicants(email);
CREATE INDEX IF NOT EXISTS idx_applicants_created_at ON applicants(created_at);

CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(status);
CREATE INDEX IF NOT EXISTS idx_applications_job_posting_id ON applications(job_posting_id);
CREATE INDEX IF NOT EXISTS idx_applications_applicant_id ON applications(applicant_id);
CREATE INDEX IF NOT EXISTS idx_applications_date ON applications(application_date);

CREATE INDEX IF NOT EXISTS idx_interview_schedules_application_id ON interview_schedules(application_id);
CREATE INDEX IF NOT EXISTS idx_interview_schedules_scheduled_time ON interview_schedules(scheduled_time);
CREATE INDEX IF NOT EXISTS idx_interview_schedules_status ON interview_schedules(status);

-- ====================================
-- TRIGGERS FOR AUTO-UPDATING updated_at
-- ====================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_job_postings_updated_at BEFORE UPDATE ON job_postings
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_applicants_updated_at BEFORE UPDATE ON applicants
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_applications_updated_at BEFORE UPDATE ON applications
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_interview_schedules_updated_at BEFORE UPDATE ON interview_schedules
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ====================================
-- FUNCTION TO AUTO-UPDATE RECRUITMENT METRICS
-- ====================================
CREATE OR REPLACE FUNCTION update_recruitment_metrics()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert or update metrics for the job posting
  INSERT INTO recruitment_metrics (
    job_posting_id,
    total_applications,
    under_review,
    shortlisted,
    interviews_scheduled,
    offers_extended,
    hired,
    rejected
  )
  SELECT 
    NEW.job_posting_id,
    COUNT(*) as total_applications,
    COUNT(*) FILTER (WHERE status = 'under review') as under_review,
    COUNT(*) FILTER (WHERE status = 'shortlisted') as shortlisted,
    COUNT(*) FILTER (WHERE status = 'interview scheduled') as interviews_scheduled,
    COUNT(*) FILTER (WHERE status = 'offer extended') as offers_extended,
    COUNT(*) FILTER (WHERE status = 'hired') as hired,
    COUNT(*) FILTER (WHERE status = 'rejected') as rejected
  FROM applications
  WHERE job_posting_id = NEW.job_posting_id
  ON CONFLICT (job_posting_id) DO UPDATE SET
    total_applications = EXCLUDED.total_applications,
    under_review = EXCLUDED.under_review,
    shortlisted = EXCLUDED.shortlisted,
    interviews_scheduled = EXCLUDED.interviews_scheduled,
    offers_extended = EXCLUDED.offers_extended,
    hired = EXCLUDED.hired,
    rejected = EXCLUDED.rejected,
    last_updated = CURRENT_TIMESTAMP;
    
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add unique constraint to recruitment_metrics
ALTER TABLE recruitment_metrics 
ADD CONSTRAINT recruitment_metrics_job_posting_id_key UNIQUE (job_posting_id);

-- Trigger to update metrics when applications change
CREATE TRIGGER trigger_update_recruitment_metrics
AFTER INSERT OR UPDATE ON applications
FOR EACH ROW EXECUTE FUNCTION update_recruitment_metrics();

-- ====================================
-- RLS (Row Level Security) POLICIES
-- ====================================

-- Enable RLS on all tables
ALTER TABLE job_postings ENABLE ROW LEVEL SECURITY;
ALTER TABLE applicants ENABLE ROW LEVEL SECURITY;
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE interview_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE recruitment_metrics ENABLE ROW LEVEL SECURITY;

-- Job Postings: Authenticated users can read, HR can insert/update
CREATE POLICY "Authenticated users can view job postings" ON job_postings
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert job postings" ON job_postings
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update job postings" ON job_postings
  FOR UPDATE TO authenticated USING (true);

-- Applicants: Authenticated users can read all
CREATE POLICY "Authenticated users can view applicants" ON applicants
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Anyone can insert applicants" ON applicants
  FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update applicants" ON applicants
  FOR UPDATE TO authenticated USING (true);

-- Applications: Authenticated users can read/write
CREATE POLICY "Authenticated users can view applications" ON applications
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert applications" ON applications
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update applications" ON applications
  FOR UPDATE TO authenticated USING (true);

-- Interview Schedules: Authenticated users only
CREATE POLICY "Authenticated users can view interview schedules" ON interview_schedules
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage interview schedules" ON interview_schedules
  FOR ALL TO authenticated USING (true);

-- Recruitment Metrics: Read-only for authenticated
CREATE POLICY "Authenticated users can view recruitment metrics" ON recruitment_metrics
  FOR SELECT TO authenticated USING (true);

-- ====================================
-- SAMPLE DATA FOR TESTING
-- ====================================

-- Insert sample job postings
INSERT INTO job_postings (
  title, 
  department, 
  position_type, 
  description, 
  requirements,
  responsibilities,
  salary_range, 
  location, 
  posted_by,
  status, 
  posted_date,
  closing_date,
  openings
)
SELECT 
  'Senior Software Engineer', 
  'Engineering', 
  'Senior Engineer', 
  'We are looking for an experienced software engineer to join our team.',
  '3-7 years of experience required. Strong knowledge of JavaScript, React, and Node.js.',
  'Lead development projects, mentor junior developers, and contribute to architecture decisions.',
  '$80,000 - $120,000', 
  'San Francisco, CA',
  (SELECT id FROM employees LIMIT 1)::TEXT,
  'active', 
  CURRENT_DATE,
  DATE '2025-12-31',  -- Cast to DATE
  2
UNION ALL
SELECT 
  'Marketing Manager', 
  'Marketing', 
  'Manager', 
  'Lead our marketing team to drive brand awareness and growth.',
  '5-10 years of experience in marketing management. Proven track record in digital marketing.',
  'Develop marketing strategies, manage marketing team, oversee campaigns and budgets.',
  '$70,000 - $100,000', 
  'New York, NY',
  (SELECT id FROM employees LIMIT 1)::TEXT,
  'active', 
  CURRENT_DATE,
  DATE '2025-11-30',  -- Cast to DATE
  1
UNION ALL
SELECT 
  'HR Coordinator', 
  'Human Resources', 
  'Coordinator', 
  'Support HR operations and employee relations.',
  '1-3 years of experience in HR. Knowledge of HRIS systems preferred.',
  'Support recruitment, maintain employee records, coordinate HR events and programs.',
  '$45,000 - $60,000', 
  'Remote',
  (SELECT id FROM employees LIMIT 1)::TEXT,
  'active', 
  CURRENT_DATE,
  DATE '2025-12-15',  -- Cast to DATE
  1;
