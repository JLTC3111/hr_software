-- Update employee-documents bucket to be public
-- This allows direct access to PDFs via public URLs
-- Run this in Supabase SQL Editor

-- Update bucket to public
UPDATE storage.buckets
SET public = true
WHERE id = 'employee-documents';

-- Verify the change
SELECT id, name, public, file_size_limit
FROM storage.buckets
WHERE id = 'employee-documents';

-- Note: RLS policies still control who can upload/delete
-- But files are now accessible via public URLs for viewing
