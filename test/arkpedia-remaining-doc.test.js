// SPDX-License-Identifier: GPL-3.0-or-later
// The remaining-work report is the maintainer's source of truth for counts.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import support from '../data/arkpedia-enemy-support.json' with { type: 'json' };
import index from '../data/arkpedia-stages.json' with { type: 'json' };

const doc = readFileSync(new URL('../docs/REMAINING.md', import.meta.url), 'utf8');
const count = label => {
  const row = doc.split('\n').find(line => line.includes(label));
  return row ? Number(row.split('|').map(cell => cell.trim()).filter(Boolean)[1]) : NaN;
};

test('the remaining report matches the data snapshots', () => {
  assert.equal(count('Enemies supported'), support.summary.supported);
  assert.equal(count('Main source stages with committed files'), index.stages.filter(s => s.data).length);
  assert.equal(count('Public catalogue'), index.stages.filter(s => !s.testOnly).length);
});
