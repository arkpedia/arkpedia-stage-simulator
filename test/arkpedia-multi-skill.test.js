// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { catalogueFor, defaultBuild, recordFor, availableSkills, skillRankCap, skillUnlockFor } from '../shared/arkpedia/loadout.js';
import { maxedSupport, validateLoadout } from '../shared/arkpedia/squad.js';

// Haze data from the pinned Global table 57010cb5b2afea112cae57daa756b58676ba6850.
// The compact fixture keeps source phase stats, unlock conditions and all ten rank blackboards.
const haze = {
  "id": "char_141_nights",
  "name": "Haze",
  "rarity": 4,
  "profession": "CASTER",
  "subProfessionId": "corecaster",
  "position": "RANGED",
  "phases": [
    {"maxLevel":45,"attributesKeyFrames":[{"level":1,"data":{"maxHp":619,"atk":253,"def":42,"magicResistance":10,"cost":17,"blockCnt":1,"moveSpeed":1,"attackSpeed":100,"baseAttackTime":1.6,"respawnTime":70,"hpRecoveryPerSec":0,"spRecoveryPerSec":1,"tauntLevel":0,"massLevel":0}},{"level":45,"data":{"maxHp":885,"atk":362,"def":71,"magicResistance":10,"cost":17,"blockCnt":1,"moveSpeed":1,"attackSpeed":100,"baseAttackTime":1.6,"respawnTime":70,"hpRecoveryPerSec":0,"spRecoveryPerSec":1,"tauntLevel":0,"massLevel":0}}],"rangeGrid":[[1,0],[1,1],[1,2],[0,0],[0,1],[0,2],[-1,0],[-1,1],[-1,2]]},
    {"maxLevel":60,"attributesKeyFrames":[{"level":1,"data":{"maxHp":885,"atk":362,"def":71,"magicResistance":15,"cost":19,"blockCnt":1,"moveSpeed":1,"attackSpeed":100,"baseAttackTime":1.6,"respawnTime":70,"hpRecoveryPerSec":0,"spRecoveryPerSec":1,"tauntLevel":0,"massLevel":0}},{"level":60,"data":{"maxHp":1150,"atk":483,"def":98,"magicResistance":15,"cost":19,"blockCnt":1,"moveSpeed":1,"attackSpeed":100,"baseAttackTime":1.6,"respawnTime":70,"hpRecoveryPerSec":0,"spRecoveryPerSec":1,"tauntLevel":0,"massLevel":0}}],"rangeGrid":[[1,0],[1,1],[1,2],[0,0],[0,1],[0,2],[0,3],[-1,0],[-1,1],[-1,2]]},
    {"maxLevel":70,"attributesKeyFrames":[{"level":1,"data":{"maxHp":1150,"atk":483,"def":98,"magicResistance":20,"cost":19,"blockCnt":1,"moveSpeed":1,"attackSpeed":100,"baseAttackTime":1.6,"respawnTime":70,"hpRecoveryPerSec":0,"spRecoveryPerSec":1,"tauntLevel":0,"massLevel":0}},{"level":70,"data":{"maxHp":1420,"atk":583,"def":110,"magicResistance":20,"cost":19,"blockCnt":1,"moveSpeed":1,"attackSpeed":100,"baseAttackTime":1.6,"respawnTime":70,"hpRecoveryPerSec":0,"spRecoveryPerSec":1,"tauntLevel":0,"massLevel":0}}],"rangeGrid":[[1,0],[1,1],[1,2],[0,0],[0,1],[0,2],[0,3],[-1,0],[-1,1],[-1,2]]}
  ],
  "favorKeyFrames": [
    {"level":0,"data":{"maxHp":0,"atk":0,"def":0}},
    {"level":50,"data":{"maxHp":0,"atk":60,"def":0}}
  ],
  "potentialRanks": [[{"attributeType":"COST","formulaItem":"ADDITION","value":-1,"loadFromBlackboard":false,"fetchBaseValueFromSourceEntity":false}],[{"attributeType":"RESPAWN_TIME","formulaItem":"ADDITION","value":-4,"loadFromBlackboard":false,"fetchBaseValueFromSourceEntity":false}],[{"attributeType":"MAX_HP","formulaItem":"ADDITION","value":100,"loadFromBlackboard":false,"fetchBaseValueFromSourceEntity":false}],[],[{"attributeType":"COST","formulaItem":"ADDITION","value":-1,"loadFromBlackboard":false,"fetchBaseValueFromSourceEntity":false}]],
  "talents": [
    {"candidates":[{"unlockCondition":{"phase":"PHASE_1","level":1},"requiredPotentialRank":0,"prefabKey":"1","name":"Black Mist","description":"Attacks reduce the target's RES by 10% for 1 second","rangeId":null,"blackboard":[{"key":"duration","value":1,"valueStr":null},{"key":"magic_resistance","value":-0.1,"valueStr":null}],"tokenKey":null,"isHideTalent":false},{"unlockCondition":{"phase":"PHASE_1","level":1},"requiredPotentialRank":4,"prefabKey":"1","name":"Black Mist","description":"Attacks reduce the target's RES by 13% <@ba.talpu>(+3%)</> for 1 second","rangeId":null,"blackboard":[{"key":"duration","value":1,"valueStr":null},{"key":"magic_resistance","value":-0.13,"valueStr":null}],"tokenKey":null,"isHideTalent":false},{"unlockCondition":{"phase":"PHASE_2","level":1},"requiredPotentialRank":0,"prefabKey":"1","name":"Black Mist","description":"Attacks reduce the target's RES by 20% for 1 second","rangeId":null,"blackboard":[{"key":"duration","value":1,"valueStr":null},{"key":"magic_resistance","value":-0.2,"valueStr":null}],"tokenKey":null,"isHideTalent":false},{"unlockCondition":{"phase":"PHASE_2","level":1},"requiredPotentialRank":4,"prefabKey":"1","name":"Black Mist","description":"Attacks reduce the target's RES by 23% <@ba.talpu>(+3%)</> for 1 second","rangeId":null,"blackboard":[{"key":"duration","value":1,"valueStr":null},{"key":"magic_resistance","value":-0.23,"valueStr":null}],"tokenKey":null,"isHideTalent":false}]}
  ],
  "skills": [
    {"id":"skcom_atk_up[2]","unlockCondition":{"phase":"PHASE_0","level":1},"levels":[{"name":"ATK Up β","skillType":"MANUAL","durationType":"NONE","duration":25,"spData":{"spType":"INCREASE_WITH_TIME","levelUpCost":null,"maxChargeTime":1,"spCost":40,"initSp":0,"increment":1},"blackboard":[{"key":"atk","value":0.2}]},{"name":"ATK Up β","skillType":"MANUAL","durationType":"NONE","duration":25,"spData":{"spType":"INCREASE_WITH_TIME","levelUpCost":null,"maxChargeTime":1,"spCost":40,"initSp":0,"increment":1},"blackboard":[{"key":"atk","value":0.25}]},{"name":"ATK Up β","skillType":"MANUAL","durationType":"NONE","duration":25,"spData":{"spType":"INCREASE_WITH_TIME","levelUpCost":null,"maxChargeTime":1,"spCost":40,"initSp":0,"increment":1},"blackboard":[{"key":"atk","value":0.3}]},{"name":"ATK Up β","skillType":"MANUAL","durationType":"NONE","duration":25,"spData":{"spType":"INCREASE_WITH_TIME","levelUpCost":null,"maxChargeTime":1,"spCost":37,"initSp":0,"increment":1},"blackboard":[{"key":"atk","value":0.35}]},{"name":"ATK Up β","skillType":"MANUAL","durationType":"NONE","duration":25,"spData":{"spType":"INCREASE_WITH_TIME","levelUpCost":null,"maxChargeTime":1,"spCost":37,"initSp":0,"increment":1},"blackboard":[{"key":"atk","value":0.4}]},{"name":"ATK Up β","skillType":"MANUAL","durationType":"NONE","duration":25,"spData":{"spType":"INCREASE_WITH_TIME","levelUpCost":null,"maxChargeTime":1,"spCost":37,"initSp":0,"increment":1},"blackboard":[{"key":"atk","value":0.45}]},{"name":"ATK Up β","skillType":"MANUAL","durationType":"NONE","duration":25,"spData":{"spType":"INCREASE_WITH_TIME","levelUpCost":null,"maxChargeTime":1,"spCost":37,"initSp":5,"increment":1},"blackboard":[{"key":"atk","value":0.5}]},{"name":"ATK Up β","skillType":"MANUAL","durationType":"NONE","duration":25,"spData":{"spType":"INCREASE_WITH_TIME","levelUpCost":null,"maxChargeTime":1,"spCost":37,"initSp":5,"increment":1},"blackboard":[{"key":"atk","value":0.6}]},{"name":"ATK Up β","skillType":"MANUAL","durationType":"NONE","duration":25,"spData":{"spType":"INCREASE_WITH_TIME","levelUpCost":null,"maxChargeTime":1,"spCost":37,"initSp":5,"increment":1},"blackboard":[{"key":"atk","value":0.7}]},{"name":"ATK Up β","skillType":"MANUAL","durationType":"NONE","duration":25,"spData":{"spType":"INCREASE_WITH_TIME","levelUpCost":null,"maxChargeTime":1,"spCost":35,"initSp":10,"increment":1},"blackboard":[{"key":"atk","value":0.8}]}]},
    {"id":"skchr_nights_2","unlockCondition":{"phase":"PHASE_1","level":1},"levels":[{"name":"Crimson Eyes","skillType":"MANUAL","durationType":"NONE","duration":25,"spData":{"spType":"INCREASE_WITH_TIME","levelUpCost":null,"maxChargeTime":1,"spCost":35,"initSp":0,"increment":1},"blackboard":[{"key":"attack_speed","value":35},{"key":"atk","value":0.15},{"key":"max_hp","value":-0.75}]},{"name":"Crimson Eyes","skillType":"MANUAL","durationType":"NONE","duration":25,"spData":{"spType":"INCREASE_WITH_TIME","levelUpCost":null,"maxChargeTime":1,"spCost":35,"initSp":0,"increment":1},"blackboard":[{"key":"attack_speed","value":35},{"key":"atk","value":0.2},{"key":"max_hp","value":-0.75}]},{"name":"Crimson Eyes","skillType":"MANUAL","durationType":"NONE","duration":25,"spData":{"spType":"INCREASE_WITH_TIME","levelUpCost":null,"maxChargeTime":1,"spCost":35,"initSp":0,"increment":1},"blackboard":[{"key":"attack_speed","value":35},{"key":"atk","value":0.25},{"key":"max_hp","value":-0.75}]},{"name":"Crimson Eyes","skillType":"MANUAL","durationType":"NONE","duration":25,"spData":{"spType":"INCREASE_WITH_TIME","levelUpCost":null,"maxChargeTime":1,"spCost":35,"initSp":0,"increment":1},"blackboard":[{"key":"attack_speed","value":40},{"key":"atk","value":0.3},{"key":"max_hp","value":-0.75}]},{"name":"Crimson Eyes","skillType":"MANUAL","durationType":"NONE","duration":25,"spData":{"spType":"INCREASE_WITH_TIME","levelUpCost":null,"maxChargeTime":1,"spCost":35,"initSp":0,"increment":1},"blackboard":[{"key":"attack_speed","value":40},{"key":"atk","value":0.35},{"key":"max_hp","value":-0.75}]},{"name":"Crimson Eyes","skillType":"MANUAL","durationType":"NONE","duration":25,"spData":{"spType":"INCREASE_WITH_TIME","levelUpCost":null,"maxChargeTime":1,"spCost":35,"initSp":0,"increment":1},"blackboard":[{"key":"attack_speed","value":40},{"key":"atk","value":0.4},{"key":"max_hp","value":-0.75}]},{"name":"Crimson Eyes","skillType":"MANUAL","durationType":"NONE","duration":25,"spData":{"spType":"INCREASE_WITH_TIME","levelUpCost":null,"maxChargeTime":1,"spCost":30,"initSp":0,"increment":1},"blackboard":[{"key":"attack_speed","value":45},{"key":"atk","value":0.45},{"key":"max_hp","value":-0.75}]},{"name":"Crimson Eyes","skillType":"MANUAL","durationType":"NONE","duration":25,"spData":{"spType":"INCREASE_WITH_TIME","levelUpCost":null,"maxChargeTime":1,"spCost":30,"initSp":0,"increment":1},"blackboard":[{"key":"attack_speed","value":50},{"key":"atk","value":0.5},{"key":"max_hp","value":-0.75}]},{"name":"Crimson Eyes","skillType":"MANUAL","durationType":"NONE","duration":25,"spData":{"spType":"INCREASE_WITH_TIME","levelUpCost":null,"maxChargeTime":1,"spCost":30,"initSp":0,"increment":1},"blackboard":[{"key":"attack_speed","value":55},{"key":"atk","value":0.55},{"key":"max_hp","value":-0.75}]},{"name":"Crimson Eyes","skillType":"MANUAL","durationType":"NONE","duration":25,"spData":{"spType":"INCREASE_WITH_TIME","levelUpCost":null,"maxChargeTime":1,"spCost":25,"initSp":0,"increment":1},"blackboard":[{"key":"attack_speed","value":60},{"key":"atk","value":0.6},{"key":"max_hp","value":-0.75}]}]}
  ]
};

const source = () => ({ operators: { [haze.id]: structuredClone(haze) } });
const build = (patch = {}) => ({ ...defaultBuild(haze), ...patch });

 test('higher rarity default builds use the first selected skill at the source E2 M3 cap', () => {
  assert.deepEqual(defaultBuild(haze), {
    id: haze.id, elite: 2, level: 70, potential: 1, trust: 0,
    skillId: 'skcom_atk_up[2]', skillRank: 10,
  });
  assert.deepEqual(availableSkills(haze, 0, 45).map((skill) => skill.id), ['skcom_atk_up[2]']);
  assert.deepEqual(availableSkills(haze, 1, 1).map((skill) => skill.id), ['skcom_atk_up[2]', 'skchr_nights_2']);
  for (const [elite, expected] of [[0, 4], [1, 7], [2, 10]])
    for (const skill of haze.skills) assert.equal(skillRankCap(haze, skill.id, elite), expected);
  assert.equal(skillRankCap(haze, 'fabricated', 2), 0);
});

test('skill unlocks require the correct promotion and source level, with later promotions retaining access', () => {
  const data = source();
  data.operators[haze.id].skills[1].unlockCondition.level = 20;
  const catalogue = catalogueFor(data);
  const second = build({ skillId: 'skchr_nights_2', elite: 1, level: 19, skillRank: 7 });
  assert.throws(() => validateLoadout(second, catalogue), /Unavailable skill/);
  assert.throws(() => validateLoadout({ ...second, elite: 0, level: 45, skillRank: 4 }, catalogue), /Unavailable skill/);
  assert.equal(validateLoadout({ ...second, level: 20 }, catalogue).skillId, 'skchr_nights_2');
  assert.equal(validateLoadout({ ...second, elite: 2, level: 1, skillRank: 10 }, catalogue).skillRank, 10);
});

test('source-backed skill ranks reject fabricated mastery, locked skills and unavailable promotions', () => {
  const catalogue = catalogueFor(source());
  for (const patch of [
    { skillRank: 11 }, { elite: 1, level: 60, skillRank: 8 },
    { elite: 0, level: 45, skillRank: 5 },
    { elite: 0, level: 45, skillId: 'skchr_nights_2', skillRank: 4 },
    { skillId: 'fake-skill' }, { elite: 3 },
  ]) assert.throws(() => validateLoadout(build(patch), catalogue), /skill|promotion/);
  for (const [elite, level, skillRank] of [[0, 45, 4], [1, 60, 7], [2, 70, 10]])
    assert.equal(validateLoadout(build({ elite, level, skillRank }), catalogue).skillRank, skillRank);
});

test('selected S2 resolves its own source skill rank and blackboard rather than S1', () => {
  const data = source();
  const s1 = recordFor(build(), data);
  const s2 = recordFor(build({ skillId: 'skchr_nights_2' }), data);
  assert.equal(s1.skill.name, 'ATK Up β');
  assert.equal(s2.skill.name, 'Crimson Eyes');
  assert.equal(s1.skill.skillId, 'skcom_atk_up[2]');
  assert.equal(s2.skill.skillId, 'skchr_nights_2');
  assert.equal(s1.skill.bb.atk, .8);
  assert.deepEqual(s2.skill.bb, { attack_speed: 60, atk: .6, max_hp: -.75 });
  assert.equal(s2.arkpedia.elite, 2);
  assert.equal(s2.arkpedia.skillRank, 10);
  assert.equal(s2.stats.atk, haze.phases[2].attributesKeyFrames.at(-1).data.atk);
  assert.throws(() => recordFor(build({ skillId: 'fake-skill' }), data), /Unavailable skill/);
});

test('maxed support keeps the chosen second skill, using M3 independently of the ordinary squad build', () => {
  const catalogue = catalogueFor(source());
  const support = maxedSupport({ id: haze.id, skillId: 'skchr_nights_2' }, catalogue);
  assert.deepEqual(support, {
    id: haze.id, elite: 2, level: 70, potential: 6, trust: 200,
    skillId: 'skchr_nights_2', skillRank: 10,
  });
  const record = recordFor(support, source());
  assert.equal(record.skill.name, 'Crimson Eyes');
  const atk = haze.phases[2].attributesKeyFrames.at(-1).data.atk
    + haze.favorKeyFrames.at(-1).data.atk
    + haze.potentialRanks.flat().filter((mod) => mod.attributeType === 'ATK').reduce((n, mod) => n + mod.value, 0);
  assert.equal(record.stats.atk, atk);
  assert.throws(() => maxedSupport({ id: haze.id, skillId: 'fabricated-s3' }, catalogue), /Unavailable skill/);
});

test('missing or malformed unlock metadata fails closed for a multi-skill operator', () => {
  const op = structuredClone(haze);
  delete op.skills[1].unlockCondition;
  assert.throws(() => availableSkills(op, 2, 70), /Missing skill unlock/);
  assert.throws(() => catalogueFor({ operators: { [op.id]: op } }), /Missing skill unlock/);
  for (const unlockCondition of [{ phase: 'PHASE_7', level: 1 }, { phase: 'PHASE_1', level: 0 }, { phase: 'PHASE_1', level: 1.5 }])
    assert.throws(() => skillUnlockFor({ id: 'invalid', unlockCondition }), /Invalid skill unlock/);
});

test('rank caps cannot exceed the number of ranks actually included in the pinned source', () => {
  const data = source();
  data.operators[haze.id].skills[1].levels = data.operators[haze.id].skills[1].levels.slice(0, 7);
  assert.equal(skillRankCap(data.operators[haze.id], 'skchr_nights_2', 2), 7);
  const catalogue = catalogueFor(data);
  assert.throws(() => validateLoadout(build({ skillId: 'skchr_nights_2', skillRank: 8 }), catalogue), /skill rank/);
  assert.equal(maxedSupport({ id: haze.id, skillId: 'skchr_nights_2' }, catalogue).skillRank, 7);
});
