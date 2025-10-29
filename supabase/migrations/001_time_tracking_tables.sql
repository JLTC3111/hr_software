-- Time Tracking Tables for HR Software
-- Run this in your Supabase SQL Editor

-- ============================================
-- 1. EMPLOYEES TABLE (if not exists)
-- ============================================
CREATE TABLE IF NOT EXISTS employees (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  position VARCHAR(100),
  department VARCHAR(100),
  email VARCHAR(255) UNIQUE NOT NULL,
  dob DATE,
  address TEXT,
  phone VARCHAR(50),
  start_date DATE,
  status VARCHAR(50) DEFAULT 'Active',
  performance DECIMAL(3,2),
  photo TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 2. TIME ENTRIES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS time_entries (
  id BIGSERIAL PRIMARY KEY,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  clock_in TIME NOT NULL,
  clock_out TIME NOT NULL,
  hours DECIMAL(4,1) NOT NULL,
  hour_type VARCHAR(50) NOT NULL DEFAULT 'regular', -- regular, holiday, weekend, bonus
  notes TEXT,
  proof_file_url TEXT,
  proof_file_name TEXT,
  proof_file_type VARCHAR(50),
  status VARCHAR(50) DEFAULT 'pending', -- pending, approved, rejected
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  approved_by INTEGER REFERENCES employees(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_employee_time_entry UNIQUE(employee_id, date, clock_in)
);

-- ============================================
-- 3. LEAVE REQUESTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS leave_requests (
  id BIGSERIAL PRIMARY KEY,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  leave_type VARCHAR(50) NOT NULL, -- vacation, sick, personal, unpaid
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  days_count DECIMAL(3,1) NOT NULL,
  reason TEXT,
  status VARCHAR(50) DEFAULT 'pending', -- pending, approved, rejected
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  approved_by INTEGER REFERENCES employees(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 4. OVERTIME LOGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS overtime_logs (
  id BIGSERIAL PRIMARY KEY,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  hours DECIMAL(4,1) NOT NULL,
  reason TEXT NOT NULL,
  overtime_type VARCHAR(50) DEFAULT 'regular', -- regular, holiday
  status VARCHAR(50) DEFAULT 'pending', -- pending, approved, rejected
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  approved_by INTEGER REFERENCES employees(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 5. TIME TRACKING SUMMARY TABLE (Materialized View Alternative)
-- ============================================
CREATE TABLE IF NOT EXISTS time_tracking_summary (
  id BIGSERIAL PRIMARY KEY,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  year INTEGER NOT NULL CHECK (year >= 2000 AND year <= 2100),
  days_worked INTEGER DEFAULT 0,
  leave_days DECIMAL(4,1) DEFAULT 0,
  regular_hours DECIMAL(6,1) DEFAULT 0,
  overtime_hours DECIMAL(6,1) DEFAULT 0,
  holiday_overtime_hours DECIMAL(6,1) DEFAULT 0,
  total_hours DECIMAL(6,1) DEFAULT 0,
  attendance_rate DECIMAL(5,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_employee_month_year UNIQUE(employee_id, month, year)
);

-- ============================================
-- INDEXES for better query performance
-- ============================================
CREATE INDEX IF NOT EXISTS idx_time_entries_employee_date ON time_entries(employee_id, date);
CREATE INDEX IF NOT EXISTS idx_time_entries_status ON time_entries(status);
CREATE INDEX IF NOT EXISTS idx_leave_requests_employee ON leave_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_dates ON leave_requests(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_overtime_logs_employee ON overtime_logs(employee_id);
CREATE INDEX IF NOT EXISTS idx_time_summary_employee_period ON time_tracking_summary(employee_id, year, month);

-- ============================================
-- FUNCTIONS AND TRIGGERS
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at trigger to all tables
CREATE TRIGGER update_employees_updated_at BEFORE UPDATE ON employees
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_time_entries_updated_at BEFORE UPDATE ON time_entries
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_leave_requests_updated_at BEFORE UPDATE ON leave_requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_overtime_logs_updated_at BEFORE UPDATE ON overtime_logs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_time_tracking_summary_updated_at BEFORE UPDATE ON time_tracking_summary
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- FUNCTION: Calculate days between dates (excluding weekends)
-- ============================================
CREATE OR REPLACE FUNCTION calculate_working_days(start_date DATE, end_date DATE)
RETURNS DECIMAL AS $$
DECLARE
    total_days DECIMAL;
    current_date DATE;
BEGIN
    total_days := 0;
    current_date := start_date;
    
    WHILE current_date <= end_date LOOP
        -- Count only weekdays (Monday=1 to Friday=5)
        IF EXTRACT(DOW FROM current_date) BETWEEN 1 AND 5 THEN
            total_days := total_days + 1;
        END IF;
        current_date := current_date + 1;
    END LOOP;
    
    RETURN total_days;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- FUNCTION: Auto-calculate leave days
-- ============================================
CREATE OR REPLACE FUNCTION calculate_leave_days()
RETURNS TRIGGER AS $$
BEGIN
    NEW.days_count := calculate_working_days(NEW.start_date, NEW.end_date);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auto_calculate_leave_days BEFORE INSERT OR UPDATE ON leave_requests
    FOR EACH ROW EXECUTE FUNCTION calculate_leave_days();

-- ============================================
-- FUNCTION: Update time tracking summary
-- ============================================
CREATE OR REPLACE FUNCTION update_time_tracking_summary(
    p_employee_id INTEGER,
    p_month INTEGER,
    p_year INTEGER
)
RETURNS VOID AS $$
DECLARE
    v_days_worked INTEGER;
    v_leave_days DECIMAL;
    v_regular_hours DECIMAL;
    v_overtime_hours DECIMAL;
    v_holiday_overtime DECIMAL;
    v_total_hours DECIMAL;
    v_attendance_rate DECIMAL;
    v_working_days INTEGER;
BEGIN
    -- Calculate days worked from time entries
    SELECT COUNT(DISTINCT date)
    INTO v_days_worked
    FROM time_entries
    WHERE employee_id = p_employee_id
        AND EXTRACT(MONTH FROM date) = p_month
        AND EXTRACT(YEAR FROM date) = p_year
        AND status = 'approved';

    -- Calculate leave days
    SELECT COALESCE(SUM(days_count), 0)
    INTO v_leave_days
    FROM leave_requests
    WHERE employee_id = p_employee_id
        AND status = 'approved'
        AND EXTRACT(YEAR FROM start_date) = p_year
        AND EXTRACT(MONTH FROM start_date) = p_month;

    -- Calculate regular hours
    SELECT COALESCE(SUM(hours), 0)
    INTO v_regular_hours
    FROM time_entries
    WHERE employee_id = p_employee_id
        AND EXTRACT(MONTH FROM date) = p_month
        AND EXTRACT(YEAR FROM date) = p_year
        AND hour_type = 'regular'
        AND status = 'approved';

    -- Calculate overtime hours
    SELECT COALESCE(SUM(hours), 0)
    INTO v_overtime_hours
    FROM overtime_logs
    WHERE employee_id = p_employee_id
        AND EXTRACT(MONTH FROM date) = p_month
        AND EXTRACT(YEAR FROM date) = p_year
        AND overtime_type = 'regular'
        AND status = 'approved';

    -- Calculate holiday overtime
    SELECT COALESCE(SUM(hours), 0)
    INTO v_holiday_overtime
    FROM overtime_logs
    WHERE employee_id = p_employee_id
        AND EXTRACT(MONTH FROM date) = p_month
        AND EXTRACT(YEAR FROM date) = p_year
        AND overtime_type = 'holiday'
        AND status = 'approved';

    -- Calculate total hours
    v_total_hours := v_regular_hours + v_overtime_hours + v_holiday_overtime;

    -- Calculate working days in month (approximate - 22 working days per month)
    v_working_days := 22;

    -- Calculate attendance rate
    IF v_working_days > 0 THEN
        v_attendance_rate := (v_days_worked::DECIMAL / v_working_days) * 100;
    ELSE
        v_attendance_rate := 0;
    END IF;

    -- Insert or update summary
    INSERT INTO time_tracking_summary (
        employee_id, month, year, days_worked, leave_days,
        regular_hours, overtime_hours, holiday_overtime_hours,
        total_hours, attendance_rate
    )
    VALUES (
        p_employee_id, p_month, p_year, v_days_worked, v_leave_days,
        v_regular_hours, v_overtime_hours, v_holiday_overtime,
        v_total_hours, v_attendance_rate
    )
    ON CONFLICT (employee_id, month, year)
    DO UPDATE SET
        days_worked = v_days_worked,
        leave_days = v_leave_days,
        regular_hours = v_regular_hours,
        overtime_hours = v_overtime_hours,
        holiday_overtime_hours = v_holiday_overtime,
        total_hours = v_total_hours,
        attendance_rate = v_attendance_rate,
        updated_at = CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- TRIGGERS: Auto-update summary when data changes
-- ============================================
CREATE OR REPLACE FUNCTION trigger_update_summary()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM update_time_tracking_summary(
        COALESCE(NEW.employee_id, OLD.employee_id),
        EXTRACT(MONTH FROM COALESCE(NEW.date, NEW.start_date, OLD.date, OLD.start_date))::INTEGER,
        EXTRACT(YEAR FROM COALESCE(NEW.date, NEW.start_date, OLD.date, OLD.start_date))::INTEGER
    );
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_summary_on_time_entry AFTER INSERT OR UPDATE OR DELETE ON time_entries
    FOR EACH ROW EXECUTE FUNCTION trigger_update_summary();

CREATE TRIGGER update_summary_on_leave AFTER INSERT OR UPDATE OR DELETE ON leave_requests
    FOR EACH ROW EXECUTE FUNCTION trigger_update_summary();

CREATE TRIGGER update_summary_on_overtime AFTER INSERT OR UPDATE OR DELETE ON overtime_logs
    FOR EACH ROW EXECUTE FUNCTION trigger_update_summary();

-- ============================================
-- ROW LEVEL SECURITY (RLS) Policies
-- ============================================

-- Enable RLS on all tables
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE overtime_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_tracking_summary ENABLE ROW LEVEL SECURITY;

-- Policies for employees table
CREATE POLICY "Employees can view all employees" ON employees
    FOR SELECT USING (true);

CREATE POLICY "HR can manage employees" ON employees
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM employees 
            WHERE id = (current_setting('app.current_user_id')::INTEGER)
            AND position IN ('hr_specialist', 'general_manager', 'managing_director')
        )
    );

-- Policies for time_entries
CREATE POLICY "Employees can view their own time entries" ON time_entries
    FOR SELECT USING (
        employee_id = (current_setting('app.current_user_id')::INTEGER)
        OR EXISTS (
            SELECT 1 FROM employees 
            WHERE id = (current_setting('app.current_user_id')::INTEGER)
            AND position IN ('hr_specialist', 'general_manager', 'managing_director')
        )
    );

CREATE POLICY "Employees can insert their own time entries" ON time_entries
    FOR INSERT WITH CHECK (
        employee_id = (current_setting('app.current_user_id')::INTEGER)
    );

CREATE POLICY "HR can manage all time entries" ON time_entries
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM employees 
            WHERE id = (current_setting('app.current_user_id')::INTEGER)
            AND position IN ('hr_specialist', 'general_manager', 'managing_director')
        )
    );

-- Similar policies for leave_requests
CREATE POLICY "Employees can view their own leave requests" ON leave_requests
    FOR SELECT USING (
        employee_id = (current_setting('app.current_user_id')::INTEGER)
        OR EXISTS (
            SELECT 1 FROM employees 
            WHERE id = (current_setting('app.current_user_id')::INTEGER)
            AND position IN ('hr_specialist', 'general_manager', 'managing_director')
        )
    );

CREATE POLICY "Employees can create their own leave requests" ON leave_requests
    FOR INSERT WITH CHECK (
        employee_id = (current_setting('app.current_user_id')::INTEGER)
    );

CREATE POLICY "HR can manage leave requests" ON leave_requests
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM employees 
            WHERE id = (current_setting('app.current_user_id')::INTEGER)
            AND position IN ('hr_specialist', 'general_manager', 'managing_director')
        )
    );

-- Similar policies for overtime_logs
CREATE POLICY "Employees can view their own overtime logs" ON overtime_logs
    FOR SELECT USING (
        employee_id = (current_setting('app.current_user_id')::INTEGER)
        OR EXISTS (
            SELECT 1 FROM employees 
            WHERE id = (current_setting('app.current_user_id')::INTEGER)
            AND position IN ('hr_specialist', 'general_manager', 'managing_director')
        )
    );

CREATE POLICY "Employees can create their own overtime logs" ON overtime_logs
    FOR INSERT WITH CHECK (
        employee_id = (current_setting('app.current_user_id')::INTEGER)
    );

CREATE POLICY "HR can manage overtime logs" ON overtime_logs
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM employees 
            WHERE id = (current_setting('app.current_user_id')::INTEGER)
            AND position IN ('hr_specialist', 'general_manager', 'managing_director')
        )
    );

-- Policies for time_tracking_summary
CREATE POLICY "Employees can view their own summary" ON time_tracking_summary
    FOR SELECT USING (
        employee_id = (current_setting('app.current_user_id')::INTEGER)
        OR EXISTS (
            SELECT 1 FROM employees 
            WHERE id = (current_setting('app.current_user_id')::INTEGER)
            AND position IN ('hr_specialist', 'general_manager', 'managing_director')
        )
    );

-- ============================================
-- SAMPLE DATA (Optional - for testing)
-- ============================================
-- Uncomment to insert sample data

/*
-- Insert sample employees
INSERT INTO employees (name, position, department, email, phone, start_date, status, performance) VALUES
('Trịnh Thị Tình', 'general_manager', 'legal_compliance', 'info@icue.vn', '+84 909 999 999', '2015-01-15', 'Active', 4.2),
('Đỗ Bảo Long', 'senior_developer', 'internal_affairs', 'dev@icue.vn', '+84 375889900', '2017-08-20', 'onLeave', 3.8),
('Nguyễn Thị Ly', 'hr_specialist', 'human_resources', 'support@icue.vn', '+84 909 999 999', '2023-03-10', 'Active', 4.2)
ON CONFLICT (email) DO NOTHING;

-- Insert sample time entries
INSERT INTO time_entries (employee_id, date, clock_in, clock_out, hours, hour_type, status) VALUES
(1, CURRENT_DATE - INTERVAL '5 days', '08:00', '17:00', 8.0, 'regular', 'approved'),
(1, CURRENT_DATE - INTERVAL '4 days', '08:00', '18:00', 9.0, 'regular', 'approved'),
(1, CURRENT_DATE - INTERVAL '3 days', '08:00', '17:30', 8.5, 'regular', 'approved')
ON CONFLICT DO NOTHING;
*/

-- ============================================
-- VIEWS for easier querying
-- ============================================

-- View: Time entries with employee details
DROP VIEW IF EXISTS time_entries_detailed;
CREATE OR REPLACE VIEW time_entries_detailed AS
SELECT 
    te.id,
    te.employee_id,
    e.name as employee_name,
    e.position,
    e.department,
    te.date,
    te.clock_in,
    te.clock_out,
    te.hours,
    te.hour_type,
    te.status,
    te.notes,
    te.proof_file_url,
    te.proof_file_type,
    te.proof_file_name,
    te.proof_file_path,
    te.submitted_at,
    te.approved_at,
    approver.name as approved_by_name
FROM time_entries te
JOIN employees e ON te.employee_id = e.id
LEFT JOIN employees approver ON te.approved_by = approver.id;

-- View: Monthly attendance summary
CREATE OR REPLACE VIEW monthly_attendance_summary AS
SELECT 
    e.id as employee_id,
    e.name as employee_name,
    e.department,
    EXTRACT(YEAR FROM te.date) as year,
    EXTRACT(MONTH FROM te.date) as month,
    COUNT(DISTINCT te.date) as days_worked,
    SUM(te.hours) as total_hours,
    ROUND(AVG(te.hours), 2) as avg_hours_per_day
FROM employees e
LEFT JOIN time_entries te ON e.id = te.employee_id AND te.status = 'approved'
GROUP BY e.id, e.name, e.department, EXTRACT(YEAR FROM te.date), EXTRACT(MONTH FROM te.date)
ORDER BY year DESC, month DESC, e.name;

COMMENT ON TABLE employees IS 'Stores employee information';
COMMENT ON TABLE time_entries IS 'Records daily time clock entries for employees';
COMMENT ON TABLE leave_requests IS 'Manages employee leave requests';
COMMENT ON TABLE overtime_logs IS 'Tracks overtime hours worked by employees';
COMMENT ON TABLE time_tracking_summary IS 'Aggregated monthly time tracking data per employee';
