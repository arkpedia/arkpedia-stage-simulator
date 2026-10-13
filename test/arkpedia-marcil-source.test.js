// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import e from '../data/arkpedia-marcil-prefabs.json' with { type: 'json' };
import publicData from '../data/arkpedia-mvp.json' with { type: 'json' };
import { MARCIL_ID as ID, selectedMarcilBuild as select, marcilSourceComponent as component }
  from '../server/sim/content/arkpedia-marcil-source.js';
const build = (n = 1, rank = 10, elite = 2) => ({ elite, level: 1, potential: 1, trust: 0,
  skillId: `skchr_marcil_${n}`, skillRank: rank, module: 'none' });
const actions = (key, event) => e.templates[key].eventToActions[event];
const type = n => n.$type.split('+').at(-1).split(',')[0];

test('Marcille native evidence stays immutable and separate from public runtime review', () => {
  assert.deepEqual(e.enabledOperators, []); assert.deepEqual(e.heldOperators, [ID]);
  assert.equal(e.source.commit, publicData.sources[e.source.repository]);
  assert.equal(e.source.commit, '57010cb5b2afea112cae57daa756b58676ba6850');
  assert.equal(e.source.modelCommit, 'd0b5af0b004b044d322397ce5ae79632b6d9fcdd');
  assert.equal(e.source.nativeClient, '26-09-23-17-49-43_b9cc4a');
  assert.equal(e.source.bundles.length, 5);
  assert.equal(Object.keys(e.templates).length, 11);
  assert.equal(Object.keys(e.projectiles).length, 6);
  assert.equal(Object.values(e.characters).flat().concat(Object.values(e.skills).flat(),
    Object.values(e.projectiles).flat()).flatMap(r => r.components).length, 226);
  assert.deepEqual(e.nativeTemplateGaps, []);
  for (const key of ['frameParity', 'moduleSupport', 'nativeParticleSupport']) assert.equal(e[key], false);
  for (const face of ['Front', 'Back']) assert.equal(e.models[ID][face].sha256,
    e.officialSkeletonBindings[ID][face].sha256);
});

for (let n = 1; n <= 3; n++) for (let rank = 1; rank <= 10; rank++) {
  test(`selected S${n} rank ${rank} preserves original values and preprocesses the mana wallet`, () => {
    const s = select(build(n, rank));
    const original = e.tables.skills[`skchr_marcil_${n}`].levels[rank - 1];
    assert.equal(s.source, original);
    assert.deepEqual(s.bb, Object.fromEntries(original.blackboard.map(b => [b.key, b.value])));
    assert.equal(s.source.spData.increment, 0);
    assert.equal(s.source.durationType, 'NONE');
    assert.equal(s.mana.initial, s.bb.mana_init + 25);
    assert.equal(s.mana.maximum, s.bb.mana_max);
    assert.equal(s.mana.maximum, 80);
    assert.equal(s.mana.period, 1); assert.equal(s.mana.recovery, 1);
    assert.equal(s.source.skillType, n === 2 ? 'AUTO' : 'MANUAL');
    assert.equal(s.index, n - 1); assert.ok(s.tags.includes('laios'));
  });
}

test('promotion selects mana init and potential talent upgrades without applying E2 bonuses early', () => {
  for (const elite of [0, 1, 2]) {
    const s = select(build(1, 1, elite));
    assert.equal(s.mana.initial, s.bb.mana_init + (elite === 2 ? 25 : 0));
    assert.equal(s.talentBb[0].atk, elite === 0 ? .1 : .2);
    const improved = select({ ...build(1, 1, elite), potential: 3 });
    assert.equal(improved.talentBb[0].atk, elite === 0 ? .15 : .25);
  }
});

test('level, trust, ATK potential, deployment cost and redeployment potential are separate', () => {
  for (const elite of [0, 1, 2]) {
    const phase = e.tables.character.phases[elite];
    const s = select({ ...build(1, 1, elite), level: phase.maxLevel });
    assert.equal(s.stats.atk, phase.attributesKeyFrames.at(-1).data.atk);
    const full = select({ ...build(1, 1, elite), level: phase.maxLevel, trust: 200, potential: 6 });
    assert.equal(full.stats.atk, s.stats.atk + 110 + 34);
    assert.equal(full.stats.cost, s.stats.cost - 2);
    assert.equal(full.stats.respawnTime, s.stats.respawnTime - 6);
    assert.equal(select({ ...build(1, 1, elite), level: phase.maxLevel, trust: 100 }).stats.atk,
      full.stats.atk - 34);
  }
});

test('invalid levels, ranks, promotions, modules and locked skills are rejected', () => {
  for (const override of [{ elite: -1 }, { elite: 3 }, { level: 0 }, { level: 91 },
    { level: 1.5 }, { trust: 201 }, { trust: -1 }, { potential: 0 }, { potential: 7 },
    { skillRank: 11 }, { skillRank: 0 }, { elite: 0, skillRank: 5 },
    { elite: 1, skillRank: 8 }, { elite: 0, skillId: 'skchr_marcil_2', skillRank: 1 },
    { elite: 1, skillId: 'skchr_marcil_3', skillRank: 1 }, { module: 'real-module' },
    { skillId: 'unknown' }]) assert.throws(() => select({ ...build(), ...override }));
  assert.throws(() => select());
});

test('dummy mana storage has an authored period and the owner uses selected skill init/cap', () => {
  const dummy = component('5732173963253464043');
  assert.equal(dummy._period, 1); assert.equal(dummy._valueKey, 'mana');
  assert.equal(dummy._addKey, 'mana_add'); assert.equal(dummy._maxKey, 'mana_max');
  assert.equal(dummy._initKey, 'mana_init');
  const [init, cap] = component('3608541555110853611')._config;
  assert.equal(init._formulaType, 1); assert.equal(init._sourceTalentKey, '2');
  assert.equal(init._sourceKey, 'mana_init'); assert.equal(init._source2, 1);
  assert.equal(init._sourceKey2, 'mana_init'); assert.equal(init._targetTalentKey, '1');
  assert.equal(cap._formulaType, 0); assert.equal(cap._source, 1);
  assert.equal(cap._sourceKey, 'mana_max'); assert.equal(cap._targetKey, 'mana_max');
});

test('owner birth imports stored mana and normal owner finish preserves it', () => {
  const born = actions('marcil_t', 'ON_OWNER_BORN');
  assert.equal(type(born[0]), 'CopyCharacterSharedBlackboard');
  assert.equal(born[0]._blackboardKey, 'mana'); assert.equal(born[0]._copyToSharedBlackboard, false);
  assert.equal(born[3]._spCostString, 'mana_max');
  assert.equal(born[4]._spString, 'mana'); assert.equal(born[4]._forceFlag, true);
  const end = actions('marcil_t', 'ON_OWNER_FINISH');
  assert.equal(end[0]._conditionNode._var, 'clearSp');
  assert.equal(type(end[0]._succeedNodes[0]), 'AssignCurSpToBB');
  assert.equal(end[0]._succeedNodes[0]._blackboardKey, 'mana');
  assert.equal(end[0]._failNodes[0]._value, 0);
  assert.equal(end[2]._blackboardKey, 'mana'); assert.equal(end[2]._copyToSharedBlackboard, true);
});

test('only S3 extended chant is suspendable and dying there clears stored mana', () => {
  for (const id of ['-4309445818410409129', '-3189074972744565811', '-8242775219312524871']) {
    const c = component(id); assert.equal(c._suspendableWhenMainChant, 0);
    assert.equal(c._suspendableWhenExtraChant, id === '-8242775219312524871' ? 1 : 0);
  }
  const finish = actions('marcil_3_extra_chant', 'ON_BUFF_FINISH');
  assert.equal(type(finish[0]), 'CheckUnitAlive'); assert.equal(type(finish[1]), 'IfNot');
  assert.equal(finish[2]._blackboardKey, 'clearSp'); assert.equal(finish[2]._defaultValue, 1);
});

test('S1 charges attack or healing output and S2 charges successful late enable', () => {
  const output = actions('marcil_s_1', 'ON_OUTPUT_ATK_OR_HEAL');
  assert.equal(type(output[0]), 'ModifySp'); assert.equal(output[0]._spString, 'sp_cost');
  assert.equal(output[0]._isMinis, true); assert.equal(output[0]._forceFlag, true);
  assert.deepEqual(output[1]._buffKeys, ['marcil_t']);
  const start = actions('marcil_s_2', 'ON_BUFF_LATE_ENABLE')[0];
  assert.equal(start._spString, 'skill_cost_min_sp'); assert.equal(start._isMinis, true);
});

test('party talent uses squad membership rather than requiring all four on the field', () => {
  const c = component('-4543140451280208917');
  assert.equal(c._options.selector.filterTag, 'laios'); assert.equal(c._options.minCntToTrig, 4);
  assert.equal(c._options.selector.excludeNotInHand, 0);
  assert.equal(c._deckBuffs[0].buff.buffKey, 'marcil_t_2[laios]');
});

test('original Front and Back attack events remain distinct from chant durations', () => {
  for (const face of ['Front', 'Back']) {
    const m = e.models[ID][face];
    assert.equal(m.eventPayloads.Attack[0].time, .5);
    assert.equal(m.eventPayloads.Skill_2_Loop_A[0].time, .4333333373069763);
    assert.equal(m.eventPayloads.Skill_2_Loop_B[0].time, .4333333373069763);
    assert.equal(m.eventPayloads.Skill_3_Attack[0].time, .4000000059604645);
    assert.equal(m.durations.Skill_3_Chant, 2);
  }
});
