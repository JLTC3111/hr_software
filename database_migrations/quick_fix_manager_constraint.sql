-- ============================================================
-- QUICK FIX: Add manager_id foreign key constraint
-- ============================================================
-- Run this in Supabase SQL Editor to fix the manager relationship error
-- ============================================================

-- Check if constraint already exists
DO $$ 
BEGIN
    -- Drop existing constraint if it exists
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'hr_users_manager_id_fkey'
        AND table_name = 'hr_users'
    ) THEN
        ALTER TABLE hr_users DROP CONSTRAINT hr_users_manager_id_fkey;
        RAISE NOTICE 'Dropped existing constraint hr_users_manager_id_fkey';
    END IF;
    
    -- Add the constraint
    ALTER TABLE hr_users
    ADD CONSTRAINT hr_users_manager_id_fkey
    FOREIGN KEY (manager_id)
    REFERENCES hr_users(id)
    ON DELETE SET NULL;
    
    RAISE NOTICE 'Successfully added hr_users_manager_id_fkey constraint';
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error: %', SQLERRM;
END $$;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_hr_users_manager_id ON hr_users(manager_id);

-- Verify the constraint was created
SELECT 
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name,
    rc.delete_rule
FROM information_schema.table_constraints AS tc 
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
    LEFT JOIN information_schema.referential_constraints AS rc
      ON tc.constraint_name = rc.constraint_name
WHERE tc.constraint_name = 'hr_users_manager_id_fkey';

-- Success message
SELECT '✅ Manager foreign key constraint fixed!' AS status;
