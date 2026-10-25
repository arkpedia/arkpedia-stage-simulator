// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { CANONICAL_STAGE_LOCKS } from '../tools/arkpedia/canonical-stage.mjs';
import { resolveStage } from '../shared/arkpedia/stages.js';
const read = path => JSON.parse(readFileSync(new URL('../data/' + path, import.meta.url)));
const index = read('arkpedia-stages.json');
const codes = ['16-5', '16-6', '16-7', '17-2', '17-3', '17-4'];
for (const code of codes) test(`${code} retains canonical source evidence with a separate test-only admission gate`, () => {
  assert.ok(CANONICAL_STAGE_LOCKS[code]);
  const lock = read(`arkpedia-canonical-stage-${code}.lock.json`), source = read(`candidates/arkpedia-stage-${code}-source.json`);
  assert.deepEqual(source.inputs, lock.files);
  assert.equal(lock.repository, 'arkpedia/arkpedia-data');
  assert.equal(lock.commit, '657f85cc032ae5da807135f536d3263c6b249ed7');
  assert.equal(source.canonicalData.commit, lock.commit);
  assert.equal(source.admitted, false); assert.equal(source.testOnly, true);
  assert.equal(source.routeReceipt.producer.commit, 'e5a96b56e312c3e73a54865da57bc33172119a0b');
  assert.deepEqual(source.levelReceipt.source, lock.upstream);
  assert.equal(source.routeReceipt.upstream.commit, lock.upstream.commit);
  assert.equal(source.routeReceipt.upstream.sha256, lock.files.rawLevel.sha256);
  assert.equal(source.levelReceipt.files[`raw/levels/${code}.json`].sha256, lock.files.rawLevel.sha256);
  for (const key of ['geometry', 'conditional']) assert.equal(source.routeReceipt.outputs[lock.files[key].path], lock.files[key].sha256);
  assert.equal(source.rawLevel.options.moveMultiplier, .5);
  if (['17-2', '17-3'].includes(code)) {
    assert.throws(() => resolveStage(index, code), /test-only/);
    assert.equal(resolveStage(index, code, { experimental: true }).testOnly, true);
  } else assert.throws(() => resolveStage(index, code, { experimental: true }), /Unknown stage/);
});

test('retaining the next canonical levels cannot bypass the builder stage-review gate', () => {
  const source = read('candidates/arkpedia-stage-17-4-source.json'), dir = mkdtempSync(join(tmpdir(), 'next-stage-gate-'));
  const stage = join(dir, 'stage.json'), geometry = join(dir, 'geometry.json'), out = join(dir, 'out.json');
  writeFileSync(stage, JSON.stringify(source.stage)); writeFileSync(geometry, JSON.stringify(source.geometry));
  assert.throws(() => execFileSync(process.execPath, ['tools/arkpedia/build-stage.mjs', '--candidate', 'ch16', '--stage', stage,
    '--geometry', geometry, '--out', out], { stdio: 'pipe' }), error => /reviewed only for test-only/.test(String(error.stderr)));
  assert.equal(existsSync(out), false);
});
