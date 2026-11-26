// SPDX-License-Identifier: GPL-3.0-or-later
// A preset operator's module (shared/arkpedia/predefined-modules.js): Logos's CCR-Δ stage 3 in 14-11 and 14-20.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import mvp from '../data/arkpedia-mvp.json' with { type: 'json' };
import source from '../data/arkpedia-predefined-module-source.json' with { type: 'json' };
import { LOGOS, LOGOS_MODULE, logosModuleReviewed, predefinedModuleDefinition } from '../shared/arkpedia/predefined-modules.js';
import { withPredefinedModule } from '../shared/arkpedia/predefined-module-record.js';
import { dirname, resolve } from 'node:path';
import { compilePredefinedOperators } from '../tools/arkpedia/stage-predefined-operators.mjs';
import { createStageLibraryLoader } from '../shared/arkpedia/stage-library.js';
import { defaultBuild, recordFor } from '../shared/arkpedia/loadout.js';
import { StandardBattle } from '../server/sim/arkpedia.js';
import { elementIntake } from '../server/sim/damage.js';

const manifest = JSON.parse(await readFile(new URL('../data/arkpedia-library.json', import.meta.url)));
const loader = createStageLibraryLoader(async url => new Response(await readFile(new URL(`..${url}`, import.meta.url))));
const load = id => { const entry = manifest.stages.find(s => s.id === id); assert.equal(entry?.availability, 'available', id); return loader.load(entry); };
const clone = v => JSON.parse(JSON.stringify(v));
const until = (b, pred, limit) => { while (!b.finished && b.time < limit && !pred()) b.step(); return pred(); };
const BUILD = { id: LOGOS, elite: 2, level: 90, potential: 1, trust: 4, skillId: 'skchr_logos_1', skillRank: 10 };
/** 14-11 with every wave enemy removed as it appears. */
const quiet = async () => {
  const stage = await load('14-11');
  const b = new StandardBattle({ ...mvp, stage, enemies: { ...mvp.enemies, ...stage.enemies } },
    { operators: [defaultBuild(mvp.operators.char_151_myrtle)] }, { seed: 1 });
  b.life = 999; b.autoFinish = false;
  b.on('enemySpawn', ({ enemy }) => { if (!enemy.mem.test) b.after(0, () => enemy.alive && !enemy.mem.test && b._remove(enemy, 'withdraw', null, true)); });
  b.step();
  return b;
};
const dummy = (b, pos) => {
  const e = b.spawnEnemy('enemy_1422_lrsldr', { pos, routeClock: { wave: 0, fragment: 0 } }); e.mem.test = true;
  b.addBuff(e, { key: 'test:hold', persist: true, flags: { noMove: true, disarm: true } });
  e.base.maxHp = 1e9; e.markDirty(); e.hp = e.s.maxHp = 1e9; // base too: Logos's S1 executes low-HP enemies
  return e;
};

test('the Logos module is reviewed; changed numbers, parts and template steps are refused', () => {
  assert.equal(logosModuleReviewed(), true);
  const part = (e, i) => e.modules[LOGOS_MODULE].battle.phases[2].parts[i];
  const cases = {
    'a stronger trait': e => { part(e, 1).addOrOverrideTalentDataBundle.candidates[0].blackboard[0].value = .16; },
    'a likelier shot': e => { part(e, 2).addOrOverrideTalentDataBundle.candidates[0].blackboard[0].value = .8; },
    'more ATK': e => { e.modules[LOGOS_MODULE].battle.phases[2].attributeBlackboard[1].value = 100; },
    'another owner': e => { e.modules[LOGOS_MODULE].equip.charId = 'char_2015_dusk'; },
    'a Physical trait filter': e => { e.templates.logos_e_002_tr.eventToActions.ON_AFTER_OUTPUT_DAMAGE[2]._damageMask = 'PHYSICAL'; },
    'a scaled fixed injury': e => { e.templates.logos_e_002_tr.eventToActions.ON_AFTER_OUTPUT_DAMAGE[5]._fixedEpDamageScale = 'ep_damage_ratio'; },
    'no burst condition': e => { e.templates.logos_e_002_t_1.eventToActions.ON_ABILITY_CAST_ON_TARGET[2]._actions.splice(1, 1); },
    'another talent buff': e => { e.prefabs.logos_equip_1_3_p2.components.find(c => c.data._buffs).data._buffs[0].templateKey = 'logos_t_1'; },
  };
  for (const [name, change] of Object.entries(cases)) { const e = clone(source); change(e); assert.equal(logosModuleReviewed(e), false, name); }
});

test('only the reviewed module, stage and build are accepted; the record gains its attributes and talent', () => {
  const definition = predefinedModuleDefinition({ id: LOGOS_MODULE, stage: 3 }, BUILD);
  assert.deepEqual(definition.stats, { maxHp: 170, atk: 67 });
  assert.deepEqual(definition.talent.bb, { prob: .6, atk_scale: .6, sluggish: .8, element_atk_scale: .6 });
  assert.equal(predefinedModuleDefinition({ id: LOGOS_MODULE, stage: 3 }, { ...BUILD, potential: 5 }).talent.bb.atk_scale, .65);
  for (const [module, build] of [[{ id: LOGOS_MODULE, stage: 2 }, BUILD], [{ id: 'uniequip_003_logos', stage: 3 }, BUILD],
    [{ id: LOGOS_MODULE, stage: 3 }, { ...BUILD, elite: 1, level: 80 }], [{ id: LOGOS_MODULE, stage: 3 }, { ...BUILD, level: 59 }],
    [{ id: LOGOS_MODULE, stage: 3 }, { ...BUILD, id: 'char_2015_dusk' }]])
    assert.throws(() => predefinedModuleDefinition(module, build), /Unsupported predefined operator module/);
  // A player's Logos has no module: the base talent and no trait.
  const plain = recordFor(BUILD, mvp), worn = withPredefinedModule(plain, definition);
  assert.deepEqual([plain.talents[0].bb.prob, plain.talents[0].bb.element_atk_scale, plain.module], [.4, undefined, undefined]);
  assert.deepEqual([worn.stats.maxHp - plain.stats.maxHp, worn.stats.atk - plain.stats.atk], [170, 67]);
  assert.equal(worn.module.epDamageRatio, .08);
  assert.equal(plain.stats.atk, recordFor(BUILD, mvp).stats.atk, 'the input record is not changed');
  for (const bad of [{ ...definition, operator: 'char_2015_dusk' }, { ...definition, epDamageRatio: 2 }, { ...definition, element: 'burn' },
    { ...definition, stats: { maxHp: 170 } }, { ...definition, talent: { ...definition.talent, index: 5 } }, null])
    assert.throws(() => withPredefinedModule(plain, bad), /Invalid predefined operator module/);
});

test('the battle import graph excludes the module review and its source data', async () => {
  const visited = new Set();
  async function visit(path) {
    if (visited.has(path)) return; visited.add(path);
    assert.ok(!path.endsWith('arkpedia-predefined-module-source.json') && !path.endsWith('predefined-modules.js'), path);
    const text = await readFile(path, 'utf8'); if (path.endsWith('.json')) return;
    for (const match of text.matchAll(/\b(?:import|export)\s+(?:[^'";]*?\s+from\s*)?["']([^"']+)["']/g))
      if (match[1].startsWith('.')) await visit(resolve(dirname(path), match[1]));
  }
  await visit(resolve('server/sim/arkpedia.js'));
  assert.ok(visited.has(resolve('shared/arkpedia/predefined-module-record.js')));
});

test('the compiler carries the module on the preset entry and refuses any other', async () => {
  for (const id of ['14-11', '14-11_adverse_environment']) {
    const entries = (await load(id)).waveProgram.predefined.entries;
    assert.deepEqual(entries.map(e => [e.key, e.module]), [[LOGOS, predefinedModuleDefinition({ id: LOGOS_MODULE, stage: 3 }, BUILD)]], id);
  }
  const inst = uniEquipIds => ({ predefines: { characterInsts: [{ position: { row: 0, col: 0 }, direction: 'LEFT', hidden: false, alias: null,
    uniEquipIds, masterInfos: null, inst: { characterKey: LOGOS, level: 90, phase: 'PHASE_2', favorPoint: 50, potentialRank: 0 },
    skillIndex: 0, mainSkillLvl: 10, tmplId: null, overrideSkillBlackboard: null, overrideTalents: null }] }, options: { isTrainingLevel: false }, waves: [] });
  const compile = uniEquipIds => compilePredefinedOperators(inst(uniEquipIds), { rows: 2, cols: 2 }, mvp.operators);
  assert.deepEqual(compile([{ key: LOGOS_MODULE, level: 3 }]).entries[0].module, predefinedModuleDefinition({ id: LOGOS_MODULE, stage: 3 }, BUILD));
  assert.equal(compile(null).entries[0].module, undefined);
  for (const worn of [[{ key: LOGOS_MODULE, level: 2 }], [{ key: 'uniequip_003_logos', level: 3 }],
    [{ key: LOGOS_MODULE, level: 3 }, { key: 'uniequip_003_logos', level: 3 }]])
    assert.throws(() => compile(worn), /Unsupported predefined operator override: char_4133_logos/);
});

test('14-11: Logos wears the module; each Arts damage adds 8% as Necrosis injury, and the talent adds Elemental damage only during the burst', async () => {
  const b = await quiet(), u = b.bench[LOGOS].unit;
  assert.ok(u?.alive);
  const plain = recordFor(BUILD, mvp);
  assert.deepEqual([u.s.maxHp, u.base.atk], [plain.stats.maxHp + 170, plain.stats.atk + 67]);
  assert.equal(u.def.talents[0].bb.prob, .6);
  const e = dummy(b, [3, 4]);
  const events = [];
  b.on('damaged', ({ source, target, amount, type, dmg }) => { if (source === u && target === e)
    events.push({ type, amount, raw: dmg?.amount, tags: dmg?.tags ?? [], locked: !!e.findBuff('apoptosisBurst'), time: b.time }); });
  assert.ok(until(b, () => events.filter(x => x.type === 'arts').length >= 6, 60));
  // Before the burst every Arts damage carries one injury of 8% of it (a listener added after the trait's sees the
  // nested injury first); no Elemental damage yet.
  assert.equal(events.some(x => x.type === 'elemental'), false);
  const intake = elementIntake(e), arts = events.filter(x => x.type === 'arts'), injuries = events.filter(x => x.type === 'element');
  assert.equal(injuries.length, arts.length);
  assert.ok(arts.some(x => x.tags.includes('logos:lexical')) && arts.some(x => !x.tags.includes('logos:lexical')), 'attacks and talent shots');
  for (const [i, hit] of arts.entries()) {
    assert.ok(injuries[i].tags.includes('logos:module-trait') && injuries[i].time === hit.time);
    assert.ok(Math.abs(injuries[i].amount - hit.amount * .08 * intake) < 1e-6, `${injuries[i].amount} vs ${hit.amount}`);
  }
  assert.ok(Math.abs(e.elem.apoptosis - injuries.reduce((sum, x) => sum + x.amount, 0)) < 1e-6, 'the Necrosis gauge holds the injuries');
  // Fill the gauge: the next injury bursts it. During the burst lexical shots add Elemental damage of ATK x0.6.
  e.elem.apoptosis = e.gaugeMax - .001;
  assert.ok(until(b, () => !!e.findBuff('apoptosisBurst'), b.time + 10));
  const from = events.length, burstAt = b.time;
  assert.ok(until(b, () => !e.findBuff('apoptosisBurst'), burstAt + 20));
  const during = events.slice(from).filter(x => x.type === 'elemental' && x.tags.includes('logos:lexical-elemental'));
  assert.ok(during.length >= 2, `${during.length} elemental hits`);
  for (const hit of events.slice(from)) if (hit.tags.includes('logos:lexical-elemental')) {
    const prior = events[events.indexOf(hit) - 1];
    assert.ok(prior.type === 'arts' && prior.tags.includes('logos:lexical'), 'after the shot\'s Arts damage');
    // Both use the ATK cached when the shot was emitted, x0.6; Requiem Aeternam adds 150 to the Arts damage only.
    assert.ok([0, 150].some(mark => Math.abs(prior.raw - mark - hit.raw) < 1e-6), `${hit.raw} vs ${prior.raw}`);
    assert.ok(hit.raw > 400);
  }
  assert.equal(events.slice(from).some(x => x.type === 'element' && x.locked), false, 'no injury while the burst runs');
  // After the burst, shots stop adding Elemental damage.
  const after = events.length;
  until(b, () => events.slice(after).filter(x => x.tags.includes('logos:lexical')).length >= 3, b.time + 30);
  assert.ok(events.slice(after).filter(x => x.tags.includes('logos:lexical')).length >= 3);
  assert.equal(events.slice(after).some(x => x.tags.includes('logos:lexical-elemental')), false);
});

test('headless 14-11 and its adverse variant run to the end with the module', async () => {
  for (const id of ['14-11', '14-11_adverse_environment']) {
    const stage = await load(id);
    const b = new StandardBattle({ ...mvp, stage, enemies: { ...mvp.enemies, ...stage.enemies } },
      { operators: [defaultBuild(mvp.operators.char_151_myrtle)] }, { seed: 1 });
    b.life = 999;
    let injury = 0; b.on('damaged', ({ dmg, amount }) => { if (dmg?.tags?.includes('logos:module-trait')) injury += amount; });
    while (!b.finished && b.time < 1500) b.step();
    assert.equal(b.reason, 'cleared', id);
    assert.ok(injury > 0, id);
  }
});
