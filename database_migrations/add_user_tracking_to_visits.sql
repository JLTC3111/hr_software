-- Add user_id and role columns to visits table for better tracking
ALTER TABLE visits 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS role TEXT;

CREATE INDEX IF NOT EXISTS idx_visits_user_id ON visits (user_id);
