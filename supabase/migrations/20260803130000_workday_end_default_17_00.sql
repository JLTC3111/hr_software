-- Move the end of the standard working day from 18:00 to 17:00.
--
-- The admin "auto-close" action in timeTracking.jsx now snaps open punches to
-- the 08:30-17:00 frame. hr_user_settings.auto_clock_out_time is the per-user
-- version of the same idea, so its default has to agree or a new user gets a
-- clock-out an hour later than the one the org actually runs on.
--
-- Only the default changes. Anyone who has already set their own time keeps it.
ALTER TABLE hr_user_settings
  ALTER COLUMN auto_clock_out_time SET DEFAULT '17:00:00';
