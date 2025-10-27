-- ============================================
-- FIX: Time tracking summary showing 0 hours
-- ============================================
-- PROBLEM: The update_time_tracking_summary() function only counts
-- time entries with status='approved', but new entries default to
-- status='pending'. This causes the summary to show 0 hours.
--
-- SOLUTION: Count both 'pending' and 'approved' entries
-- (but not 'rejected' entries)
-- ============================================

-- Drop and recreate the function with fixed logic
DROP FUNCTION IF EXISTS update_time_tracking_summary(TEXT, INTEGER, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS update_time_tracking_summary(INTEGER, INTEGER, INTEGER) CASCADE;

-- Recreate with proper type (check if employees.id is INTEGER or TEXT in your database)
CREATE OR REPLACE FUNCTION update_time_tracking_summary(
    p_employee_id TEXT,  -- or INTEGER depending on your schema
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
    -- COUNT PENDING AND APPROVED (not rejected)
    SELECT COUNT(DISTINCT date)
    INTO v_days_worked
    FROM time_entries
    WHERE employee_id = p_employee_id::TEXT
        AND EXTRACT(MONTH FROM date) = p_month
        AND EXTRACT(YEAR FROM date) = p_year
        AND status IN ('pending', 'approved');  -- FIXED: was only 'approved'

    -- Calculate leave days (only approved leave counts)
    SELECT COALESCE(SUM(days_count), 0)
    INTO v_leave_days
    FROM leave_requests
    WHERE employee_id = p_employee_id::TEXT
        AND status = 'approved'
        AND EXTRACT(YEAR FROM start_date) = p_year
        AND EXTRACT(MONTH FROM start_date) = p_month;

    -- Calculate regular hours from time_entries
    -- COUNT PENDING AND APPROVED (not rejected)
    SELECT COALESCE(SUM(hours), 0)
    INTO v_regular_hours
    FROM time_entries
    WHERE employee_id = p_employee_id::TEXT
        AND EXTRACT(MONTH FROM date) = p_month
        AND EXTRACT(YEAR FROM date) = p_year
        AND hour_type = 'regular'
        AND status IN ('pending', 'approved');  -- FIXED: was only 'approved'

    -- Calculate overtime hours from overtime_logs
    -- COUNT PENDING AND APPROVED (not rejected)
    SELECT COALESCE(SUM(hours), 0)
    INTO v_overtime_hours
    FROM overtime_logs
    WHERE employee_id = p_employee_id::TEXT
        AND EXTRACT(MONTH FROM date) = p_month
        AND EXTRACT(YEAR FROM date) = p_year
        AND overtime_type = 'regular'
        AND status IN ('pending', 'approved');  -- FIXED: was only 'approved'

    -- Calculate holiday overtime
    -- COUNT PENDING AND APPROVED (not rejected)
    SELECT COALESCE(SUM(hours), 0)
    INTO v_holiday_overtime
    FROM overtime_logs
    WHERE employee_id = p_employee_id::TEXT
        AND EXTRACT(MONTH FROM date) = p_month
        AND EXTRACT(YEAR FROM date) = p_year
        AND overtime_type = 'holiday'
        AND status IN ('pending', 'approved');  -- FIXED: was only 'approved'

    -- Calculate total hours (including all hour types from time_entries)
    SELECT COALESCE(SUM(hours), 0)
    INTO v_total_hours
    FROM time_entries
    WHERE employee_id = p_employee_id::TEXT
        AND EXTRACT(MONTH FROM date) = p_month
        AND EXTRACT(YEAR FROM date) = p_year
        AND status IN ('pending', 'approved');

    -- Add overtime to total
    v_total_hours := v_total_hours + v_overtime_hours + v_holiday_overtime;

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
-- VERIFICATION QUERIES
-- ============================================

-- Check current time entries and their status
SELECT 
    employee_id,
    date,
    hours,
    hour_type,
    status,
    EXTRACT(MONTH FROM date) as month,
    EXTRACT(YEAR FROM date) as year
FROM time_entries
ORDER BY date DESC
LIMIT 10;

-- Check current summary data
SELECT * FROM time_tracking_summary
ORDER BY year DESC, month DESC
LIMIT 10;

-- Manually trigger summary update for all employees with time entries this month
DO $$
DECLARE
    rec RECORD;
BEGIN
    FOR rec IN 
        SELECT DISTINCT 
            employee_id::TEXT as emp_id,
            EXTRACT(MONTH FROM date)::INTEGER as m,
            EXTRACT(YEAR FROM date)::INTEGER as y
        FROM time_entries
        WHERE date >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '2 months'
    LOOP
        PERFORM update_time_tracking_summary(rec.emp_id, rec.m, rec.y);
        RAISE NOTICE 'Updated summary for employee % - %/%', rec.emp_id, rec.m, rec.y;
    END LOOP;
END $$;

SELECT '✅ Summary function fixed to count pending AND approved entries!' AS status;
SELECT '✅ Summary data refreshed for recent months!' AS status;
