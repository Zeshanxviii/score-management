import * as XLSX from 'xlsx';
import type { Alliance, Category } from '@itu/shared';
import { pool, withTransaction } from '../db/pool';

export interface ParsedTeam {
  code: string;
  name: string | null;
  category: Category;
  school: string | null;
  alliance: Alliance;
}

export interface ParseResult {
  teams: ParsedTeam[];
  skipped: { row: number; reason: string }[];
}

/**
 * Reads the "Confirmed teams" workbook.
 * Expected columns (case-insensitive, any order): Team ID / Team i'd, Team Name, School Name.
 * Falls back to columns B (id), C (name), D (school) when no header matches.
 * Category: Team ID starting with J -> JUNIOR, S -> SENIOR (covers JI/JT/SI/ST).
 */
export function parseTeamsWorkbook(buf: Buffer): ParseResult {
  const wb = XLSX.read(buf, { type: 'buffer' });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) return { teams: [], skipped: [{ row: 0, reason: 'Workbook has no sheets' }] };
  const rows: unknown[][] = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: '' });

  if (!rows.length) return { teams: [], skipped: [{ row: 0, reason: 'First sheet is empty' }] };

  const norm = (v: unknown) => String(v ?? '').trim().toLowerCase().replace(/[''`]/g, '');
  const header = (rows[0] as unknown[]).map(norm);
  let idIdx = header.findIndex((h) => h.includes('team id') || h === 'teamid' || h.includes('team i'));
  let nameIdx = header.findIndex((h) => h === 'team name' || (h.includes('team') && h.includes('name')));
  let schoolIdx = header.findIndex((h) => h.includes('school'));

  // Fallback to B/C/D (the confirmed-teams layout)
  if (idIdx < 0 || nameIdx < 0) {
    idIdx = 1;
    nameIdx = 2;
    schoolIdx = schoolIdx < 0 ? 3 : schoolIdx;
  }

  const teams: ParsedTeam[] = [];
  const skipped: { row: number; reason: string }[] = [];
  const seen = new Set<string>();

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i] as unknown[];
    const rawCode = String(r[idIdx] ?? '').trim().toUpperCase();
    const rawName = String(r[nameIdx] ?? '').trim();
    const rawSchool = schoolIdx >= 0 ? String(r[schoolIdx] ?? '').trim() : '';
    const rowNo = i + 1;

    if (!rawCode) {
      // Ignore trailing "Total" row and fully blank rows
      const joined = (r as unknown[]).map((v) => String(v ?? '').trim()).join('');
      if (!joined || /^total/i.test(String(r[0] ?? ''))) continue;
      skipped.push({ row: rowNo, reason: 'Missing Team ID' });
      continue;
    }
    if (!/^[A-Z0-9][A-Z0-9-]{0,15}$/.test(rawCode)) {
      skipped.push({ row: rowNo, reason: `Invalid Team ID "${rawCode}"` });
      continue;
    }
    const first = rawCode[0];
    let category: Category | null = null;
    if (first === 'J') category = 'JUNIOR';
    else if (first === 'S') category = 'SENIOR';
    if (!category) {
      skipped.push({ row: rowNo, reason: `Cannot map "${rawCode}" to JUNIOR/SENIOR (expects J… or S…)` });
      continue;
    }
    const key = `${category}:${rawCode}`;
    if (seen.has(key)) {
      skipped.push({ row: rowNo, reason: `Duplicate "${rawCode}" in file` });
      continue;
    }
    seen.add(key);
    // Team Name and School Name stay in separate columns (name = team only).
    const name = rawName ? rawName.slice(0, 200) : null;
    teams.push({ code: rawCode, name, category, school: rawSchool ? rawSchool.slice(0, 200) : null, alliance: 'RED' });
  }
  // Balanced random RED/BLUE per category: shuffle each category, first half RED, rest BLUE
  // (odd count -> extra team gets a coin flip). Covers "junior and senior both red and blue in random order".
  for (const cat of ['JUNIOR', 'SENIOR'] as const) {
    const group = teams.filter((t) => t.category === cat);
    for (let k = group.length - 1; k > 0; k--) {
      const j = Math.floor(Math.random() * (k + 1));
      [group[k], group[j]] = [group[j], group[k]];
    }
    const redCount = Math.floor(group.length / 2);
    group.forEach((t, idx) => {
      if (group.length % 2 === 1 && idx === group.length - 1) {
        t.alliance = Math.random() < 0.5 ? 'RED' : 'BLUE';
      } else {
        t.alliance = idx < redCount ? 'RED' : 'BLUE';
      }
    });
  }
  return { teams, skipped };
}

/** Re-shuffles RED/BLUE evenly across ALL existing teams of a competition (per category). */
export async function shuffleAlliances(competitionId: string): Promise<Record<string, { red: number; blue: number }>> {
  const { rows } = await pool.query<{ id: string; category: Category }>(
    'SELECT id, category FROM teams WHERE competition_id=$1',
    [competitionId],
  );
  const out: Record<string, { red: number; blue: number }> = {};
  await withTransaction(async (c) => {
    for (const cat of ['JUNIOR', 'SENIOR'] as const) {
      const ids = rows.filter((r) => r.category === cat).map((r) => r.id);
      for (let k = ids.length - 1; k > 0; k--) {
        const j = Math.floor(Math.random() * (k + 1));
        [ids[k], ids[j]] = [ids[j], ids[k]];
      }
      const redCount = Math.floor(ids.length / 2);
      let red = 0;
      let blue = 0;
      for (let i = 0; i < ids.length; i++) {
        let a: Alliance;
        if (ids.length % 2 === 1 && i === ids.length - 1) a = Math.random() < 0.5 ? 'RED' : 'BLUE';
        else a = i < redCount ? 'RED' : 'BLUE';
        await c.query('UPDATE teams SET alliance=$2 WHERE id=$1', [ids[i], a]);
        if (a === 'RED') red++;
        else blue++;
      }
      out[cat] = { red, blue };
    }
  });
  return out;
}

/** Upserts parsed teams (match on competition+category+code; updates name + school, keeps existing alliance). Returns per-category counts. */
export async function importParsedTeams(
  competitionId: string,
  teams: ParsedTeam[],
  actorId?: string,
  runIn?: { query: (t: string, p: unknown[]) => Promise<unknown> },
) {
  const exec = async () => {
    let junior = 0;
    let senior = 0;
    for (const t of teams) {
      await pool.query(
        `INSERT INTO teams (competition_id, category, code, name, school_name, alliance) VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (competition_id, category, code) DO UPDATE SET name = COALESCE(EXCLUDED.name, teams.name),
           school_name = COALESCE(EXCLUDED.school_name, teams.school_name), alliance = COALESCE(teams.alliance, EXCLUDED.alliance)`,
        [competitionId, t.category, t.code, t.name, t.school, t.alliance],
      );
      if (t.category === 'JUNIOR') junior++;
      else senior++;
    }
    return { junior, senior, total: teams.length };
  };

  if (runIn) return exec();
  return withTransaction(async () => exec()).then(async (counts) => {
    if (actorId) {
      const { audit } = await import('./audit');
      await audit(pool, {
        competitionId,
        actorId,
        entity: 'team',
        action: 'BULK_CREATE',
        after: { source: 'excel-import', ...counts },
      });
    }
    const { publishChange } = await import('./events');
    publishChange(competitionId, 'JUNIOR');
    publishChange(competitionId, 'SENIOR');
    return counts;
  });
}
