-- ============================================================
-- MULTI-EMAIL SUPPORT FOR USERS
-- Allows one hr_user to have multiple email addresses
-- Each email can have its own auth account but all point to same hr_user
-- ============================================================

-- Create user_emails table to map multiple auth accounts to one hr_user
CREATE TABLE IF NOT EXISTS user_emails (
  id SERIAL PRIMARY KEY,
  hr_user_id UUID NOT NULL REFERENCES hr_users(id) ON DELETE CASCADE,
  auth_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL UNIQUE,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(auth_user_id)
);

-- Create index for fast lookup by email
CREATE INDEX IF NOT EXISTS idx_user_emails_email ON user_emails(email);
CREATE INDEX IF NOT EXISTS idx_user_emails_hr_user_id ON user_emails(hr_user_id);
CREATE INDEX IF NOT EXISTS idx_user_emails_auth_user_id ON user_emails(auth_user_id);

-- Add primary_email column to hr_users to track the main email
ALTER TABLE hr_users 
  ADD COLUMN IF NOT EXISTS primary_email VARCHAR(255);

-- Migrate existing hr_users to user_emails table
DO $$
DECLARE
  user_record RECORD;
BEGIN
  -- For each existing hr_user, create an entry in user_emails
  FOR user_record IN SELECT id, email FROM hr_users WHERE email IS NOT NULL
  LOOP
    -- Insert into user_emails if not already exists
    INSERT INTO user_emails (hr_user_id, auth_user_id, email, is_primary)
    VALUES (user_record.id, user_record.id, user_record.email, true)
    ON CONFLICT (email) DO NOTHING;
    
    -- Update primary_email in hr_users
    UPDATE hr_users 
    SET primary_email = user_record.email
    WHERE id = user_record.id AND primary_email IS NULL;
  END LOOP;
  
  RAISE NOTICE 'Migrated existing users to multi-email structure';
END $$;

-- Create function to get hr_user_id from any auth_user_id
CREATE OR REPLACE FUNCTION get_hr_user_id_from_auth(auth_id UUID)
RETURNS UUID AS $$
DECLARE
  result UUID;
BEGIN
  SELECT hr_user_id INTO result
  FROM user_emails
  WHERE auth_user_id = auth_id
  LIMIT 1;
  
  -- If not found in user_emails, check if it's directly in hr_users
  IF result IS NULL THEN
    SELECT id INTO result
    FROM hr_users
    WHERE id = auth_id;
  END IF;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql STABLE;

-- Create function to get primary email for an hr_user
CREATE OR REPLACE FUNCTION get_primary_email(hr_user_uuid UUID)
RETURNS VARCHAR AS $$
DECLARE
  result VARCHAR;
BEGIN
  SELECT email INTO result
  FROM user_emails
  WHERE hr_user_id = hr_user_uuid AND is_primary = true
  LIMIT 1;
  
  -- Fallback to hr_users.email if not found
  IF result IS NULL THEN
    SELECT email INTO result
    FROM hr_users
    WHERE id = hr_user_uuid;
  END IF;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql STABLE;

-- Create function to add additional email for a user
CREATE OR REPLACE FUNCTION add_user_email(
  p_hr_user_id UUID,
  p_auth_user_id UUID,
  p_email VARCHAR,
  p_is_primary BOOLEAN DEFAULT false
)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  -- Insert the new email
  INSERT INTO user_emails (hr_user_id, auth_user_id, email, is_primary)
  VALUES (p_hr_user_id, p_auth_user_id, p_email, p_is_primary)
  ON CONFLICT (email) DO UPDATE
  SET hr_user_id = EXCLUDED.hr_user_id,
      auth_user_id = EXCLUDED.auth_user_id,
      is_primary = EXCLUDED.is_primary;
  
  -- If this is set as primary, update other emails for this user
  IF p_is_primary THEN
    UPDATE user_emails
    SET is_primary = false
    WHERE hr_user_id = p_hr_user_id AND email != p_email;
    
    -- Update hr_users primary_email
    UPDATE hr_users
    SET primary_email = p_email,
        email = p_email
    WHERE id = p_hr_user_id;
  END IF;
  
  result := json_build_object(
    'success', true,
    'message', 'Email added successfully'
  );
  
  RETURN result;
EXCEPTION WHEN OTHERS THEN
  result := json_build_object(
    'success', false,
    'error', SQLERRM
  );
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON user_emails TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE user_emails_id_seq TO authenticated;
GRANT EXECUTE ON FUNCTION get_hr_user_id_from_auth(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_primary_email(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION add_user_email(UUID, UUID, VARCHAR, BOOLEAN) TO authenticated;

-- Create view for easier querying
CREATE OR REPLACE VIEW user_emails_view AS
SELECT 
  ue.id,
  ue.hr_user_id,
  ue.auth_user_id,
  ue.email,
  ue.is_primary,
  hu.full_name,
  hu.role,
  hu.department,
  hu.is_active,
  ue.created_at
FROM user_emails ue
JOIN hr_users hu ON ue.hr_user_id = hu.id;

GRANT SELECT ON user_emails_view TO authenticated;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Multi-email support migration completed successfully';
  RAISE NOTICE '📧 Users can now have multiple email addresses linked to one account';
  RAISE NOTICE '🔗 Use get_hr_user_id_from_auth() to resolve auth_user_id to hr_user_id';
END $$;
