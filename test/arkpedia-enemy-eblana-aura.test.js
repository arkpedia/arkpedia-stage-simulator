// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeBattle } from './helpers/battleHarness.js';
import { ENEMY_RECORDS } from './helpers/enemyHarness.js';
import { installEnemyFeatures } from '../server/sim/content/arkpedia-enemy-features.js';
import { StageWaveScheduler } from '../server/sim/content/arkpedia-stage-waves.js';
import { eblanaAuraNative } from '../shared/arkpedia/enemy-eblana-features.js';
import { enemySupport, nativeComponents } from '../shared/arkpedia/enemy-support.js';
import native from '../data/arkpedia-enemy-native-abilities.json' with { type: 'json' };
import clocks from '../data/arkpedia-enemy-clock-source.json' with { type: 'json' };

const bossId = 'enemy_1536_ncrmcr', victimId = 'enemy_1007_slime';
function fixture(level = 0) {
  // Isolate the Aura talent from the still-unimplemented phase/skill programs.
  const record = structuredClone(ENEMY_RECORDS.enemies[bossId].levels[level]);
  record.talents = { bb: {}, bbStr: { 'Aura.enemy_key': record.talents.bbStr['Aura.enemy_key'] }, groups: { Aura: ['enemy_key'] } };
  record.skills = []; record.abilities = [];
  const ids = [victimId, 'enemy_1288_duskls', 'enemy_1288_duskls_2', 'enemy_1292_duskld', 'enemy_1294_duchns'];
  const h = makeBattle({ content: 'none', autoFinish: false, units: [],
    defs: { enemies: { ...Object.fromEntries(ids.map(id => [id, ENEMY_RECORDS.enemies[id].levels[0]])), [bossId]: record } },
    setup: installEnemyFeatures });
  const b = h.b; b.start();
  b.stageWaveScheduler = new StageWaveScheduler(b, { schemaVersion: 1, waves: [0, 1].map(() => ({ fragments: [] })) });
  const spawned = [];
  b.on('enemySpawn', ({ enemy }) => { spawned.push(enemy); b.addBuff(enemy, { key: 'test:hold', persist: true, flags: { noMove: true, disarm: true } }); });
  const spawn = (id = victimId, options = {}) => b.spawnEnemy(id, { pos: [9, 6], route: { motion: 'WALK', start: [9, 6], end: [9, 0], steps: [{ t: 'wait', s: 4 }] }, ...options });
  const boss = spawn(bossId); return { ...h, boss, spawn, spawned };
}
for (const level of [0, 1]) test(`Eblana aura level ${level}: delayed ember keeps the victim route and wave, with its own stats`, () => {
  const { b, boss, spawn, run, spawned } = fixture(level), victim = spawn(victimId, { mods: { hpMul: 9, atkMul: 7 } });
  b.stageWaveScheduler.track(victim, { wave: 0 });
  assert.equal(victim.findBuff('enemy_ncrmcr_aura')?.source, boss);
  b.kill(victim); const planned = b.total; run(.4);
  assert.equal(spawned.length, 2); run(.2); const child = spawned.at(-1);
  assert.equal(child.defId, level ? 'enemy_1288_duskls_2' : 'enemy_1288_duskls');
  assert.equal(child.form, 'husk'); assert.equal(child.hp, 5); assert.equal(child.counted, false);
  assert.equal(child.s.atk, ENEMY_RECORDS.enemies[child.defId].levels[0].stats.atk);
  assert.equal(!!child.s.flags.invulnerable, false); assert.equal(b.total, planned);
  assert.equal(child.findBuff('enemy_ncrmcr_aura'), null, 'embers are excluded from conversion');
  assert.deepEqual(b.stageWaveScheduler.membership(child), { wave: 0, dontBlockWave: false });
  assert.equal(child.route.legs[0].t, 'wait'); assert.equal(child.route.legs.at(-1).c, 0);
  run(10.1); assert.equal(child.form, 'revived');
  assert.equal(child.s.maxHp, ENEMY_RECORDS.enemies[child.defId].levels[0].stats.maxHp);
  assert.deepEqual(b.errors, []);
});
test('conversion excludes machines, existing Flamechasers, Exhausted Flame, falls and leaks', () => {
  const { b, spawn, run, spawned } = fixture();
  for (const id of ['enemy_1288_duskls', 'enemy_1288_duskls_2', 'enemy_1292_duskld', 'enemy_1294_duchns']) {
    const unit = spawn(id); assert.equal(unit.findBuff('enemy_ncrmcr_aura'), null, id);
  }
  const machine = spawn(); machine.tags.add('machine'); run(.1);
  assert.equal(machine.findBuff('enemy_ncrmcr_aura'), null); b.kill(machine);
  const fallen = spawn(); fallen.mem.deathByFall = true; b.kill(fallen);
  const leaked = spawn(); b.leak(leaked); const count = spawned.length; run(.7);
  assert.equal(spawned.length, count); assert.deepEqual(b.errors, []);
});
test('boss removal detaches conversion but a previously triggered summon still completes', () => {
  const { b, boss, spawn, run, spawned } = fixture(), first = spawn(), second = spawn();
  b.kill(first); b.kill(boss); assert.equal(second.findBuff('enemy_ncrmcr_aura'), null);
  b.kill(second); const count = spawned.length; run(.6);
  assert.equal(spawned.length, count + 1); assert.equal(spawned.at(-1).form, 'husk'); assert.deepEqual(b.errors, []);
});
test('overlapping aura sources cannot duplicate a converted body or remove each other’s current binding', () => {
  const { b, boss, spawn, run, spawned } = fixture(), second = spawn(bossId), victim = spawn();
  assert.equal(victim.findBuff('enemy_ncrmcr_aura').source, boss);
  b.kill(victim); const before = spawned.length; run(.6);
  assert.equal(spawned.length, before + 1);
  const next = spawn(); b.kill(boss); run(.1);
  assert.equal(next.findBuff('enemy_ncrmcr_aura').source, second); assert.deepEqual(b.errors, []);
});
test('Aura source contract covers both levels; the boss is admitted with The Leader contract', () => {
  for (const r of Object.values(ENEMY_RECORDS.enemies[bossId].levels)) assert.equal(eblanaAuraNative(r, nativeComponents(native, bossId)), true);
  // Since 2026-11-18 the remaining phases and skills have their own contract (enemy-the-leader-features.js).
  assert.equal(enemySupport(ENEMY_RECORDS.enemies[bossId], clocks.prefabs, native).policy, 'stats-attacks-and-features');
  for (const change of ['delay', 'fall', 'mode', 'tags']) {
    const ev = structuredClone(native);
    if (change === 'delay') ev.templates.enemy_ncrmcr_aura.eventToActions.ON_OWNER_KILLED[3]._delayTime = 0;
    if (change === 'fall') ev.templates.enemy_ncrmcr_aura.eventToActions.ON_OWNER_KILLED[0]._finishReason = 'KILLED';
    if (change === 'mode') ev.templates.switch_mode_no_restore.eventToActions.ON_BUFF_START[0]._restoreDefault = true;
    if (change === 'tags') for (const row of ev.prefabs[`dyn/battle/prefabs/enemies/${bossId}.prefab`]) {
      const d = JSON.parse(row.originalJson); if (d._tags?.includes('machine')) d._tags = []; row.originalJson = JSON.stringify(d);
    }
    assert.equal(eblanaAuraNative(ENEMY_RECORDS.enemies[bossId].levels[0], nativeComponents(ev, bossId)), false, change);
  }
});
