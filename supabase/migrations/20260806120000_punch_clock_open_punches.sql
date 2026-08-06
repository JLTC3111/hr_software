-- Punch clock: somewhere to keep a punch that has not been closed yet.
--
-- `time_entries.clock_out` is NOT NULL, so a finished shift is the only thing
-- that table can describe. The live punch therefore had nowhere to live but the
-- browser: it was held in localStorage, which meant an open punch was lost the
-- moment someone came back on another machine, another browser, or after site
-- data was cleared. This table is that missing row.
--
-- One row per employee, because a person can only be on the clock once. The
-- punch-out path deletes the row and files the ordinary `time_entries` record,
-- so nothing here is ever a duplicate of a filed shift, and an abandoned row is
-- a forgotten punch-out rather than a data conflict.

CREATE TABLE IF NOT EXISTS open_punches (
  -- The primary key *is* the invariant: at most one open punch per person.
  employee_id text PRIMARY KEY REFERENCES employees (id) ON DELETE CASCADE,
  -- The working day the punch belongs to. A punch never survives midnight; the
  -- client refuses a row whose date is not today.
  date date NOT NULL,
  clock_in time without time zone NOT NULL,
  -- Breaks taken so far, as [{ "start": <minutes>, "end": <minutes|null> }],
  -- minutes measured from midnight — the same units the screen works in. A null
  -- `end` is the break currently running.
  breaks jsonb DEFAULT '[]'::jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Restating the columns as ADD COLUMN IF NOT EXISTS, matching the baseline
-- migration's convergence style, so a database that already has a narrower
-- version of this table is widened rather than left behind.
ALTER TABLE open_punches ADD COLUMN IF NOT EXISTS date date;
ALTER TABLE open_punches ADD COLUMN IF NOT EXISTS clock_in time without time zone;
ALTER TABLE open_punches ADD COLUMN IF NOT EXISTS breaks jsonb DEFAULT '[]'::jsonb;
ALTER TABLE open_punches ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE open_punches ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP;

-- "Who is on the clock right now" reads by day, not by person.
CREATE INDEX IF NOT EXISTS idx_open_punches_date ON open_punches (date);

DROP TRIGGER IF EXISTS update_open_punches_updated_at ON open_punches;
CREATE TRIGGER update_open_punches_updated_at BEFORE UPDATE ON open_punches
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Same posture as the rest of the HR tables: signed-in staff share the floor
-- view, so the read is open to authenticated users and the writes are too. The
-- screen only ever writes the row keyed to the signed-in employee.
ALTER TABLE open_punches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view open punches" ON open_punches;
DROP POLICY IF EXISTS "Authenticated users can insert open punches" ON open_punches;
DROP POLICY IF EXISTS "Authenticated users can update open punches" ON open_punches;
DROP POLICY IF EXISTS "Authenticated users can delete open punches" ON open_punches;

CREATE POLICY "Authenticated users can view open punches"
  ON open_punches FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert open punches"
  ON open_punches FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update open punches"
  ON open_punches FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete open punches"
  ON open_punches FOR DELETE TO authenticated USING (true);
