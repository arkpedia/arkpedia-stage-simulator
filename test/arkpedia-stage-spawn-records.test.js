// SPDX-License-Identifier: GPL-3.0-or-later
// A spawn dependency added to the regular enemies must reach every file-backed
// stage: a stage file without the record of an enemy its enemies spawn fails
// to load ("Missing record of an enemy X spawns"). Repair with
// `node tools/arkpedia/repair-stage-spawn-records.mjs`.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

test('every file-backed stage carries the records of the enemies its enemies spawn', () => {
  const script = fileURLToPath(new URL('../tools/arkpedia/repair-stage-spawn-records.mjs', import.meta.url));
  const result = spawnSync(process.execPath, [script, '--check'], { cwd: fileURLToPath(new URL('../', import.meta.url)), encoding: 'utf8', timeout: 120_000 });
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0, result.stdout + result.stderr);
});
