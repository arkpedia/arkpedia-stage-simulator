// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import native from '../data/arkpedia-device-native-source.json' with { type: 'json' };
import { twigsDefinition, twigsNativeReviewed } from '../shared/arkpedia/stage-twigs.js';
import { makeBattle, chessRec } from './helpers/battleHarness.js';
import { addCorruptionField, corruptionZone } from '../server/sim/content/arkpedia-corruption.js';
import { compileTwigsInstance } from '../tools/arkpedia/stage-twigs.mjs';
const instance = { level: 1, skillLevel: 1, branchId: 'twig_route', actionIndex: 0, pollutionLow: 50, pollutionHigh: 25 };
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
