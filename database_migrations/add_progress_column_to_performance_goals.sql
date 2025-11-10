-- Add progress column to performance_goals table
-- This column tracks the completion percentage (0-100) of each goal

-- Add progress column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'performance_goals' 
        AND column_name = 'progress'
    ) THEN
        ALTER TABLE performance_goals 
        ADD COLUMN progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100);
        
        -- Add comment to document the column
        COMMENT ON COLUMN performance_goals.progress IS 'Goal completion percentage (0-100). Completed goals should be set to 100.';
    END IF;
END $$;

-- Update existing completed goals to have 100% progress
UPDATE performance_goals 
SET progress = 100 
WHERE status = 'completed' AND (progress IS NULL OR progress = 0);

-- Set in_progress goals to 50% as a default if they don't have a value
UPDATE performance_goals 
SET progress = 50 
WHERE status = 'in_progress' AND (progress IS NULL OR progress = 0);

-- Display results
SELECT id, title, status, progress 
FROM performance_goals 
ORDER BY id;
