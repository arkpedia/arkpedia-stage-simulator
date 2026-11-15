// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeBattle, chessRec } from './helpers/battleHarness.js';
import { ENEMY_RECORDS } from './helpers/enemyHarness.js';
import { installEnemyFeatures } from '../server/sim/content/arkpedia-enemy-features.js';
import { StageGramophones } from '../server/sim/content/arkpedia-stage-gramophones.js';
import { sortAllyTargets } from '../server/sim/targeting.js';
import { enemySupport } from '../shared/arkpedia/enemy-support.js';
import native from '../data/arkpedia-enemy-native-abilities.json' with { type: 'json' };
import clock from '../data/arkpedia-enemy-clock-source.json' with { type: 'json' };
import { loadContentContext, planStage } from '../tools/arkpedia/content-inventory.mjs';
import { applyStageEnemySkillMultipliers } from '../shared/arkpedia/stage-enemy-talents.js';
const shield = e => e.buffs.reduce((sum, buff) => sum + buff.shield, 0);
function fixture(id, override) {
  const record = override ?? ENEMY_RECORDS.enemies[id].levels[0];
  const op = chessRec({ id: 'mudrock_target', stats: { atk: 0, maxHp: 10000, def: 100 } });
  const h = makeBattle({ content: 'none', autoFinish: false,
    defs: { enemies: { [id]: record }, chess: { [op.chessId]: op } },
    units: [{ chessId: op.chessId, row: 9, col: 6 }, { chessId: op.chessId, row: 10, col: 6 }], setup: installEnemyFeatures });
  const b = h.b; b.start(); const e = b.spawnEnemy(id, { pos: [9, 8] });
  for (const u of b.allyUnits) b.addBuff(u, { key: 'test:hold', flags: { disarm: true, noBlock: true } });
  return { h, b, e, record, allies: [...b.allyUnits] };
}
test('Zealot variants reuse three Arts-only layers and preserve HP ratio when their HP/ASPD bonus ends', () => {
  for (const id of ['enemy_1091_mdhmmr', 'enemy_1091_mdhmmr_2']) {
    const { b, e, record } = fixture(id), base = record.stats.maxHp, total = 3 * record.talents.bb['shield.dynamic'];
    assert.equal(e.s.maxHp, base * 1.5); assert.equal(e.hp, e.s.maxHp); assert.equal(e.s.aspd, record.stats.aspd + 50);
    assert.equal(shield(e), total);
    b.dealDamage(null, e, { amount: 900, type: 'true' }); const ratio = e.hp / e.s.maxHp;
    assert.equal(shield(e), total); b.applyStatus(e, 'silence', { duration: 10 }); assert.equal(e.s.maxHp, base * 1.5);
    b.dealDamage(null, e, { amount: total / (1 - e.s.res / 100), type: 'arts' });
    assert.equal(shield(e), 0); assert.equal(e.s.maxHp, base); assert.equal(e.s.aspd, record.stats.aspd);
    assert.ok(Math.abs(e.hp / e.s.maxHp - ratio) < 1e-9); assert.deepEqual(b.errors, []);
  }
});
test('Matterllurgists prefer real charging markers and release the original one/two physical projectiles', () => {
  for (const id of ['enemy_1090_mdsnpr', 'enemy_1090_mdsnpr_2']) {
    const { h, b, e, allies } = fixture(id), [charger, other] = allies;
    b.stageGramophones = new StageGramophones(b, [{ name: "L-44 'Gramophone'", key: 'trap_014_tower', kind: 'device',
      hidden: false, row: 9, col: 5, instance: { level: 1, skillLevel: 1 } }]);
    b.stageGramophones.tick(b.dt);
    assert.ok(charger.findBuff('tower_t_1[charge_range]')); assert.equal(other.findBuff('tower_t_1[charge_range]'), null);
    b.addBuff(other, { key: 'test:taunt', mods: { taunt: 1 } });
    assert.equal(sortAllyTargets(e, [other, charger])[0], charger);
    const hits = []; b.on('hit', c => { if (c.source === e) hits.push(c.target); });
    h.run(1.5); assert.ok(hits.includes(charger)); assert.equal(hits.includes(other), id.endsWith('_2'));
    charger.x = 3; b.stageGramophones.tick(b.dt); assert.equal(charger.findBuff('tower_t_1[charge_range]'), null);
    assert.equal(sortAllyTargets(e, [charger, other])[0], other); assert.deepEqual(b.errors, []);
  }
});
test('source contracts reject changed barrier stats and Matterllurgist target counts', () => {
  for (const id of ['enemy_1091_mdhmmr', 'enemy_1091_mdhmmr_2', 'enemy_1090_mdsnpr', 'enemy_1090_mdsnpr_2'])
    assert.ok(enemySupport(ENEMY_RECORDS.enemies[id], clock.prefabs, native).policy, id);
  const n = structuredClone(native);
  for (const row of n.prefabs['dyn/battle/prefabs/enemies/enemy_1090_mdsnpr_2.prefab']) {
    const v = JSON.parse(row.originalJson); if ('_secondaryFilter' in v) v._maxNum = 1; row.originalJson = JSON.stringify(v);
  }
  assert.equal(enemySupport(ENEMY_RECORDS.enemies.enemy_1090_mdsnpr_2, clock.prefabs, n).policy, null);
  const r = structuredClone(ENEMY_RECORDS.enemies.enemy_1091_mdhmmr); r.levels[0].talents.bb['shield.max_hp'] = 1;
  assert.equal(enemySupport(r, clock.prefabs, native).policy, null);
});

test('Blood Shamans retain delayed ground splash and Gramophone seizure after death, with cached ATK', () => {
  for (const id of ['enemy_1089_ltlntc', 'enemy_1089_ltlntc_2']) {
    const { h, b, e, record, allies: [ground, air] } = fixture(id);
    ground.x = 7.2; air.x = 7.2; air.motion = 'FLY';
    b.addBuff(ground, { key: 'test:camou', flags: { camou: true } });
    b.addBuff(e, { key: 'test:hold', flags: { disarm: true, noMove: true } });
    b.stageGramophones = new StageGramophones(b, [{ name: "L-44 'Gramophone'", key: 'trap_014_tower', kind: 'device',
      hidden: false, row: 9, col: 7, instance: { level: 1, skillLevel: 3 } }]);
    const d = [...b.stageGramophones.entries.values()][0]; h.run(.2); assert.equal(d.control, 'ally');
    const hp = ground.hp, airHp = air.hp, amount = e.s.atk * record.talents.bb['boom.atk_scale'];
    b.kill(e); e.base.atk *= 10; e.markDirty();
    h.run(1.2); assert.equal(d.control, 'ally'); assert.equal(ground.hp, hp);
    h.run(.2); assert.equal(d.control, 'enemy'); assert.equal(d.sp, 0);
    assert.equal(ground.hp, hp - amount); assert.equal(air.hp, airHp);
    assert.deepEqual(b.errors, []);
  }
});
test('Blood Shaman periodic loss uses its existing one-second clock; leaking does not emit a death payload', () => {
  const { h, b, e } = fixture('enemy_1089_ltlntc');
  b.addBuff(e, { key: 'test:hold', flags: { disarm: true, noMove: true } });
  const hp = e.hp; h.run(1); assert.equal(e.hp, hp - 400);
  const events = []; b.on('hit', c => { if (c.dmg.tags.includes('shamanDeath')) events.push(c); });
  b._remove(e, 'leak'); h.run(2); assert.deepEqual(events, []); assert.deepEqual(b.errors, []);
});

function whispererFixture(id = 'enemy_1088_ltsmer', override) {
  const f = fixture(id, override), { b, e } = f;
  b.addBuff(e, { key: 'test:stationary', flags: { noMove: true } });
  b.stageGramophones = new StageGramophones(b, [7, 10].map(col => ({ name: "L-44 'Gramophone'",
    key: 'trap_014_tower', kind: 'device', hidden: false, row: 9, col, instance: { level: 1, skillLevel: 1 } })));
  // Keep this test's control-SP changes independent of allied charging and combat.
  for (const u of f.allies) { u.x = 3; u.y = 12; }
  return { ...f, towers: [...b.stageGramophones.entries.values()] };
}
test('Whisperers select the nearest eligible Gramophone, drain on contact, and stop on capture', () => {
  for (const id of ['enemy_1088_ltsmer', 'enemy_1088_ltsmer_2']) {
    assert.ok(enemySupport(ENEMY_RECORDS.enemies[id], clock.prefabs, native).policy);
    const { h, b, e, towers: [near, far] } = whispererFixture(id);
    h.run(4.9); assert.equal(near.sp, 50); assert.equal(e.profile.noAttack, false);
    h.run(.6); assert.equal(near.sp, 48); assert.equal(far.sp, 50); assert.equal(e.profile.noAttack, true);
    h.run(2); assert.equal(near.sp, 44); assert.equal(far.sp, 50);
    b.stageGramophones.modifySp(near.id, -43); h.run(1.1);
    assert.equal(near.sp, 0); h.run(.8); assert.equal(e.profile.noAttack, false);
    b.stageGramophones.tick(.1); assert.equal(near.control, 'enemy');
    h.run(12); assert.ok(far.sp < 50); assert.deepEqual(b.errors, []);
  }
});
test('Whisperer links interrupt on status, death, and external projectile removal without retaining attack locks', () => {
  for (const mode of ['stun', 'silence', 'sleep', 'death', 'projectile']) {
    const { h, b, e, towers: [near] } = whispererFixture(); h.run(5.6);
    assert.equal(e.profile.noAttack, true); const sp = near.sp;
    if (mode === 'death') b.kill(e);
    else if (mode === 'projectile') b.projectiles.remove(p => p.data?.whispererChannel);
    else b.applyStatus(e, mode, { duration: .1, force: true });
    h.run(1.2); assert.equal(near.sp, sp, mode); assert.equal(e.profile.noAttack, false, mode);
    assert.equal(e.findBuff('ab:whispererChannel'), null, mode); assert.deepEqual(b.errors, []);
  }
});
test('Whisperer channels expire when SP is protected and skip enemy-controlled Gramophones', () => {
  const { h, b, e, towers: [near, far] } = whispererFixture();
  b.stageGramophones.seize(near.id); b.addBuff(far.unit, { key: 'test:sp', flags: { noSp: true } });
  h.run(5.6); assert.equal(e.profile.noAttack, true);
  const beam = b.projectiles.list.find(p => p.data?.whispererChannel);
  h.run(24.9); assert.equal(far.sp, 50); assert.equal(near.sp, 0);
  assert.ok(beam.removed); assert.equal(e.mem.regularFormVisual.clip, 'Skill_End');
  // The 15-second cooldown runs during the channel, so it may cast again after recovery.
  h.run(1); assert.notEqual(b.projectiles.list.find(p => p.data?.whispererChannel), beam); assert.deepEqual(b.errors, []);
});
test('Whisperers retain native stun and silence immunity during capture', () => {
  const { h, b, e, towers: [near] } = whispererFixture(); h.run(5.6);
  for (const status of ['stun', 'silence']) b.applyStatus(e, status, { duration: 10 });
  h.run(2); assert.equal(near.sp, 44); assert.equal(e.profile.noAttack, true);
  assert.deepEqual(b.errors, []);
});

test('original TW challenge and tutorial changes configure the shared Whisperer channel without editing its catalogue record', async () => {
  const context = await loadContentContext();
  for (const [stage, id, seconds, expected] of [
    ['tw-ex-5_challenge_mode', 'enemy_1088_ltsmer_2', 5.6, 46],
    ['tw-tr-1', 'enemy_1088_ltsmer', .6, 48],
  ]) {
    const p = await planStage(context, stage); assert.deepEqual(p.blockers, []);
    const record = p.stage.enemies[id], { h, b, towers: [near] } = whispererFixture(id, record);
    h.run(seconds); assert.equal(near.sp, expected); assert.deepEqual(b.errors, []);
    assert.equal(ENEMY_RECORDS.enemies[id].levels[0].skills[0].bb.sp, -2);
    assert.equal(ENEMY_RECORDS.enemies[id].levels[0].skills[0].initCooldown, 5);
    if (stage.includes('ex-5')) assert.equal(record.stats.rangeRadius, 4.2);
  }
  const r = ENEMY_RECORDS.enemies.enemy_1088_ltsmer.levels[0];
  for (const rules of [{ missing: { sp: 2 } }, { charge: { unknown: 2 } }, { charge: { sp: -1 } }, { charge: { sp: Infinity } }])
    assert.throws(() => applyStageEnemySkillMultipliers(r, rules));
});
