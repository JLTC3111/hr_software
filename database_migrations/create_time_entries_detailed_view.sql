-- ============================================================
-- CREATE TIME ENTRIES DETAILED VIEW
-- This view joins time_entries with employees table to show
-- employee names and other details for admin/manager views
-- ============================================================

-- Drop the view if it exists
DROP VIEW IF EXISTS time_entries_detailed;

-- Create the time_entries_detailed view
CREATE VIEW time_entries_detailed AS
SELECT 
    te.id,
    te.employee_id,
    te.date,
    te.clock_in,
    te.clock_out,
    te.hours,
    te.hour_type,
    te.notes,
    te.status,
    te.proof_file_url,
    te.proof_file_name,
    te.proof_file_type,
    te.proof_file_path,
    te.approved_by,
    te.approved_at,
    te.created_at,
    te.updated_at,
    e.name as employee_name,
    e.email as employee_email,
    e.department as employee_department,
    e.position as employee_position
FROM time_entries te
LEFT JOIN employees e ON te.employee_id = e.id
ORDER BY te.date DESC, te.created_at DESC;

-- Grant permissions
GRANT SELECT ON time_entries_detailed TO authenticated;
GRANT SELECT ON time_entries_detailed TO anon;

-- Add comment to explain the view
COMMENT ON VIEW time_entries_detailed IS 'Detailed view of time entries with employee information for admin/manager access';
