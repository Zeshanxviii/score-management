# ITU 2026 Scoreboard — Backend

Turborepo monorepo: **Express 5 + TypeScript + PostgreSQL** (`pg` connection pool).

```
apps/api          Express API (routes, services, SQL migrations, Dockerfile)
apps/web          React UI: public scoreboard screen + admin panel (Vite, Tailwind, Radix, motion)
packages/shared   Zod schemas + domain constants (rounds, categories...)
```

## Quick start
```bash
docker compose up -d db                 # PostgreSQL 16
cp apps/api/.env.example apps/api/.env  # set JWT_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD
npm install
npm run build                           # turbo builds shared, then api
npm run db:seed -w @itu/api -- --demo   # migrate + admin user + itu-2026 (+ demo teams/scores)
npm run import:schedule -w @itu/api    # loads the real ITU 2026 workbook: 57 teams, 90 matches with start times
npm run dev                             # API http://localhost:4000, web http://localhost:5173
npm test                                # ranking unit tests
```
Full stack in containers: `docker compose up --build` (runs migrations on boot; change the JWT secret first).

## Production notes
- **Connection pool**: one shared `pg.Pool` (`DB_POOL_MAX`, idle/connection/statement timeouts). Transactions use `withTransaction()`; idle-client errors are logged and never crash the process. Keep `DB_POOL_MAX × instances` below Postgres `max_connections` (or use PgBouncer).
- **Security**: helmet, strict CORS allow-list (`CORS_ORIGINS`), JWT (HS256 pinned), bcrypt, rate limits (stricter on login), 100kb body limit, strict zod validation (unknown fields rejected), parameterised SQL only.
- **Ops**: `/health` (liveness), `/ready` (DB check), structured pino logs with request ids, graceful shutdown on SIGTERM, migrations behind an advisory lock.
- **Scaling SSE**: the live-refresh stream uses an in-process event bus. With more than one API instance, swap `services/events.ts` for Postgres `LISTEN/NOTIFY` or Redis pub/sub.
- Set `TRUST_PROXY=1` behind a load balancer so rate limiting sees real client IPs.

## Data model (`apps/api/migrations/001_init.sql`)
`competitions → teams, matches, display_settings, live_state, audit_log`, plus `admin_users`.
- **Category isolation is enforced by the database**: matches reference teams through composite FKs `(team_id, competition_id, category)`, so a Junior team can never be placed in a Senior match. Match numbers are unique per `(competition, category)`, not globally.
- Qualification score = `MAX(round 1, round 2)`, derived from qualification matches (team on either side). Cancelled matches are ignored.
- Visibility settings are stored separately from scores; hidden fields are **removed server-side** from public responses.
- Every admin change (including edits to COMPLETED matches) is written to `audit_log`; matches carry a `version` for optimistic concurrency.

## Unconfirmed rules (deliberately NOT hard-coded)
- **Top-16 tie-break**: equal scores share a rank; a tie across the cutoff marks those teams `TIE_TBD`.
- **Knockout winner / tie-break / 3rd place rules**: winners are set by the admin (`winnerId`), never computed. Pairings are never auto-generated.
- **ST14**: `team_b_id` is nullable; no opponent is invented.
- **Delays**: scheduling is an explicit admin action (`/rounds/:round/schedule`), never automatic.

## API (`/api/v1`) — admin routes need `Authorization: Bearer <token>`
| Method | Path | Purpose |
|---|---|---|
| POST | `/auth/login` | `{email,password}` → JWT |
| GET | `/auth/me` | current admin |
| GET/POST | `/competitions` | list / create (creates live state + visibility rows for both categories) |
| GET | `/competitions/:slug`, `/competitions/:slug/audit` | details / audit log |

Scoped to `/competitions/:slug/categories/:category` (`junior` or `senior`):

| Method | Path | Purpose |
|---|---|---|
| GET/POST | `/teams`, `/teams/bulk` | list / create / bulk create |
| PATCH/DELETE | `/teams/:id` | edit / delete (409 if used by matches) |
| GET/POST | `/matches` (`?round=`) | list / create |
| GET/PATCH/DELETE | `/matches/:id` | read / edit scores, teams, winner, status, time (send `version` to detect conflicts) |
| POST | `/rounds/:round/schedule` | start times: `{startAt, matchDurationMinutes=2, bufferMinutes=3}` |
| GET | `/boards/:board` | unfiltered leaderboard: `QUALIFICATION`, `FIRST_QUALIFICATION`, `SECOND_QUALIFICATION` (ranked rows) or `PRE_QUARTER_FINAL`, `QUARTER_FINAL`, `SEMI_FINAL`, `THIRD_POSITION`, `FINAL` (matches) |
| GET | `/settings` | visibility per board + which board is live |
| PUT | `/settings/:board` | `{showScores?, showWinner?, showLeaderboard?}` |
| PUT | `/live` | `{board}`: what the public screen shows |

Public, no auth (`/public/:slug/:category/...`): `GET /display` (live board + current + upcoming, visibility applied), `GET /boards/:board`, `GET /stream` (SSE `refresh` events, then re-fetch `/display`).

## Web app (`apps/web`)
React 18 + Vite + Tailwind + Radix Switch + lucide icons, animated with [motion](https://motion.dev) (`motion/react`).

| URL | What |
|---|---|
| `/screen/senior`, `/screen/junior` | Public screen (put this on the projector). Follows whatever board the admin sends to the screen; spectators can tap any round tab to look at that round's own leaderboard, then "Back to live screen". |
| `/admin` | Admin panel: sign in, pick category + round tab, edit teams/scores/status/winner, toggle Show scores / winner / leaderboard per round, "Show on public screen". |

Public screen layout: **one current (LIVE) match** and the **next three upcoming matches** of the round being shown (Qualification covers both qualification rounds), beside that round's leaderboard.
Updates arrive instantly over SSE (with a 15 s polling fallback). Motion: rows glide when ranks change, scores count up, the live card slides when a new match goes live, upcoming items stagger in, the LIVE dot pulses, tab pills slide. `prefers-reduced-motion` is respected.

Dev uses a Vite proxy for `/api`. For production host the built `apps/web/dist` anywhere and either serve `/api` from the same origin or set `VITE_API_URL` at build time and add the origin to `CORS_ORIGINS`.

## Schedule import notes
`apps/api/data/itu-2026-schedule.json` was generated from `ITU_2026_Match_Schedule_Updated.xlsx`. Check these before the event:
- The workbook header says **Saturday 10 Oct 2025**; 10 Oct 2026 is the Saturday, so the importer uses `EVENT_DATE=2026-10-10` (override with the env var).
- Times are interpreted as `EVENT_TZ_OFFSET=+05:30`.
- Senior team `ST032` is imported exactly as written (possibly meant to be ST32).
- Senior `ST14` (matches 15 and 30) has no opponent; imported with none.
- Junior match 14 has its time typed as text ("11.05 AM"); parsed as 11:05.
- Knockout matches are created with **no teams**; the "PQ1 vs PQ16" slot labels are not turned into pairings because the administrator assigns them. Re-running the import never overwrites existing matches unless `--force` is passed.
