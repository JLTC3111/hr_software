-- ============================================
-- FIX: Update time_tracking_summary function to accept TEXT employee_id
-- ============================================
-- The function was defined with INTEGER but employees.id is TEXT
-- This causes: "function update_time_tracking_summary(text, integer, integer) does not exist"

-- Drop and recreate with correct type
DROP FUNCTION IF EXISTS update_time_tracking_summary(INTEGER, INTEGER, INTEGER) CASCADE;

CREATE OR REPLACE FUNCTION update_time_tracking_summary(
    p_employee_id TEXT,  -- Changed from INTEGER to TEXT
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
-- VERIFICATION
-- ============================================
-- This migration fixes the error:
-- "function update_time_tracking_summary(text, integer, integer) does not exist"
-- that occurred when creating time entries with bonus or other hour types
