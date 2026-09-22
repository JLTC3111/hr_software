-- ============================================
-- DROP EXISTING TABLES (for recreation)
-- ============================================
DROP TABLE IF EXISTS hr_notifications CASCADE;
DROP TABLE IF EXISTS hr_user_settings CASCADE;
DROP VIEW IF EXISTS notification_stats CASCADE;
DROP FUNCTION IF EXISTS create_notification CASCADE;
DROP FUNCTION IF EXISTS mark_notification_read CASCADE;
DROP FUNCTION IF EXISTS mark_all_notifications_read CASCADE;
DROP FUNCTION IF EXISTS cleanup_old_notifications CASCADE;
DROP FUNCTION IF EXISTS create_user_settings CASCADE;
DROP FUNCTION IF EXISTS update_updated_at_column CASCADE;

-- ============================================
-- CREATE TABLES
-- ============================================

-- Create notifications table
CREATE TABLE IF NOT EXISTS hr_notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,  -- Changed to UUID
  user_id UUID NOT NULL REFERENCES hr_users(id) ON DELETE CASCADE,  -- Changed to UUID
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  type VARCHAR(50) NOT NULL DEFAULT 'info', -- info, success, warning, error
  category VARCHAR(50) DEFAULT 'general', -- general, time_tracking, performance, employee, recruitment, system
  is_read BOOLEAN DEFAULT FALSE,
  action_url VARCHAR(500),
  action_label VARCHAR(100),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),  -- Changed to TIMESTAMPTZ
  read_at TIMESTAMPTZ,  -- Changed to TIMESTAMPTZ
  expires_at TIMESTAMPTZ  -- Changed to TIMESTAMPTZ
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON hr_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON hr_notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON hr_notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON hr_notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_category ON hr_notifications(category);

-- Create user settings table
CREATE TABLE IF NOT EXISTS hr_user_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,  -- Changed to UUID
  user_id UUID NOT NULL UNIQUE REFERENCES hr_users(id) ON DELETE CASCADE,  -- Changed to UUID
  
  -- Notification preferences
  email_notifications BOOLEAN DEFAULT TRUE,
  push_notifications BOOLEAN DEFAULT TRUE,
  desktop_notifications BOOLEAN DEFAULT FALSE,
  notification_frequency VARCHAR(20) DEFAULT 'realtime', -- realtime, daily, weekly
  
  -- Category-specific notification settings
  notify_time_tracking BOOLEAN DEFAULT TRUE,
  notify_performance BOOLEAN DEFAULT TRUE,
  notify_employee_updates BOOLEAN DEFAULT TRUE,
  notify_recruitment BOOLEAN DEFAULT TRUE,
  notify_system BOOLEAN DEFAULT TRUE,
  
  -- Display preferences
  theme VARCHAR(20) DEFAULT 'system', -- light, dark, system
  language VARCHAR(10) DEFAULT 'en',
  timezone VARCHAR(50) DEFAULT 'UTC',
  date_format VARCHAR(20) DEFAULT 'MM/DD/YYYY',
  time_format VARCHAR(10) DEFAULT '12h', -- 12h, 24h
  
  -- Privacy settings
  profile_visibility VARCHAR(20) DEFAULT 'all', -- all, team, managers, private
  show_email BOOLEAN DEFAULT TRUE,
  show_phone BOOLEAN DEFAULT TRUE,
  
  -- Dashboard preferences
  default_dashboard_view VARCHAR(50) DEFAULT 'overview',
  items_per_page INTEGER DEFAULT 10,
  
  -- Other preferences
  auto_clock_out BOOLEAN DEFAULT FALSE,
  auto_clock_out_time TIME DEFAULT '18:00:00',
  weekly_report BOOLEAN DEFAULT TRUE,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),  -- Changed to TIMESTAMPTZ
  updated_at TIMESTAMPTZ DEFAULT NOW()  -- Changed to TIMESTAMPTZ
);

-- Create index on user_id for settings
CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON hr_user_settings(user_id);

-- ============================================
-- FUNCTIONS
-- ============================================

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for user settings
CREATE TRIGGER update_user_settings_updated_at BEFORE UPDATE ON hr_user_settings
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create notification_stats view for quick dashboard queries
CREATE OR REPLACE VIEW notification_stats AS
SELECT 
  user_id,
  COUNT(*) as total_notifications,
  COUNT(*) FILTER (WHERE is_read = FALSE) as unread_count,
  COUNT(*) FILTER (WHERE type = 'error') as error_count,
  COUNT(*) FILTER (WHERE type = 'warning') as warning_count,
  MAX(created_at) as latest_notification_at
FROM hr_notifications
WHERE expires_at IS NULL OR expires_at > NOW()
GROUP BY user_id;

-- Create function to auto-create user settings when a new user is created
CREATE OR REPLACE FUNCTION create_user_settings()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO hr_user_settings (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to auto-create settings for new users
CREATE TRIGGER create_settings_for_new_user
AFTER INSERT ON hr_users
FOR EACH ROW
EXECUTE FUNCTION create_user_settings();

-- Create function to send notification
CREATE OR REPLACE FUNCTION create_notification(
  p_user_id UUID,  -- Changed to UUID
  p_title VARCHAR,
  p_message TEXT,
  p_type VARCHAR DEFAULT 'info',
  p_category VARCHAR DEFAULT 'general',
  p_action_url VARCHAR DEFAULT NULL,
  p_action_label VARCHAR DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb,
  p_expires_at TIMESTAMPTZ DEFAULT NULL  -- Changed to TIMESTAMPTZ
)
RETURNS UUID AS $$  -- Changed to UUID
DECLARE
  v_notification_id UUID;  -- Changed to UUID
BEGIN
  INSERT INTO hr_notifications (
    user_id, title, message, type, category, 
    action_url, action_label, metadata, expires_at
  )
  VALUES (
    p_user_id, p_title, p_message, p_type, p_category,
    p_action_url, p_action_label, p_metadata, p_expires_at
  )
  RETURNING id INTO v_notification_id;
  
  RETURN v_notification_id;
END;
$$ LANGUAGE plpgsql;

-- Create function to mark notification as read
CREATE OR REPLACE FUNCTION mark_notification_read(p_notification_id UUID)  -- Changed to UUID
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE hr_notifications
  SET is_read = TRUE, read_at = NOW()
  WHERE id = p_notification_id;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Create function to mark all notifications as read for a user
CREATE OR REPLACE FUNCTION mark_all_notifications_read(p_user_id UUID)  -- Changed to UUID
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE hr_notifications
  SET is_read = TRUE, read_at = NOW()
  WHERE user_id = p_user_id AND is_read = FALSE;
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- Create function to clean up old notifications
CREATE OR REPLACE FUNCTION cleanup_old_notifications(p_days INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  DELETE FROM hr_notifications
  WHERE created_at < NOW() - INTERVAL '1 day' * p_days
  OR (expires_at IS NOT NULL AND expires_at < NOW());
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- SECURITY
-- ============================================

-- Disable RLS for development (consistent with other tables)
ALTER TABLE hr_notifications DISABLE ROW LEVEL SECURITY;
ALTER TABLE hr_user_settings DISABLE ROW LEVEL SECURITY;

-- ============================================
-- INITIAL DATA
-- ============================================

-- Insert default settings for existing users
INSERT INTO hr_user_settings (user_id)
SELECT id FROM hr_users
ON CONFLICT (user_id) DO NOTHING;

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE hr_notifications IS 'Stores user notifications for various system events';
COMMENT ON TABLE hr_user_settings IS 'Stores user-specific preferences and settings';
COMMENT ON VIEW notification_stats IS 'Aggregated notification statistics per user';