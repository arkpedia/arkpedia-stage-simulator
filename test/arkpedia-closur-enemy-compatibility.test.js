// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import proof from '../data/arkpedia-closur-enemy-compatibility.json' with { type: 'json' };
import native from '../data/arkpedia-enemy-clock-source.json' with { type: 'json' };
import { assertClosurEnemyCompatibility } from '../shared/arkpedia/closur-enemy-compatibility.js';

test('the currently admitted regular enemies have no declared enemy-ability clocks in the original prefab index', () => {
  const raw = readFileSync(new URL('../data/arkpedia-enemy-clock-source.json', import.meta.url));
  assert.equal(createHash('sha256').update(raw).digest('hex'), proof.source.nativeTimingIndex.sha256);
  assert.equal(proof.source.globalEnemyTable.commit, '57010cb5b2afea112cae57daa756b58676ba6850');
  assert.equal(proof.source.globalEnemyTable.gitBlob, 'ff07c033f8808d01d60624864cfea972402f75c5');
  assert.deepEqual(Object.keys(proof.enemies).sort(), ['enemy_1002_nsabr', 'enemy_1007_slime']);
  for (const [id, row] of Object.entries(proof.enemies)) {
    const p = native.prefabs[row.prefab];
    assert.equal(p.rootName, id); assert.equal(p.rootPathId, row.rootPathId);
    assert.equal(p.hierarchySha256, row.hierarchySha256);
    assert.ok(p.clockComponents.every(c => !('_familyMask' in c.fields && '_trigger' in c.fields)));
    for (const c of p.clockComponents) for (const k of ['_commonAbilities', '_generalAbilities'])
      assert.ok((c.fields[k] ?? []).every(ref => ref.m_FileID === 0 && ref.m_PathID === '0'));
  }
  assert.deepEqual(proof.enabledOperators, []); assert.equal(proof.frameParity, false);
});
test('the real regular-stage snapshot passes without changing its enemies, operator coverage or source records', () => {
  const before = JSON.stringify(data); assertClosurEnemyCompatibility(data);
  assert.equal(JSON.stringify(data), before);
});
test('a practice field with no enemies needs no invented clock compatibility', () => {
  assert.doesNotThrow(() => assertClosurEnemyCompatibility({ enemies: {} }));
});
for (const id of Object.keys(proof.enemies)) test(`${id}: injected skills or abilities cannot reuse the stat-only proof`, () => {
  for (const field of ['skills', 'abilities']) for (const value of [[{ prefabKey: 'NewSkill', cooldown: 5 }], { NewSkill: true }]) {
    const changed = structuredClone(data); changed.enemies[id][field] = value;
    assert.throws(() => assertClosurEnemyCompatibility(changed), /needs native clock review for enemy abilities/);
  }
});
test('a newly admitted enemy requires its own compatibility review even when its skill list is empty', () => {
  const changed = structuredClone(data); changed.enemies.enemy_future = { stats: {}, skills: [] };
  assert.throws(() => assertClosurEnemyCompatibility(changed), /needs native clock review for regular enemy: enemy_future/);
});
test('malformed enemy records cannot bypass the compatibility boundary', () => {
  for (const value of [null, [], 4, 'enemy']) {
    assert.throws(() => assertClosurEnemyCompatibility({ enemies: { enemy_1007_slime: value } }));
    assert.throws(() => assertClosurEnemyCompatibility({ enemies: value }));
  }
});
