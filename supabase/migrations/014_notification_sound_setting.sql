-- Add optional notification sound preference
ALTER TABLE hr_user_settings
  ADD COLUMN IF NOT EXISTS notification_sound BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN hr_user_settings.notification_sound IS 'Play a sound when new in-app notifications arrive';
