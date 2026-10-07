-- Public-screen theme per competition + category (admin-selectable).
ALTER TABLE live_state ADD COLUMN IF NOT EXISTS theme text NOT NULL DEFAULT 'dark';
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'live_state_theme_check') THEN
    ALTER TABLE live_state ADD CONSTRAINT live_state_theme_check CHECK (theme IN ('dark', 'light', 'arena', 'ocean'));
  END IF;
END $$;
