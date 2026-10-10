// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import e from '../data/arkpedia-nymph-prefabs.json' with { type: 'json' };
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import { REGULAR_OPERATORS } from '../shared/arkpedia/operators.js';
const ID = 'char_4146_nymph';
const records = group => Object.values(group).flatMap(rows => rows.flatMap(row => row.components.map(c => c.data)));
function nodes(value, match, out = []) {
  if (value && typeof value === 'object') {
    if (!Array.isArray(value) && match(value)) out.push(value);
    for (const v of Object.values(value)) nodes(v, match, out);
  }
  return out;
}
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`);

test('Nymph whole kit is held; source preparation cannot turn on a partial S1/S3 adapter', () => {
  assert.deepEqual(e.enabledOperators, []); assert.deepEqual(e.runtimeMapping, {});
  assert.match(e.reviewStatus, /S2 animation-event consumption is unresolved/);
  assert.equal(REGULAR_OPERATORS[ID], undefined); assert.equal(data.operators[ID], undefined);
  assert.equal(e.frameParity, false); assert.equal(e.moduleSupport, false); assert.equal(e.nativeParticleSupport, false);
});
test('source closure retains all thirty ranks, twelve projectile trees and thirteen native templates', () => {
  assert.equal(Object.keys(e.tables.skills).length, 3);
  for (const s of Object.values(e.tables.skills)) assert.equal(s.levels.length, 10);
  assert.equal(Object.keys(e.projectiles).length, 12);
  assert.equal(Object.keys(e.templates).length, 13);
  assert.deepEqual(Object.keys(e.originalTemplates), Object.keys(e.templates));
  assert.deepEqual(e.nativeTemplateGaps, []);
  for (const row of e.source.bundles) {
    assert.match(row.md5, /^[a-f0-9]{32}$/); assert.match(row.sha256, /^[a-f0-9]{64}$/); assert.ok(row.size > 0);
  }
  assert.equal(e.source.bundles.length, 5);
});
for (const face of ['Front', 'Back']) test(`${face}: both original S2 events carry identical, non-disambiguating payloads`, () => {
  const m = e.models[ID][face], binding = e.officialSkeletonBindings[ID][face];
  assert.equal(binding.sha256, m.sha256); assert.equal(binding.byteLength, m.bytes);
  for (const key of ['animatorPathId', 'skeletonAnimationPathId', 'skeletonDataAssetPathId', 'textAssetPathId'])
    assert.match(binding[key], /^-?\d+$/);
  assert.deepEqual(m.hits.Skill_2, [.267, .467]);
  assert.equal(m.eventPayloads.Skill_2.length, 2);
  for (const payload of m.eventPayloads.Skill_2) {
    assert.equal(payload.name, 'OnAttack'); assert.equal(payload.int, 0); assert.equal(payload.float, 0); assert.equal(payload.string, '');
  }
  assert.deepEqual(m.hits.Attack, [.533]); assert.deepEqual(m.hits.Skill_3_Attack, [.533]);
});
test('one S2 Ranged ability retains source event wait, capped playback and invalid-target destination behavior', () => {
  const abilities = records({ skill: e.skills.skchr_nymph_2 }).filter(d => d._projectileKey);
  assert.equal(abilities.length, 1);
  const a = abilities[0]; assert.equal(a._projectileKey, 'projectile_chr_nymph_s2');
  assert.equal(a._waitForAttackEvent, 1); assert.equal(a._maxAnimScale, 1);
  assert.equal(a._emitToInputPosWhenTargetIsInvalid, 1); assert.equal(a._interuptIfTargetDead, 0);
});
test('S2 direct-on-reach and delayed stop splash remain separate; only the direct branch creates Fear', () => {
  const ds = records({ p: e.projectiles.projectile_chr_nymph_s2 });
  const motion = ds.find(d => d._speed != null); near(motion._speed, 10); near(motion._delayAfterReached, .33);
  assert.equal(motion._clearTraceTargetWhenReached, 1);
  const controller = ds.find(d => d._actionController)?._actionController;
  assert.ok(controller); assert.equal(controller._addExtraBuffsWhenReached, 1);
  assert.equal(controller._extraBuffsInTheEnd[0].buffKey, 'nymph_s_2[trace_taregt]');
  const collision = ds.find(d => d._exceptTraceTarget != null);
  assert.equal(collision._exceptTraceTarget, 0); assert.equal(collision._onlyCheckHitWhenStop, 1);
  assert.equal(collision._onlyCheckHitWhenReachTarget, 0);
  const directFear = nodes(e.templates['nymph_s_2[trace_taregt]'], n => n._buff?.buffKey === 'fear');
  assert.equal(directFear.length, 1); assert.equal(directFear[0]._buff.loadFromDB, true);
  assert.equal(nodes(e.templates['nymph_s_2[damage]'], n => n._buff?.buffKey === 'fear').length, 0);
  assert.ok(e.buffDatabase.fear);
});
test('Talent1 source listener waits .1s; its per-source DoT triggers immediately then every second', () => {
  const listener = nodes(e.templates.nymph_t_1, n => n._buff?.buffKey === 'nymph_t_1[listener]')[0];
  near(listener._buff.triggerInterval, .1); assert.equal(listener._buff.waitFirstTriggerInterval, true);
  assert.equal(listener._buff.disableOverride, true); assert.equal(listener._isDerivedBuff, true);
  assert.equal(listener._finishDerivedBuffIfParentFinish, true);
  for (const k of ['nymph_t_1[listener]', 'nymph_s_2']) {
    const dot = nodes(e.templates[k], n => n._buff?.buffKey === 'nymph_t_1[ep_damage]')[0]._buff;
    assert.equal(dot.independentCharacterSource, true); assert.equal(dot.waitFirstTriggerInterval, false);
    assert.equal(dot.triggerInterval, 1); assert.deepEqual(dot.priorityBBKeys, ['element_atk_scale']);
  }
  assert.ok(e.templates['nymph_t_1[ep_damage]'].eventToActions.ON_BEFORE_EP_BREAK_FINISH);
  assert.ok(e.templates['nymph_t_1[ep_damage]'].eventToActions.ON_BUFF_START);
});
test('Talent2 stack event is Necrosis recovery start rather than every elemental damage output', () => {
  assert.deepEqual(Object.keys(e.templates.nymph_t_2.eventToActions), ['ON_EP_BREAK_START', 'ON_BUFF_START']);
  const filters = nodes(e.templates.nymph_t_2, n => n._recoveryType != null);
  assert.equal(filters[0]._recoveryType, 'DARK');
  const stacks = nodes(e.templates.nymph_t_2, n => n._buff?.buffKey === 'nymph_t_2[atk]');
  assert.equal(stacks.length, 1); assert.equal(stacks[0]._buff.overrideType, 'STACK');
});
