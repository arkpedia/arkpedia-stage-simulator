// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import evidence from '../data/arkpedia-native-operators/char_4229_aphris.json' with {type: 'json'};
import {
  APHRISSA_ID as ID, APHRISSA_RELAY_ID as TOKEN, APHRISSA_SKILLS,
  selectedAphrissaBuild as select, selectedAphrissaInputs, aphrissaSourceComponent,
  aphrissaNativeInputs,
} from '../server/sim/content/arkpedia-aphrissa-source.js';
import {normalizeChess} from '../server/sim/simdata.js';

const build = more => ({elite: 2, level: 90, potential: 1, trust: 0,
  skillId: APHRISSA_SKILLS[0], skillRank: 10, module: 'none', ...more});

test('Aphrissa retains the exact complete source receipt without approving gameplay, modules or particles', async () => {
  const raw = await readFile(new URL('../data/arkpedia-native-operators/' + ID + '.json', import.meta.url));
  assert.equal(raw.length, 576304);
  assert.equal(createHash('sha256').update(raw).digest('hex'), '77207d3d44737940e6bc4aee4a4a57abea27a1490d3870168e9f1615527ca254');
  assert.deepEqual(evidence.enabledOperators, []);
  assert.deepEqual(evidence.heldOperators, [ID]);
  assert.deepEqual(evidence.nativeTemplateGaps, []);
  assert.deepEqual(evidence.jsonTemplateGaps, []);
  assert.equal(evidence.source.bundles.length, 6);
  assert.equal(Object.keys(evidence.templates).length, 16);
  assert.deepEqual(Object.keys(evidence.projectiles), []);
  let count = 0;
  for (const group of ['characters', 'artworkHierarchy', 'skills', 'projectiles', 'tokens'])
    for (const rows of Object.values(evidence[group]))
      for (const row of rows) for (const part of row.components) {
        count++;
        assert.equal(typeof part.pathId, 'string');
      }
  assert.equal(count, 220);
  for (const key of ['frameParity', 'moduleSupport', 'nativeParticleSupport']) assert.equal(evidence[key], false);
});

test('The relay preserves three literal null promotion slots without a synthetic skill or prefab', () => {
  assert.deepEqual(Object.keys(evidence.tokens), [TOKEN]);
  const slots = evidence.tables.tokens[TOKEN].skills;
  assert.equal(slots.length, 3);
  assert.deepEqual(slots.map(row => row.unlockCond.phase), ['PHASE_0', 'PHASE_1', 'PHASE_2']);
  for (const row of slots) {
    assert.equal(row.skillId, null);
    assert.equal(row.overridePrefabKey, null);
    assert.equal(row.overrideTokenKey, null);
    assert.equal(row.levelUpCostCond.length, 3);
  }
  assert.deepEqual(evidence.tables.tokenSkills, {});
  assert.deepEqual(evidence.tokenSkillBindings, {[TOKEN]: {}});
  assert.deepEqual(evidence.tokenSkillPrefabOverrides, {[TOKEN]: {}});
  assert.deepEqual(evidence.tokenModeSkills, {[TOKEN]: []});
  assert.deepEqual(evidence.ownerModeSkills, []);
  assert.deepEqual(evidence.skillBindings, Object.fromEntries(APHRISSA_SKILLS.map(key => [key, [key]])));
});

for (const [index, skillId] of APHRISSA_SKILLS.entries()) for (let skillRank = 1; skillRank <= 10; skillRank++)
  test(`Aphrissa S${index + 1} rank ${skillRank} retains the exact selected table and SP costs`, () => {
    for (const potential of [1, 6]) for (const trust of [0, 200]) {
      const selected = select(build({skillId, skillRank, potential, trust}));
      assert.deepEqual(selected.source, evidence.tables.skills[skillId].levels[skillRank - 1]);
      assert.equal(selected.index, index);
      assert.equal(selected.source.spData.spType, 'INCREASE_WITH_TIME');
      assert.equal(selected.stats.baseAttackTime, 2.9);
      assert.deepEqual(Object.keys(selected.bb).sort(), selected.source.blackboard.map(row => row.key).sort());
    }
  });

test('Promotion, potential and trust preserve the printed stats and talent thresholds', () => {
  const low = select(build({elite: 0, level: 50, skillRank: 4}));
  const mid = select(build({elite: 1, level: 80, skillRank: 7}));
  const high = select(build({potential: 6, trust: 200}));
  assert.deepEqual([low.stats.maxHp, low.stats.atk, low.stats.def, low.stats.cost], [970, 567, 78, 31]);
  assert.deepEqual(low.talentBb, [{cnt: 1}]);
  assert.deepEqual(mid.talentBb, [{cnt: 1, atk: .15}]);
  assert.deepEqual([high.stats.maxHp, high.stats.atk, high.stats.def, high.stats.cost, high.stats.respawnTime], [1660, 1021, 128, 32, 66]);
  assert.deepEqual(high.talentBb, [{cnt: 1, atk: .25}, {magic_resist_penetrate_fixed: 13}]);
  assert.deepEqual(select(build()).talentBb[1], {magic_resist_penetrate_fixed: 10});
  assert.equal(low.rangeGrid.length, 5);
  assert.equal(mid.rangeGrid.length, 6);
});

test('Locked skills, unsupported modules and malformed builds reject before combat', () => {
  for (const more of [
    {elite: 0, level: 50, skillRank: 4, skillId: APHRISSA_SKILLS[1]},
    {elite: 1, level: 80, skillRank: 7, skillId: APHRISSA_SKILLS[2]},
    {elite: 0, level: 50, skillRank: 5}, {elite: 3}, {level: 91},
    {potential: 0}, {potential: 7}, {trust: 201}, {skillRank: 11},
    {skillId: 'invented'}, {module: 'aphris-x'},
  ]) assert.throws(() => select(build(more)));
  assert.throws(() => aphrissaSourceComponent('characters', ID, '0'), /Missing original/);
});

test('Normalized selected inputs refuse changed stats, skills, SP, ranges and talents', () => {
  const b = build(), selected = select(b);
  const fresh = () => ({rangeGrid: structuredClone(selected.rangeGrid), def: normalizeChess({
    chessId: ID, charId: ID, stats: selected.stats, rangeGrid: selected.rangeGrid,
    tags: selected.tags, talents: selected.talents,
    skill: {...selected.source, ...selected.source.spData, skillId: b.skillId, rangeGrid: selected.skillRangeGrid},
    arkpedia: b,
  })});
  assert.equal(selectedAphrissaInputs(fresh()).index, 0);
  for (const change of [
    unit => unit.def.stats.atk++, unit => unit.def.skill.bb.invented = 1,
    unit => unit.def.raw.arkpedia.skillId = APHRISSA_SKILLS[1],
    unit => unit.def.skill.spCost++, unit => unit.rangeGrid = [],
    unit => unit.def.talents[0].bb.cnt = 2,
  ]) {
    const unit = fresh(); change(unit);
    assert.throws(() => selectedAphrissaInputs(unit), /Incomplete original/);
  }
});

test('The six original modes distinguish ordinary, S1, S3, down-facing variants and S2', () => {
  const n = aphrissaNativeInputs();
  assert.deepEqual(n.root._modes.map(pointer => pointer.m_PathID), [
    '-1903225493074288546', '8687705486239719518', '-6689684376514797474',
    '-1025038833740619682', '-6037644826992189346', '8849245003997044830',
  ]);
  assert.equal(n.ordinary._damageType, 2);
  assert.equal(n.ordinary._waitForAttackEvent, 1);
  assert.equal(n.ordinary._selectTargetTiming, 3);
  assert.equal(n.ordinary._hitInterval, .05000000074505806);
  assert.equal(n.ordinaryRange._extendable, 1);
  assert.equal(n.ordinaryRange._infinite, 0);
  assert.equal(n.ordinaryRange._extendLengthEveryValidateChar, 2);
  assert.equal(n.ordinaryRelayValidator._targetId, TOKEN);
  assert.equal(n.ordinaryTarget._targetMotion, 3);
});

test('S2 uses a repeated time-driven Arts beam with an infinite ray selector', () => {
  const n = aphrissaNativeInputs();
  assert.equal(n.s2Beam._damageType, 2);
  assert.equal(n.s2Beam._waitForAttackEvent, 0);
  assert.equal(n.s2Beam._triggerDelta, .5);
  assert.equal(n.s2Beam._preDelay, .16699999570846558);
  assert.equal(n.s2Beam._postDelayChecker, .6669999957084656);
  assert.equal(n.s2Beam._allowNoTarget, 1);
  assert.equal(n.s2Beam._affectedBySlowDown, 0);
  assert.equal(n.s2Range._infinite, 1);
  assert.equal(n.s2Range._extendable, 0);
});

test('S3 preserves its charge sequence and source ammunition override instead of the prefab default', () => {
  const n = aphrissaNativeInputs(), selected = select(build({skillId: APHRISSA_SKILLS[2]}));
  assert.deepEqual(n.s3Sequence._abilities.map(p => p.m_PathID), ['-4303161870961327889', '-5427451279434235665']);
  assert.equal(n.s3Charge._durationKey, 'charge_time');
  assert.equal(selected.bb.charge_time, 3);
  assert.equal(selected.bb['attack@trigger_time'], 20);
  assert.equal(n.s3Counter._triggerTimeCount, 40);
  assert.deepEqual(n.s3Counter, {...n.s3DownCounter, m_GameObject: n.s3Counter.m_GameObject,
    _countEvent: n.s3Counter._countEvent});
  assert.equal(n.s3._showSpAsBulletMode, 1);
  assert.equal(n.s3Attack._damageType, 2);
  assert.equal(n.s3Attack._animKey, 'Skill_3_Loop');
  assert.equal(n.s3DownAttack._downAnimKey, 'Skill_Down_3_Loop');
});

test('The original relay needs a direction and does not consume a deployment slot', () => {
  const n = aphrissaNativeInputs();
  assert.equal(n.relayRoot._occupiedRemainingCharacterCnt, 0);
  assert.equal(n.relayRoot._buildCondition.needSpecifyDirection, 1);
  assert.equal(n.relayRoot._alwaysHideHp, 1);
  assert.deepEqual(Object.keys(evidence.models[TOKEN]), ['Single']);
  assert.deepEqual(Object.keys(evidence.models[TOKEN].Single.durations), ['Default', 'Die', 'Idle', 'Start']);
  assert.deepEqual(Object.keys(evidence.models[ID]), ['Front', 'Back']);
  assert.equal(evidence.models[ID].Back.durations.Die, undefined);
});
