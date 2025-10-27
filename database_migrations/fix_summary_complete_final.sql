-- ============================================================
-- FINAL COMPLETE FIX: Time Tracking Summary
-- ============================================================
-- ISSUE: time_tracking_summary columns don't match time_entries hour types
-- 
-- time_entries.hour_type: regular, weekend, holiday, bonus
-- time_tracking_summary columns: regular_hours, overtime_hours, holiday_overtime_hours
--
-- SOLUTION: Map all hour types correctly
-- - regular_hours = regular from time_entries
-- - overtime_hours = weekend + bonus + overtime from time_entries + regular from overtime_logs
-- - holiday_overtime_hours = holiday from time_entries + holiday from overtime_logs
-- ============================================================

DROP FUNCTION IF EXISTS update_time_tracking_summary(TEXT, INTEGER, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS update_time_tracking_summary(INTEGER, INTEGER, INTEGER) CASCADE;

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
    v_overtime_regular DECIMAL;
    v_overtime_holiday DECIMAL;
    v_overtime_hours DECIMAL;
    v_holiday_overtime_hours DECIMAL;
    v_total_hours DECIMAL;
    v_attendance_rate DECIMAL;
    v_working_days INTEGER;
BEGIN
    -- Calculate days worked (unique dates with ANY status except rejected)
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

    -- ========================================
    -- Calculate hours from TIME_ENTRIES by type
    -- ========================================
    
    -- Regular hours (from time_entries)
    SELECT COALESCE(SUM(hours), 0)
    INTO v_regular_hours
    FROM time_entries
    WHERE employee_id::TEXT = p_employee_id::TEXT
        AND EXTRACT(MONTH FROM date) = p_month
        AND EXTRACT(YEAR FROM date) = p_year
        AND hour_type = 'regular'
        AND status IN ('pending', 'approved');

    -- Weekend hours (from time_entries)
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

    -- Bonus hours (from time_entries)
    SELECT COALESCE(SUM(hours), 0)
    INTO v_bonus_hours
    FROM time_entries
    WHERE employee_id::TEXT = p_employee_id::TEXT
        AND EXTRACT(MONTH FROM date) = p_month
        AND EXTRACT(YEAR FROM date) = p_year
        AND hour_type = 'bonus'
        AND status IN ('pending', 'approved');

    -- ========================================
    -- Calculate hours from OVERTIME_LOGS
    -- ========================================
    
    -- Regular overtime (from overtime_logs)
    SELECT COALESCE(SUM(hours), 0)
    INTO v_overtime_regular
    FROM overtime_logs
    WHERE employee_id::TEXT = p_employee_id::TEXT
        AND EXTRACT(MONTH FROM date) = p_month
        AND EXTRACT(YEAR FROM date) = p_year
        AND overtime_type = 'regular'
        AND status IN ('pending', 'approved');

    -- Holiday overtime (from overtime_logs)
    SELECT COALESCE(SUM(hours), 0)
    INTO v_overtime_holiday
    FROM overtime_logs
    WHERE employee_id::TEXT = p_employee_id::TEXT
        AND EXTRACT(MONTH FROM date) = p_month
        AND EXTRACT(YEAR FROM date) = p_year
        AND overtime_type = 'holiday'
        AND status IN ('pending', 'approved');

    -- ========================================
    -- AGGREGATE INTO SUMMARY COLUMNS
    -- ========================================
    
    -- overtime_hours = weekend + bonus + overtime_logs.regular
    v_overtime_hours := v_weekend_hours + v_bonus_hours + v_overtime_regular;
    
    -- holiday_overtime_hours = holiday + overtime_logs.holiday
    v_holiday_overtime_hours := v_holiday_hours + v_overtime_holiday;
    
    -- total_hours = ALL hours from all sources
    v_total_hours := v_regular_hours + v_weekend_hours + v_holiday_hours + 
                     v_bonus_hours + v_overtime_regular + v_overtime_holiday;

    -- Calculate working days in month
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
        
    RAISE NOTICE 'Updated employee %: regular=%, overtime=%, holiday_ot=%, total=%', 
        p_employee_id, v_regular_hours, v_overtime_hours, v_holiday_overtime_hours, v_total_hours;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- REFRESH ALL SUMMARIES
-- ============================================================

DO $$
DECLARE
    rec RECORD;
    v_count INTEGER := 0;
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Refreshing time tracking summaries...';
    RAISE NOTICE '========================================';
    
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
            RAISE WARNING 'Failed for employee % (%/%): %', 
                rec.emp_id, rec.m, rec.y, SQLERRM;
        END;
    END LOOP;
    
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Refreshed % employee-month records', v_count;
    RAISE NOTICE '========================================';
END $$;

-- ============================================================
-- VERIFICATION
-- ============================================================

SELECT '✅ SUMMARY COLUMN MAPPING:' as info;
SELECT '  • regular_hours = regular from time_entries' as mapping;
SELECT '  • overtime_hours = weekend + bonus from time_entries + regular from overtime_logs' as mapping;
SELECT '  • holiday_overtime_hours = holiday from time_entries + holiday from overtime_logs' as mapping;
SELECT '  • total_hours = SUM of all above' as mapping;

-- Show updated summaries
SELECT 
    employee_id,
    year,
    month,
    days_worked,
    regular_hours,
    overtime_hours,
    holiday_overtime_hours,
    total_hours,
    ROUND(attendance_rate, 1) || '%' as attendance
FROM time_tracking_summary
ORDER BY year DESC, month DESC, employee_id
LIMIT 20;
