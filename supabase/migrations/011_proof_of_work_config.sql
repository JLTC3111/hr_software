-- ============================================
-- PROOF OF WORK STORAGE CONFIGURATION
-- Time Entry & Leave Request File Storage
-- ============================================

-- This migration documents the storage setup for proof of work documents
-- using the existing 'employee-documents' bucket

-- ============================================
-- EXISTING BUCKET CONFIGURATION
-- ============================================

-- BUCKET: employee-documents (ALREADY EXISTS)
-- Settings:
--   - Name: employee-documents
--   - Privacy: PUBLIC
--   - File size limit: 50MB
--   - Allowed MIME types: ALL (no restrictions)

-- ============================================
-- FOLDER STRUCTURE IN employee-documents BUCKET
-- ============================================

-- employee-documents/
-- ├── time-proofs/          # Proof files for time entries
-- │   ├── {employeeId}_{timestamp}.jpg
-- │   ├── {employeeId}_{timestamp}.png
-- │   └── {employeeId}_{timestamp}.pdf
-- └── leave-proofs/         # Proof files for leave requests
--     └── {employeeId}_{timestamp}.pdf

-- File naming convention: {employeeId}_{timestamp}.{extension}
-- Example: 123_1703123456789.jpg

-- ============================================
-- DATABASE SCHEMA UPDATES
-- ============================================

-- Verify time_entries table has proof file columns
SELECT column_name, data_type, character_maximum_length, is_nullable
FROM information_schema.columns
WHERE table_name = 'time_entries'
  AND column_name IN ('proof_file_url', 'proof_file_name', 'proof_file_type', 'proof_file_path')
ORDER BY ordinal_position;

-- Expected output:
-- proof_file_url  | text        | NULL | YES
-- proof_file_name | text        | NULL | YES
-- proof_file_type | varchar(50) | 50   | YES
-- proof_file_path | text        | NULL | YES

-- Add proof_file_path column to store the storage path (for easy file management)
ALTER TABLE time_entries 
ADD COLUMN IF NOT EXISTS proof_file_path TEXT;

COMMENT ON COLUMN time_entries.proof_file_path IS 'Storage path for proof file (e.g., time-proofs/123_1234567890.jpg) - used to reference and delete files';

-- ============================================
-- OPTIONAL: Add proof file columns to leave_requests
-- ============================================

-- Add proof file support for leave requests (medical certificates, etc.)
ALTER TABLE leave_requests 
ADD COLUMN IF NOT EXISTS proof_file_url TEXT,
ADD COLUMN IF NOT EXISTS proof_file_name TEXT,
ADD COLUMN IF NOT EXISTS proof_file_type VARCHAR(50),
ADD COLUMN IF NOT EXISTS proof_file_path TEXT;

COMMENT ON COLUMN leave_requests.proof_file_url IS 'URL to proof document (medical certificate, etc.) stored in employee-documents bucket';
COMMENT ON COLUMN leave_requests.proof_file_name IS 'Original filename of proof document';
COMMENT ON COLUMN leave_requests.proof_file_type IS 'MIME type of proof document';
COMMENT ON COLUMN leave_requests.proof_file_path IS 'Storage path for proof file - used to reference and delete files';

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

-- Index for finding time entries with proof files
CREATE INDEX IF NOT EXISTS idx_time_entries_with_proof 
ON time_entries(employee_id, date) 
WHERE proof_file_url IS NOT NULL;

-- Index for finding leave requests with proof files
CREATE INDEX IF NOT EXISTS idx_leave_requests_with_proof 
ON leave_requests(employee_id, start_date) 
WHERE proof_file_url IS NOT NULL;

-- ============================================
-- AUDIT LOG for proof file operations
-- ============================================

CREATE TABLE IF NOT EXISTS proof_file_audit (
  id BIGSERIAL PRIMARY KEY,
  operation VARCHAR(20) NOT NULL, -- 'upload', 'delete', 'access'
  entity_type VARCHAR(50) NOT NULL, -- 'time_entry', 'leave_request'
  entity_id TEXT NOT NULL,
  employee_id TEXT NOT NULL REFERENCES employees(id),  -- Changed to TEXT
  file_name TEXT,
  file_type VARCHAR(50),
  file_size INTEGER,
  storage_path TEXT, -- Storage path for the file
  performed_by TEXT REFERENCES employees(id),  -- Changed to TEXT
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_proof_audit_employee ON proof_file_audit(employee_id);
CREATE INDEX idx_proof_audit_entity ON proof_file_audit(entity_type, entity_id);
CREATE INDEX idx_proof_audit_created ON proof_file_audit(created_at);

COMMENT ON TABLE proof_file_audit IS 'Audit log for all proof file operations';

-- ============================================
-- STATISTICS VIEW
-- ============================================

CREATE OR REPLACE VIEW proof_file_statistics AS
SELECT 
  e.id AS employee_id,
  e.name AS employee_name,
  COUNT(DISTINCT te.proof_file_url) + COUNT(DISTINCT lr.proof_file_url) AS total_files,
  COUNT(DISTINCT te.proof_file_url) AS time_entry_files,
  COUNT(DISTINCT lr.proof_file_url) AS leave_request_files
FROM employees e
LEFT JOIN time_entries te ON e.id = te.employee_id AND te.proof_file_url IS NOT NULL
LEFT JOIN leave_requests lr ON e.id = lr.employee_id AND lr.proof_file_url IS NOT NULL
GROUP BY e.id, e.name
HAVING COUNT(DISTINCT te.proof_file_url) + COUNT(DISTINCT lr.proof_file_url) > 0
ORDER BY total_files DESC;

COMMENT ON VIEW proof_file_statistics IS 'Summary of proof file usage by employee';

-- ============================================
-- STORAGE POLICIES (NOT NEEDED - BUCKET IS PUBLIC)
-- ============================================

-- Since the employee-documents bucket is PUBLIC, no RLS policies are needed.
-- All authenticated users can access files via public URLs.
-- 
-- NOTE: If you want to restrict access in the future:
-- 1. Change bucket to PRIVATE in Supabase Dashboard
-- 2. Apply RLS policies similar to employee-photos bucket
-- 3. Update code to use signed URLs instead of public URLs

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Check if columns exist
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name IN ('time_entries', 'leave_requests')
  AND column_name LIKE 'proof_file%'
ORDER BY table_name, ordinal_position;

-- Check if indexes exist
SELECT 
  schemaname,
  tablename,
  indexname
FROM pg_indexes
WHERE tablename IN ('time_entries', 'leave_requests', 'proof_file_audit')
  AND indexname LIKE '%proof%'
ORDER BY tablename, indexname;

-- Check if audit table exists
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'proof_file_audit'
) AS audit_table_exists;

-- ============================================
-- SETUP CHECKLIST
-- ============================================

-- ✅ 1. Verify employee-documents bucket exists (DONE - bucket exists)
-- ✅ 2. Verify bucket is PUBLIC with 50MB limit (DONE - per user confirmation)
-- ⬜ 3. Run this migration to add database columns
-- ⬜ 4. Verify columns added successfully (run verification queries above)
-- ⬜ 5. Test file upload from timeClockEntry.jsx
-- ⬜ 6. Test file display with public URLs
-- ⬜ 7. Test file deletion
-- ⬜ 8. Monitor proof_file_audit table for logs

-- ============================================
-- USAGE EXAMPLES
-- ============================================

-- Example: Find all time entries with proof files
-- SELECT id, employee_id, date, proof_file_name, proof_file_url
-- FROM time_entries
-- WHERE proof_file_url IS NOT NULL
-- ORDER BY date DESC;

-- Example: Find employees who uploaded proof files this month
-- SELECT DISTINCT e.name, COUNT(te.id) as proof_files_count
-- FROM employees e
-- JOIN time_entries te ON e.id = te.employee_id
-- WHERE te.proof_file_url IS NOT NULL
--   AND te.date >= DATE_TRUNC('month', CURRENT_DATE)
-- GROUP BY e.id, e.name
-- ORDER BY proof_files_count DESC;

-- Example: Get storage statistics
-- SELECT * FROM proof_file_statistics;
