import { test } from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import fixture from './fixtures/arkpedia-buff-templates.json' with { type: 'json' };
import evidence from '../data/arkpedia-skill-prefabs.json' with { type: 'json' };
import { compileBuffTemplate } from '../shared/arkpedia/behavior.js';
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { auditBehaviorTemplates } from '../tools/arkpedia/behavior-audit.mjs';

function battleFor(id = 'char_123_fang', rank = 7) {
  const isolated = structuredClone(data);
  isolated.stage.geometry.waves[0].spawns = [];
  const b = new StandardBattle(isolated, { operators: [{ ...defaultBuild(data.operators[id]), skillRank: rank }] });
  b.autoFinish = false;
  b.setViewport('fullscreen-workspace');
  b.flags.dpPerSec = 0;
  b.addDp('arkpedia', 40);
  return b;
}
const cost = () => structuredClone(fixture.templates.charge_cost);
const heal = () => structuredClone(fixture.templates['instant_heal[hp_ratio]']);
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`);

test('runtime DP template equals the pinned game fixture and verified prefab bindings', () => {
  assert.deepEqual(data.behaviors.templates.charge_cost, fixture.templates.charge_cost);
  assert.deepEqual(data.behaviors.source, fixture.source);
  assert.equal(evidence.templateTableSha256, fixture.source.sha256);
  assert.deepEqual(evidence.prefabs.skcom_charge_cost.buffTemplates, ['charge_cost']);
  assert.deepEqual(evidence.prefabs.skchr_wyvern_1.buffTemplates, ['charge_cost']);
  // Cardigan is a native ability, not this game's instant-heal buff template.
  assert.deepEqual(evidence.prefabs.skcom_heal_self.buffTemplates, []);
  assert.equal(evidence.prefabs.skcom_heal_self.nativeHeal[0]._isHpRatio, 1);
});

test('Fang and Vanilla use source DP values once per activation at every supported skill rank', () => {
  for (const id of ['char_123_fang', 'char_240_wyvern']) for (let rank = 1; rank <= 7; rank++) {
    const b = battleFor(id, rank), u = b.deployOperator(id, 2, 7, 'RIGHT');
    const expected = data.operators[id].skills[0].levels[rank - 1].blackboard.find(r => r.key === 'cost').value;
    const before = b.dp;
    u.skill.gainSp(u.skill.spCost, 'test');
    if (u.skill.manual) assert.equal(b.activateOperator(id), true);
    else b.step();
    near(b.dp, before + expected);
    assert.equal(u.skill.activations, 1);
    if (u.skill.manual) assert.equal(b.activateOperator(id), false);
    else b.step();
    near(b.dp, before + expected);
    assert.deepEqual(b.errors, []);
  }
});

test('DP actions use engine resource caps and source ownership', () => {
  const b = battleFor(), unit = b.deployOperator('char_123_fang', 2, 7, 'RIGHT');
  const program = compileBuffTemplate(cost());
  b.addDp(unit.ownerId, 100);
  program.run('ON_BUFF_START', { battle: b, unit, blackboard: { cost: 6 } });
  assert.equal(b.dp, 99);
  program.run('ON_BUFF_START', { battle: b, unit, blackboard: { cost: -200 } });
  assert.equal(b.dp, 0);
});

test('self-heal node uses talent-adjusted max HP, caps overheal and respects healing prohibition', () => {
  const b = battleFor('char_209_ardign'), unit = b.deployOperator('char_209_ardign', 2, 7, 'RIGHT');
  const program = compileBuffTemplate(heal());
  unit.hp = unit.s.maxHp * .1;
  program.run('ON_BUFF_START', { battle: b, unit, blackboard: { heal_scale: .4 } });
  near(unit.hp, unit.s.maxHp * .5);
  unit.hp = unit.s.maxHp - 1;
  program.run('ON_BUFF_START', { battle: b, unit, blackboard: { heal_scale: .4 } });
  near(unit.hp, unit.s.maxHp);
  b.addBuff(unit, { key: 'cannot-heal', flags: { healFree: true } });
  unit.hp = unit.s.maxHp * .1;
  program.run('ON_BUFF_START', { battle: b, unit, blackboard: { heal_scale: .4 } });
  near(unit.hp, unit.s.maxHp * .1);
});

test('unsupported nodes, events, field variants and metadata reject the whole template', () => {
  for (const mutate of [
    t => t.eventToActions.ON_BUFF_START.push({ $type: 'Torappu.Battle.Action.Nodes+CreateBuff, Assembly-CSharp' }),
    t => t.eventToActions.ON_BUFF_FINISH = [],
    t => t.eventToActions.ON_BUFF_START[0]._sourceType = 'TARGET',
    t => t.eventToActions.ON_BUFF_START[0]._forceToDisplayNumber = true,
    t => t.eventToActions.ON_BUFF_START[0].unreviewed = true,
    t => t.effectKey = 'unrendered-effect',
    t => t.onEventPriority = 'LOWER_PRIORITY',
  ]) {
    const t = cost(); mutate(t);
    assert.throws(() => compileBuffTemplate(t), /Unsupported behaviour/);
  }
});

test('missing or nonfinite operands reject before an earlier action mutates combat', () => {
  const t = cost();
  t.eventToActions.ON_BUFF_START.push(heal().eventToActions.ON_BUFF_START[0]);
  const program = compileBuffTemplate(t);
  const b = battleFor(), unit = b.deployOperator('char_123_fang', 2, 7, 'RIGHT'), before = b.dp;
  for (const blackboard of [{ cost: 6 }, { cost: 6, heal_scale: NaN }, { cost: 6, heal_scale: -1 },
    { cost: 6, heal_scale: Number.MAX_VALUE }, { cost: '6', heal_scale: .4 }]) {
    assert.throws(() => program.run('ON_BUFF_START', { battle: b, unit, blackboard }));
    near(b.dp, before);
  }
  assert.throws(() => program.run('ON_BUFF_START', {
    battle: b, unit, source: { ownerId: 'somebody-else' }, blackboard: { cost: 6, heal_scale: .4 },
  }), /owner\/source/);
  near(b.dp, before);
});

test('invalid live templates, prefab changes and blackboards fail before a battle starts', () => {
  for (const mutate of [
    d => delete d.behaviors.templates.charge_cost,
    d => d.behaviors.templates.charge_cost.templateKey = 'another-template',
    d => d.behaviors.templates.charge_cost.eventToActions.ON_BUFF_FINISH = [],
    d => d.operators.char_123_fang.skills[0].levels[6].prefabId = 'unknown',
    d => d.operators.char_123_fang.skills[0].levels[6].blackboard = [],
  ]) {
    const d = structuredClone(data); mutate(d);
    assert.throws(() => new StandardBattle(d, { operators: [defaultBuild(d.operators.char_123_fang)] }));
  }
});

test('audit counts nested unsupported actions separately and never enables an operator', () => {
  const unknown = cost(); unknown.templateKey = 'unknown';
  unknown.eventToActions.ON_BUFF_START = [{ $type: 'Torappu.Battle.Action.Nodes+IfElse, Assembly-CSharp',
    _succeedNodes: [cost().eventToActions.ON_BUFF_START[0]], _failNodes: [heal().eventToActions.ON_BUFF_START[0]] }];
  const report = auditBehaviorTemplates({ charge_cost: cost(), unknown }, { source: fixture.source, bindings: [] });
  assert.equal(report.summary.acceptedTemplatesWithActions, 1);
  assert.equal(report.summary.rejectedTemplates, 1);
  assert.equal(report.summary.actionTypes, 3);
  assert.equal(report.summary.boundPlayableOperators, 0);
  assert.ok(report.firstRejections.some(r => r.name.includes('IfElse')));
});
