/**
 * Imports teams from the "Confirmed teams" .xlsx workbook.
 *
 * Usage:
 *   npm run import:teams -w @itu/api -- "/path/to/Confirmed teams RFGYC'26 - 9 & 10 Oct.xlsx" [--slug=itu-2026] [--dry-run]
 *
 * Mapping: Team ID column -> code (uppercased), Team Name (+ School) -> name,
 * first letter J -> JUNIOR, S -> SENIOR. Existing teams are updated, never duplicated.
 */
import fs from 'node:fs';
import { pool, closePool } from './pool';
import { migrate } from './migrate';
import { ensureCompetition } from './ensureCompetition';
import { parseTeamsWorkbook, importParsedTeams } from '../services/teams-excel';
import { logger } from '../logger';

async function main() {
  const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const opts = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => {
    const [k, v] = a.slice(2).split('=');
    return [k, v ?? true];
  }));
  const file = args[0];
  if (!file) {
    console.error(`Usage: npm run import:teams -w @itu/api -- "<path-to-xlsx>" [--slug=itu-2026] [--dry-run]`);
    process.exit(1);
  }
  const slug = (opts.slug as string) || 'itu-2026';
  const dryRun = opts['dry-run'] !== undefined;
  const buf = fs.readFileSync(file);
  const { teams, skipped } = parseTeamsWorkbook(buf);

  const junior = teams.filter((t) => t.category === 'JUNIOR');
  const senior = teams.filter((t) => t.category === 'SENIOR');
  const red = (xs: typeof teams) => xs.filter((t) => t.alliance === 'RED').length;
  console.log(`Parsed ${teams.length} teams from ${file} (JUNIOR: ${junior.length} [R${red(junior)}/B${junior.length - red(junior)}], SENIOR: ${senior.length} [R${red(senior)}/B${senior.length - red(senior)}])`);
  for (const t of teams.slice(0, 10)) console.log(`  ${t.category} ${t.code} [${t.alliance}] — ${t.name ?? '(no name)'} (${t.school ?? 'no school'})`);
  if (teams.length > 10) console.log(`  … and ${teams.length - 10} more`);
  if (skipped.length) {
    console.log(`Skipped ${skipped.length} rows:`);
    for (const s of skipped.slice(0, 20)) console.log(`  row ${s.row}: ${s.reason}`);
  }
  if (dryRun) {
    console.log('Dry run — nothing written.');
    return;
  }

  await migrate();
  const rows = (await pool.query('SELECT id FROM competitions WHERE slug=$1', [slug])).rows;
  const competitionId: string = rows[0]?.id ?? (await ensureCompetition(slug, 'ITU 2026'));
  const counts = await importParsedTeams(competitionId, teams);
  logger.info({ slug, ...counts, skipped: skipped.length }, 'Teams imported from Excel');
  console.log(`Done: upserted ${counts.total} teams into competition "${slug}" (JUNIOR ${counts.junior}, SENIOR ${counts.senior}).`);
}

main()
  .then(() => closePool())
  .catch(async (err) => { logger.error({ err }, 'Team import failed'); await closePool().catch(() => undefined); process.exit(1); });
