-- ITU 2026 scoreboard schema.
-- Category isolation is enforced by the database: a match may only reference teams that belong to
-- the same competition AND category (composite foreign keys below).

CREATE TYPE category     AS ENUM ('JUNIOR', 'SENIOR');
CREATE TYPE round_type   AS ENUM ('FIRST_QUALIFICATION','SECOND_QUALIFICATION','PRE_QUARTER_FINAL','QUARTER_FINAL','SEMI_FINAL','THIRD_POSITION','FINAL');
CREATE TYPE board_type   AS ENUM ('QUALIFICATION','FIRST_QUALIFICATION','SECOND_QUALIFICATION','PRE_QUARTER_FINAL','QUARTER_FINAL','SEMI_FINAL','THIRD_POSITION','FINAL');
CREATE TYPE match_status AS ENUM ('SCHEDULED','READY','LIVE','PAUSED','COMPLETED','CANCELLED');

CREATE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TABLE admin_users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text NOT NULL,
  password_hash text NOT NULL,
  role          text NOT NULL DEFAULT 'ADMIN',
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX admin_users_email_uq ON admin_users (lower(email));

CREATE TABLE competitions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug       text NOT NULL UNIQUE,
  name       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE teams (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id uuid NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  category       category NOT NULL,
  code           text NOT NULL,
  name           text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (competition_id, category, code),
  UNIQUE (id, competition_id, category)
);
CREATE TRIGGER teams_updated BEFORE UPDATE ON teams FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE matches (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id   uuid NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  category         category NOT NULL,
  match_number     integer NOT NULL CHECK (match_number > 0),   -- unique per competition+category, NOT globally
  round            round_type NOT NULL,
  team_a_id        uuid,
  team_b_id        uuid,                                         -- nullable: e.g. ST14 entries with no confirmed opponent
  score_a          numeric(8,2) CHECK (score_a >= 0),
  score_b          numeric(8,2) CHECK (score_b >= 0),
  winner_id        uuid,                                         -- set by the administrator, never computed
  status           match_status NOT NULL DEFAULT 'SCHEDULED',
  scheduled_at     timestamptz,
  duration_minutes integer NOT NULL DEFAULT 2,
  buffer_minutes   integer NOT NULL DEFAULT 3,
  version          integer NOT NULL DEFAULT 1,                   -- optimistic concurrency for admin edits
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (competition_id, category, match_number),
  FOREIGN KEY (team_a_id, competition_id, category) REFERENCES teams (id, competition_id, category) ON DELETE RESTRICT,
  FOREIGN KEY (team_b_id, competition_id, category) REFERENCES teams (id, competition_id, category) ON DELETE RESTRICT,
  FOREIGN KEY (winner_id) REFERENCES teams (id) ON DELETE RESTRICT,
  CHECK (team_a_id IS NULL OR team_b_id IS NULL OR team_a_id <> team_b_id),
  CHECK (winner_id IS NULL OR winner_id = team_a_id OR winner_id = team_b_id)
);
CREATE INDEX matches_round_idx    ON matches (competition_id, category, round, match_number);
CREATE INDEX matches_status_idx   ON matches (competition_id, category, status, scheduled_at);
CREATE INDEX matches_team_a_idx   ON matches (team_a_id);
CREATE INDEX matches_team_b_idx   ON matches (team_b_id);
CREATE TRIGGER matches_updated BEFORE UPDATE ON matches FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Public visibility per category + board. Independent from stored scores: hiding never deletes data.
CREATE TABLE display_settings (
  competition_id   uuid NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  category         category NOT NULL,
  board            board_type NOT NULL,
  show_scores      boolean NOT NULL DEFAULT true,
  show_winner      boolean NOT NULL DEFAULT true,
  show_leaderboard boolean NOT NULL DEFAULT true,
  updated_at       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (competition_id, category, board)
);
CREATE TRIGGER display_settings_updated BEFORE UPDATE ON display_settings FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Which board the public screen is currently showing, per category.
CREATE TABLE live_state (
  competition_id uuid NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  category       category NOT NULL,
  active_board   board_type NOT NULL DEFAULT 'QUALIFICATION',
  updated_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (competition_id, category)
);
CREATE TRIGGER live_state_updated BEFORE UPDATE ON live_state FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Completed matches can be edited, so every admin change is recorded.
CREATE TABLE audit_log (
  id             bigserial PRIMARY KEY,
  competition_id uuid REFERENCES competitions(id) ON DELETE CASCADE,
  actor_id       uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  entity         text NOT NULL,
  entity_id      uuid,
  action         text NOT NULL,
  before         jsonb,
  after          jsonb,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_log_comp_idx ON audit_log (competition_id, created_at DESC);
