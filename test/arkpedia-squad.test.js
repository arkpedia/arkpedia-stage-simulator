import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareSquad, maxedSupport, validateLoadout, canDeployInViewport } from '../shared/arkpedia/squad.js';

const definition = (id, maxElite = 2, maxLevel = 90) => ({
  id, promotions: Array.from({ length: maxElite + 1 }, (_, elite) => ({ elite, maxLevel: elite === maxElite ? maxLevel : 50 })),
  maxPotential: 6, maxTrust: 200, skills: [{ id: 's1', maxRankByElite: { 0: 4, 1: 7, 2: 10 } }],
  modules: maxElite === 2 ? [{ id: 'mod-x', maxStage: 3, unlockElite: 2, minLevel: 60 }] : [], skins: ['default']
});
const catalogue = Object.fromEntries(Array.from({ length: 14 }, (_, i) => [`char_${i}`, definition(`char_${i}`)]));
catalogue.char_low = definition('char_low', 1, 55);
catalogue.char_four = definition('char_four', 2, 70);
catalogue.char_robot = { ...definition('char_robot', 0, 30), skills: [] };
const build = (id = 'char_0') => ({ id, elite: 2, level: 90, potential: 1, trust: 0, skillId: 's1', skillRank: 10 });

test('12 squad slots plus support cannot become 13 ordinary squad slots', () => {
  const operators = Array.from({ length: 12 }, (_, i) => build(`char_${i}`));
  const result = prepareSquad({ operators, support: { id: 'char_12', skillId: 's1' } }, catalogue);
  assert.equal(result.operators.length, 12);
  assert.equal(result.support.id, 'char_12');
  assert.throws(() => prepareSquad({ operators: [...operators, build('char_13')] }, catalogue), /1–12/);
  assert.throws(() => prepareSquad({ operators: [] }, catalogue), /1–12/);
  assert.equal(prepareSquad({ operators: [build()] }, catalogue).support, null);
});

test('duplicates are rejected within squad and across support', () => {
  assert.throws(() => prepareSquad({ operators: [build(), build()] }, catalogue), /distinct/);
  assert.throws(() => prepareSquad({ operators: [build()], support: { id: 'char_0', skillId: 's1' } }, catalogue), /distinct/);
});

test('support maxima respect the operator, chosen skill and module', () => {
  const low = maxedSupport({ id: 'char_low', skillId: 's1' }, catalogue);
  assert.deepEqual([low.elite, low.level, low.skillRank, low.trust, low.potential], [1, 55, 7, 200, 6]);
  const four = maxedSupport({ id: 'char_four', skillId: 's1', moduleId: 'mod-x' }, catalogue);
  assert.equal(four.level, 70);
  assert.deepEqual(four.module, { id: 'mod-x', stage: 3 });
  assert.throws(() => maxedSupport({ id: 'char_low', skillId: 's1', moduleId: 'mod-x' }, catalogue), /Unavailable module/);
  assert.throws(() => maxedSupport({ id: 'char_0', skillId: 'missing' }, catalogue), /Unavailable skill/);
});

test('skill-less operators can also be selected as maxed support', () => {
  const support = maxedSupport({ id: 'char_robot' }, catalogue);
  assert.deepEqual([support.elite, support.level, support.skillId, support.skillRank], [0, 30, null, null]);
  assert.throws(() => maxedSupport({ id: 'char_robot', skillId: 'invented' }, catalogue), /no skills/);
  assert.equal(prepareSquad({ operators: [support] }, catalogue).operators[0].skillId, null);
});

test('impossible upgrades and missing module prerequisites are rejected', () => {
  for (const change of [{ level: 91 }, { level: NaN }, { potential: 0 }, { potential: 7 }, { trust: 201 }, { skillRank: 11 }, { elite: 3 }, { skinId: 'missing' }]) assert.throws(() => validateLoadout({ ...build(), ...change }, catalogue));
  assert.throws(() => validateLoadout({ ...build(), elite: 1, level: 50, skillRank: 10 }, catalogue), /skill rank/);
  assert.throws(() => validateLoadout({ ...build(), level: 59, module: { id: 'mod-x', stage: 1 } }, catalogue), /Unavailable module/);
  assert.throws(() => validateLoadout({ ...build(), module: { id: 'mod-x', stage: 4 } }, catalogue), /module stage/);
  assert.throws(() => validateLoadout(build('unknown'), catalogue), /Unknown operator/);
});

test('prepared squad copies data, strips supplied stats and freezes nested builds', () => {
  const input = { ...build(), atk: 999999, module: { id: 'mod-x', stage: 1 } };
  const result = prepareSquad({ operators: [input] }, catalogue);
  input.module.stage = 3;
  assert.equal(result.operators[0].module.stage, 1);
  assert.equal(result.operators[0].atk, undefined);
  assert.ok(Object.isFrozen(result.operators[0].module));
  assert.ok(Object.isFrozen(result.operators));
});

test('embedded, unknown and exited viewports cannot deploy', () => {
  for (const viewport of ['embedded', 'exited', 'unknown', null, undefined]) assert.equal(canDeployInViewport(viewport), false);
  assert.equal(canDeployInViewport('native-fullscreen'), true);
  assert.equal(canDeployInViewport('fullscreen-workspace'), true);
});
