// SPDX-License-Identifier: GPL-3.0-or-later
// 14-20: the presentation-only enemy sign environment (shared/arkpedia/stage-environments.js), Duq'arael's weaker
// Sanctuary (enemy-blood-lord-features.js) and Logos's module with S3 (predefined-modules.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import mvp from '../data/arkpedia-mvp.json' with { type: 'json' };
import native from '../data/arkpedia-environment-native-source.json' with { type: 'json' };
import { ENEMY_RECORDS } from './helpers/enemyHarness.js';
import { compileStageEnvironments, ENEMY_SIGN_ENVIRONMENT, enemySignNativeReviewed, environmentNativeReviewed } from '../shared/arkpedia/stage-environments.js';
import { applyStageEnemyBlackboard } from '../shared/arkpedia/stage-enemy-talents.js';
import { BLOOD_LORD_TWO, bloodLordTwoParams } from '../shared/arkpedia/enemy-blood-lord-features.js';
import { createStageLibraryLoader } from '../shared/arkpedia/stage-library.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { StandardBattle } from '../server/sim/arkpedia.js';

const manifest = JSON.parse(await readFile(new URL('../data/arkpedia-library.json', import.meta.url)));
const loader = createStageLibraryLoader(async url => new Response(await readFile(new URL(`..${url}`, import.meta.url))));
const load = id => { const entry = manifest.stages.find(s => s.id === id); assert.equal(entry?.availability, 'available', id); return loader.load(entry); };
const clone = v => JSON.parse(JSON.stringify(v));
const until = (b, pred, limit) => { while (!b.finished && b.time < limit && !pred()) b.step(); return pred(); };
const battle = stage => { const b = new StandardBattle({ ...mvp, stage, enemies: { ...mvp.enemies, ...stage.enemies } },
  { operators: [defaultBuild(mvp.operators.char_151_myrtle)] }, { seed: 1 }); b.life = 999; return b; };
const sign = (value, extra = {}) => ({ prefabKey: ENEMY_SIGN_ENVIRONMENT, blackboard: [{ key: 'filter_id', value, valueStr: null }],
  overrideCameraEffect: null, passProfessionMaskFlag: false, professionMask: 'NONE', playerSideMask: 'ALL', ...extra });

test('the enemy sign environment is reviewed as presentation only; any effect on it is refused', () => {
  assert.equal(enemySignNativeReviewed(), true);
  assert.equal(environmentNativeReviewed(ENEMY_SIGN_ENVIRONMENT), true);
  const events = e => e.templates['[g]mainline14_enemy_sign_effect'].eventToActions.ON_BUFF_START[0];
  const cases = {
    'a stat change on the marker': e => { events(e)._succeedNodes[1]._buff.attributes.attributeModifiers.push({ attributeType: 'ATK', formulaItem: 'MULTIPLIER', value: 2 }); },
    'a behaviour template on the marker': e => { events(e)._failNodes[0]._buff.templateKey = 'periodic_damage'; },
    'another enemy list': e => { events(e)._succeedNodes[0]._filterIds.push('enemy_1007_slime'); },
    'a second event': e => { e.templates['[g]mainline14_enemy_sign_effect'].eventToActions.ON_BUFF_TRIGGER = []; },
    'a flag on the holder buff': e => { e.prefabs[ENEMY_SIGN_ENVIRONMENT][0].data._buffs[0].attributes.abnormalFlags.push(1); },
    'a deck buff': e => { e.prefabs[ENEMY_SIGN_ENVIRONMENT][0].data._deckBuffs.push({}); },
  };
  for (const [name, change] of Object.entries(cases)) { const e = clone(native); change(e); assert.equal(enemySignNativeReviewed(e), false, name); }
  const [compiled] = compileStageEnvironments([sign(1)]);
  assert.equal(compiled.kind, ENEMY_SIGN_ENVIRONMENT); assert.equal(compiled.presentationOnly, true);
  assert.ok(compiled.enemies.includes('enemy_1547_blord_2') && compiled.enemies.length === 9);
  assert.equal(compileStageEnvironments([sign(0)])[0].enemies, null, 'every enemy');
  assert.throws(() => compileStageEnvironments([sign(2)]), /Unsupported enemy sign parameters/);
  assert.throws(() => compileStageEnvironments([{ ...sign(1), blackboard: [...sign(1).blackboard, { key: 'atk', value: 1, valueStr: null }] }]), /Unsupported enemy sign parameters/);
  assert.throws(() => compileStageEnvironments([sign(1, { playerSideMask: 'NONE' })]), /Unsupported stage environment targeting/);
});

test('Duq\'arael accepts the 30% Sanctuary of 14-20 from the stage, no other value or aura change', () => {
  const record = ENEMY_RECORDS.enemies[BLOOD_LORD_TWO].levels[0];
  const rows = Object.entries(record.talents.bb).map(([key, value]) => ({ key, value, valueStr: null }));
  const override = change => ({ level: 0, blackboard: rows.map(r => ({ ...r, ...(change[r.key] != null ? { value: change[r.key] } : {}) })) });
  const weak = applyStageEnemyBlackboard(record, override({ 'HpAura.damage_resistance': .3 }));
  assert.equal(bloodLordTwoParams(weak).aura.sanctuary, .3);
  assert.equal(bloodLordTwoParams(record).aura.sanctuary, .9);
  for (const change of [{ 'HpAura.damage_resistance': .95 }, { 'HpAura.damage_resistance': 0 }, { 'HpAura.damage_resistance': .5 }, { 'HpAura.hp_recovery_per_sec': 600 }])
    assert.throws(() => applyStageEnemyBlackboard(record, override(change)), /Unsupported original enemy parameter/);
});

test('14-20: Duq\'arael\'s second form holds a 30% Sanctuary; Logos\'s S3 damage carries the module trait', async () => {
  for (const id of ['14-20', '14-20_adverse_environment']) {
    const stage = await load(id);
    assert.deepEqual(stage.environment?.map(e => e.kind) ?? stage.battle?.environment?.map(e => e.kind), [ENEMY_SIGN_ENVIRONMENT], id);
  }
  const b = battle(await load('14-20')); b.autoFinish = false;
  const logos = () => b.bench.char_4133_logos.unit;
  b.step();
  assert.equal(logos().skill.id, 'skchr_logos_3');
  assert.equal(logos().def.raw.module.id, 'uniequip_002_logos');
  let injury = 0, skillArts = 0;
  b.on('damaged', ({ source, type, amount, dmg }) => { if (source !== logos()) return;
    if (dmg?.tags?.includes('logos:module-trait')) injury += amount; else if (type === 'arts' && dmg.isSkill) skillArts += amount; });
  let crown = null;
  assert.ok(until(b, () => (crown = b.enemies.find(e => e.alive && e.defId === BLOOD_LORD_TWO)?.findBuff('ab:crimsonCrown')) != null, 900), 'the second form arrives');
  assert.ok(Math.abs(crown.mods.physTakenMul - .7) < 1e-9 && Math.abs(crown.mods.artsTakenMul - .7) < 1e-9);
  assert.ok(injury > 0);
});

test('headless 14-20, its adverse variant and H14-4 adverse run to the end', async () => {
  for (const id of ['14-20', '14-20_adverse_environment', 'h14-4_adverse_environment']) {
    const b = battle(await load(id));
    while (!b.finished && b.time < 2500) b.step();
    // H14-4's boss costs every life point when it leaks, so an undefended run ends in defeat there.
    assert.equal(b.reason, id.startsWith('h14-4') ? 'defeated' : 'cleared', id);
    assert.deepEqual(b.errors ?? [], [], id);
  }
});
