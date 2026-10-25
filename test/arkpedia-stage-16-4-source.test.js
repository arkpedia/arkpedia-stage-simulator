// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { verifiedNative } from '../tools/arkpedia/enemy-support.mjs';
import { resolveStage } from '../shared/arkpedia/stages.js';
import { chapter16BranchSpawner } from '../server/sim/content/chapter16-branch.js';
const read = path => JSON.parse(readFileSync(new URL('../' + path, import.meta.url)));
const source = read('data/candidates/arkpedia-stage-16-4-source.json');
const lock = read('data/arkpedia-ch16-stage-16-4.lock.json');

test('16-4 retains the complete checksum-verified canonical inputs and independent receipts', () => {
  assert.equal(source.admitted, false); assert.equal(source.testOnly, true);
  assert.equal(source.canonicalData.repository, 'arkpedia/arkpedia-data');
  assert.equal(source.canonicalData.commit, '57ab0fc5df7ae27b04a0c84515301f1feb6cf7f2');
  assert.deepEqual(source.inputs, lock.files);
  assert.equal(source.routeReceipt.producer.commit, lock.producer.commit);
  assert.equal(source.routeReceipt.upstream.commit, lock.upstream.commit);
  assert.equal(source.levelReceipt.source.commit, lock.upstream.commit);
  assert.equal(source.levelReceipt.files['raw/levels/16-4.json'].sha256, lock.files.rawLevel.sha256);
  assert.equal(source.routeReceipt.upstream.sha256, lock.files.rawLevel.sha256);
  assert.equal(source.rawLevel.options.moveMultiplier, .5);
  assert.equal(source.geometry.waves.flatMap(w => w.spawns).reduce((n, s) => n + s.count, 0), 17);
  assert.equal(source.rawLevel.extraRoutes[0].visitEveryCheckPoint, false);
});

test('the next enemy evidence matches the original native timing index without granting support', () => {
  const bytes = readFileSync(new URL('../data/arkpedia-enemy-clock-source.json', import.meta.url));
  const index = JSON.parse(bytes);
  const native = read('data/candidates/arkpedia-ch16-crossbow-native.json');
  const pin = read('data/arkpedia-mvp.json').behaviors.source;
  assert.equal(Object.keys(native.prefabs).length, 2);
  assert.doesNotThrow(() => verifiedNative(native, index.prefabs, createHash('sha256').update(bytes).digest('hex'), pin));
  const changed = structuredClone(native);
  Object.values(changed.prefabs)[0][0].originalJson += ' ';
  assert.throws(() => verifiedNative(changed, index.prefabs, createHash('sha256').update(bytes).digest('hex'), pin), /does not match/);
  assert.equal(read('data/candidates/arkpedia-ch16-enemy-support.json').enemies.enemy_10121_uasnip.policy, null);
});

test('16-4 stays outside the catalogue while its explicit early-exit traversal can be decoded', () => {
  assert.throws(() => resolveStage(read('data/arkpedia-stages.json'), '16-4', { experimental: true }));
  assert.equal(typeof chapter16BranchSpawner({}, source), 'function');
  assert.throws(() => execFileSync(process.execPath, ['tools/arkpedia/canonical-stage.mjs', '--stage', '../unreviewed'],
    { cwd: new URL('../', import.meta.url), stdio: 'pipe' }), error => /only pinned source intakes/.test(String(error.stderr)));
});
