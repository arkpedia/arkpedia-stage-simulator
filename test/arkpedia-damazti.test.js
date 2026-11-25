// SPDX-License-Identifier: GPL-3.0-or-later
// 12-20's 'Damazti Cluster' family (shared/arkpedia/enemy-damazti-features.js, server/sim/content/arkpedia-enemy-damazti.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import mvp from '../data/arkpedia-mvp.json' with { type: 'json' };
import native from '../data/arkpedia-enemy-native-abilities.json' with { type: 'json' };
import { ENEMY_RECORDS } from './helpers/enemyHarness.js';
import { nativeComponents } from '../shared/arkpedia/enemy-support.js';
import { damaztiNative, damaztiParams, damaztiStageRuleOk, damaztiBranchBindings, DAMAZTI_RUNE_TARGETS } from '../shared/arkpedia/enemy-damazti-features.js';
import { createStageLibraryLoader } from '../shared/arkpedia/stage-library.js';
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';

const manifest = JSON.parse(await readFile(new URL('../data/arkpedia-library.json', import.meta.url)));
const loader = createStageLibraryLoader(async url => new Response(await readFile(new URL(`..${url}`, import.meta.url))));
const load = id => { const entry = manifest.stages.find(s => s.id === id); assert.equal(entry?.availability, 'available', id); return loader.load(entry); };
const HOST = 'enemy_1542_wdslm', FRAGMENT = 'enemy_1542_wdslm_2', LAST = 'enemy_1542_wdslm_3', DECOY = 'enemy_1542_wdslm_4', DISTORTION = 'enemy_1323_wdbshd';
const near = (a, b, eps = .05) => Math.abs(a - b) <= eps;

test('the family is pinned at both levels; changed kits, hard levels and other trees are refused', () => {
  for (const id of [HOST, FRAGMENT, LAST, DECOY, DISTORTION]) for (const r of Object.values(ENEMY_RECORDS.enemies[id].levels))
    assert.equal(damaztiNative(r, nativeComponents(native, id)), true, `${id}@${r.level}`);
  const h = ENEMY_RECORDS.enemies[HOST].levels[0], n = nativeComponents(native, HOST);
  assert.equal(damaztiNative({ ...h, talents: { ...h.talents, bb: { ...h.talents.bb, 'P1SummonHLevel.hlevel_mark': 1 } } }, n), false, 'a hard level');
  assert.equal(damaztiNative({ ...h, stats: { ...h.stats, def: 700 } }, n), false, 'a changed DEF');
  assert.equal(damaztiNative({ ...h, skills: h.skills.map(s => s.prefabKey === 'syncAttackWithSummon' ? { ...s, cooldown: 40 } : s) }, n), false, 'a changed burst');
  assert.equal(damaztiNative(h, nativeComponents(native, FRAGMENT)), false, 'the host tree is its own');
  // Literal parameters (PRTS-confirmed where the data was ambiguous: the 15 s mark, the fragment's 100% sync attack).
  const p = damaztiParams(h);
  assert.deepEqual([p.role, p.resistance, p.sync.p1.scale, p.sync.p1.cooldown, p.sync.p1.initial, p.burst.damage, p.burst.cooldown, p.burst.initial],
    ['host', .2, 1, 20, 10, 375, 50, 0]);
  assert.deepEqual([p.reborn.duration, p.reborn.dot, p.reborn.radius, p.reborn.invincible, p.summon.ratio, p.summon.branch, p.half.mark, p.half.invincible],
    [30, 100, 1.75, 5, .5, 'branch_2', 15, 20]);
  assert.deepEqual([p.burst.hit, p.burst.dur, p.attack.hit, p.attack.dur], [Math.fround(239 / 30), Math.fround(9.1), Math.fround(4 / 3), Math.fround(8 / 3)]);
  assert.equal(damaztiParams(ENEMY_RECORDS.enemies[FRAGMENT].levels[0]).sync.p1.scale, 1);
  // Level 1 (H12) is read over level 0: only the revive's damage changes.
  assert.equal(damaztiParams(ENEMY_RECORDS.enemies[HOST].levels[1]).reborn.dot, 150);
  assert.equal(damaztiParams(ENEMY_RECORDS.enemies[HOST].levels[1]).half.mark, 15);
});

test('a stage with the family needs the Corrosion rune for all of it, and binds its two branches', () => {
  const all = Object.fromEntries(DAMAZTI_RUNE_TARGETS.map(id => [id, { element: 'erosion', ratio: .25 }]));
  assert.equal(damaztiStageRuleOk({ enemyElementalDamage: all }), true);
  assert.equal(damaztiStageRuleOk({}), false);
  const { [DISTORTION]: _, ...withoutDistortion } = all;
  assert.equal(damaztiStageRuleOk({ enemyElementalDamage: withoutDistortion }), false);
  assert.deepEqual(damaztiBranchBindings({ enemyDbRefs: [{ id: HOST }, { id: DECOY }, { id: 'enemy_1313_wdfmr' }] }), ['branch_2', 'branch_1']);
  assert.deepEqual(damaztiBranchBindings({ enemyDbRefs: [{ id: HOST, overwrittenData: { talentBlackboard: [{ key: 'P1SummonHLevel.hlevel_mark', value: 1 }] } }] }),
    ['branch_2', 'branch_3']);
});

test('12-20, its adverse variant and H12-1 adverse are available with the sight environment and the rune', async () => {
  for (const id of ['12-20', '12-20_adverse_environment', 'h12-1_adverse_environment']) {
    const stage = await load(id);
    assert.deepEqual(stage.environment?.filter(e => e.kind === 'mainline12_sightManager'), [{ kind: 'mainline12_sightManager', interval: .5 }], id);
    assert.equal(damaztiStageRuleOk(stage.rules), true, id);
  }
});

test('12-20: disguise, first form, fragment, shared revive, Lifeline Burst, the half-HP mark and the last fragment', async () => {
  const stage = await load('12-20');
  const squad = ['char_151_myrtle', 'char_123_fang', 'char_240_wyvern', 'char_122_beagle'];
  const b = new StandardBattle({ ...mvp, stage, enemies: { ...mvp.enemies, ...stage.enemies } }, { operators: squad.map(k => defaultBuild(mvp.operators[k])) }, { seed: 1 });
  b.setViewport('fullscreen-workspace'); b.life = 999; b.getPlayer('arkpedia').dp = 99;
  // No two operators share a 3x3 square, so every one stands alone; the last deployed (Beagle) is marked.
  const ops = [[6, 2], [5, 4], [3, 4], [1, 8]].map(([r, c], i) => {
    const u = b.deployOperator(squad[i], r, c, 'RIGHT');
    b.addBuff(u, { key: 'test:sturdy', persist: true, mods: { hpMul: 50 } }); u.hp = u.s.maxHp; return u;
  });
  const until = t => { while (!b.finished && b.time < t - 1e-9) b.step(); };
  const alive = id => b.enemies.filter(u => u.alive && u.defId === id);
  const form = u => u.mem.damazti.form;
  const hits = []; b.on('damaged', c => { if (c.target.side === 'ally' && (c.source?.defId?.startsWith('enemy_15') || c.dmg?.tags?.[0] === 'wdslmRebornDot')) hits.push({ t: b.time, tag: c.dmg?.tags?.[0] ?? c.type, src: c.source?.defId ?? null, target: c.target.defId, amount: c.amount, type: c.type }); });
  const spawns = []; b.on('enemySpawn', ({ enemy: e }) => spawns.push({ t: b.time, id: e.defId, at: [Math.round(e.y), Math.round(e.x)] }));
  const strike = (u, ratio) => b.dealDamage(ops[0], u, { amount: u.s.maxHp * ratio, type: 'true', tags: ['test'] });

  until(4);
  const [host] = alive(HOST);
  assert.deepEqual(spawns.find(s => s.id === HOST), { t: 3, id: HOST, at: [6, 0] });
  assert.equal(form(host), 'disguised'); assert.equal(host.s.flags.invulnerable, true);
  // Held in place for the test: his route reaches the exit long before the second form.
  b.addBuff(host, { key: 'test:hold', persist: true, flags: { noMove: true } });
  host.mem.norportIdentity.forceReveal();
  until(5.9); assert.equal(form(host), 'switching'); assert.equal(host.s.flags.invulnerable, true);
  until(6.1); assert.equal(form(host), 'p1'); assert.equal(!!host.s.flags.invulnerable, false);

  // First-form sync attack: 10 s after the form starts, at 2_Skill's OnAttack, on the latest-deployed operator.
  until(18);
  const sync1 = hits.filter(h => h.tag === 'wdslmSync');
  assert.equal(sync1.length, 1); assert.ok(near(sync1[0].t, 6 + 10 + Math.fround(11 / 6), .1), String(sync1[0].t));
  assert.equal(sync1[0].target, 'char_122_beagle');
  // The rune: every damage the family deals adds 25% of it as Corrosion.
  assert.ok(hits.some(h => h.type === 'element' && near(h.t, sync1[0].t, 1e-9) && h.target === sync1[0].target), 'Corrosion with the sync hit');

  // Below 50%: the first fragment on branch_2's route (4,1), disguised; the group is invincible until it is identified.
  strike(host, .52); until(b.time + .2);
  const [fragment] = alive(FRAGMENT);
  assert.deepEqual(spawns.find(s => s.id === FRAGMENT).at, [4, 1]);
  assert.equal(form(fragment), 'disguised');
  assert.ok(near(fragment.hp / fragment.s.maxHp, .48, 1e-9), 'the fragment takes the host HP ratio');
  for (const u of [host, fragment]) {
    assert.equal(u.s.flags.invulnerable, true);
    assert.ok(near(u.s.physTakenMul, .8, 1e-9) && near(u.s.artsTakenMul, .8, 1e-9), 'one fragment: 20% less Physical and Arts');
  }
  until(b.time + 3); const before = host.hp; strike(host, .1); assert.equal(host.hp, before, 'invincible while a member is disguised');
  fragment.mem.norportIdentity.forceReveal(); until(b.time + 2.2);
  assert.deepEqual([form(host), form(fragment), !!host.s.flags.invulnerable, !!fragment.s.flags.invulnerable], ['p1', 'p1', false, false]);
  strike(fragment, .1);
  assert.ok(near(host.hp / host.s.maxHp, .38, 1e-9), 'a hit on the fragment drains the shared pool');

  // The next sync attack forces the fragment's own.
  const syncCount = hits.filter(h => h.tag === 'wdslmSync').length;
  until(b.time + 21);
  const forced = hits.filter(h => h.tag === 'wdslmSync').slice(syncCount);
  assert.deepEqual(forced.map(h => h.src).sort(), [HOST, FRAGMENT]);

  // Knock-out: both revive together for 30 s with the Arts aura (sourceless, no Corrosion), then the second form.
  const ko = b.time;
  strike(host, 1); until(b.time + .1);
  assert.deepEqual([form(host), form(fragment)], ['reborn', 'reborn']);
  until(ko + 29.8);
  const dots = hits.filter(h => h.tag === 'wdslmRebornDot');
  assert.ok(dots.length >= 29 && dots.every(h => h.amount > 0 && h.type === 'arts'), String(dots.length));
  assert.equal(hits.filter(h => h.tag === 'stage:apply_elemental_damage' && h.t > ko && h.t < ko + 29.8).length, 0, 'the aura has no source');
  b.dealDamage(null, host, { amount: 1e9, type: 'true', tags: ['test'] });
  assert.equal(host.alive, true, 'damage during the revive does not end it');
  until(ko + 30.2);
  assert.deepEqual([form(host), form(fragment), host.hp, !!host.s.flags.invulnerable], ['p2', 'p2', host.s.maxHp, true]);
  const p2 = ko + 30;

  // Lifeline Burst at once: every operator's tile is locked; at 2_Skill_2's OnAttack 375 Arts on each tile and its four
  // neighbours, and one Distortion on each locked tile.
  until(p2 + 8.2);
  const burst = hits.filter(h => h.tag === 'wdslmLifeline');
  assert.equal(burst.length, 4);
  assert.ok(burst.every(h => h.src === HOST && near(h.t, p2 + Math.fround(239 / 30), .15)), JSON.stringify(burst.map(h => h.t)));
  assert.deepEqual(spawns.filter(s => s.id === DISTORTION).map(s => s.at).sort(), [[1, 8], [3, 4], [5, 4], [6, 2]]);
  const distortion = alive(DISTORTION)[0], hp0 = distortion.hp;
  until(b.time + 1.01); assert.ok(distortion.hp <= hp0 - 250 + 1e-6, 'a Distortion loses 250 HP every second');

  // Below 50% in the second form: one operator is marked; the group is invincible for 20 s; after 15 s the operator is
  // removed for the battle, the decoy appears on its tile, and 2 s later the last fragment on branch_1's route (3,1).
  until(b.time + 6); strike(host, .55); until(b.time + .2);
  const marked = b.time;
  const beagle = ops[3];
  assert.ok(beagle.findBuff('enemy_wdslm[dieAndSummon]'));
  assert.equal(host.s.flags.invulnerable, true);
  until(marked + 14.8); assert.equal(beagle.alive, true);
  until(marked + 15.2);
  assert.equal(beagle.alive, false);
  assert.equal(b.bench.char_122_beagle.removedFromDeck, true);
  assert.match(b.placementError('char_122_beagle', 1, 8) ?? '', /removed/);
  assert.deepEqual(spawns.find(s => s.id === DECOY).at, [1, 8]);
  until(marked + 17.3);
  const [last] = alive(LAST);
  assert.deepEqual(spawns.find(s => s.id === LAST).at, [3, 1]);
  assert.equal(alive(DECOY).length, 0);
  assert.ok(near(last.hp / last.s.maxHp, host.hp / host.s.maxHp, 1e-9));
  for (const u of [host, fragment, last]) assert.ok(near(u.s.physTakenMul, .6, 1e-9), 'two fragments: 40% less');
  assert.equal(last.s.flags.invulnerable, true, 'the 20 s invincibility reaches the last fragment');
  until(marked + 20.3);
  assert.equal(!!host.s.flags.invulnerable, false);

  // Second-form knock-out: no revive is left; the whole group finishes together.
  strike(last, 1); until(b.time + .1);
  assert.deepEqual([HOST, FRAGMENT, LAST].map(id => alive(id).length), [0, 0, 0]);
  assert.deepEqual(b.errors, []);
});

test('a member that leaks finishes the whole group without revives', async () => {
  const stage = await load('12-20');
  const b = new StandardBattle({ ...mvp, stage, enemies: { ...mvp.enemies, ...stage.enemies } }, { operators: [defaultBuild(mvp.operators.char_151_myrtle)] }, { seed: 1 });
  b.life = 999;
  while (b.time < 3.1) b.step();
  const host = b.enemies.find(u => u.alive && u.defId === HOST);
  host.mem.norportIdentity.forceReveal();
  while (b.time < 6.1) b.step();
  b.dealDamage(null, host, { amount: host.s.maxHp * .6, type: 'true', tags: ['test'] });
  while (b.time < 6.3) b.step();
  const fragment = b.enemies.find(u => u.alive && u.defId === FRAGMENT);
  fragment.mem.norportIdentity.forceReveal();
  while (b.time < 8.6) b.step();
  b.leak(fragment);
  assert.equal(host.alive, false, 'the host goes with the leaking fragment');
  assert.notEqual(host.mem.damazti.form, 'reborn');
  assert.deepEqual(b.errors, []);
});

test('12-20 and H12-1 adverse: wave 1 follows with the boss alive in its second form, and the battle clears', async () => {
  for (const id of ['12-20', 'h12-1_adverse_environment']) {
    const stage = await load(id);
    const b = new StandardBattle({ ...mvp, stage, enemies: { ...mvp.enemies, ...stage.enemies } }, { operators: [defaultBuild(mvp.operators.char_151_myrtle)] }, { seed: 1 });
    b.setViewport('fullscreen-workspace'); b.life = 999;
    // Every other enemy is removed as it appears; the boss group is held in place and taken to its second form.
    const until = t => { while (!b.finished && b.time < t) { b.step(); for (const u of b.enemies) if (u.alive && !/wdslm|wdbshd/.test(u.defId)) b.kill(u, null); } };
    until(3.5);
    const host = b.enemies.find(u => u.alive && u.defId === HOST);
    b.addBuff(host, { key: 'test:hold', persist: true, flags: { noMove: true } }); host.mem.norportIdentity.forceReveal(); until(7);
    b.dealDamage(null, host, { amount: host.s.maxHp * .55, type: 'true' }); until(7.5);
    const fragment = b.enemies.find(u => u.alive && u.defId === FRAGMENT);
    b.addBuff(fragment, { key: 'test:hold', persist: true, flags: { noMove: true } }); fragment.mem.norportIdentity.forceReveal(); until(10);
    b.dealDamage(null, host, { amount: host.s.maxHp, type: 'true' }); until(41);
    assert.equal(host.mem.damazti.form, 'p2', id);
    until(400);
    assert.equal(b.stageWaveScheduler.done, true, `${id}: every wave ran with the boss alive`);
    assert.equal(b.finished, false);
    b.dealDamage(null, host, { amount: host.s.maxHp, type: 'true' }); until(b.time + 20);
    assert.deepEqual([b.finished, b.reason], [true, 'cleared'], id);
    assert.deepEqual(b.errors, []);
  }
});
