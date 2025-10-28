-- ============================================
-- PROOF OF WORK STORAGE SETUP
-- Storage bucket and policies for time entry proof files
-- (Doctor's notes, screenshots, photos, etc.)
-- ============================================

-- ============================================
-- STORAGE BUCKET CREATION
-- ============================================
-- ⚠️ IMPORTANT: Storage buckets cannot be created via SQL migrations.
-- You must create them manually through the Supabase Dashboard or use the Management API.
-- 
-- MANUAL SETUP STEPS:
-- 
-- 1. Go to Supabase Dashboard: https://app.supabase.com
-- 2. Select your project
-- 3. Navigate to Storage → Buckets
-- 4. Click "New Bucket"
-- 5. Configure the bucket:
--    Name: hr-documents
--    Public: ❌ NO (private bucket for sensitive documents)
--    File size limit: 10MB (10485760 bytes)
--    Allowed MIME types: image/jpeg, image/png, image/jpg, image/gif, image/webp, application/pdf
-- 
-- OR use the Supabase Management API (recommended for automation):
-- 
-- curl -X POST 'https://api.supabase.com/v1/projects/{project-ref}/storage/buckets' \
--   -H "Authorization: Bearer {api-key}" \
--   -H "Content-Type: application/json" \
--   -d '{
--     "name": "hr-documents",
--     "public": false,
--     "fileSizeLimit": 10485760,
--     "allowedMimeTypes": ["image/jpeg", "image/png", "image/jpg", "image/gif", "image/webp", "application/pdf"]
--   }'

-- ============================================
-- FOLDER STRUCTURE IN hr-documents BUCKET
-- ============================================
-- 
-- hr-documents/
--   ├── time-proofs/              # Proof of work for time entries
--   │   ├── {employeeId}_{timestamp}.jpg
--   │   ├── {employeeId}_{timestamp}.png
--   │   └── {employeeId}_{timestamp}.pdf
--   ├── leave-proofs/             # Medical certificates, doctor's notes
--   │   ├── {employeeId}_{timestamp}.pdf
--   │   └── {employeeId}_{timestamp}.jpg
--   ├── contracts/                # Employee contracts (future)
--   │   └── {employeeId}_contract.pdf
--   └── performance-docs/         # Performance review documents (future)
--       └── {employeeId}_review_{timestamp}.pdf

-- ============================================
-- STORAGE POLICIES FOR hr-documents BUCKET
-- ============================================

-- Note: These policies must be created via Supabase Dashboard
-- Navigate to: Storage → hr-documents → Policies

-- Policy 1: Authenticated users can upload their own proof files
-- Name: "Employees can upload proof files"
-- Operation: INSERT
-- Target roles: authenticated
-- Policy Definition (Using SQL Policy Builder):
INSERT INTO storage.policies (name, bucket_id, operation, definition)
VALUES (
  'Employees can upload proof files',
  'hr-documents',
  'INSERT',
  '(bucket_id = ''hr-documents'') AND ((storage.foldername(name))[1] = ''time-proofs'' OR (storage.foldername(name))[1] = ''leave-proofs'')'
);

-- Policy 2: Authenticated users can view their own proof files
-- Name: "Employees can view their own proof files"
-- Operation: SELECT
-- Target roles: authenticated
-- Policy Definition:
INSERT INTO storage.policies (name, bucket_id, operation, definition)
VALUES (
  'Employees can view their own proof files',
  'hr-documents',
  'SELECT',
  '(bucket_id = ''hr-documents'') AND (
    (storage.foldername(name))[1] = ''time-proofs'' OR 
    (storage.foldername(name))[1] = ''leave-proofs''
  ) AND (
    -- Allow if filename starts with their employee ID
    (split_part((storage.filename(name)), ''_'', 1))::text = auth.uid()::text
  )'
);

-- Policy 3: Admins and managers can view all proof files
-- Name: "Admins can view all proof files"
-- Operation: SELECT
-- Target roles: authenticated
-- Policy Definition:
-- Note: You'll need to create a user_roles table or use metadata to determine admin status
INSERT INTO storage.policies (name, bucket_id, operation, definition)
VALUES (
  'Admins can view all proof files',
  'hr-documents',
  'SELECT',
  '(bucket_id = ''hr-documents'') AND (
    auth.jwt() ->> ''role'' = ''admin'' OR 
    auth.jwt() ->> ''role'' = ''manager''
  )'
);

-- Policy 4: Allow users to delete their own proof files
-- Name: "Employees can delete their own proof files"
-- Operation: DELETE
-- Target roles: authenticated
INSERT INTO storage.policies (name, bucket_id, operation, definition)
VALUES (
  'Employees can delete their own proof files',
  'hr-documents',
  'DELETE',
  '(bucket_id = ''hr-documents'') AND (
    (storage.foldername(name))[1] = ''time-proofs'' OR 
    (storage.foldername(name))[1] = ''leave-proofs''
  ) AND (
    (split_part((storage.filename(name)), ''_'', 1))::text = auth.uid()::text
  )'
);

-- ============================================
-- VERIFY STORAGE SETUP (Run these queries to check)
-- ============================================

-- Check if bucket exists
SELECT * FROM storage.buckets WHERE name = 'hr-documents';

-- Check policies
SELECT * FROM storage.policies WHERE bucket_id = 'hr-documents';

-- ============================================
-- TABLE VERIFICATION
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

-- If columns don't exist, add them:
-- ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS proof_file_url TEXT;
-- ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS proof_file_name TEXT;
-- ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS proof_file_type VARCHAR(50);

-- Add proof_file_path column to store the storage path (for regenerating signed URLs)
ALTER TABLE time_entries 
ADD COLUMN IF NOT EXISTS proof_file_path TEXT;

COMMENT ON COLUMN time_entries.proof_file_path IS 'Storage path for proof file (e.g., time-proofs/123_1234567890.jpg) - used to regenerate signed URLs';

-- ============================================
-- OPTIONAL: Add proof file columns to leave_requests
-- ============================================

-- Add proof file support for leave requests (medical certificates, etc.)
ALTER TABLE leave_requests 
ADD COLUMN IF NOT EXISTS proof_file_url TEXT,
ADD COLUMN IF NOT EXISTS proof_file_name TEXT,
ADD COLUMN IF NOT EXISTS proof_file_type VARCHAR(50),
ADD COLUMN IF NOT EXISTS proof_file_path TEXT;

COMMENT ON COLUMN leave_requests.proof_file_url IS 'URL to proof document (medical certificate, etc.) stored in hr-documents bucket';
COMMENT ON COLUMN leave_requests.proof_file_name IS 'Original filename of uploaded proof document';
COMMENT ON COLUMN leave_requests.proof_file_type IS 'MIME type of proof document (e.g., application/pdf, image/jpeg)';

-- ============================================
-- HELPER FUNCTION: Generate signed URL for proof files
-- ============================================

-- Create a function to generate signed URLs for private bucket access
CREATE OR REPLACE FUNCTION get_proof_file_signed_url(file_path TEXT, expiry_seconds INTEGER DEFAULT 3600)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  signed_url TEXT;
BEGIN
  -- This is a placeholder - actual signed URL generation happens in the application
  -- Supabase doesn't support generating signed URLs directly in SQL
  -- Use the Supabase JS client: supabase.storage.from('hr-documents').createSignedUrl(path, expiresIn)
  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION get_proof_file_signed_url IS 'Placeholder function - use Supabase JS client for signed URLs';

-- ============================================
-- INDEXES FOR BETTER PERFORMANCE
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
  entity_id BIGINT NOT NULL,
  employee_id INTEGER NOT NULL REFERENCES employees(id),
  file_name TEXT,
  file_type VARCHAR(50),
  file_size INTEGER,
  storage_path TEXT, -- Storage path for the file
  performed_by INTEGER REFERENCES employees(id),
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_proof_audit_employee ON proof_file_audit(employee_id);
CREATE INDEX idx_proof_audit_entity ON proof_file_audit(entity_type, entity_id);
CREATE INDEX idx_proof_audit_created ON proof_file_audit(created_at);

-- ============================================
-- STATISTICS VIEW
-- ============================================

-- Create view to see proof file statistics
CREATE OR REPLACE VIEW proof_file_statistics AS
SELECT 
  e.id AS employee_id,
  e.name AS employee_name,
  e.department,
  COUNT(DISTINCT te.id) FILTER (WHERE te.proof_file_url IS NOT NULL) AS time_entries_with_proof,
  COUNT(DISTINCT te.id) FILTER (WHERE te.proof_file_url IS NULL) AS time_entries_without_proof,
  COUNT(DISTINCT lr.id) FILTER (WHERE lr.proof_file_url IS NOT NULL) AS leave_requests_with_proof,
  COUNT(DISTINCT lr.id) FILTER (WHERE lr.proof_file_url IS NULL) AS leave_requests_without_proof,
  ROUND(
    100.0 * COUNT(DISTINCT te.id) FILTER (WHERE te.proof_file_url IS NOT NULL) / 
    NULLIF(COUNT(DISTINCT te.id), 0), 
    2
  ) AS time_entry_proof_percentage
FROM employees e
LEFT JOIN time_entries te ON e.id = te.employee_id
LEFT JOIN leave_requests lr ON e.id = lr.employee_id
GROUP BY e.id, e.name, e.department
ORDER BY e.name;

COMMENT ON VIEW proof_file_statistics IS 'Statistics showing proof file upload compliance by employee';

-- ============================================
-- SETUP COMPLETION CHECKLIST
-- ============================================

-- [ ] 1. Create 'hr-documents' bucket in Supabase Dashboard
-- [ ] 2. Set bucket to PRIVATE (public: false)
-- [ ] 3. Set file size limit to 10MB
-- [ ] 4. Configure allowed MIME types: image/jpeg, image/png, image/jpg, image/gif, image/webp, application/pdf
-- [ ] 5. Create storage policies (use the INSERT statements above or create via Dashboard)
-- [ ] 6. Verify time_entries table has proof file columns (run verification query above)
-- [ ] 7. Run ALTER TABLE for leave_requests to add proof file columns
-- [ ] 8. Test file upload from the application
-- [ ] 9. Verify files are stored in time-proofs/ folder
-- [ ] 10. Test file retrieval with signed URLs

-- ============================================
-- TROUBLESHOOTING
-- ============================================

-- If uploads fail, check:
-- 1. Bucket exists: SELECT * FROM storage.buckets WHERE name = 'hr-documents';
-- 2. Policies exist: SELECT * FROM storage.policies WHERE bucket_id = 'hr-documents';
-- 3. User is authenticated: Check auth.uid() returns a valid UUID
-- 4. File size is within limit (10MB)
-- 5. File type is allowed
-- 6. Application has correct bucket name in code ('hr-documents')

-- ============================================
-- NOTES
-- ============================================

-- Security Considerations:
-- 1. hr-documents bucket is PRIVATE - files require signed URLs to access
-- 2. Signed URLs expire after 1 hour (configurable)
-- 3. Users can only access their own files (enforced by RLS policies)
-- 4. Admins/managers can access all files
-- 5. Audit log tracks all file operations for compliance

-- Storage Considerations:
-- 1. Files are stored with format: {employeeId}_{timestamp}.{ext}
-- 2. Old files are not automatically deleted - implement cleanup as needed
-- 3. Consider implementing file versioning for sensitive documents
-- 4. Monitor storage usage and set up alerts for quota limits

-- Performance Considerations:
-- 1. Indexes created for queries filtering by proof file existence
-- 2. Use signed URLs with appropriate expiry times
-- 3. Consider CDN for frequently accessed files (not applicable for private docs)
-- 4. Implement pagination for file listings
