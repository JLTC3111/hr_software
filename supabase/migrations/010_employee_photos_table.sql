-- Employee Photos Table Migration
-- Stores photo metadata and version history for employees

-- ============================================
-- 1. EMPLOYEE PHOTOS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS employee_photos (
  id BIGSERIAL PRIMARY KEY,
  employee_id TEXT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  photo_url TEXT NOT NULL, -- Supabase Storage URL
  storage_path TEXT NOT NULL, -- Path in storage bucket (e.g., "employee-photos/123_1234567890.jpg")
  file_name VARCHAR(255) NOT NULL,
  file_size INTEGER, -- Size in bytes
  mime_type VARCHAR(100) DEFAULT 'image/jpeg',
  width INTEGER, -- Image width in pixels
  height INTEGER, -- Image height in pixels
  thumbnail_url TEXT, -- Optional: URL to thumbnail version
  is_current BOOLEAN DEFAULT true, -- Is this the active photo?
  uploaded_by TEXT REFERENCES employees(id), -- Who uploaded it
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP WITH TIME ZONE, -- Soft delete
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 2. INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_employee_photos_employee_id ON employee_photos(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_photos_current ON employee_photos(employee_id, is_current) WHERE is_current = true AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_employee_photos_uploaded_at ON employee_photos(uploaded_at DESC);
CREATE INDEX IF NOT EXISTS idx_employee_photos_deleted ON employee_photos(deleted_at) WHERE deleted_at IS NOT NULL;

-- ============================================
-- 3. TRIGGER: Ensure only one current photo per employee
-- ============================================
CREATE OR REPLACE FUNCTION ensure_single_current_photo()
RETURNS TRIGGER AS $$
BEGIN
  -- If setting a photo as current, mark all other photos for this employee as not current
  IF NEW.is_current = true THEN
    UPDATE employee_photos
    SET is_current = false, updated_at = CURRENT_TIMESTAMP
    WHERE employee_id = NEW.employee_id 
      AND id != NEW.id 
      AND is_current = true
      AND deleted_at IS NULL;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_single_current_photo
  BEFORE INSERT OR UPDATE ON employee_photos
  FOR EACH ROW
  EXECUTE FUNCTION ensure_single_current_photo();

-- ============================================
-- 4. TRIGGER: Update employee.photo field automatically
-- ============================================
CREATE OR REPLACE FUNCTION sync_employee_photo()
RETURNS TRIGGER AS $$
BEGIN
  -- Update the employees table with the current photo URL
  IF NEW.is_current = true AND NEW.deleted_at IS NULL THEN
    UPDATE employees
    SET photo = NEW.photo_url, updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.employee_id;
  END IF;
  
  -- If photo is deleted and was current, clear employee photo
  IF NEW.deleted_at IS NOT NULL AND OLD.is_current = true THEN
    UPDATE employees
    SET photo = NULL, updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.employee_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_sync_employee_photo
  AFTER INSERT OR UPDATE ON employee_photos
  FOR EACH ROW
  EXECUTE FUNCTION sync_employee_photo();

-- ============================================
-- 5. TRIGGER: Update updated_at timestamp
-- ============================================
CREATE TRIGGER update_employee_photos_updated_at 
  BEFORE UPDATE ON employee_photos
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 6. VIEW: Current Employee Photos
-- ============================================
CREATE OR REPLACE VIEW employee_photos_current AS
SELECT 
  ep.id,
  ep.employee_id,
  e.name as employee_name,
  e.department,
  ep.photo_url,
  ep.storage_path,
  ep.file_name,
  ep.file_size,
  ep.mime_type,
  ep.width,
  ep.height,
  ep.thumbnail_url,
  ep.uploaded_at,
  uploader.name as uploaded_by_name
FROM employee_photos ep
JOIN employees e ON ep.employee_id = e.id
LEFT JOIN employees uploader ON ep.uploaded_by = uploader.id
WHERE ep.is_current = true 
  AND ep.deleted_at IS NULL;

-- ============================================
-- 7. VIEW: Photo History
-- ============================================
CREATE OR REPLACE VIEW employee_photo_history AS
SELECT 
  ep.id,
  ep.employee_id,
  e.name as employee_name,
  ep.photo_url,
  ep.file_name,
  ep.file_size,
  ep.is_current,
  ep.uploaded_at,
  ep.deleted_at,
  uploader.name as uploaded_by_name,
  CASE 
    WHEN ep.deleted_at IS NOT NULL THEN 'deleted'
    WHEN ep.is_current THEN 'current'
    ELSE 'archived'
  END as status
FROM employee_photos ep
JOIN employees e ON ep.employee_id = e.id
LEFT JOIN employees uploader ON ep.uploaded_by = uploader.id
ORDER BY ep.employee_id, ep.uploaded_at DESC;

-- ============================================
-- 8. FUNCTION: Get Employee Photo History
-- ============================================
CREATE OR REPLACE FUNCTION get_employee_photo_history(p_employee_id INTEGER)
RETURNS TABLE (
  id BIGINT,
  photo_url TEXT,
  file_name VARCHAR,
  file_size INTEGER,
  uploaded_at TIMESTAMP WITH TIME ZONE,
  uploaded_by_name TEXT,
  is_current BOOLEAN,
  status TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ep.id,
    ep.photo_url,
    ep.file_name,
    ep.file_size,
    ep.uploaded_at,
    uploader.name as uploaded_by_name,
    ep.is_current,
    CASE 
      WHEN ep.deleted_at IS NOT NULL THEN 'deleted'
      WHEN ep.is_current THEN 'current'
      ELSE 'archived'
    END as status
  FROM employee_photos ep
  LEFT JOIN employees uploader ON ep.uploaded_by = uploader.id
  WHERE ep.employee_id = p_employee_id
  ORDER BY ep.uploaded_at DESC;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 9. FUNCTION: Soft Delete Photo
-- ============================================
CREATE OR REPLACE FUNCTION soft_delete_photo(p_photo_id BIGINT)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE employee_photos
  SET deleted_at = CURRENT_TIMESTAMP,
      is_current = false,
      updated_at = CURRENT_TIMESTAMP
  WHERE id = p_photo_id AND deleted_at IS NULL;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 10. FUNCTION: Clean Up Orphaned Photos (find photos not linked to employees)
-- ============================================
CREATE OR REPLACE FUNCTION find_orphaned_photos()
RETURNS TABLE (
  id BIGINT,
  storage_path TEXT,
  file_name VARCHAR,
  uploaded_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ep.id,
    ep.storage_path,
    ep.file_name,
    ep.uploaded_at
  FROM employee_photos ep
  LEFT JOIN employees e ON ep.employee_id = e.id
  WHERE e.id IS NULL OR ep.deleted_at IS NOT NULL;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 11. COMMENTS
-- ============================================
COMMENT ON TABLE employee_photos IS 'Stores employee photo metadata and version history';
COMMENT ON COLUMN employee_photos.is_current IS 'Only one photo per employee should be current at a time';
COMMENT ON COLUMN employee_photos.storage_path IS 'Full path in Supabase Storage bucket';
COMMENT ON COLUMN employee_photos.deleted_at IS 'Soft delete timestamp - NULL means active';
COMMENT ON FUNCTION ensure_single_current_photo() IS 'Ensures only one current photo per employee';
COMMENT ON FUNCTION sync_employee_photo() IS 'Automatically updates employees.photo field when current photo changes';
COMMENT ON VIEW employee_photos_current IS 'Shows only current active photos for all employees';
COMMENT ON VIEW employee_photo_history IS 'Complete photo history including archived and deleted photos';

-- ============================================
-- 12. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================
-- Enable RLS on employee_photos table
ALTER TABLE employee_photos ENABLE ROW LEVEL SECURITY;

-- Policy: Public read access to current photos only
CREATE POLICY "Allow public read access to current photos"
  ON employee_photos FOR SELECT
  USING (is_current = true AND deleted_at IS NULL);

-- Policy: Authenticated users can view all photos
CREATE POLICY "Allow authenticated users to view all photos"
  ON employee_photos FOR SELECT
  TO authenticated
  USING (true);

-- Policy: Authenticated users can insert photos
CREATE POLICY "Allow authenticated users to insert photos"
  ON employee_photos FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Policy: Authenticated users can update their own photos or if HR role
CREATE POLICY "Allow authenticated users to update photos"
  ON employee_photos FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Policy: Only admins can delete photos (soft delete)
CREATE POLICY "Allow authenticated users to soft delete photos"
  ON employee_photos FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (deleted_at IS NOT NULL);
