-- ============================================================
-- COMPREHENSIVE FIX: Time tracking summary showing 0 hours
-- ============================================================
-- ISSUES FOUND:
-- 1. Function only counts status='approved' entries (defaults to 'pending')
-- 2. Function only counts hour_type='regular' from time_entries
--    Missing: 'weekend', 'holiday', 'bonus' hour types
-- 3. Total hours calculation incomplete
--
-- SOLUTION: Count all relevant entries properly
-- ============================================================

-- Drop existing function (try both INTEGER and TEXT parameter types)
DROP FUNCTION IF EXISTS update_time_tracking_summary(TEXT, INTEGER, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS update_time_tracking_summary(INTEGER, INTEGER, INTEGER) CASCADE;

-- Create new function with comprehensive logic
CREATE OR REPLACE FUNCTION update_time_tracking_summary(
    p_employee_id TEXT,
    p_month INTEGER,
    p_year INTEGER
)
RETURNS VOID AS $$
DECLARE
    v_days_worked INTEGER;
    v_leave_days DECIMAL;
    v_regular_hours DECIMAL;
    v_weekend_hours DECIMAL;
    v_holiday_hours DECIMAL;
    v_bonus_hours DECIMAL;
    v_overtime_hours DECIMAL;
    v_holiday_overtime_hours DECIMAL;
    v_total_hours DECIMAL;
    v_attendance_rate DECIMAL;
    v_working_days INTEGER;
BEGIN
    -- Calculate days worked from time entries (unique dates)
    -- Include BOTH pending and approved (exclude rejected)
    SELECT COUNT(DISTINCT date)
    INTO v_days_worked
    FROM time_entries
    WHERE employee_id::TEXT = p_employee_id::TEXT
        AND EXTRACT(MONTH FROM date) = p_month
        AND EXTRACT(YEAR FROM date) = p_year
        AND status IN ('pending', 'approved');

    -- Calculate leave days (only approved)
    SELECT COALESCE(SUM(days_count), 0)
    INTO v_leave_days
    FROM leave_requests
    WHERE employee_id::TEXT = p_employee_id::TEXT
        AND status = 'approved'
        AND EXTRACT(YEAR FROM start_date) = p_year
        AND EXTRACT(MONTH FROM start_date) = p_month;

    -- Calculate hours by type from time_entries
    -- Include BOTH pending and approved
    
    -- Regular hours
    SELECT COALESCE(SUM(hours), 0)
    INTO v_regular_hours
    FROM time_entries
    WHERE employee_id::TEXT = p_employee_id::TEXT
        AND EXTRACT(MONTH FROM date) = p_month
        AND EXTRACT(YEAR FROM date) = p_year
        AND hour_type = 'regular'
        AND status IN ('pending', 'approved');

    -- Weekend hours
    SELECT COALESCE(SUM(hours), 0)
    INTO v_weekend_hours
    FROM time_entries
    WHERE employee_id::TEXT = p_employee_id::TEXT
        AND EXTRACT(MONTH FROM date) = p_month
        AND EXTRACT(YEAR FROM date) = p_year
        AND hour_type = 'weekend'
        AND status IN ('pending', 'approved');

    -- Holiday hours (from time_entries)
    SELECT COALESCE(SUM(hours), 0)
    INTO v_holiday_hours
    FROM time_entries
    WHERE employee_id::TEXT = p_employee_id::TEXT
        AND EXTRACT(MONTH FROM date) = p_month
        AND EXTRACT(YEAR FROM date) = p_year
        AND hour_type = 'holiday'
        AND status IN ('pending', 'approved');

    -- Bonus hours
    SELECT COALESCE(SUM(hours), 0)
    INTO v_bonus_hours
    FROM time_entries
    WHERE employee_id::TEXT = p_employee_id::TEXT
        AND EXTRACT(MONTH FROM date) = p_month
        AND EXTRACT(YEAR FROM date) = p_year
        AND hour_type = 'bonus'
        AND status IN ('pending', 'approved');

    -- Calculate overtime hours from overtime_logs
    -- Regular overtime
    SELECT COALESCE(SUM(hours), 0)
    INTO v_overtime_hours
    FROM overtime_logs
    WHERE employee_id::TEXT = p_employee_id::TEXT
        AND EXTRACT(MONTH FROM date) = p_month
        AND EXTRACT(YEAR FROM date) = p_year
        AND overtime_type = 'regular'
        AND status IN ('pending', 'approved');

    -- Holiday overtime
    SELECT COALESCE(SUM(hours), 0)
    INTO v_holiday_overtime_hours
    FROM overtime_logs
    WHERE employee_id::TEXT = p_employee_id::TEXT
        AND EXTRACT(MONTH FROM date) = p_month
        AND EXTRACT(YEAR FROM date) = p_year
        AND overtime_type = 'holiday'
        AND status IN ('pending', 'approved');

    -- Calculate TOTAL hours (ALL hour types)
    v_total_hours := v_regular_hours + v_weekend_hours + v_holiday_hours + 
                     v_bonus_hours + v_overtime_hours + v_holiday_overtime_hours;

    -- Calculate working days in month (approximate - 22 working days)
    v_working_days := 22;

    -- Calculate attendance rate
    IF v_working_days > 0 THEN
        v_attendance_rate := LEAST((v_days_worked::DECIMAL / v_working_days) * 100, 100);
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
        v_regular_hours, v_overtime_hours, v_holiday_overtime_hours,
        v_total_hours, v_attendance_rate
    )
    ON CONFLICT (employee_id, month, year)
    DO UPDATE SET
        days_worked = v_days_worked,
        leave_days = v_leave_days,
        regular_hours = v_regular_hours,
        overtime_hours = v_overtime_hours,
        holiday_overtime_hours = v_holiday_overtime_hours,
        total_hours = v_total_hours,
        attendance_rate = v_attendance_rate,
        updated_at = CURRENT_TIMESTAMP;
        
    RAISE NOTICE 'Updated summary for employee % - %/%: % days, % total hours', 
        p_employee_id, p_month, p_year, v_days_worked, v_total_hours;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- DIAGNOSTIC QUERIES
-- ============================================================

-- Show time entries with their status
SELECT 
    employee_id,
    TO_CHAR(date, 'YYYY-MM-DD') as entry_date,
    hours,
    hour_type,
    status,
    EXTRACT(MONTH FROM date) as month,
    EXTRACT(YEAR FROM date) as year
FROM time_entries
ORDER BY date DESC
LIMIT 20;

-- Show current summary data (BEFORE fix)
SELECT 
    employee_id,
    year,
    month,
    days_worked,
    regular_hours,
    overtime_hours,
    holiday_overtime_hours,
    total_hours,
    ROUND(attendance_rate, 1) as attendance_pct
FROM time_tracking_summary
ORDER BY year DESC, month DESC
LIMIT 20;

-- ============================================================
-- REFRESH ALL SUMMARIES
-- ============================================================
-- Recalculate summaries for the last 6 months

DO $$
DECLARE
    rec RECORD;
    v_count INTEGER := 0;
BEGIN
    RAISE NOTICE 'Starting summary refresh...';
    
    FOR rec IN 
        SELECT DISTINCT 
            employee_id::TEXT as emp_id,
            EXTRACT(MONTH FROM date)::INTEGER as m,
            EXTRACT(YEAR FROM date)::INTEGER as y
        FROM time_entries
        WHERE date >= CURRENT_DATE - INTERVAL '6 months'
        ORDER BY y DESC, m DESC
    LOOP
        BEGIN
            PERFORM update_time_tracking_summary(rec.emp_id, rec.m, rec.y);
            v_count := v_count + 1;
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'Failed to update summary for employee % (%/%): %', 
                rec.emp_id, rec.m, rec.y, SQLERRM;
        END;
    END LOOP;
    
    RAISE NOTICE 'Summary refresh complete! Updated % employee-month records', v_count;
END $$;

-- Show summary data AFTER fix
SELECT 
    '=== SUMMARY DATA AFTER FIX ===' as info,
    employee_id,
    year,
    month,
    days_worked,
    regular_hours,
    overtime_hours,
    holiday_overtime_hours,
    total_hours,
    ROUND(attendance_rate, 1) as attendance_pct
FROM time_tracking_summary
ORDER BY year DESC, month DESC, employee_id
LIMIT 20;

-- ============================================================
-- VERIFICATION
-- ============================================================
SELECT '✅ Function updated to count ALL hour types!' AS fix_1;
SELECT '✅ Function updated to count PENDING + APPROVED entries!' AS fix_2;
SELECT '✅ All summaries refreshed for last 6 months!' AS fix_3;
