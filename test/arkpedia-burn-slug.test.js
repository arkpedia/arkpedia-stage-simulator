// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeBattle, chessRec } from './helpers/battleHarness.js';
import records from '../data/arkpedia-enemy-records.json' with { type: 'json' };
import native from '../data/arkpedia-enemy-native-abilities.json' with { type: 'json' };
import clocks from '../data/arkpedia-enemy-clock-source.json' with { type: 'json' };
import { enemySupport, nativeComponents } from '../shared/arkpedia/enemy-support.js';
import { burnSlugNative } from '../shared/arkpedia/enemy-burn-slug-features.js';
import { installEnemyFeatures } from '../server/sim/content/arkpedia-enemy-features.js';

const ids = ['enemy_1305_mhslim', 'enemy_1305_mhslim_2'];
const rec = id => records.enemies[id].levels[0];
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`);

test('both slugs are admitted only with the Burn shot and the pinned tree; other EpDamage users keep their entry', () => {
  for (const id of ids) {
    assert.equal(enemySupport(records.enemies[id], clocks.prefabs, native).policy, 'stats-attacks-and-features', id);
    assert.equal(burnSlugNative(rec(id), nativeComponents(native, id)), true, id);
  }
  assert.equal(enemySupport(records.enemies.enemy_1183_mlasrt, clocks.prefabs, native).policy, 'stats-attacks-and-features');
  const r = rec(ids[0]);
  assert.equal(burnSlugNative({ ...r, talents: { ...r.talents, bb: { 'EpDamage.attack@ep_damage_ratio': .5 } } }, nativeComponents(native, ids[0])), false);
  const changed = structuredClone(native);
  for (const row of changed.prefabs['dyn/battle/prefabs/enemies/' + ids[0] + '.prefab']) {
    const d = JSON.parse(row.originalJson); if (d._elementDamageType === 3) { d._elementDamageType = 2; row.originalJson = JSON.stringify(d); }
  }
  assert.equal(enemySupport(records.enemies[ids[0]], clocks.prefabs, changed).policy, null, 'Burn, not Corrosion');
});

test('each shot deals ATK Arts and ATK x 1.0 Burn to its target', () => {
  for (const id of ids) {
    const op = chessRec({ id: 'slug-target', stats: { maxHp: 1e6, atk: 0, def: 0, res: 0, blockCnt: 0 }, skill: null });
    const h = makeBattle({ content: 'none', autoFinish: false, timeLimit: 60,
      defs: { chess: { [op.chessId]: op }, enemies: { [id]: structuredClone(rec(id)) } },
      units: [{ chessId: op.chessId, row: 9, col: 5 }], setup: installEnemyFeatures });
    const b = h.b; b.start();
    const [u] = b.allyUnits; b.addBuff(u, { key: 'hold', flags: { disarm: true } });
    const e = b.spawnEnemy(id, { pos: [9, 6] }); b.addBuff(e, { key: 'hold', flags: { noMove: true } });
    const hits = []; b.on('damaged', c => { if (c.source === e && c.target === u) hits.push({ type: c.type, amount: c.amount, element: c.dmg?.element }); });
    h.run(1.5);
    const arts = hits.filter(x => x.type === 'arts'), burn = hits.filter(x => x.type === 'element');
    assert.equal(arts.length, 1); near(arts[0].amount, e.s.atk);
    assert.equal(burn.length, 1); assert.equal(burn[0].element, 'burn'); near(burn[0].amount, e.s.atk);
    assert.deepEqual(b.errors, []);
  }
});

test('compiled VEC-A: the Blazing Slug at its stage stats burns the deployed operator', async () => {
  const { readFile } = await import('node:fs/promises');
  const { StandardBattle } = await import('../server/sim/arkpedia.js');
  const { createStageLibraryLoader } = await import('../shared/arkpedia/stage-library.js');
  const { defaultBuild } = await import('../shared/arkpedia/loadout.js');
  const mvp = JSON.parse(await readFile(new URL('../data/arkpedia-mvp.json', import.meta.url)));
  const manifest = JSON.parse(await readFile(new URL('../data/arkpedia-library.json', import.meta.url)));
  const loader = createStageLibraryLoader(async url => new Response(await readFile(new URL(`..${url}`, import.meta.url))));
  const stage = await loader.load(manifest.stages.find(s => s.id === 'vec-a_act1break_h01'));
  const b = new StandardBattle({ ...mvp, stage, enemies: { ...mvp.enemies, ...stage.enemies } },
    { operators: [{ ...defaultBuild(mvp.operators.char_151_myrtle) }] }, { seed: 1 });
  let slug = null;
  const clear = () => { for (const e of b.enemies) if (e.alive && e.defId !== ids[0]) b.kill(e); };
  while (!b.finished && b.time < 900 && !slug) { clear(); slug = b.enemies.find(e => e.alive && e.defId === ids[0]); b.step(); }
  assert.ok(slug); assert.equal(slug.s.maxHp, 7000); assert.equal(slug.s.atk, 50);
  b.addBuff(slug, { key: 'hold', persist: true, flags: { noMove: true } });
  b.setViewport('fullscreen-workspace'); b.getPlayer('arkpedia').dp = 99;
  let myrtle = null;
  for (let r = 0; r < stage.geometry.tileGrid.length && !myrtle; r++) for (let c = 0; c < stage.geometry.tileGrid[0].length && !myrtle; c++) {
    try { myrtle = b.deployOperator('char_151_myrtle', r, c, 'RIGHT'); } catch {} }
  assert.ok(myrtle); myrtle.base.maxHp = 1e9; myrtle.markDirty(); myrtle.hp = myrtle.s.maxHp;
  slug.x = myrtle.x - 1; slug.y = myrtle.y;
  const hits = []; b.on('damaged', c => { if (c.source === slug && c.target === myrtle) hits.push(c.dmg?.element ?? c.type); });
  const until = b.time + 3; while (!b.finished && b.time < until) { clear(); b.step(); }
  assert.ok(hits.includes('arts') && hits.includes('burn'), hits.join());
  assert.deepEqual(b.errors, []);
});
