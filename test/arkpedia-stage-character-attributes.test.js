// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadContentContext, planStage } from '../tools/arkpedia/content-inventory.mjs';
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { stageCharacterMultipliers, stageDeviceAttributes } from '../shared/arkpedia/stage-character-attributes.js';
import { makeBattle, chessRec } from './helpers/battleHarness.js';
import { installNativeStageRules } from '../server/sim/content/arkpedia-stage-native-rules.js';
import { compileStageRules } from '../shared/arkpedia/stage-rules.js';
const c = await loadContentContext();

test('TW-EX4 challenge multiplies character ATK after skill bonuses and does not stack on redeploy', async () => {
  const p = await planStage(c, 'tw-ex-4_challenge_mode'); assert.deepEqual(p.blockers, []);
  const op = chessRec({ id: 'stage_atk_guard', stats: { atk: 1000 } });
  const h = makeBattle({ content: 'none', autoFinish: false, defs: { chess: { [op.chessId]: op } },
    units: [{ chessId: op.chessId, row: 9, col: 6 }], setup: b => installNativeStageRules(b, p.stage.rules) });
  h.b.start(); const u = h.b.allyUnits[0]; assert.equal(u.s.atk, 600); assert.equal(op.stats.atk, 1000);
  h.b.addBuff(u, { key: 'skill', mods: { atkPct: 1 } }); assert.equal(u.s.atk, 1200);
  h.b.emit('deploy', { unit: u, move: true }); assert.equal(u.s.atk, 1200);
  h.b._remove(u, 'retreat'); h.b._deploy(u, { tile: [9, 6] }); assert.equal(u.s.atk, 600);
  assert.deepEqual(h.b.errors, []);
});

test('CB-EX6 challenge applies -1 Block only to Vanguards and Casters, across movement and redeployment', async () => {
  const p = await planStage(c, 'cb-ex6_challenge_mode'); assert.deepEqual(p.blockers, []);
  assert.deepEqual(p.stage.rules.characterAttributes, [{ professionMask: 513, buildableMask: 3, additions: { blockCnt: -1 } }]);
  for (const profession of ['PIONEER', 'CASTER', 'WARRIOR', 'TOKEN']) {
    const op = chessRec({ id: 'block_' + profession, profession, stats: { blockCnt: profession === 'CASTER' ? 0 : 2 } });
    const h = makeBattle({ content: 'none', autoFinish: false, defs: { chess: { [op.chessId]: op } },
      units: [{ chessId: op.chessId, row: 9, col: 6 }], setup: b => installNativeStageRules(b, p.stage.rules) });
    h.b.start(); const u = h.b.allyUnits[0], expected = profession === 'CASTER' ? 0 : profession === 'PIONEER' ? 1 : 2;
    assert.equal(u.s.blockCnt, expected);
    h.b.addBuff(u, { key: 'skillBlock', mods: { blockCnt: 1 } });
    assert.equal(u.s.blockCnt, profession === 'CASTER' ? 0 : expected + 1);
    h.b.emit('deploy', { unit: u, move: true });
    assert.equal(u.s.blockCnt, profession === 'CASTER' ? 0 : expected + 1);
    h.b._remove(u, 'retreat'); h.b._deploy(u, { tile: [9, 6] }); assert.equal(u.s.blockCnt, expected);
    assert.deepEqual(h.b.errors, []);
  }
});

test('original NONE character masks preserve global and scoped enemy multipliers in CB challenges', async () => {
  for (const id of ['cb-ex1_challenge_mode', 'cb-ex2_challenge_mode']) {
    const p = await planStage(c, id); assert.deepEqual(p.blockers, []);
    if (id.startsWith('cb-ex1')) {
      assert.equal(p.stage.rules.enemyScoped.enemy_1057_gansho_2.atk, 1.5);
      assert.equal(p.stage.enemies.enemy_1057_gansho_2.stats.atk, 345);
    } else {
      assert.equal(p.stage.rules.enemies.maxHp, 1.2);
      assert.equal(p.stage.rules.enemyScoped.enemy_1060_emouse_2.maxHp, 1.2);
      assert.equal(p.stage.enemies.enemy_1060_emouse_2.stats.maxHp, 5760);
    }
  }
});

test('block additions reject fractional values and enemy mask relaxation does not admit player runes', () => {
  const source = { id: 'fixture', battle: {}, variant: null };
  const receipt = { schemaVersion: 1, stageId: 'fixture', source: { commit: 'a'.repeat(40), sha256: 'b'.repeat(64) }, runes: [] };
  for (const rune of [
    { key: 'char_blockcnt_add', professionMask: 513, buildableMask: 'ALL', blackboard: [{ key: 'value', value: -.5, valueStr: null }] },
    { key: 'gbuff_lifepoint', professionMask: 'NONE', buildableMask: 'NONE', blackboard: [{ key: 'value', value: 1, valueStr: null }] },
    { key: 'enemy_attribute_mul', professionMask: 'NONE', buildableMask: 'ALL', blackboard: [{ key: 'atk', value: 2, valueStr: null }] },
  ]) assert.throws(() => compileStageRules(source, { ...receipt, runes: [{ difficultyMask: 'ALL', ...rune }] }));
});

test('trap Block additions share selection and clamp below zero without editing device defaults', () => {
  const stats = { hp: 100, block: 1 };
  const rules = { characterAttributes: [{ professionMask: 256, buildableMask: 3, additions: { blockCnt: -2 } }] };
  assert.deepEqual(stageDeviceAttributes(rules, 'trap_fixture', stats), { hp: 100, block: 0 });
  assert.deepEqual(stats, { hp: 100, block: 1 });
});

test('11-3 adverse reduces character DEF and doubles only corruption blackboards', async () => {
  const p = await planStage(c, '11-3_adverse_environment'); assert.deepEqual(p.blockers, []);
  assert.deepEqual(p.stage.rules.characterAttributes, [{ professionMask: 1023, buildableMask: 3, multipliers: { def: .8 } }]);
  const affected = Object.values(p.stage.enemies).filter(r => r.talents.groups.PollutedDie);
  assert.ok(affected.length); for (const r of affected) assert.equal(r.talents.bb['PollutedDie.polluted_damage_low'], 100);
  const op = chessRec({ id: 'stage_def_guard' });
  const h = makeBattle({ content: 'none', autoFinish: false, defs: { chess: { [op.chessId]: op } },
    units: [{ chessId: op.chessId, row: 9, col: 6 }], setup: b => installNativeStageRules(b, p.stage.rules) });
  h.b.start(); const u = h.b.allyUnits[0];
  assert.equal(u.s.def, 160); assert.equal(op.stats.def, 200);
  h.b.addBuff(u, { key: 'skill', mods: { defPct: 1 } }); assert.equal(u.s.def, 320);
  h.b.emit('deploy', { unit: u, move: true }); assert.equal(u.s.def, 320, 'one stage modifier after movement');
  h.b._remove(u, 'retreat'); h.b._deploy(u, { tile: [9, 6] }); assert.equal(u.s.def, 160);
  assert.deepEqual(h.b.errors, []);
});

test('scoped character modifiers select a token by its own ID, class and placement', () => {
  const rules = { characterAttributes: [{ professionMask: 128, buildableMask: 1,
    ids: ['token_fixture'], multipliers: { maxHp: 5, def: 1.2 } }] };
  assert.deepEqual(stageCharacterMultipliers(rules, { id: 'token_fixture', profession: 'TOKEN', position: 'MELEE' }), { maxHp: 5, def: 1.2 });
  for (const record of [{ id: 'token_other', profession: 'TOKEN', position: 'MELEE' },
    { id: 'token_fixture', profession: 'TRAP', position: 'MELEE' }, { id: 'token_fixture', profession: 'TOKEN', position: 'RANGED' }])
    assert.deepEqual(stageCharacterMultipliers(rules, record), {});
  const rec = chessRec({ id: 'token_fixture', profession: 'TOKEN' });
  const h = makeBattle({ content: 'none', autoFinish: false, defs: { chess: { [rec.chessId]: rec } },
    units: [{ chessId: rec.chessId, row: 9, col: 6 }], setup: b => installNativeStageRules(b, rules) });
  h.b.start(); const u = h.b.allyUnits[0]; assert.equal(u.s.maxHp, 10000); assert.equal(u.hp, 10000); assert.equal(u.s.def, 240);
  assert.deepEqual(h.b.errors, []);
});

test('Ursus Camp roadblocks reuse their device implementation with stage-only HP and DEF', async () => {
  const p = await planStage(c, 'ursus_camp_r_03'); assert.deepEqual(p.blockers, []);
  const source = { ...c.mvp, stage: p.stage, enemies: { ...c.mvp.enemies, ...p.stage.enemies } };
  const b = new StandardBattle(source, { operators: Object.values(c.mvp.operators).slice(0, 5).map(defaultBuild) });
  const blocks = b.enemies.filter(e => e.def.raw.key === 'trap_020_roadblock');
  assert.ok(blocks.length);
  for (const e of blocks) { assert.equal(e.s.maxHp, 40000); assert.equal(e.hp, 40000); assert.equal(e.s.def, 240); }
  assert.deepEqual(b.errors, []);
});
