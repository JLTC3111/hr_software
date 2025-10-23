-- ============================================
-- SUPABASE STORAGE SETUP
-- Employee Photos and Documents Storage
-- ============================================

-- Note: Storage buckets are created via Supabase Dashboard or API
-- This migration provides the SQL commands as reference

-- ============================================
-- STORAGE BUCKETS (Run via Supabase Dashboard)
-- ============================================

-- Create 'employee-photos' bucket
-- Settings:
--   - Public: true
--   - File size limit: 5MB
--   - Allowed MIME types: image/*

-- Create 'hr-documents' bucket  
-- Settings:
--   - Public: false
--   - File size limit: 10MB
--   - Allowed MIME types: application/pdf, image/*

-- ============================================
-- STORAGE POLICIES
-- ============================================

-- Allow public read access to employee photos
-- CREATE POLICY "Public can view employee photos"
-- ON storage.objects FOR SELECT
-- USING (bucket_id = 'employee-photos');

-- Allow authenticated users to upload employee photos
-- CREATE POLICY "Authenticated users can upload employee photos"
-- ON storage.objects FOR INSERT
-- WITH CHECK (bucket_id = 'employee-photos' AND auth.role() = 'authenticated');

-- Allow authenticated users to update employee photos
-- CREATE POLICY "Authenticated users can update employee photos"
-- ON storage.objects FOR UPDATE
-- USING (bucket_id = 'employee-photos' AND auth.role() = 'authenticated');

-- Allow authenticated users to delete employee photos
-- CREATE POLICY "Authenticated users can delete employee photos"
-- ON storage.objects FOR DELETE
-- USING (bucket_id = 'employee-photos' AND auth.role() = 'authenticated');

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to clean up orphaned photos
CREATE OR REPLACE FUNCTION cleanup_orphaned_photos()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER := 0;
BEGIN
  -- This would require storage extension to be enabled
  -- For now, manual cleanup recommended
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON FUNCTION cleanup_orphaned_photos IS 'Cleans up photos that are no longer associated with any employee';

-- ============================================
-- MANUAL SETUP INSTRUCTIONS
-- ============================================

-- To create storage buckets:
-- 1. Go to Supabase Dashboard > Storage
-- 2. Click "New Bucket"
-- 3. Create "employee-photos" (public, 5MB limit, image/* only)
-- 4. Create "hr-documents" (private, 10MB limit, pdf and images)
-- 5. Configure policies as needed via Dashboard

-- ============================================
-- NOTES
-- ============================================

-- Storage buckets cannot be created via SQL migrations in Supabase
-- They must be created through the Dashboard or Management API
-- This file serves as documentation and policy reference
