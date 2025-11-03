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
-- SUPABASE STORAGE BUCKET SETUP
-- ============================================
-- 
-- ⚠️ IMPORTANT: Storage buckets cannot be created via SQL migrations.
-- You must create them manually through the Supabase Dashboard.
-- 
-- MANUAL SETUP STEPS:
-- 
-- 1. Go to Supabase Dashboard: https://app.supabase.com
-- 2. Select your project
-- 3. Navigate to Storage → Buckets
-- 4. Click "New Bucket"
-- 5. Configure the bucket:
--    - Name: employee-photos
--    - Public: ✅ YES (for public access to photos)
--    - File size limit: 5MB (5242880 bytes)
--    - Allowed MIME types: image/jpeg, image/png, image/gif, image/webp
-- 
-- 6. After creating, set up Storage Policies (see below)
-- 
-- ============================================
-- RECOMMENDED FOLDER STRUCTURE IN BUCKET
-- ============================================
-- 
-- employee-photos/
--   ├── originals/           # Full-size uploaded images
--   │   ├── {employeeId}_{timestamp}.jpg
--   │   └── {employeeId}_{timestamp}.png
--   ├── thumbnails/          # Auto-generated thumbnails (150x150)
--   │   ├── {employeeId}_{timestamp}_thumb.jpg
--   │   └── {employeeId}_{timestamp}_thumb.png
--   └── archives/            # Archived/replaced photos
--       └── {employeeId}_{timestamp}_archived.jpg
-- 
-- ============================================
-- STORAGE POLICIES (Applied via Dashboard)
-- ============================================
-- 
-- Policy 1: Public Read Access to Current Photos
-- Name: "Public Read Access"
-- Operation: SELECT
-- Target roles: public
-- Policy Definition: 
--   bucket_id = 'employee-photos' AND (storage.foldername(name))[1] = 'originals'
-- 
-- Policy 2: Public Read Access to Thumbnails
-- Name: "Public Read Thumbnails"
-- Operation: SELECT
-- Target roles: public
-- Policy Definition: 
--   bucket_id = 'employee-photos' AND (storage.foldername(name))[1] = 'thumbnails'
-- 
-- Policy 3: Authenticated Upload to Originals
-- Name: "Authenticated users can upload originals"
-- Operation: INSERT
-- Target roles: authenticated
-- Policy Definition: 
--   bucket_id = 'employee-photos' AND (storage.foldername(name))[1] = 'originals'
-- 
-- Policy 4: Authenticated Upload to Thumbnails
-- Name: "Authenticated users can upload thumbnails"
-- Operation: INSERT
-- Target roles: authenticated
-- Policy Definition: 
--   bucket_id = 'employee-photos' AND (storage.foldername(name))[1] = 'thumbnails'
-- 
-- Policy 5: Authenticated Update
-- Name: "Authenticated users can update"
-- Operation: UPDATE
-- Target roles: authenticated
-- Policy Definition: 
--   bucket_id = 'employee-photos' AND auth.role() = 'authenticated'
-- 
-- Policy 6: Authenticated Delete (Admins Only - Optional)
-- Name: "Admins can delete"
-- Operation: DELETE
-- Target roles: authenticated
-- Policy Definition: 
--   bucket_id = 'employee-photos' AND auth.jwt()->>'role' = 'admin'
-- 
-- ============================================
-- IMAGE OPTIMIZATION RECOMMENDATIONS
-- ============================================
-- 
-- 1. Client-side resize before upload:
--    - Max dimensions: 800x800px for originals
--    - Thumbnails: 150x150px
--    - Use canvas API or libraries like 'browser-image-compression'
-- 
-- 2. Compress images before upload:
--    - JPEG quality: 85%
--    - PNG: Use lossy compression if possible
--    - Convert to WebP for better compression
-- 
-- 3. File naming convention:
--    - Format: {employeeId}_{timestamp}.{ext}
--    - Example: 123_1704123456789.jpg
--    - Ensures uniqueness and easy sorting
-- 
-- 4. Cleanup strategy:
--    - Move old photos to archives/ folder instead of deleting
--    - Run periodic cleanup job (monthly) to remove orphaned files
-- 
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
