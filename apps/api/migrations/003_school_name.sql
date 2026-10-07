-- Separate school name from team name (Excel has both columns).
ALTER TABLE teams ADD COLUMN IF NOT EXISTS school_name text;
