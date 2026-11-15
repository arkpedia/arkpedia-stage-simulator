// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { normalizeEnemy } from '../server/sim/simdata.js';
import mvp from '../data/arkpedia-mvp.json' with { type: 'json' };
import { ENEMY_RECORDS as records, enemyRecord, spawnAny } from './helpers/enemyHarness.js';

const keys = Object.keys(records.enemies);
test('the catalogue preserves every Global enemy and adds absent CN IDs at every database level', () => {
  assert.equal(records.summary.enemies, 2163);assert.equal(keys.length, 2163);
  assert.deepEqual(records.summary.sourceCounts, { global: 1552, cn: 611 });
  const cn = keys.filter(key => records.enemies[key].sourceChannel === 'cn').sort();
  assert.equal(cn.length, 611); assert.deepEqual(cn, records.source.supplements[0].addedIds);
  assert.equal(records.summary.records, keys.reduce((n, k) => n + Object.keys(records.enemies[k].levels).length, 0));
  assert.match(records.source.commit, /^[0-9a-f]{40}$/);
  for (const f of Object.values(records.source.files)) assert.match(f.sha256, /^[0-9a-f]{64}$/);
  assert.equal(records.levelRule, 'level 0 merged with the selected level');
  assert.equal(records.levelRuleDivergences.filter(row => !cn.includes(row.key)).length, 4, 'Global level-rule divergences are unchanged');
  assert.equal(records.levelRuleDivergences.length, 5, 'one additional CN level-rule divergence is retained');
});
test('every record normalizes into a finite engine definition', () => {
  for (const key of keys) for (const [level, r] of Object.entries(records.enemies[key].levels)) {
    assert.equal(r.key, key);assert.equal(r.level, Number(level));
    const d = normalizeEnemy(key, r);
    for (const s of ['maxHp', 'atk', 'def', 'res', 'aspd', 'bat', 'moveSpeed', 'rangeRadius', 'massLevel'])
      assert.ok(Number.isFinite(d.stats?.[s] ?? d[s]), `${key}@${level}.${s}`);
    assert.ok(['WALK', 'FLY'].includes(d.motion));assert.ok(['phys', 'arts', 'heal', 'none', 'true', 'element'].includes(d.dmgType), `${key} dmgType ${d.dmgType}`);
    if (r.applyWay === 'MELEE') assert.equal(r.stats.rangeRadius, 0, `${key}: melee enemies hit only their blocker`);
  }
});
test('the built 0-1 enemies are the catalogue records with the level file overrides', () => {
  for (const [key, built] of Object.entries(mvp.enemies)) {
    const r = enemyRecord(key, built.level);
    assert.deepEqual({ ...built, stats: { ...built.stats, def: r.stats.def } }, r, key);
  }
  assert.equal(mvp.enemies.enemy_1002_nsabr.stats.def, 30, 'Soldier keeps the level file DEF override');
});
test('every enemy spawns, walks and fights on the flat harness stage without engine errors', () => {
  for (const key of keys) {
    const h = spawnAny(key, { seconds: 12 });
    assert.deepEqual(h.b.errors ?? [], [], key);
    assert.ok(h.b.units.some(u => u.side === 'enemy' && u.defId === key), `${key} spawned`);
  }
});
test('the catalogue matches the pinned source tables when they are present', { skip: !existsSync(new URL('../.cache/arkpedia/enemy_handbook_table.json', import.meta.url)) }, async () => {
  const { buildEnemyRecords } = await import('../tools/arkpedia/enemy-records.mjs');
  assert.equal(JSON.stringify(await buildEnemyRecords()), JSON.stringify(records));
});
