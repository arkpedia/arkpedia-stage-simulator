// SPDX-License-Identifier: GPL-3.0-or-later
// The CI shard split must be a partition: every test file once, no duplicates.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, mkdtempSync, mkdirSync, copyFileSync, writeFileSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { testFilesForShard } from '../tools/run-tests.mjs';
import { STAGE_SMOKE_GROUPS, publicSmokeStages, stageSmokeCases } from '../tools/stage-smoke.mjs';

const ALL = readdirSync(new URL('../test/', import.meta.url)).filter(name => name.endsWith('.test.js')).sort();

for (const total of [2, 3, 5]) {
  test(`the ${total}-way shard split is an exact partition`, () => {
    const seen = [];
    for (let index = 0; index < total; index++) seen.push(...testFilesForShard(total, index));
    assert.equal(seen.length, ALL.length);
    assert.deepEqual([...new Set(seen)].sort(), ALL);
  });
}

test('stage smoke groups cover every public stage exactly once within bounded files', () => {
  const groups = Array.from({ length: STAGE_SMOKE_GROUPS }, (_, group) => stageSmokeCases(group));
  const seen = groups.flat();
  assert.equal(seen.length, publicSmokeStages.length);
  assert.equal(new Set(seen).size, publicSmokeStages.length);
  assert.ok(publicSmokeStages.every(entry => seen.includes(entry)));
  assert.ok(groups.every(group => group.length > 0 && group.length <= Math.ceil(publicSmokeStages.length / STAGE_SMOKE_GROUPS)));
  assert.throws(() => stageSmokeCases(-1), RangeError);
  assert.throws(() => stageSmokeCases(STAGE_SMOKE_GROUPS), RangeError);
});

test('the real CLI executes fixtures and propagates failures, including paths with spaces', () => {
  const directory = mkdtempSync(join(tmpdir(), 'arkpedia runner '));
  try {
    mkdirSync(join(directory, 'tools'));
    mkdirSync(join(directory, 'test'));
    copyFileSync(new URL('../tools/run-tests.mjs', import.meta.url), join(directory, 'tools/run-tests.mjs'));
    const fixture = join(directory, 'test/fixture.test.js');
    const environment = { ...process.env, SHARD_INDEX: '0', SHARD_TOTAL: '1' };
    // Exercise an ordinary CLI invocation, outside this test worker's context.
    delete environment.NODE_TEST_CONTEXT;
    writeFileSync(join(directory, 'package.json'), '{"type":"module"}');
    writeFileSync(fixture, "import test from 'node:test'; import {writeFileSync} from 'node:fs'; test('fixture executed',()=>writeFileSync('executed.txt','yes'));\n");
    const invoke = () => spawnSync(process.execPath, ['tools/run-tests.mjs'], {
      cwd: directory, env: environment, encoding: 'utf8', timeout: 30_000,
    });
    const passing = invoke();
    assert.equal(passing.error, undefined);
    assert.equal(passing.status, 0, passing.stdout + passing.stderr);
    assert.equal(readFileSync(join(directory, 'executed.txt'), 'utf8'), 'yes');
    writeFileSync(fixture, "import test from 'node:test'; import assert from 'node:assert/strict'; test('fixture failure',()=>assert.fail('expected fixture failure'));\n");
    const failing = invoke();
    assert.equal(failing.error, undefined);
    assert.notEqual(failing.status, 0, failing.stdout + failing.stderr);
    assert.match(failing.stdout + failing.stderr, /expected fixture failure/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
