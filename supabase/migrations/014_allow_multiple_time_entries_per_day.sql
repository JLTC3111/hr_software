DO $$
DECLARE
  con RECORD;
BEGIN
  FOR con IN
    SELECT
      n.nspname AS schemaname,
      t.relname AS tablename,
      c.conname AS constraint_name,
      (
        SELECT array_agg(a.attname ORDER BY x.ordinality)
        FROM unnest(c.conkey) WITH ORDINALITY AS x(attnum, ordinality)
        JOIN pg_attribute a
          ON a.attrelid = t.oid
         AND a.attnum   = x.attnum
      ) AS cols
    FROM pg_constraint c
    JOIN pg_class t
      ON t.oid = c.conrelid
    JOIN pg_namespace n
      ON n.oid = t.relnamespace
    WHERE t.relname = 'time_entries'
      AND c.contype = 'u'
  LOOP
    -- Drop any unique constraint that includes (employee_id, date, hour_type).
    IF con.cols::text[] @> ARRAY['employee_id', 'date', 'hour_type']
       AND con.constraint_name <> 'unique_employee_time_entry' THEN
      EXECUTE format(
        'ALTER TABLE %I.%I DROP CONSTRAINT IF EXISTS %I',
        con.schemaname,
        con.tablename,
        con.constraint_name
      );
    END IF;
  END LOOP;
END $$;

-- Ensure the expected unique constraint exists (one entry per employee per day per clock_in).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'time_entries'
      AND c.contype = 'u'
      AND c.conname = 'unique_employee_time_entry'
  ) THEN
    ALTER TABLE time_entries
      ADD CONSTRAINT unique_employee_time_entry UNIQUE(employee_id, date, clock_in);
  END IF;
END $$;