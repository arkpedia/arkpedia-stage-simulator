// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { loadContentContext, planStage } from '../tools/arkpedia/content-inventory.mjs';
import { nativeStageRuleReviewed } from '../shared/arkpedia/stage-native-rules.js';
import { compileStageRules } from '../shared/arkpedia/stage-rules.js';
import { installNativeStageRules } from '../server/sim/content/arkpedia-stage-native-rules.js';
import { enemyStealthed } from '../server/sim/targeting.js';
import { makeBattle, chessRec } from './helpers/battleHarness.js';
import evidence from '../data/arkpedia-native-stage-rules.json' with { type: 'json' };

const context = await loadContentContext();
test('original stage-rule components retain their canonical hashes and narrow contracts', () => {
  const canonical = v => Array.isArray(v) ? v.map(canonical) : v && typeof v === 'object'
    ? Object.fromEntries(Object.keys(v).sort().map(k => [k, canonical(v[k])])) : v;
  for (const row of Object.values(evidence.prefabs).flatMap(p => p.components))
    assert.equal(createHash('sha256').update(JSON.stringify(canonical(row.data))).digest('hex'), row.sha256);
  for (const key of ['silenceimmue', 'invisible', 'common_char_melee_built', 'deploy_damage', 'apply_elemental_damage']) assert.equal(nativeStageRuleReviewed(key), true, key);
  const changed = structuredClone(evidence);
  changed.prefabs.silenceimmue.components[0].data._buffs[0].attributes.abnormalImmunes = [8];
  changed.prefabs.invisible.components.find(c => '_restoreDelay' in c.data).data._restoreDelay = 0;
  changed.templates.common_char_melee_built.eventToActions.ON_BUFF_START[0]._conditionNode._heightType = 'HIGHLAND';
  changed.templates.deploy_damage.eventToActions.ON_OWNER_POST_BORN[0]._skipModifierEvent = true;
  changed.templates['apply_elemental_damage[enemy]'].eventToActions.ON_OUTPUT_DAMAGE[0]._baseOnHostAtk = true;
  for (const key of ['silenceimmue', 'invisible', 'common_char_melee_built', 'deploy_damage', 'apply_elemental_damage', 'unknown']) assert.equal(nativeStageRuleReviewed(key, changed), false, key);
});
test('BW-7 Silence immunity is stage-local and rejects Silence while leaving unrelated statuses valid', async () => {
  const id = 'enemy_1067_snslime', plan = await planStage(context, 'bw-7_challenge_mode');
  assert.deepEqual(plan.blockers, []);
  const original = context.records.enemies[id].levels[0];
  assert.equal(original.stats.immunities.silence, false);
  assert.equal(plan.stage.enemies[id].stats.immunities.silence, true);
  assert.ok(plan.localSources.some(s => s.path === 'data/arkpedia-native-stage-rules.json'));
  const h = makeBattle({ content: 'none', autoFinish: false, units: [], defs: { enemies: plan.stage.enemies } });
  h.b.start(); const e = h.b.spawnEnemy(id, { pos: [9, 8] });
  h.b.applyStatus(e, 'silence', 5); assert.equal(!!e.s.flags.silence, false);
  h.b.applyStatus(e, 'stun', 5); assert.equal(e.s.flags.stun, true);
  assert.deepEqual(h.b.errors, []);
});
test('stage invisibility begins at spawn, switches off on block and returns three seconds after release', async () => {
  const plan = await planStage(context, '10-3_adverse_environment'); assert.deepEqual(plan.blockers, []);
  const id = 'enemy_1220_dzoms', records = structuredClone(plan.stage.enemies);
  for (const r of Object.values(records)) r.stats.moveSpeed = 0;
  const h = makeBattle({ content: 'none', autoFinish: false, units: [], defs: { enemies: records },
    setup: b => installNativeStageRules(b, plan.stage.rules) });
  const b = h.b; b.start(); const e = b.spawnEnemy(id, { pos: [9, 8] });
  assert.equal(enemyStealthed(e), true);
  b.applyStatus(e, 'silence', 10); assert.equal(enemyStealthed(e), true, 'native buff is not silenceable');
  e.blockedBy = { alive: true }; b._stealthSwitch(e); assert.equal(enemyStealthed(e), false);
  e.blockedBy = null; b._stealthSwitch(e); h.run(2.9); assert.equal(enemyStealthed(e), false);
  h.run(.2); assert.equal(enemyStealthed(e), true);
  const other = b.spawnEnemy(Object.keys(records).find(key => key !== id), { pos: [9, 5] });
  assert.equal(!!other.findBuff('stage:invisible'), false);
  assert.deepEqual(b.errors, []);
});
test('melee-built native rule logs real melee ground births without changing placement or counting movement', () => {
  const melee = chessRec({ id: 'metric_melee' }), ranged = chessRec({ id: 'metric_ranged' });
  ranged.position = 'RANGED'; ranged.profession = 'SNIPER';
  const h = makeBattle({ content: 'none', autoFinish: false,
    defs: { chess: { [melee.chessId]: melee, [ranged.chessId]: ranged } },
    units: [{ chessId: melee.chessId, row: 9, col: 6 }, { chessId: ranged.chessId, row: 8, col: 6 }],
    setup: b => installNativeStageRules(b, { environmentBuffs: ['common_char_melee_built'] }) });
  h.b.start(); const b = h.b, u = b.allyUnits.find(u => u.defId === melee.chessId);
  assert.equal(b.stageExtraBattleInfo.melee_built, 1);
  assert.equal(b.allyUnits.find(u => u.defId === ranged.chessId).def.position, 'RANGED');
  b.emit('deploy', { unit: u, move: true }); b.emit('deploy', { unit: u, moveLikeRespawn: true });
  assert.equal(b.stageExtraBattleInfo.melee_built, 1);
  b.emit('deploy', { unit: u }); assert.equal(b.stageExtraBattleInfo.melee_built, 2);
  assert.deepEqual(b.errors, []);
});
test('unknown ability/environment IDs and duplicate targets are blocked before compilation', () => {
  const receipt = { schemaVersion: 1, stageId: 'fixture', source: { commit: 'a'.repeat(40), sha256: 'b'.repeat(64) } };
  for (const [key, blackboard] of [
    ['enemy_dynamic_ability_new', [{ key: 'enemy', value: 0, valueStr: 'enemy_a' }, { key: 'key', value: 0, valueStr: 'new' }]],
    ['enemy_dynamic_ability_new', [{ key: 'enemy', value: 0, valueStr: 'enemy_a|enemy_a' }, { key: 'key', value: 0, valueStr: 'invisible' }]],
    ['env_gbuff_new', [{ key: 'key', value: 0, valueStr: 'unreviewed' }]],
  ]) assert.throws(() => compileStageRules({ id: 'fixture' }, { ...receipt,
    runes: [{ key, difficultyMask: 'ALL', professionMask: 1023, buildableMask: 'ALL', blackboard }] }), /Unsupported|Duplicate/);
});

test('14-15 adverse adds DEF only to Soul Maelstrom after the stage stat scale', async () => {
  const plan = await planStage(context, '14-15_adverse_environment'); assert.deepEqual(plan.blockers, []);
  const target = 'enemy_1428_lrsoul';
  for (const [id, record] of Object.entries(plan.stage.enemies)) {
    const original = context.records.enemies[id].levels[record.level];
    assert.equal(record.stats.def, original.stats.def * 1.2 + (id === target ? 300 : 0));
  }
  assert.deepEqual(plan.stage.rules.enemyScopedAdd, { [target]: { def: 300 } });
});

test('10-16 deployment penalty uses a True-damage packet, defensive SP and each real birth', async () => {
  const plan = await planStage(context, '10-16_adverse_environment'); assert.deepEqual(plan.blockers, []);
  const rec = chessRec({ id: 'deploy_penalty', stats: { maxHp: 2000 }, skill: { spType: 'INCREASE_WHEN_TAKEN_DAMAGE' } });
  const h = makeBattle({ content: 'generic', captureNoisy: true, autoFinish: false, defs: { chess: { [rec.chessId]: rec } },
    units: [{ chessId: rec.chessId, row: 9, col: 6 }], setup: b => installNativeStageRules(b, plan.stage.rules) });
  const b = h.b; b.start(); const u = b.allyUnits[0];
  assert.equal(u.hp, 1000); assert.equal(u.skill.sp, 1);
  b.emit('deploy', { unit: u, move: true }); b.emit('deploy', { unit: u, moveLikeRespawn: true });
  assert.equal(u.hp, 1000); assert.equal(u.skill.sp, 1);
  b._remove(u, 'retreat'); assert.equal(b._deploy(u, { tile: [9, 6] }), true);
  assert.equal(u.hp, 1000); assert.equal(u.skill.sp, 1);
  const hit = h.hooksOf('damaged').at(-1);
  assert.equal(hit?.ctx?.dmg?.type ?? hit?.dmg?.type, 'true');
  assert.deepEqual(b.errors, []);
});

test('deployment penalty respects source masks and applies shields/damage modifiers after birth buffs', () => {
  const records = Object.fromEntries(['WARRIOR', 'TOKEN', 'TRAP'].map(profession => {
    const r = chessRec({ id: 'penalty_' + profession, profession }); return [r.chessId, r];
  }));
  const h = makeBattle({ content: 'none', autoFinish: false, defs: { chess: records },
    units: Object.keys(records).map((chessId, i) => ({ chessId, row: 9, col: 5 + i })), setup: b => {
      installNativeStageRules(b, { deploymentDamage: [{ professionMask: 767, buildableMask: 3, hpRatio: .5 }] });
      b.on('deploy', ({ unit: u }) => b.addBuff(u, { key: 'birth-protection', shield: 100, mods: { dmgTakenMul: .5 } }));
    } });
  h.b.start();
  for (const u of h.b.allyUnits) assert.equal(u.hp, u.def.profession === 'TRAP' ? 2000 : 1600);
  assert.deepEqual(h.b.errors, []);
});

test('12-20 elemental rune: the listed enemies add Corrosion of 25% of each damage they deal, nothing else does', () => {
  const receipt = { schemaVersion: 1, stageId: 'fixture', source: { commit: 'a'.repeat(40), sha256: 'b'.repeat(64) } };
  const rune = (blackboard, extra = {}) => ({ key: 'env_gbuff_new_with_verify', difficultyMask: 'ALL', professionMask: 1023, buildableMask: 'ALL', blackboard, ...extra });
  const bb = (ids, ratio = .25) => [{ key: 'ep_damage_ratio', value: ratio, valueStr: null }, { key: 'key', value: 0, valueStr: 'apply_elemental_damage' },
    { key: 'enemy', value: 0, valueStr: ids }];
  const compiled = compileStageRules({ id: 'fixture' }, { ...receipt, runes: [rune(bb('enemy_a|enemy_b'))] });
  assert.deepEqual(compiled.enemyElementalDamage, { enemy_a: { element: 'erosion', ratio: .25 }, enemy_b: { element: 'erosion', ratio: .25 } });
  for (const bad of [bb('enemy_a|enemy_a'), bb('enemy_a', 0), bb('enemy_a', 1.5), [...bb('enemy_a'), { key: 'atk', value: 1, valueStr: null }],
    bb('enemy_a').map(x => x.key === 'key' ? { ...x, valueStr: 'apply_elemental_damage[enemy]' } : x)])
    assert.throws(() => compileStageRules({ id: 'fixture' }, { ...receipt, runes: [rune(bad)] }), /Unsupported|Duplicate|Invalid/);
  assert.throws(() => compileStageRules({ id: 'fixture' }, { ...receipt, runes: [rune(bb('enemy_a'), { professionMask: 1 })] }), /Unsupported/);
  const rec = chessRec({ id: 'corroded', stats: { maxHp: 5000, def: 0 } });
  const enemies = { enemy_a: { ...structuredClone(context.records.enemies.enemy_1071_dftman_2.levels[0]), key: 'enemy_a' } };
  const h = makeBattle({ content: 'none', autoFinish: false, defs: { chess: { [rec.chessId]: rec } },
    units: [{ chessId: rec.chessId, row: 9, col: 6 }], setup: b => installNativeStageRules(b, compiled) });
  const b = h.b; b.start(); const u = b.allyUnits[0];
  const listed = b.spawnEnemy('enemy_a', { pos: [9, 8] }), other = b.spawnEnemy('enemy_a', { pos: [9, 9] });
  other.defId = 'enemy_unlisted';
  b.dealDamage(listed, u, { amount: 400, type: 'phys' });
  assert.equal(u.elem.erosion, 100);
  b.dealDamage(other, u, { amount: 400, type: 'phys' });
  assert.equal(u.elem.erosion, 100, 'an unlisted enemy adds nothing');
  b.dealDamage(listed, u, { amount: 40, type: 'element', element: 'erosion' });
  assert.equal(u.elem.erosion, 140, 'an element hit does not feed itself');
  assert.deepEqual(b.errors, []);
});
