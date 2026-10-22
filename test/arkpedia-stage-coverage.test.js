// SPDX-License-Identifier: GPL-3.0-or-later
// The coverage report is the maintainer's map of what is left: every main
// source stage is either built or grouped by the first blocking mechanic.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync } from 'node:fs';
import { buildStageCoverage } from '../tools/arkpedia/stage-coverage.mjs';

const sourceStages = new URL('../../arkpedia-data/source/data/stages/', import.meta.url);
test('every main stage is built or classified by its first blocker', { skip: existsSync(sourceStages) ? false : 'the arkpedia-data source checkout is not present' }, () => {
  const report = buildStageCoverage();
  assert.ok(report.total > report.built);
  assert.equal(report.built, readdirSync(new URL('../data/', import.meta.url)).filter(name => /^arkpedia-stage-.+\.json$/.test(name)).length);
  assert.equal(Object.values(report.byReason).reduce((sum, n) => sum + n, 0), report.total - report.built);
  assert.equal(report.byChapter.reduce((sum, [, counts]) => sum + counts.total, 0), report.total);
  assert.equal(report.byChapter.reduce((sum, [, counts]) => sum + counts.built, 0), report.built);
  assert.ok(report.blockers.length, 'unsupported enemies are ranked');
  assert.ok(report.blockers.length, 'unsupported enemy blockers are ranked');
});
