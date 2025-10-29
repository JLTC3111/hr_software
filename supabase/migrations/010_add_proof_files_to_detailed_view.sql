-- Add proof file columns to time_entries_detailed view
-- This ensures admins can see proof files when viewing employee time entries

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
