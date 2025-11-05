-- Remove all seeded performance reviews
-- This will delete all performance reviews from the database

-- Delete all performance reviews
DELETE FROM performance_reviews;

-- Reset the sequence (if you have auto-increment)
-- ALTER SEQUENCE performance_reviews_id_seq RESTART WITH 1;

-- Verify deletion
SELECT COUNT(*) as remaining_reviews FROM performance_reviews;

-- Also reset any workload_tasks with quality ratings if they were seeded
UPDATE workload_tasks SET quality_rating = 0 WHERE quality_rating > 0;

-- Verify workload tasks reset
SELECT COUNT(*) as tasks_with_ratings FROM workload_tasks WHERE quality_rating > 0;
