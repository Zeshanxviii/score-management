-- Permanent red/blue side per team, assigned in balanced random order per category.
ALTER TABLE teams ADD COLUMN IF NOT EXISTS alliance text CHECK (alliance IN ('RED', 'BLUE'));
