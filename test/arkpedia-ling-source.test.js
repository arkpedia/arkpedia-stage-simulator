// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import e from '../data/arkpedia-ling-prefabs.json' with { type: 'json' };
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import { REGULAR_OPERATORS } from '../shared/arkpedia/operators.js';

const ID = 'char_2023_ling', tokens = [1, 2, 3].map(n => `token_10020_ling_soul${n}`);
const components = rows => rows.flatMap(r => r.components);
const component = (rows, id) => components(rows).find(c => c.pathId === id).data;
const bb = rows => Object.fromEntries(rows.map(r => [r.key, r.valueStr ?? r.value]));
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`);
const control = id => components(e.tokens[id]).find(c => c.data._buildCondition).data;
function nodes(value, wanted) {
  const found = [];
  function visit(v) {
    if (!v || typeof v !== 'object') return;
    if (wanted(v)) found.push(v);
    for (const [key, x] of Object.entries(v)) {
      if (key === 'SerializedState') visit(JSON.parse(x));
      else visit(x);
    }
  }
  visit(value); return found;
}
const action = (v, name) => nodes(v, n => n.$type?.split('+').at(-1).split(',')[0] === name);

test('Ling source stays held independently of playable coverage and frame claims', () => {
  assert.deepEqual(e.enabledOperators, []); assert.deepEqual(e.heldOperators, [ID]);
  assert.equal(REGULAR_OPERATORS[ID].mechanic, 'ling'); assert.equal(data.operators[ID].id, ID);
  for (const key of ['frameParity', 'moduleSupport', 'nativeParticleSupport']) assert.equal(e[key], false);
  assert.equal(e.source.commit, '57010cb5b2afea112cae57daa756b58676ba6850');
  assert.equal(e.source.nativeClient, '26-09-23-17-49-43_b9cc4a');
  assert.equal(e.source.modelCommit, 'd0b5af0b004b044d322397ce5ae79632b6d9fcdd');
  assert.equal(e.source.buffDatabase.gitBlob.sha, 'de9e0777610e3be81185ec45841f3e007b51ccbf');
});

test('source contains all sixty owner/token ranks and original dependency groups', () => {
  assert.deepEqual(Object.keys(e.tokens), tokens);
  assert.deepEqual(Object.keys(e.tables.tokens), tokens);
  assert.equal(e.source.bundles.length, 6);
  assert.deepEqual(Object.keys(e.tables.skills), [1, 2, 3].map(n => `skchr_ling_${n}`));
  assert.deepEqual(Object.keys(e.tables.tokenSkills), [1, 2, 3].map(n => `sktok_ling_soul${n}`));
  for (const s of [...Object.values(e.tables.skills), ...Object.values(e.tables.tokenSkills)]) assert.equal(s.levels.length, 10);
  assert.deepEqual(e.nativeTemplateGaps, []);
  assert.deepEqual(Object.keys(e.templates), Object.keys(e.originalTemplates));
  assert.equal(Object.keys(e.templates).length, 19); assert.equal(Object.keys(e.projectiles).length, 5);
  for (const group of ['characters', 'tokens', 'skills', 'projectiles']) for (const rs of Object.values(e[group])) {
    assert.equal(rs.length, new Set(rs.map(r => r.pathId)).size);
    for (const r of rs) for (const c of r.components) assert.equal(typeof c.pathId, 'string');
  }
});

test('dragon types retain separate terrain, facing, DP and redeployment time', () => {
  assert.deepEqual(tokens.map(id => control(id)._buildCondition.buildableType), [1, 2, 1]);
  assert.ok(tokens.every(id => control(id)._buildCondition.needSpecifyDirection === 1));
  assert.ok(tokens.every(id => control(id)._occupiedRemainingCharacterCnt === 1));
  const stats = tokens.map(id => e.tables.tokens[id].phases.at(-1).attributesKeyFrames.at(-1).data);
  assert.deepEqual(stats.map(s => s.cost), [12, 9, 23]);
  assert.deepEqual(stats.map(s => s.respawnTime), [10, 10, 20]);
  assert.deepEqual(stats.map(s => s.blockCnt), [1, 1, 2]);
});

test('native stock and deployed limits are additive selected-promotion attributes', () => {
  for (const id of tokens) for (const [phase, candidate] of e.tables.tokens[id].talents[0].candidates.entries()) {
    const b = bb(candidate.blackboard), base = e.tables.tokens[id].phases[phase].attributesKeyFrames[0].data;
    assert.equal(base.maxDeckStackCnt + b.max_deck_stack_cnt, phase + 3);
    assert.equal(base.maxDeployCount + b.max_deploy_count, 3);
  }
});

test('S1 dragon modes switch Physical attacks to Arts without changing the native hit event', () => {
  const rs = e.tokens[tokens[0]], ctrl = control(tokens[0]);
  const attacks = ctrl._modes.map(p => component(rs, component(rs, p.m_PathID)._attack.m_PathID));
  assert.deepEqual(attacks.map(a => a._damageType), [1, 2]);
  assert.ok(attacks.every(a => a._animKey === 'Attack' && a._maxAnimScale === 1 && a._waitForAttackEvent === 1));
  for (const rank of e.tables.skills.skchr_ling_1.levels) {
    const b = bb(rank.blackboard); assert.equal(rank.duration, 25); assert.equal(b.cnt, 1);
    assert.ok(b.atk > 0 && b.attack_speed > 0);
  }
});

test('S2 owner and dragon have separate two-target Arts selectors and skill clips', () => {
  const owner = component(e.skills.skchr_ling_2, '-4741658570178449012');
  const dragon = component(e.tokens[tokens[1]], '4772571023981460419');
  assert.equal(owner._animKey, 'Skill_2'); assert.equal(dragon._animKey, 'Skill');
  for (const [rs, a] of [[e.skills.skchr_ling_2, owner], [e.tokens[tokens[1]], dragon]]) {
    const selector = component(rs, a._selector.m_PathID);
    assert.equal(selector._maxNum, 2); assert.equal(selector._limitTargetNum, 1);
    assert.equal(a._damageType, 2); assert.equal(a._waitForAttackEvent, 1);
    assert.equal(a._activeBuffs[0].buffKey, 'ling_s2_unmovable');
    assert.deepEqual(a._activeBuffs[0].attributes.abnormalFlags, [13]);
  }
  assert.equal(dragon._metadata.blackboardPrefix, '2.');
  assert.equal(e.tables.skills.skchr_ling_2.levels.at(-1).spData.maxChargeTime, 2);
  for (const [rank, level] of e.tables.skills.skchr_ling_2.levels.entries()) {
    const t = bb(e.tables.tokenSkills.sktok_ling_soul2.levels[rank].blackboard), b = bb(level.blackboard);
    assert.equal(t['2.atk_scale'], b.atk_scale); assert.equal(t['2.duration'], b['ling_s2_unmovable.duration']);
  }
});

test('S2 checks strict low HP after its serialized delay and recharges only after withdrawal', () => {
  const recycle = component(e.skills.skchr_ling_2, '2679009538321527180');
  near(recycle._preDelay, 1.2);
  const sequence = JSON.parse(recycle._actions.SerializedState);
  assert.deepEqual(sequence.map(n => n.$type.split('+').at(-1)), ['FilterByTargetHpRatio', 'Withdraw', 'RechargeToken']);
  assert.equal(sequence[0]._condType, 'LT'); assert.equal(sequence[1]._force, true);
  assert.equal(sequence[2]._rechargeTiming, 'NORMAL');
  assert.ok(e.tables.skills.skchr_ling_2.levels.every(l => bb(l.blackboard).hp_ratio === .5));
});

test('S3 native modes preserve physical lower and Arts higher forms plus consumed form', () => {
  const rs = e.tokens[tokens[2]], ctrl = control(tokens[2]);
  assert.equal(ctrl._modes.length, 5);
  const attacks = ctrl._modes.slice(0, 4).map(p => component(rs, component(rs, p.m_PathID)._attack.m_PathID));
  assert.deepEqual(attacks.map(a => a._damageType), [1, 1, 2, 2]);
  for (const level of e.tables.tokenSkills.sktok_ling_soul3.levels) {
    const b = bb(level.blackboard);
    assert.deepEqual(b, { '2.max_hp': 1, '2.atk': .8, '2.def': .8, '2.magic_resistance': 1, '2.base_attack_time': .8, '2.block_cnt': 2 });
  }
});

test('fusion transfers deployment volume, restores HP and forcibly removes the absorbed dragon', () => {
  for (const suffix of ['self', 'another']) {
    const t = e.templates[`ling_soul3_evolution[${suffix}]`];
    assert.equal(action(t, 'TransferRemainingCharacterCntVolume').length, 1);
    const heal = action(t, 'HealViaMaxHpRatio')[0];
    assert.equal(heal._ignoreHealFree, true); assert.equal(heal._skipModifierEvent, true);
    assert.equal(action(t, 'CreateBuff').at(-1)._buff.templateKey, 'ling_soul3_evolution_die');
  }
  const mode = e.templates['ling_soul3_evolution[mode]'];
  assert.deepEqual(action(mode, 'SwitchMode').map(n => n._modeIndex), [2, 3]);
  const consumed = e.templates.ling_soul3_evolution_die;
  assert.equal(action(consumed, 'SwitchMode')[0]._modeIndex, 4);
  assert.equal(action(consumed, 'Withdraw')[0]._force, true);
});

test('S3 periodic damage reads Ling as source and the dragon as area centre', () => {
  const a = action(e.templates['ling_s3_aoe[token]'], 'AOEDamage')[0];
  assert.equal(a._sourceType, 'BUFF_SOURCE'); assert.equal(a._targetType, 'BUFF_OWNER');
  assert.equal(a._damageType, 'MAGICAL'); assert.equal(a._damageScale, 'atk_scale');
  assert.equal(a._useRadius, false); assert.equal(a._useDamageFromBB, false);
  assert.equal(e.tables.skills.skchr_ling_3.levels.at(-1).duration, 30);
  assert.equal(bb(e.tables.skills.skchr_ling_3.levels.at(-1).blackboard).interval, .5);
  assert.deepEqual(e.tables.ranges['x-5'].grids.map(g => [g.row, g.col]).sort(), [[-1, 0], [0, -1], [0, 0], [0, 1], [1, 0]].sort());
});

test('summon departure talent retains source SP trigger and capped stacking ATK buff', () => {
  const events = e.templates.ling_t.eventToActions;
  assert.deepEqual(Object.keys(events), ['ON_OWNER_KILLED']);
  const buffs = action(events, 'CreateBuff').map(n => n._buff);
  const sp = buffs.find(b => b.templateKey === 'modify_sp[trigger]');
  assert.equal(sp.isSilenceable, false); near(sp.triggerInterval, .1);
  const atk = buffs.find(b => b.buffKey === 'ling_atk_up');
  assert.equal(atk.overrideType, 'STACK'); assert.equal(atk.lifeTimeType, 'INFINITY');
  for (const c of e.tables.character.talents[1].candidates) assert.equal(bb(c.blackboard).max_stack_cnt, 5);
});

test('original projectile dependencies all retain source speed ten and uncached ordinary ATK', () => {
  for (const rs of Object.values(e.projectiles)) assert.equal(components(rs).find(c => c.data._speed !== undefined).data._speed, 10);
  const attacks = components(e.characters[ID]).filter(c => c.data._projectileKey);
  assert.deepEqual(attacks.map(c => c.data._projectileKey).sort(), ['projectile_chr_ling', 'projectile_chr_ling_s3']);
  assert.ok(attacks.every(c => c.data._useCachedAtkOnly === 0));
});

test('original owner and dragon events retain higher-form aliases and full-precision timings', () => {
  for (const face of ['Front', 'Back']) {
    near(e.models[ID][face].eventPayloads.Attack[0].time, .6);
    near(e.models[ID][face].eventPayloads.Skill_02[0].time, .5);
    assert.equal(e.officialSkeletonBindings[ID][face].sha256, e.models[ID][face].sha256);
  }
  for (const id of tokens) {
    near(e.tokenModels[id].eventPayloads.Attack[0].time, 11 / 30);
    assert.equal(e.officialTokenSkeletonBindings[id].sha256, e.tokenModels[id].sha256);
  }
  near(e.tokenModels[tokens[2]].eventPayloads.Attack_02[0].time, .5);
  near(e.tokenModels[tokens[2]].eventPayloads.Start_02[0].time, 8 / 30);
  const aliases = e.officialTokenSkeletonBindings[tokens[2]].animationAliases;
  assert.equal(aliases.find(a => a.animKey === 'Attack_2').animName, 'Attack_02');
  assert.equal(aliases.find(a => a.animKey === 'Born_2').animName, 'Start_02');
});
