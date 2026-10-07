import test from 'node:test';
import assert from 'node:assert/strict';
import { rankTeams, type TeamScores } from './ranking';

const t = (code: string, round1: number | null, round2: number | null): TeamScores => ({ teamId: code, code, name: null, round1, round2 });

test('qualification score is the better of the two rounds', () => {
  const rows = rankTeams([t('SI02', 72, 85), t('ST17', 91, 76)], 'best', true);
  assert.equal(rows[0].code, 'ST17');
  assert.equal(rows[0].best, 91);
  assert.equal(rows[1].best, 85);
});

test('equal scores share a rank (competition ranking)', () => {
  const rows = rankTeams([t('A', 90, null), t('B', 90, null), t('C', 80, null)], 'best', false);
  assert.deepEqual(rows.map((r) => r.rank), [1, 1, 3]);
});

test('tie across the Top 16 cutoff is flagged TBD, not resolved', () => {
  const teams = Array.from({ length: 17 }, (_, i) => t(`T${String(i + 1).padStart(2, '0')}`, 100 - i, null));
  teams[16] = t('T17', 85, null); // rank 16 is 85 too
  const rows = rankTeams(teams, 'best', true);
  const tied = rows.filter((r) => r.status === 'TIE_TBD').map((r) => r.code);
  assert.deepEqual(tied.sort(), ['T16', 'T17']);
  assert.equal(rows.filter((r) => r.status === 'TOP_16').length, 15);
});

test('unscored teams are unranked and listed last', () => {
  const rows = rankTeams([t('A', null, null), t('B', 10, null)], 'best', true);
  assert.equal(rows[0].code, 'B');
  assert.equal(rows[1].status, 'UNRANKED');
  assert.equal(rows[1].rank, null);
});

test('single-round board uses only that round', () => {
  const rows = rankTeams([t('A', 50, 99), t('B', 60, 10)], 'round1', false);
  assert.equal(rows[0].code, 'B');
});
