-- Add is_demo column to visits table for tracking demo sessions
-- This migration adds the is_demo boolean flag to distinguish demo visits from real user visits

ALTER TABLE visits 
ADD COLUMN IF NOT EXISTS is_demo BOOLEAN DEFAULT false;

-- Create index for efficient querying of demo visits
CREATE INDEX IF NOT EXISTS idx_visits_is_demo ON visits (is_demo);

-- Update existing rows: assume all existing visits are non-demo
UPDATE visits SET is_demo = false WHERE is_demo IS NULL;
