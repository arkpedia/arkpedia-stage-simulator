// SPDX-License-Identifier: GPL-3.0-or-later
// Light of Glory (shared/arkpedia/stage-light-of-glory.js, server/sim/content/arkpedia-stage-light-of-glory.js) and 14-12's
// 600-HP Caustic Originium Slug alias (shared/arkpedia/enemy-aliases.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import mvp from '../data/arkpedia-mvp.json' with { type: 'json' };
import deviceNative from '../data/arkpedia-device-native-source.json' with { type: 'json' };
import deviceTables from '../data/arkpedia-device-source.json' with { type: 'json' };
import { lightOfGloryNativeReviewed, lightOfGloryDefinition } from '../shared/arkpedia/stage-light-of-glory.js';
import { createStageLibraryLoader } from '../shared/arkpedia/stage-library.js';
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { corruptionZone } from '../server/sim/content/arkpedia-corruption.js';

const manifest = JSON.parse(await readFile(new URL('../data/arkpedia-library.json', import.meta.url)));
const loader = createStageLibraryLoader(async url => new Response(await readFile(new URL(`..${url}`, import.meta.url))));
const load = id => { const entry = manifest.stages.find(s => s.id === id); assert.equal(entry?.availability, 'available', id); return loader.load(entry); };
const clone = v => JSON.parse(JSON.stringify(v));
const until = (b, pred, limit) => { while (!b.finished && b.time < limit && !pred()) b.step(); return pred(); };
const battle = stage => new StandardBattle({ ...mvp, stage, enemies: { ...mvp.enemies, ...stage.enemies } },
  { operators: [defaultBuild(mvp.operators.char_151_myrtle)] }, { seed: 1 });
/** The real stage, with every wave enemy removed as it appears (the wave clock and its actions stay as compiled). */
const quiet = async (id = '14-12') => {
  const b = battle(await load(id));
  b.life = 999;
  b.on('enemySpawn', ({ enemy }) => { if (!enemy.mem.test) b.after(0, () => enemy.alive && !enemy.mem.test && b._remove(enemy, 'withdraw', null, true)); });
  b.step();
  return b;
};
/** The reviewed growth, tick by tick: radius after `n` ticks of 0.03 s. */
const radiusAfter = n => { const d = lightOfGloryDefinition({ level: 1, skillLevel: 1, direction: 'UP' });
  let step = d.step, extend = 0; for (let i = 0; i < n; i++) { step = Math.min(step + d.stepGain, d.maxStep); extend = Math.min(extend + step, d.maxRadius); }
  return Math.min(d.start + extend, d.maxRadius); };

test('Light of Glory is reviewed; changes are refused', () => {
  assert.equal(lightOfGloryNativeReviewed(), true);
  const t = clone(deviceTables);
  t.devices.trap_164_lrsiege.talents[1].candidates[0].blackboard.find(x => x.key === 'atk').value = 2;
  assert.equal(lightOfGloryNativeReviewed(deviceNative, t), false, 'a weaker ATK buff');
  const t2 = clone(deviceTables);
  t2.devices.trap_164_lrsiege.talents[1].candidates[0].blackboard.find(x => x.key === 'max_radius_increase_per_tick').value = .05;
  assert.equal(lightOfGloryNativeReviewed(deviceNative, t2), false, 'a faster spread');
  const n = clone(deviceNative);
  n.prefabs.trap_164_lrsiege.components.find(c => c.data._targetOptions?.professionMask === 767).data._targetOptions.professionMask = 1023;
  assert.equal(lightOfGloryNativeReviewed(n), false, 'devices buffed too');
  // About 0.67 tiles/s once the step is at its cap; radius 20 about 31 s after activation.
  assert.ok(Math.abs(radiusAfter(Math.round(10 / .03)) - radiusAfter(Math.round(5 / .03)) - 10 / 3) < .05);
  assert.equal(radiusAfter(1100), 20);
});

test('14-12: the slug alias is the Caustic Originium Slug at 600 HP with its own blast (talents kept)', async () => {
  const stage = await load('14-12');
  const slug = stage.enemies.enemy_1424_lrboom_3;
  assert.equal(slug.stats.maxHp, 600);
  assert.equal(slug.talents.bb['Boom.atk_scale'], 3.5);
  assert.deepEqual(slug.abilities.map(a => a.text), stage.enemies.enemy_1424_lrboom.abilities.map(a => a.text));
  const adverse = await load('14-12_adverse_environment');
  assert.equal(adverse.enemies.enemy_1424_lrboom.talents.bb['Boom.atk_scale'], 5, 'the adverse stage override');
  assert.equal(adverse.enemies.enemy_1424_lrboom_3.talents.bb['Boom.atk_scale'], 3.5);
});

test('14-12: switched on by its wave action (second wave +16 s); the circle grows, buffs operators, slows enemies, clears pollution', async () => {
  const b = await quiet(), L = b.stageLightOfGlory, a = [...L.entries.values()][0];
  assert.equal(a.active, false);
  assert.ok(until(b, () => a.active, 120));
  const t0 = a.activatedAt;
  const ops = b.allies().filter(u => u.kind === 'op');
  assert.ok(ops.length >= 2, 'the two story operators');
  const base = new Map(ops.map(u => [u, { atk: u.s.atk, def: u.s.def, res: u.s.res }]));
  const near = ops.reduce((x, y) => (x.x - a.col) ** 2 + (x.y - a.row) ** 2 <= (y.x - a.col) ** 2 + (y.y - a.row) ** 2 ? x : y);
  const reach = Math.hypot(near.x - a.col, near.y - a.row);
  const slug = b.spawnEnemy('enemy_1424_lrboom', { pos: [a.row, a.col + 1] }); slug.mem.test = true;
  b.addBuff(slug, { key: 'test:hold', persist: true, flags: { noMove: true } });
  corruptionZone(b, slug, a.col + 1, a.row, 1.5, 60, 50, 25);
  until(b, () => b.time >= t0 + 2.05, t0 + 3);
  assert.ok(Math.abs(a.radius - radiusAfter(Math.floor(2.05 / .03 + 1e-6))) < .03, `${a.radius}`);
  assert.ok(Math.abs(slug.s.moveSpeed - (slug.base.moveSpeed - .1)) < 1e-9, 'enemies inside are slowed');
  assert.equal([...(b._corruptionZones ?? [])].some(z => z.src === slug), false, 'the pollution zone inside is cleared');
  assert.ok(until(b, () => !!near.findBuff(`stage:lightOfGlory:${a.d.alias}`), t0 + 40));
  const was = base.get(near);
  assert.ok(Math.abs(near.s.atk - was.atk * 4) < 1, `${near.s.atk} vs ${was.atk}`);
  assert.ok(Math.abs(near.s.def - was.def * 5) < 1);
  assert.ok(Math.abs(near.s.res - Math.min(100, was.res * 1.3)) < 1e-6);
  assert.ok(a.radius + 1e-9 >= reach);
});

for (const id of ['14-12', '14-12_adverse_environment']) {
  test(`headless ${id} clears`, async () => {
    const b = battle(await load(id));
    b.life = 999;
    let last = 0;
    while (!b.finished && b.time < 600) {
      b.step();
      if (b.time - last >= 3) { last = b.time;
        for (const e of b.enemies) if (e.alive && !e.mem.stageDeviceId) b.dealDamage(null, e, { amount: 1e7, type: 'true', sourceless: true }); }
    }
    assert.equal(b.reason, 'cleared');
    assert.equal([...b.stageLightOfGlory.entries.values()][0].active, true);
  });
}
