// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { pollutionInfantry, pollutionBowman } from '../server/sim/content/chapter17-pollution-reactions.js';
import { pollute, leakSource, chapter17Environment } from '../server/sim/content/chapter17.js';
import { attach, installFeatureDispatch } from '../server/sim/content/enemies.js';
import { makeBattle, chessRec } from './helpers/battleHarness.js';
import { verifiedNative, verifiedChapter16FamilyGraph } from '../tools/arkpedia/enemy-support.mjs';
import { installEnemyFeatures } from '../server/sim/content/arkpedia-enemy-features.js';
import { deriveEnemySupport, prefabPath } from '../shared/arkpedia/enemy-support.js';
const bytes = p => readFileSync(new URL('../data/' + p, import.meta.url));
const read = p => JSON.parse(bytes(p));
const records = read('candidates/arkpedia-enemy-records.canonical.json').enemies;
const infantry = 'enemy_10201_muinf', bow = 'enemy_10202_mubow';
const proof = read('candidates/arkpedia-ch17-infantry-bow-source.json');
function fixture(key = bow, { units = true, variant = false, automatic = false } = {}) {
  key += variant ? '_2' : '';
  const h = makeBattle({ content: 'generic', autoFinish: false, setup: automatic ? installEnemyFeatures : installFeatureDispatch,
    defs: { enemies: Object.fromEntries([key, 'enemy_10211_murad'].map(k => [k, records[k].levels[0]])),
      chess: { dummy: chessRec({ id: 'dummy', stats: { maxHp: 1e6, atk: 0, def: 100, res: 50, blockCnt: 0 } }) } },
    units: units ? [{ chessId: 'dummy', row: 10, col: 5 }] : [] });
  h.b.start();
  const e = h.spawn(key, { pos: [10, 7] }); e.base.moveSpeed = 0; e.markDirty();
  const a = automatic ? e.mem.ab?.list[0] : key.startsWith(infantry) ? pollutionInfantry(records[key].levels[0]) : pollutionBowman(records[key].levels[0]);
  if (!automatic) attach(h.b, e, [a]);
  return { h, b: h.b, e, a, u: units ? h.unit('dummy') : null };
}

test('complete native family graph and all indexed components share the frozen inventories', () => {
  const index = read('arkpedia-enemy-clock-source.json');
  verifiedChapter16FamilyGraph(bytes('candidates/arkpedia-ch17-infantry-bow-source.json'), bytes('arkpedia-cn-native-source.json'), bytes('arkpedia-cn-enemy-native-source.json'), index);
  verifiedNative(read('candidates/arkpedia-ch17-infantry-bow-native.json'), index.prefabs,
    createHash('sha256').update(bytes('arkpedia-enemy-clock-source.json')).digest('hex'), read('arkpedia-mvp.json').behaviors.source);
  assert.equal(Object.keys(proof.prefabs).length, 4); assert.equal(Object.keys(proof.projectiles).length, 2);
  const start = key => JSON.parse(JSON.parse(proof.templates[key].originalJson).eventToActions._items.find(e => e.key === 0).value.SerializedState);
  const heal = start('enemy_muinf_t')[0];
  assert.equal(heal.$type, 'Torappu.Battle.Action.Nodes+HealViaMaxHpRatio');
  assert.equal(heal._ignoreHealFree, false); assert.equal(heal._skipModifierEvent, false);
  assert.equal(start('switch_mode_no_restore')[0]._restartFSM, true);
  const finish = start('enemy_mubow_switch_back');
  assert.equal(finish[0]._restoreDefault, true); assert.equal(finish[0]._restartFSM, false);
  assert.equal(finish[1]._abilityName, 'Attack'); assert.equal(finish[1]._waitFirstPeriod, true);
  for (const rows of Object.values(proof.projectiles)) {
    const data = rows.map(r => JSON.parse(r.originalJson));
    assert.equal(data.find(r => '_speed' in r)._speed, 10);
    assert.equal(data.find(r => '_lifeTime' in r)._lifeTime, 10);
    assert.equal(data.find(r => '_lifeTime' in r)._stopWhenSourceInvalid, 0);
  }
});

test('feature dispatch installs both families without manual candidate attachment', () => {
  const f = fixture(infantry, { automatic: true, units: false }); f.e.hp = 1000;
  assert.equal(typeof f.e.mem.ch17PollutionReaction, 'function'); pollute(f.b, f.e); assert.equal(f.e.hp, 1800);
  const g = fixture(bow, { automatic: true });
  assert.equal(typeof g.e.mem.ch17PollutionReaction, 'function'); pollute(g.b, g.e); g.h.run(.1);
  assert.equal(g.e.stats.attacks, 1); assert.equal(g.b.projectiles.list[0].speed, 10);
  assert.deepEqual([...f.b.errors, ...g.b.errors], []);
});

test('reaction support rejects missing full-graph evidence, changed native rows, wrappers and record signatures', () => {
  const native = read('candidates/arkpedia-ch17-infantry-bow-native.json'), review = read('candidates/arkpedia-ch17-reviewed-reactions.json');
  const index = read('arkpedia-enemy-clock-source.json');
  const entries = Object.fromEntries(Object.keys(review.enemies).map(key => [key, records[key]]));
  const evidence = { ...native, chapter16Families: { infantryBow: { graphSha256: review.sources.graph.sha256 } } };
  for (const key of Object.keys(entries)) {
    const decision = deriveEnemySupport(entries, index.prefabs, evidence)[key];
    assert.equal(decision.policy, 'stats-attacks-and-features');
    assert.equal(decision.native[key].claimedWrappers, review.enemies[key].counts.enemyAbilityWrappers);
    assert.equal(decision.native[key].claimedActive, review.enemies[key].counts.activeGeneralOrCommonAbilities);
    assert.equal(deriveEnemySupport(entries, index.prefabs, native)[key].policy, null);
    const changed = structuredClone(evidence); changed.prefabs[prefabPath(key)][0].originalJson += ' ';
    assert.equal(deriveEnemySupport(entries, index.prefabs, changed)[key].policy, null);
    const changedIndex = structuredClone(index.prefabs);
    changedIndex[prefabPath(key)].clockComponents.push({ fields: { _familyMask: 1, _trigger: {} } });
    assert.equal(deriveEnemySupport(entries, changedIndex, evidence)[key].policy, null);
    const wrong = structuredClone(entries); wrong[key].levels[0].abilities[0].text += ' changed';
    assert.equal(deriveEnemySupport(wrong, index.prefabs, evidence)[key].policy, null);
  }
  const wrongRatio = structuredClone(entries); wrongRatio[infantry].levels[0].talents.bb['MuradPollut.hp_ratio'] = .5;
  assert.equal(deriveEnemySupport(wrongRatio, index.prefabs, evidence)[infantry].policy, null);
});

for (const variant of [false, true]) test(`infantry pollution heals current max HP, respects modifiers/heal-free and does not become regeneration (variant ${variant})`, () => {
  const { h, b, e } = fixture(infantry, { units: false, variant });
  e.hp = 1000;
  const ratio = records[e.defId].levels[0].talents.bb['MuradPollut.hp_ratio'];
  pollute(b, e); assert.equal(e.hp, 1000 + e.s.maxHp * ratio);
  const hp = e.hp; h.run(3); assert.equal(e.hp, hp);
  const block = b.addBuff(e, { key: 'test:heal-free', persist: true, flags: { healFree: true } });
  pollute(b, e); assert.equal(e.hp, hp);
  b.removeBuff(e, block);
  b.addBuff(e, { key: 'test:max-hp', persist: true, mods: { hpPct: 1 } });
  const max = e.s.maxHp;
  assert.equal(max, records[e.defId].levels[0].stats.maxHp * 2);
  e.hp = 1000; pollute(b, e); assert.equal(e.hp, 1000 + max * ratio);
  b.addBuff(e, { key: 'test:healing-taken', persist: true, mods: { healingTakenMul: .5 } });
  b.addBuff(e, { key: 'test:silence', persist: true, flags: { silence: true } });
  const before = e.hp; pollute(b, e); assert.equal(e.hp, Math.min(max, before + max * ratio * .5));
  assert.deepEqual(b.errors, []);
});

test('a real hidden Leak Source ring invokes the infantry heal through shared beam collision', () => {
  const { h, b, e } = fixture(infantry, { units: false }); e.hp = 1000;
  const source = h.spawn('enemy_10211_murad', { pos: [10, 9] });
  attach(b, source, [leakSource(records.enemy_10211_murad.levels[0])]);
  h.run(6.5); assert.equal(e.hp, 1800); assert.ok(b.chapter16.beams.length > 0);
  assert.deepEqual(b.errors, []);
});

test('a real hidden Leak Source ring arms the bowman while no opponent is in attack range', () => {
  const { h, b, e, a } = fixture(bow, { units: false, automatic: true });
  h.spawn('enemy_10211_murad', { pos: [10, 9] });
  h.run(6.5);
  assert.equal(a.mode, 1); assert.ok(e.findBuff('enemy_mubow_fx')); assert.equal(e.stats.attacks, 0);
  assert.deepEqual(b.errors, []);
});

test('the native environment unharmful Leak Source summon cannot keep a cleared battle open', () => {
  const environments = read('candidates/arkpedia-ch16-action-source.json').environments;
  const original = environments['dyn/battle/prefabs/[uc]envsystems/env_v073_mainline17_ctrl.prefab']
    .map(r => JSON.parse(r.originalJson)).find(r => r._enemyKey === 'enemy_10211_murad');
  assert.equal(original._unharmful, 1); assert.equal(original._alwaysCountAsKilled, 0);
  const { h, b, e } = fixture(infantry, { units: false });
  const source = chapter17Environment(b).summon();
  assert.ok(source); attach(b, source, [leakSource(records.enemy_10211_murad.levels[0])]);
  assert.equal(source.counted, false);
  b.autoFinish = true; b.kill(e, null); h.step();
  assert.equal(b.finished, true); assert.equal(b.result().reason, 'cleared');
  assert.deepEqual(b.errors, []);
});

test('Arts mode ignores the previous normal cooldown and restores a full normal period at attack end', () => {
  const { h, b, e, a, u } = fixture(), hp = u.hp;
  // Controlled engine clip fixture: distinguish its cast end from shot impact.
  // This is not presented as the original game's measured animation duration.
  e.def = { ...e.def, attackAnim: { dur: 1, hit: .2 } };
  h.run(.1); assert.equal(e.stats.attacks, 1);
  assert.ok(e.atkCd > 2.8); pollute(b, e); assert.equal(a.mode, 1);
  h.run(.1); assert.equal(e.stats.attacks, 2, 'the enhanced mode does not inherit a spent normal-mode period');
  h.run(.3);
  assert.equal(hp - u.hp, 200, 'born normal and Arts shots use their own types: 100 after DEF + 100 after RES');
  assert.equal(a.mode, 1, 'impact is not cast end');
  h.run(.6); assert.equal(a.mode, 0); assert.equal(e.findBuff('enemy_mubow_fx'), null);
  assert.ok(e.atkCd > 2.5, 'normal period was reset when the enhanced cast ended');
  h.run(2.4); assert.equal(e.stats.attacks, 2);
  h.run(.7); assert.equal(e.stats.attacks, 3);
  assert.deepEqual(b.errors, []);
});

test('a second native variant retains Arts mode under silence and a born shot survives cast interruption', () => {
  const { h, b, e, a, u } = fixture(bow, { variant: true }); const hp = u.hp;
  e.def = { ...e.def, attackAnim: { dur: 1, hit: .2 } };
  b.addBuff(e, { key: 'test:silence', persist: true, flags: { silence: true } });
  pollute(b, e); h.run(.1); assert.equal(a.mode, 1); assert.equal(e.stats.attacks, 1);
  b.addBuff(e, { key: 'test:stun', duration: .05, flags: { stun: true } });
  h.run(.1); assert.equal(a.mode, 0); assert.equal(a.pending, null);
  h.run(.3); assert.equal(hp - u.hp, 125);
  assert.deepEqual(b.errors, []);
});

test('no target retains enhanced mode; repeated pollution is one mode rather than queued attacks', () => {
  const { h, b, e, a, u } = fixture(); u.x = 1;
  pollute(b, e); pollute(b, e); h.run(4);
  assert.equal(a.mode, 1); assert.equal(e.stats.attacks, 0);
  u.x = 5; h.run(.1); assert.equal(e.stats.attacks, 1);
  pollute(b, e); h.run(1); assert.equal(a.mode, 0); assert.equal(e.stats.attacks, 1);
  assert.deepEqual(b.errors, []);
});

test('source death keeps a born Arts projectile but retires mode callbacks and future pollution', () => {
  const { h, b, e, a, u } = fixture(); const hp = u.hp;
  pollute(b, e); h.run(.1); b.kill(e, null); pollute(b, e); h.run(1);
  assert.equal(hp - u.hp, 100); assert.equal(a.pending, null);
  assert.equal(e.mem.ch17PollutionReaction, undefined);
  assert.equal(e.findBuff('enemy_mubow_fx'), null);
  assert.deepEqual(b.errors, []);
});

test('battle end removes a pending enhanced cast without a stale cooldown or new heal', () => {
  const { h, b, e, a } = fixture(); pollute(b, e); h.run(.1);
  b.emit('battleEnd', {}); const cd = e.atkCd;
  assert.equal(a.pending, null); assert.equal(e.findBuff('enemy_mubow_fx'), null);
  pollute(b, e); assert.equal(e.atkCd, cd);
  assert.equal(e.mem.ch17PollutionReaction, undefined);
  assert.deepEqual(b.errors, []);
});
