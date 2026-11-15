// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeBattle, enemyRec } from './helpers/battleHarness.js';
import { ManualStageDevices } from '../server/sim/content/arkpedia-stage-manual-devices.js';
import { manualDeviceDefinition, manualDeviceNativeReviewed } from '../shared/arkpedia/stage-manual-devices.js';
import { installEnemyFeatures } from '../server/sim/content/arkpedia-enemy-features.js';
import { ENEMY_RECORDS } from './helpers/enemyHarness.js';
import native from '../data/arkpedia-device-native-source.json' with { type: 'json' };
const key = 'trap_025_prison', sniper = 'enemy_1117_liiprr', ordinary = 'enemy_1116_liprr';
function fixture(direction = 'RIGHT', row = 9) {
  const real = Object.fromEntries([sniper, ordinary].map(id => { const r = structuredClone(ENEMY_RECORDS.enemies[id].levels[0]);
    r.stats.atk = 0; r.stats.moveSpeed = 0; return [id, r]; }));
  const h = makeBattle({ content: 'none', autoFinish: false, timeLimit: 600,
    players: [{ playerId: 'arkpedia', side: 'L', units: [] }],
    defs: { enemies: { ...real, target: enemyRec({ key: 'target', atk: 0, speed: 0, hp: 10000 }) } }, setup: installEnemyFeatures });
  h.b.start(); h.b.getPlayer('arkpedia').dp = 99;
  const controller = new ManualStageDevices(h.b, [{ key, row, col: 6, name: 'Imprisonment Device',
    kind: 'device', hidden: false, instance: { level: 1, skillLevel: 1, direction } }]);
  const d = [...controller.entries.values()][0];
  return { ...h, controller, d, spawn: (id = 'target', pos = [9, 7]) => h.b.spawnEnemy(id, { pos }) };
}
test('manual activation requires SP, DP and an eligible recipient without consuming failed attempts', () => {
  const f = fixture(); assert.throws(() => f.controller.activate(f.d.id), /charging/); f.run(25);
  assert.equal(f.d.sp, 25); assert.throws(() => f.controller.activate(f.d.id), /eligible/); assert.equal(f.d.sp, 25);
  const e = f.spawn(); f.b.getPlayer('arkpedia').dp = 4;
  assert.throws(() => f.controller.activate(f.d.id), /DP/); assert.equal(f.d.sp, 25);
  f.b.getPlayer('arkpedia').dp = 20; f.controller.activate(f.d.id);
  assert.equal(f.b.getPlayer('arkpedia').dp, 15); assert.equal(f.d.sp, 0); assert.equal(e.hp, e.s.maxHp);
  assert.equal(e.s.flags.stun, true); assert.throws(() => f.controller.activate(f.d.id), /already active/);
  f.run(4); assert.equal(f.d.sp, 0); f.run(.3); assert.ok(f.d.sp > 0 && f.d.sp < .3);
  f.run(25); assert.equal(f.d.state, 'ready'); assert.equal(f.d.unit.alive, true); assert.deepEqual(f.b.errors, []);
});
test('the original facing rotates the asymmetric field for ground and flying recipients', () => {
  for (const [direction, inside, outside] of [['RIGHT', [10, 7], [10, 5]], ['LEFT', [10, 5], [10, 7]],
    ['UP', [11, 6], [9, 6]], ['DOWN', [9, 6], [11, 6]]]) {
    const f = fixture(direction, 10), a = f.spawn('target', inside), b = f.spawn('target', outside);
    a.motion = 'FLY'; f.d.sp = 25; f.controller.activate(f.d.id);
    assert.equal(a.s.flags.stun, true, direction); assert.equal(!!b.s.flags.stun, false, direction);
    assert.equal(f.d.unit.dir, direction); assert.deepEqual(f.b.errors, []);
  }
});
test('the same pulse reconfines both shared and native prisoners without resetting an existing confinement count', () => {
  const f = fixture();
  for (const id of [sniper, ordinary]) {
    const e = f.spawn(id), a = e.mem.ab.list.find(a => a.liberate); a.n = 2;
    f.d.sp = 25; f.d.state = 'ready'; f.controller.activate(f.d.id); assert.equal(a.n, 2); assert.equal(a.free, false);
    a.liberate(f.b, e, a); assert.equal(a.free, true);
    f.d.sp = 25; f.d.state = 'ready'; f.controller.activate(f.d.id);
    assert.equal(a.free, false); assert.equal(a.n, 0); assert.ok(e.findBuff('ab:confined')); assert.equal(e.findBuff('ab:liberty'), null);
    f.b.kill(e);
  }
  assert.equal(f.b.stageOutcomes.counters.prison, 2); assert.deepEqual(f.b.errors, []);
});
test('selection respects stealth and target-free; the vulnerable device is tagged, unhealable and restores terrain on destruction', () => {
  const f = fixture(), e = f.spawn(); f.d.sp = 25;
  f.b.addBuff(e, { key: 'hidden', flags: { stealth: true } }); assert.throws(() => f.controller.activate(f.d.id), /eligible/);
  f.b.removeBuff(e, 'hidden'); f.b.addBuff(e, { key: 'targetfree', flags: { targetFree: true } });
  assert.throws(() => f.controller.activate(f.d.id), /eligible/);
  assert.equal(f.d.unit.tags.has('prison'), true); assert.equal(f.d.unit.profile.characterLikeDevice, true);
  f.b.dealDamage(e, f.d.unit, { amount: 700, type: 'phys' }); assert.equal(f.d.unit.hp, 1300);
  f.b.heal(null, f.d.unit, 700); assert.equal(f.d.unit.hp, 1300);
  for (const status of ['stun', 'freeze']) f.b.applyStatus(f.d.unit, status, { duration: 3 });
  assert.equal(f.d.unit.canAct, true); assert.equal(f.b.grid.tile(9, 6).pass, 'FLY');
  f.b.kill(f.d.unit); assert.equal(f.d.state, 'spent'); assert.equal(f.b.grid.tile(9, 6).pass, 'ALL');
  assert.equal(f.b.stageOutcomes.counters.born, 1); assert.equal(f.b.stageOutcomes.counters.killed, 1); assert.deepEqual(f.b.errors, []);
});
test('native admission checks DP, cast duration, tags and guarded reconfinement', () => {
  assert.equal(manualDeviceNativeReviewed(key), true);
  assert.equal(manualDeviceDefinition(key, { level: 30, skillLevel: 1, direction: 'LEFT' }).stats.hp, 2000);
  for (const which of ['duration', 'guard', 'tag']) {
    const n = structuredClone(native);
    if (which === 'duration') n.prefabs.sktok_prison.components.find(c => '_activeBuffs' in c.data).data._cooldown = 0;
    if (which === 'guard') n.templates.enemy_confinement_force.eventToActions.ON_BUFF_START[0]._buffKeys = [];
    if (which === 'tag') n.prefabs.trap_025_prison.components.find(c => '_modes' in c.data).data._filterTag = [];
    assert.equal(manualDeviceNativeReviewed(key, n), false, which);
  }
});
test('a real device attracts Sniper Prisoner fire ahead of a higher-taunt building', () => {
  const f = fixture(), decoy = f.b.spawnDevice('decoy', 9, 9, { hp: 2000 });
  decoy.profile.enemyTargetableDevice = true; decoy.profile.characterLikeDevice = true;
  decoy.base.tauntLevel = 99; decoy.markDirty();
  const e = f.spawn(sniper, [9, 8]); e.base.atk = 220; e.markDirty();
  f.run(1.6); assert.equal(f.d.unit.hp, 1780); assert.equal(decoy.hp, 2000); assert.deepEqual(f.b.errors, []);
});
test('forced reconfinement interrupts an Arts cast even when its owner is immune to the pulse stun', () => {
  const f = fixture(), e = f.spawn(sniper), a = e.mem.ab.list.find(a => a.confine);
  e.base.atk = 220; e.def.immune.add('stun'); e.markDirty(); a.liberate(f.b, e, a);
  assert.equal(e.atkCd, e.s.interval); e.atkCd = 0;
  f.run(.2); assert.ok(a.cast); f.d.sp = 25; f.controller.activate(f.d.id);
  assert.equal(a.cast, null); assert.equal(a.free, false); assert.equal(!!e.s.flags.stun, false);
  const hp = f.d.unit.hp; f.run(1.2); assert.equal(f.d.unit.hp, hp); assert.deepEqual(f.b.errors, []);
});
test('charging follows source SP recovery modifiers and does not advance while SP recovery is stopped', () => {
  const f = fixture(); f.b.addBuff(f.d.unit, { key: 'stop', flags: { noSp: true } }); f.run(3); assert.equal(f.d.sp, 0);
  f.b.removeBuff(f.d.unit, 'stop'); f.b.addBuff(f.d.unit, { key: 'recovery', mods: { spRecoveryFlat: 1 } });
  assert.equal(f.d.unit.s.spRecovery, 2); f.run(2); assert.ok(Math.abs(f.d.sp - 4) < 1e-6); assert.deepEqual(f.b.errors, []);
});
test('original MB-2 through MB-4 retain facings, permit manual reconfinement and resolve their complete schedules', async () => {
  const { loadContentContext, planStage } = await import('../tools/arkpedia/content-inventory.mjs');
  const { StandardBattle } = await import('../server/sim/arkpedia.js');
  const { defaultBuild } = await import('../shared/arkpedia/loadout.js');
  const c = await loadContentContext();
  for (const id of ['mb-2', 'mb-3', 'mb-4']) {
    const p = await planStage(c, id, { waves: true }); assert.deepEqual(p.blockers, [], id);
    const b = new StandardBattle({ ...c.mvp, stage: p.stage, enemies: { ...c.mvp.enemies, ...p.stage.enemies } },
      { operators: [defaultBuild(c.mvp.operators.char_123_fang)] });
    b.on('enemySpawn', ({ enemy }) => { if (enemy.tag !== 'review:held') b.after(.05, () => b.kill(enemy)); });
    b.start(); const d = [...b.manualStageDevices.entries.values()].find(d => d.key === key); assert.ok(d, id);
    const point = [...d.tiles].map(k => k.split(',').map(Number)).find(([r, c]) => b.grid.groundPassable(r, c)); assert.ok(point, id);
    const e = b.spawnEnemy(sniper, { pos: point, countInTotal: false, tag: 'review:held' });
    e.profile.noAttack = true; b.addBuff(e, { key: 'review:hold', flags: { noMove: true } });
    const a = e.mem.ab.list.find(a => a.confine); a.liberate(b, e, a);
    const life = b.life; while (b.time < 25.1 && !b.finished) b.step();
    assert.equal(b.finished, false); b.addDp('arkpedia', 99); b.manualStageDevices.activate(d.id);
    assert.equal(a.free, false); assert.equal(e.s.flags.stun, true); assert.equal(d.unit.dir, d.spec.direction);
    b.kill(e); b.runToEnd(600); assert.equal(b.reason, 'cleared', id); assert.equal(b.life, life); assert.deepEqual(b.errors, []);
  }
});
