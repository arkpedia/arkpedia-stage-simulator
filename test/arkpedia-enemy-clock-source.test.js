// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import inventory from '../data/arkpedia-cn-enemy-native-source.json' with { type: 'json' };
import source from '../data/arkpedia-enemy-clock-source.json' with { type: 'json' };
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import { prepareCNEnemyPlan } from '../tools/arkpedia/cn-enemy-native-source.mjs';

const manifest = () => ({ versionId: inventory.source.resourceVersion,
  abInfos: inventory.bundles.map(r => ({ name: r.path, abSize: r.bytes, md5: r.md5 })) });
test('enemy source preparation retains the complete frozen membership without runtime approval', () => {
  const result = prepareCNEnemyPlan(manifest());
  assert.deepEqual(result.bundles, inventory.bundles.map(({ sha256, ...rest }) => rest));
  assert.deepEqual(result.summary, { bundles: 37, bytes: 13446842 });
  assert.deepEqual(source.enabledOperators, []); assert.deepEqual(result.enabledOperators, []);
  for (const key of ['runtimeBindingsVerified', 'frameParity']) {
    assert.equal(source[key], false); assert.equal(result[key], false);
  }
  assert.equal(source.compiledDispatchVerified, false);
  assert.equal(data.operators.char_4228_closur, undefined);
  const raw = readFileSync(new URL('../data/arkpedia-cn-enemy-native-source.json', import.meta.url));
  assert.equal(createHash('sha256').update(raw).digest('hex'), source.source.sha256);
});
test('a partial, duplicated, relabeled or unpinned enemy import is rejected before publication', () => {
  const changes = [
    m => { m.versionId = 'global-or-latest'; },
    m => m.abInfos.pop(),
    m => { m.abInfos[1] = { ...m.abInfos[0] }; },
    m => { m.abInfos[0].name = 'battle/enm_pfb_999.ab'; },
    m => { m.abInfos[0].name = 'battle/enm_pfb_../../foreign.ab'; },
    m => { m.abInfos[0].abSize = 0; },
    m => { m.abInfos[0].abSize = Infinity; },
    m => { m.abInfos[0].md5 = 'unverified'; },
  ];
  for (const change of changes) { const m = manifest(); change(m); assert.throws(() => prepareCNEnemyPlan(m)); }
});
test('same-named native abilities preserve opposite flags on their actual prefab components', () => {
  for (const [id, pid, flag] of [
    ['enemy_10001_trslim', '-7147745292939599887', 1],
    ['enemy_10006_trsmgi', '-8842998082277521802', 0],
  ]) {
    const p = source.prefabs[`dyn/battle/prefabs/enemies/${id}.prefab`];
    const c = p.clockComponents.find(r => r.pathId === pid);
    assert.equal(c.objectName, 'StartRun'); assert.equal(c.fields._affectedBySlowDown, flag);
    assert.equal(c.ancestors[0], p.rootPathId); assert.equal(c.fields._cooldownKey, 'duration');
  }
});
test('the timing inventory keeps native pointer precision and both explicit eligibility states', () => {
  const total = { prefabs: 0, hierarchyObjects: 0, components: 0, clockComponents: 0, slowDownYes: 0, slowDownNo: 0 };
  const pointer = value => assert.match(value, /^-?\d+$/);
  function checkPointers(value) {
    if (Array.isArray(value)) value.forEach(checkPointers);
    else if (value && typeof value === 'object') for (const [k, v] of Object.entries(value)) {
      if (k === 'm_PathID') { assert.equal(typeof v, 'string'); pointer(v); }
      else checkPointers(v);
    }
  }
  for (const [name, p] of Object.entries(source.prefabs)) {
    assert.ok(name.startsWith('dyn/battle/prefabs/enemies/')); pointer(p.rootPathId);
    assert.equal(new Set(p.clockComponents.map(r => r.pathId)).size, p.clockComponents.length);
    total.prefabs++; total.hierarchyObjects += p.hierarchyObjects; total.components += p.components;
    total.clockComponents += p.clockComponents.length;
    for (const r of p.clockComponents) {
      pointer(r.pathId); pointer(r.gameObjectPathId); r.ancestors.forEach(pointer); checkPointers(r);
      assert.match(r.originalDataSha256, /^[0-9a-f]{64}$/);
      if (r.fields._affectedBySlowDown !== undefined) {
        assert.ok([0, 1].includes(r.fields._affectedBySlowDown));
        total[r.fields._affectedBySlowDown ? 'slowDownYes' : 'slowDownNo']++;
      }
    }
  }
  assert.deepEqual(source.summary, { bundles: 37, ...total });
  assert.equal(total.prefabs, 2155); assert.equal(total.clockComponents, 17676);
  assert.equal(total.slowDownYes, 4110); assert.equal(total.slowDownNo, 823);
});
