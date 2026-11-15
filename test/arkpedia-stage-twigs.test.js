// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import native from '../data/arkpedia-device-native-source.json' with { type: 'json' };
import { twigsDefinition, twigsNativeReviewed } from '../shared/arkpedia/stage-twigs.js';
import { makeBattle, chessRec } from './helpers/battleHarness.js';
import { addCorruptionField, corruptionZone } from '../server/sim/content/arkpedia-corruption.js';
import { compileTwigsInstance } from '../tools/arkpedia/stage-twigs.mjs';
import { installTwigs } from '../server/sim/content/arkpedia-stage-twigs.js';
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { loadContentContext, planStage } from '../tools/arkpedia/content-inventory.mjs';
const instance = { level: 1, skillLevel: 1, branchId: 'twig_route', actionIndex: 0, pollutionLow: 50, pollutionHigh: 25 };
function runtimeFixture() {
  const target = chessRec({ id: 'twig_runtime_target', stats: { atk: 0, maxHp: 100000 }, skill: null });
  const h = makeBattle({ content: 'none', autoFinish: false, defs: { chess: { [target.chessId]: target } },
    units: [{ chessId: target.chessId, row: 9, col: 6 }] });
  h.b.start(); const unit = h.b.spawnDevice('trap_086_larva', 9, 7, { side: 'enemy', hp: 40000, blockCnt: 0 });
  const summons = []; let progress = 0;
  h.b.stageBranches = { branches: { twig_route: { spawns: [{ order: 0 }] } },
    summon: (...args) => summons.push(args) };
  const state = installTwigs(h.b, unit, { ...twigsDefinition(instance), radius: 1.1 },
    { progress: () => progress, animation: { clip: 'Attack_A', duration: 1, release: Math.fround(1 / 3) } });
  return { ...h, unit, state, summons, target: h.b.allyUnits[0], progress: value => { progress = value; } };
}
test('Twigs low-HP mode is permanent, pulses use captured recipients and death summons once', () => {
  const f = runtimeFixture(), hits = []; f.b.on('elementHit', c => hits.push(c));
  f.unit.hp = 20000; f.run(.1); assert.equal(f.state.dark, false);
  f.unit.hp = 19999; f.run(.1); assert.equal(f.state.dark, true);
  f.unit.hp = 40000; f.run(4.1); assert.equal(f.state.dark, true); assert.equal(hits.length, 0);
  f.run(.4); assert.equal(hits.length, 1); assert.equal(hits[0].dmg.amount, 250);
  f.b.kill(f.unit); assert.equal(f.summons.length, 1); assert.equal(f.state.retired, true);
  assert.equal(f.target.findBuff('ab:corruption'), null);
  f.b.kill(f.unit); f.run(5); assert.equal(f.summons.length, 1); assert.equal(hits.length, 1);
  assert.deepEqual(f.b.errors, []);
});
test('Twigs progress checks hold final clearance until their managed death branch is released', () => {
  const f = runtimeFixture(); f.b.autoFinish = true; f.run(.2);
  assert.equal(f.b.finished, false); assert.equal(f.unit.alive, true);
  f.progress(1); f.run(.2); assert.equal(f.unit.alive, false);
  assert.deepEqual(f.summons, [['twig_route', 0]]); assert.equal(f.b.finished, true);
  assert.deepEqual(f.b.errors, []);
});
test('real chapter stages release full-strength uncounted Rot Eaters and wait for their removal', async () => {
  const context = await loadContentContext();
  for (const id of ['11-7', '11-8']) {
    const plan = await planStage(context, id, { waves: true }); assert.deepEqual(plan.blockers, []);
    const b = new StandardBattle({ ...context.mvp, stage: plan.stage,
      enemies: { ...context.mvp.enemies, ...plan.stage.enemies } },
    { operators: [defaultBuild(context.mvp.operators.char_123_fang)] });
    const children = [];
    b.on('enemySpawn', ({ enemy }) => {
      if (enemy.defId === 'enemy_1266_nhapos') {
        children.push(enemy); b.addBuff(enemy, { key: 'fixture:hold', flags: { noMove: true, disarm: true } });
      } else b.after(.05, () => b.kill(enemy));
    });
    b.start(); while (!b.finished && !children.length && b.time < 600) b.step();
    assert.equal(children.length, 1, id); const child = children[0];
    assert.equal(child.counted, false); assert.equal(child.mem.rotEaterBirthScale, 1);
    for (let i = 0; i < 30; i++) b.step();
    assert.equal(b.finished, false, 'the child holds final victory');
    assert.equal(b.killed, b.total);
    b.kill(child); b.step(); assert.equal(b.reason, 'cleared');
    assert.deepEqual(b.errors, []);
  }
});
test('original Twigs overrides normalize case, preserve defaults and bind the correct death route', () => {
  const p = { alias: 'twig', hidden: false, position: { row: 3, col: 4 },
    inst: { characterKey: 'trap_086_larva', level: 1, phase: 'PHASE_0', favorPoint: 0, potentialRank: 0 },
    skillIndex: 0, mainSkillLvl: 1,
    overrideSkillBlackboard: [{ key: 'branch_id', value: 0, valueStr: 'twig_route' },
      { key: 'Polluted_damage_low', value: 100, valueStr: null }] };
  const level = { branches: { twig_route: { phases: [{ preDelay: 0, actions: [{ actionType: 'SPAWN',
    managedByScheduler: true, key: 'enemy_1266_nhapos', count: 1, preDelay: 0, routeIndex: 0 }] }] } },
    extraRoutes: [{ startPosition: { row: 3, col: 4 } }] };
  assert.deepEqual(compileTwigsInstance(p, level), { ...instance, pollutionLow: 100 });
  for (const change of ['duplicate', 'unknown', 'missing-branch', 'wrong-route', 'wrong-enemy']) {
    const q = structuredClone(p), l = structuredClone(level);
    if (change === 'duplicate') q.overrideSkillBlackboard.push({ key: 'polluted_damage_low', value: 50 });
    if (change === 'unknown') q.overrideSkillBlackboard.push({ key: 'future_mechanic', value: 1 });
    if (change === 'missing-branch') delete l.branches.twig_route;
    if (change === 'wrong-route') l.extraRoutes[0].startPosition.row++;
    if (change === 'wrong-enemy') l.branches.twig_route.phases[0].actions[0].key = 'other';
    assert.throws(() => compileTwigsInstance(q, l), undefined, change);
  }
});
test('Twigs source preparation retains branch identity and rejects unknown instance values', () => {
  assert.equal(twigsNativeReviewed(), true);
  const spec = twigsDefinition(instance);
  assert.equal(spec.hp, 40000); assert.equal(spec.branchId, 'twig_route'); assert.equal(spec.element, 250);
  for (const change of [{ level: 31 }, { branchId: '' }, { actionIndex: -1 }, { pollutionLow: NaN }, { skillLevel: 2 }])
    assert.throws(() => twigsDefinition({ ...instance, ...change }));
  for (const kind of ['side', 'threshold', 'element', 'spawn']) {
    const ev = structuredClone(native);
    if (kind === 'side') ev.prefabs.trap_086_larva.components.find(c => '_sideType' in c.data).data._sideType = 1;
    if (kind === 'threshold') ev.prefabs.sktok_larva.components.find(c => '_maxHpRatio' in c.data).data._maxHpRatio = .75;
    if (kind === 'element') ev.templates.trap_larva_t_dark_damage.eventToActions.ON_BUFF_START[0]._noSource = true;
    if (kind === 'spawn') ev.templates['trap_larva_t[summon]'].eventToActions.ON_OWNER_KILLED[0]._managedByScheduler = false;
    assert.equal(twigsNativeReviewed(ev), false, kind);
  }
});
test('persistent and temporary pollution share one contact clock and remove only their own contributions', () => {
  const target = chessRec({ id: 'twig_field_target', stats: { atk: 0, maxHp: 10000 }, skill: null });
  const h = makeBattle({ content: 'none', autoFinish: false, defs: { chess: { [target.chessId]: target } },
    units: [{ chessId: target.chessId, row: 9, col: 6 }] });
  h.b.start(); const u = h.b.allyUnits[0];
  const remove = addCorruptionField(h.b, null, { low: 50, high: 25,
    contains: t => Math.round(t.y) === 9 && Math.round(t.x) === 6 });
  h.run(.8); assert.equal(u.hp, 10000);
  corruptionZone(h.b, null, 6, 9, 1, 4, 100, 50);
  h.run(.3); assert.equal(u.hp, 9950);
  remove(); h.run(1); assert.equal(u.hp, 9850);
  h.run(3); assert.equal(u.findBuff('ab:corruption'), null);
  assert.deepEqual(h.b.errors, []);
});
