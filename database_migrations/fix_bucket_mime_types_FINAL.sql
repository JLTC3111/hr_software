-- FINAL FIX: Remove MIME type restrictions from employee-documents bucket
-- This allows PDF uploads without MIME type errors

-- ========================================
-- STEP 1: Remove MIME Type Restrictions
-- ========================================
UPDATE storage.buckets
SET 
  public = true,
  allowed_mime_types = NULL,  -- Remove restrictions (allow all types)
  file_size_limit = 52428800  -- 50MB
WHERE id = 'employee-documents';

-- ========================================
-- STEP 2: Verify Configuration
-- ========================================
SELECT 
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
FROM storage.buckets
WHERE id = 'employee-documents';

-- Expected result:
-- public: true
-- file_size_limit: 52428800
-- allowed_mime_types: NULL (no restrictions)

-- ========================================
-- STEP 3: Ensure RLS Policies Are Correct
-- ========================================

-- Drop any conflicting policies
DROP POLICY IF EXISTS "Authenticated users can view documents" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view employee documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete" ON storage.objects;

-- Create clean policies for employee-documents bucket
CREATE POLICY "Public read access for employee-documents"
ON storage.objects FOR SELECT
USING (bucket_id = 'employee-documents');

CREATE POLICY "Authenticated users can upload employee documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'employee-documents');

CREATE POLICY "Authenticated users can update employee documents"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'employee-documents');

CREATE POLICY "Authenticated users can delete employee documents"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'employee-documents');

-- ========================================
-- VERIFICATION QUERIES
-- ========================================

-- 1. Check bucket configuration
SELECT 
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types,
  created_at
FROM storage.buckets
WHERE id = 'employee-documents';

-- 2. List all policies for storage.objects
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE tablename = 'objects'
  AND schemaname = 'storage'
ORDER BY policyname;

-- ========================================
-- SUCCESS CRITERIA
-- ========================================
-- ✅ public = true
-- ✅ allowed_mime_types = NULL
-- ✅ file_size_limit = 52428800
-- ✅ 4 policies exist for employee-documents (SELECT, INSERT, UPDATE, DELETE)
