-- ============================================
-- FIX: Trigger accessing non-existent start_date field on time_entries
-- ============================================
-- The trigger_update_summary function was trying to access NEW.start_date
-- on time_entries table, which only has a 'date' field, not 'start_date'
-- Only leave_requests table has 'start_date' field

-- Drop and recreate the trigger function with proper field checking
DROP FUNCTION IF EXISTS trigger_update_summary() CASCADE;

CREATE OR REPLACE FUNCTION trigger_update_summary()
RETURNS TRIGGER AS $$
DECLARE
    v_date DATE;
BEGIN
    -- Determine which date field to use based on the table
    -- time_entries and overtime_logs use 'date'
    -- leave_requests uses 'start_date'
    IF TG_TABLE_NAME = 'leave_requests' THEN
        v_date := COALESCE(NEW.start_date, OLD.start_date);
    ELSE
        v_date := COALESCE(NEW.date, OLD.date);
    END IF;

    -- Update the summary
    PERFORM update_time_tracking_summary(
        COALESCE(NEW.employee_id, OLD.employee_id),
        EXTRACT(MONTH FROM v_date)::INTEGER,
        EXTRACT(YEAR FROM v_date)::INTEGER
    );
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Recreate the triggers
DROP TRIGGER IF EXISTS update_summary_on_time_entry ON time_entries;
DROP TRIGGER IF EXISTS update_summary_on_leave ON leave_requests;
DROP TRIGGER IF EXISTS update_summary_on_overtime ON overtime_logs;

CREATE TRIGGER update_summary_on_time_entry 
    AFTER INSERT OR UPDATE OR DELETE ON time_entries
    FOR EACH ROW EXECUTE FUNCTION trigger_update_summary();

CREATE TRIGGER update_summary_on_leave 
    AFTER INSERT OR UPDATE OR DELETE ON leave_requests
    FOR EACH ROW EXECUTE FUNCTION trigger_update_summary();

CREATE TRIGGER update_summary_on_overtime 
    AFTER INSERT OR UPDATE OR DELETE ON overtime_logs
    FOR EACH ROW EXECUTE FUNCTION trigger_update_summary();

-- ============================================
-- VERIFICATION
-- ============================================
-- This migration fixes the error:
-- "record 'new' has no field 'start_date'"
-- that occurred when creating time entries
