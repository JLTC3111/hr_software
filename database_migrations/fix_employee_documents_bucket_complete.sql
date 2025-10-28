-- Complete Fix for employee-documents Bucket
-- Run this in Supabase SQL Editor

-- ========================================
-- STEP 1: Make Bucket Public
-- ========================================
UPDATE storage.buckets
SET public = true
WHERE id = 'employee-documents';

-- ========================================
-- STEP 2: Update CORS Configuration
-- ========================================
-- Note: CORS is configured at Supabase project level, not via SQL
-- You must do this in Supabase Dashboard:
-- Settings > Storage > CORS Configuration
-- Add these allowed origins:
-- - http://localhost:3000
-- - http://localhost:5173
-- - http://localhost:5174
-- - Your production domain

-- ========================================
-- STEP 3: Remove Restrictive RLS Policies
-- ========================================
-- Drop existing SELECT policies that might block public access
DROP POLICY IF EXISTS "Authenticated users can view documents" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view employee documents" ON storage.objects;

-- Create new public SELECT policy for employee-documents
CREATE POLICY "Public read access for employee-documents"
ON storage.objects FOR SELECT
USING (bucket_id = 'employee-documents');

-- Keep authenticated-only policies for INSERT, UPDATE, DELETE
DROP POLICY IF EXISTS "Authenticated users can upload" ON storage.objects;
CREATE POLICY "Authenticated users can upload employee documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'employee-documents');

DROP POLICY IF EXISTS "Authenticated users can update" ON storage.objects;
CREATE POLICY "Authenticated users can update employee documents"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'employee-documents');

DROP POLICY IF EXISTS "Authenticated users can delete" ON storage.objects;
CREATE POLICY "Authenticated users can delete employee documents"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'employee-documents');

-- ========================================
-- STEP 4: Verify Configuration
-- ========================================
-- Check bucket settings
SELECT 
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
FROM storage.buckets
WHERE id = 'employee-documents';

-- Check RLS policies
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'objects'
  AND schemaname = 'storage'
  AND policyname LIKE '%employee%'
ORDER BY policyname;

-- ========================================
-- Expected Results:
-- ========================================
-- Bucket should show:
-- - public: true
-- - file_size_limit: 52428800 (50MB)
-- 
-- Policies should show:
-- - SELECT: Public access (no role restriction)
-- - INSERT/UPDATE/DELETE: authenticated only
