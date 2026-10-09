// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import source from '../data/arkpedia-eyjafjalla-prefabs.json' with { type: 'json' };
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { effectiveProfile, performAttack, acquireTargets } from '../server/sim/ai.js';
const ID = 'char_180_amgoat';
const near = (a, z) => assert.ok(Math.abs(a - z) < 1e-5, `${a} != ${z}`);
function advanceTo(b, time) { while (b.time < time - 1e-9) b.step(); assert.deepEqual(b.errors, []); }
function advance(b, seconds) { advanceTo(b, b.time + seconds); }
function make({ skill = 0, rank = 10, elite = 2, potential = 1, dir = 'RIGHT', seed = 1, additional = [] } = {}) {
  const d = structuredClone(data), o = d.operators[ID];
  d.stage.geometry.waves[0].spawns = []; d.stage.battle.dp_per_second = 0;
  d.stage.geometry.rows = 19; d.stage.geometry.cols = 21;
  d.stage.geometry.tileGrid = Array.from({ length: 19 }, () => Array(21).fill(2));
  const build = { ...defaultBuild(o), elite, potential, level: o.phases[elite].maxLevel,
    skillId: o.skills[skill].id, skillRank: Math.min(rank, [4, 7, 10][elite]) };
  const b = new StandardBattle(d, { operators: [build, ...additional.map(id => defaultBuild(d.operators[id]))] }, { seed });
  b.autoFinish = false; b.setViewport('fullscreen-workspace');
  b.grid.tiles = b.grid.tiles.map(t => ({ ...t, height: 'LOW', build: 'ALL', pass: 'ALL' }));
  b.addDp('arkpedia', 99);
  const receipts = []; b.on('damaged', c => receipts.push({ ...c, time: b.time }));
  const deploy = (id, r = 5, c = 8) => { b.addDp('arkpedia', 99); const a = b.deployOperator(id, r, c, dir); assert.ok(a); a.atkCd = 1000; a.profile.canAttack = () => false; return a; };
  const u = b.deployOperator(ID, 5, 5, dir); assert.ok(u);
  u.atkCd = 1000; u.profile.canAttack = () => false;
  return { b, u, receipts, deploy };
}
function enemy(b, { x = 6, y = 5, fly = false } = {}) {
  const e = b.spawnEnemy('enemy_1007_slime', { pos: [y, x] });
  Object.assign(e.base, { maxHp: 100000, def: 0, res: 0, moveSpeed: 0 }); e.markDirty(); void e.s; e.hp = 100000;
  if (fly) e.motion = 'FLY';
  b.addBuff(e, { key: 'test:pin', flags: { noMove: true, disarm: true } }); b._buildEnemyIndex(); return e;
}
function cast(b, u) { u.skill.setSpTotal(u.skill.spCost); assert.equal(u.skill.activate('test'), true); }
function shot(b, u, e) { performAttack(b, u, effectiveProfile(u), [e]); u.atkCd = 1000; }
const outgoing = (rs, u) => rs.filter(r => r.source === u && r.target.side === 'enemy');
const incoming = (b, u, e, amount) => b.dealDamage(e, u, { amount, type: 'true', isAttack: true });
const bbFor = (skill, rank) => Object.fromEntries(source.tables.skills[`skchr_amgoat_${skill + 1}`].levels[rank - 1].blackboard.map(v => [v.key, v.value]));

test('original source preserves five bundles, damage order, aura priority and unrounded random SP', () => {
  assert.equal(source.source.bundles.length, 5); assert.equal(Object.keys(source.templates).length, 4);
  assert.equal(source.frameParity, false); assert.equal(source.moduleSupport, false);
  assert.equal(Object.values(source.tables.skills).flatMap(s => s.levels).length, 30);
  const ps = source.projectiles.projectile_amgoat_s2.flatMap(g => g.components).map(c => c.data);
  near(ps.find(c => c.m_Radius != null).m_Radius, 1.5);
  const action = ps.find(c => c._actionController)._actionController;
  assert.equal(action._onlyAddBuffsToTraceTarget, 1);
  assert.equal(action._extraBuffsInTheEnd[0].templateKey, 'amgoat_s_2');
  assert.equal(source.templates.amgoat_s_2.eventToActions.ON_BUFF_START[0]._atkScaleVar, 'atk_scale_2');
  const native = JSON.parse(source.originalTemplates.amgoat_t_2.eventToActions._items[0].value.SerializedState);
  assert.equal(native[0]._convertToInt, false); assert.equal(native[1]._forceFlag, false);
  for (const face of ['Front', 'Back']) {
    assert.equal(source.models[ID][face].sha256, source.officialSkeletonBindings[ID][face].sha256);
    near(source.models[ID][face].hits.Attack[0], .667);
  }
  assert.equal(source.models[ID].Back.durations.Skill_Start, undefined);
});
for (let rank = 1; rank <= 10; rank++) test(`S1 rank ${rank}: first cast ASPD, later ATK and additive caster talent`, () => {
  const { b, u, receipts } = make({ rank }); const bb = bbFor(0, rank), s = source.tables.skills.skchr_amgoat_1.levels[rank - 1];
  near(u.skill.spCost, s.spData.spCost); near(u.s.atk, u.base.atk * 1.14);
  cast(b, u); near(u.s.aspd, 100 + bb['amgoat_s_1[a].attack_speed']); near(u.s.atk, u.base.atk * 1.14);
  near(u.skill.timeLeft, 25); const e = enemy(b); shot(b, u, e); advance(b, .85);
  near(outgoing(receipts, u)[0].amount, u.base.atk * 1.14);
  advanceTo(b, 25.1); near(u.s.aspd, 100); near(u.s.atk, u.base.atk * 1.14);
  cast(b, u); near(u.s.aspd, 100 + bb['amgoat_s_1[b].attack_speed']);
  near(u.s.atk, u.base.atk * (1.14 + bb['amgoat_s_1[b].atk']));
  shot(b, u, e); advance(b, .85); near(outgoing(receipts, u).at(-1).amount, u.s.atk);
  u.skill.end('test'); near(u.s.atk, u.base.atk * 1.14); near(u.s.aspd, 100);
  cast(b, u); assert.equal(u.mem.eyjaUses, 3); near(u.s.atk, u.base.atk * (1.14 + bb['amgoat_s_1[b].atk']));
});
for (let rank = 1; rank <= 10; rank++) test(`S2 rank ${rank}: primary-only RES before two hits, area half and source charge cap`, () => {
  const { b, u, receipts } = make({ skill: 1, rank }); const bb = bbFor(1, rank), s = source.tables.skills.skchr_amgoat_2.levels[rank - 1];
  near(u.skill.spCost, s.spData.spCost); assert.equal(u.skill.maxCharges, s.spData.maxChargeTime);
  const e = enemy(b), a = enemy(b, { x: 7 }), far = enemy(b, { x: 7.6 });
  for (const z of [e, a, far]) { z.base.res = 40; z.markDirty(); }
  cast(b, u); const sp = u.skill.spTotal; assert.equal(u.s.flags.noSp, true); shot(b, u, e);
  advance(b, .6); assert.equal(outgoing(receipts, u).length, 0); near(u.skill.spTotal, sp);
  advance(b, .3); const hits = outgoing(receipts, u);
  assert.deepEqual(hits.map(r => r.target), [e, a, e]);
  near(e.s.res, 40 * (1 + bb.magic_resistance)); near(a.s.res, 40);
  near(hits[0].amount, u.s.atk * bb.atk_scale * (1 - e.s.res / 100));
  near(hits[1].amount, u.s.atk * bb.atk_scale * .6);
  near(hits[2].amount, u.s.atk * bb.atk_scale_2 * (1 - e.s.res / 100));
  assert.equal(new Set(hits.map(r => r.dmg.attackId)).size, 1); near(far.hp, far.s.maxHp);
  assert.equal(u.skill.pending, false); assert.equal(Boolean(u.s.flags.noSp), false);
  advance(b, 6.1); near(e.s.res, 40); assert.equal(e.findBuff(`eyja:res:${u.id}`), null);
});
for (let rank = 1; rank <= 10; rank++) test(`S3 rank ${rank}: additive BAT, distinct random target cap, all directions and expiry`, () => {
  const { b, u, receipts } = make({ skill: 2, rank }); const bb = bbFor(2, rank), old = [...u.rangeKeys];
  const es = Array.from({ length: 8 }, (_, n) => enemy(b, { x: 6, y: 4 + n / 10 }));
  cast(b, u); near(u.s.atk, u.base.atk * (1.14 + bb.atk)); near(u.s.bat, .5); near(u.s.interval, .5);
  near(u.skill.timeLeft, 15); assert.ok(u.rangeKeys.length > old.length);
  const p = effectiveProfile(u), choices = acquireTargets(b, u, p);
  assert.equal(choices.length, bb['attack@max_target']); assert.equal(new Set(choices).size, choices.length);
  performAttack(b, u, p, choices); u.atkCd = 1000;
  assert.equal(b.projectiles.list.length, choices.length); assert.ok(b.projectiles.list.every(p => p.speed === 6));
  advance(b, .3); assert.equal(outgoing(receipts, u).length, choices.length);
  assert.ok(outgoing(receipts, u).every(r => es.includes(r.target))); assert.ok(es.some(e => e.hp === e.s.maxHp));
  advanceTo(b, 15.1); assert.equal(u.skill.active, false); near(u.s.atk, u.base.atk * 1.14);
  near(u.s.bat, 1.6); assert.deepEqual(u.rangeKeys, old);
  assert.equal(u.mem.regularFormVisual.clip, 'Skill_End'); advance(b, 2.1); assert.equal(u.mem.regularFormVisual, null);
});
for (const elite of [0, 1, 2]) for (const potential of [1, 3, 6])
  test(`E${elite} P${potential}: aura recipients, chosen talent values and initial SP`, () => {
    const { b, u, deploy } = make({ elite, potential, additional: ['char_121_lava', 'char_002_amiya', 'char_208_melan'] });
    const t = elite === 0 ? 0 : (elite === 1 ? .07 : .14) + (potential === 6 ? .02 : 0);
    near(u.s.atk, u.base.atk * (1 + t));
    const a = deploy('char_121_lava'), z = deploy('char_002_amiya', 5, 9), guard = deploy('char_208_melan', 5, 10);
    near(a.s.atk, a.base.atk * (1 + t)); near(z.s.atk, z.base.atk * (1 + t)); near(guard.s.atk, guard.base.atk * 1.08);
    b.addBuff(a, { key: 'test:atk', mods: { atkPct: .5 }, flags: { untargetable: true } });
    advance(b, .1); near(a.s.atk, a.base.atk * (1 + t + .5));
    const sp = u.skill.initSp, min = potential >= 3 ? 10 : 7, max = potential >= 3 ? 20 : 16;
    if (elite === 2) assert.ok(u.skill.spTotal >= sp + min && u.skill.spTotal < sp + max + .1);
    else near(u.skill.spTotal, sp + .1);
    b.retreat(u); near(a.s.atk, a.base.atk * 1.5); near(z.s.atk, z.base.atk); assert.equal(a.findBuff('eyja:pyrobreath'), null);
  });
for (const dir of ['UP', 'RIGHT', 'DOWN', 'LEFT']) test(`${dir}: original attack event, capped ASPD and Volcano stance`, () => {
  const { b, u, receipts } = make({ skill: 2, dir });
  const e = enemy(b, { x: dir === 'LEFT' ? 4 : dir === 'RIGHT' ? 6 : 5, y: dir === 'UP' ? 6 : dir === 'DOWN' ? 4 : 5 });
  b.addBuff(u, { key: 'test:aspd', mods: { aspd: 100 } }); shot(b, u, e); advance(b, .6);
  assert.equal(outgoing(receipts, u).length, 0); advance(b, .3); assert.equal(outgoing(receipts, u).length, 1);
  cast(b, u); assert.equal(u.mem.regularFormVisual.forceFront, true); advance(b, 1.7);
  assert.equal(u.mem.regularFormVisual.clip, 'Skill_Loop'); u.skill.end('test');
  assert.equal(u.mem.regularFormVisual.clip, 'Skill_End'); advance(b, 2.1); assert.equal(u.mem.regularFormVisual, null);
});
test('Volcano reselects distinct legal live victims and seeded choices reproduce', () => {
  const run = seed => {
    const { b, u } = make({ skill: 2, seed });
    const es = Array.from({ length: 10 }, () => enemy(b));
    const fly = enemy(b, { fly: true }), hidden = enemy(b), sleep = enemy(b), untargetable = enemy(b);
    b.addBuff(hidden, { key: 'test:hidden', flags: { stealth: true } });
    b.addBuff(sleep, { key: 'test:sleep', flags: { sleep: true } });
    b.addBuff(untargetable, { key: 'test:untargetable', flags: { untargetable: true } });
    cast(b, u); const p = effectiveProfile(u), picks = [];
    for (let n = 0; n < 8; n++) {
      const xs = acquireTargets(b, u, p); assert.equal(xs.length, 6); assert.equal(new Set(xs).size, 6);
      assert.ok(xs.every(e => es.includes(e) || e === fly)); picks.push(xs.map(e => e.spawnSeq));
    }
    assert.ok(new Set(picks.map(p => p.join(','))).size > 1);
    assert.ok(picks.flat().includes(fly.spawnSeq)); return picks;
  };
  assert.deepEqual(run(17), run(17)); assert.notDeepEqual(run(17), run(18));
});
test('Wild Fire samples fractional native bounds once per deployment and respects ordinary SP cap', () => {
  const samples = [];
  for (let seed = 1; seed <= 100; seed++) {
    const { b, u } = make({ seed, skill: 2 }); const n = u.skill.spTotal - u.skill.initSp;
    assert.ok(n >= 7 && n < 16); samples.push(n); const sp = u.skill.spTotal; advance(b, 1);
    near(u.skill.spTotal, sp + 1);
  }
  assert.ok(samples.some(x => !Number.isInteger(x))); assert.ok(Math.min(...samples) < 7.2); assert.ok(Math.max(...samples) > 15.8);
  const { u } = make({ skill: 1, potential: 3 }); assert.ok(u.skill.spTotal >= 10 && u.skill.spTotal <= 15);
});
test('Duetto usage and Wild Fire reset on redeployment; owned aura and timed buffs do not leak', () => {
  const { b, u, deploy } = make({ additional: ['char_121_lava'] }); const a = deploy('char_121_lava');
  cast(b, u); u.skill.end('test'); advance(b, 3); cast(b, u); assert.equal(u.mem.eyjaUses, 2);
  b.retreat(u); near(a.s.atk, a.base.atk); advance(b, 70.1); b.addDp('arkpedia', 99);
  const fresh = b.deployOperator(ID, 5, 5, 'RIGHT'); assert.ok(fresh); fresh.atkCd = 1000; fresh.profile.canAttack = () => false;
  assert.equal(fresh.mem.eyjaUses, 0); assert.equal(fresh.findBuff('eyja:duetto'), null);
  assert.ok(fresh.skill.spTotal >= fresh.skill.initSp + 7); cast(b, fresh); near(fresh.s.atk, fresh.base.atk * 1.14);
});
for (const mode of ['stun', 'freeze', 'sleep', 'retreat', 'death']) test(`unfired Attack is cancelled by ${mode}`, () => {
  const { b, u, receipts } = make(); const e = enemy(b); shot(b, u, e); advance(b, .2);
  if (mode === 'retreat') b.retreat(u); else if (mode === 'death') b.kill(u);
  else b.applyStatus(u, mode, { duration: .2 });
  advance(b, 1); assert.equal(outgoing(receipts, u).length, 0); assert.equal(b.projectiles.list.length, 0);
});
for (const mode of ['retreat', 'death', 'skillEnd']) test(`fired Volcano projectile survives ${mode} and reads impact stats`, () => {
  const { b, u, receipts } = make({ skill: 2 }); const e = enemy(b, { x: 7 }); cast(b, u); shot(b, u, e);
  assert.equal(b.projectiles.list.length, 1);
  if (mode === 'retreat') b.retreat(u); else if (mode === 'death') b.kill(u); else u.skill.end('test');
  advance(b, .5); assert.equal(outgoing(receipts, u).length, 1); near(outgoing(receipts, u)[0].amount, u.s.atk);
});
test('Ignition reserves one charge and SP only through windup; natural AI uses another only on another attack', () => {
  const { b, u, receipts } = make({ skill: 1, elite: 1, rank: 7 }); const e = enemy(b);
  u.skill.setSpTotal(u.skill.spCost * 2); u.atkCd = 0; u.profile.canAttack = () => true;
  advance(b, .05); assert.equal(u.skill.charges, 1); assert.equal(u.skill.pending, true);
  advance(b, .55); near(u.skill.spTotal, u.skill.spCost); assert.equal(outgoing(receipts, u).length, 0);
  advance(b, .5); assert.equal(outgoing(receipts, u).length, 2); assert.equal(u.skill.charges, 1);
  advance(b, 1.5); assert.equal(outgoing(receipts, u).length, 4); assert.equal(u.skill.charges, 0);
  assert.ok(u.skill.spTotal > 0); assert.ok(e.alive);
});
test('Ignition dead input refunds a reserved charge when release finds no replacement', () => {
  const { b, u, receipts } = make({ skill: 1, elite: 1 }); const e = enemy(b); cast(b, u); shot(b, u, e);
  b.kill(e); advance(b, .85); assert.equal(outgoing(receipts, u).length, 0);
  assert.equal(u.skill.charges, 1); assert.equal(u.skill.pending, false); assert.equal(Boolean(u.s.flags.noSp), false);
});
test('Ignition retargets a dead input to one replacement; no double shell or refund', () => {
  const { b, u, receipts } = make({ skill: 1, elite: 1 }); const e = enemy(b), a = enemy(b, { x: 7 });
  cast(b, u); shot(b, u, e); b.kill(e); advance(b, 1);
  assert.equal(outgoing(receipts, u).length, 2); assert.ok(outgoing(receipts, u).every(r => r.target === a));
  assert.equal(u.skill.charges, 0); assert.equal(u.skill.pending, false);
});
test('Ignition radius boundary, aerial splash, protected targets and main-only resistance refresh', () => {
  const { b, u, receipts } = make({ skill: 1 }); const e = enemy(b), edge = enemy(b, { x: 7.5, fly: true }), outside = enemy(b, { x: 7.501 });
  const hidden = enemy(b), untargetable = enemy(b), sleep = enemy(b);
  b.addBuff(hidden, { key: 'test:hidden', flags: { stealth: true } });
  b.addBuff(untargetable, { key: 'test:untargetable', flags: { untargetable: true } });
  b.addBuff(sleep, { key: 'test:sleep', flags: { sleep: true } });
  cast(b, u); shot(b, u, e); advance(b, .9);
  assert.deepEqual(outgoing(receipts, u).map(r => r.target), [e, edge, e]);
  for (const z of [outside, hidden, untargetable, sleep]) near(z.hp, z.s.maxHp);
  advance(b, 4); cast(b, u); shot(b, u, e); advance(b, .9); advance(b, 2);
  assert.ok(e.findBuff(`eyja:res:${u.id}`)); assert.equal(edge.findBuff(`eyja:res:${u.id}`), null);
  advance(b, 4.1); assert.equal(e.findBuff(`eyja:res:${u.id}`), null);
});
test('Ignition two separate hits respect Arts dodge, shield and lethal area order', () => {
  const { b, u, receipts } = make({ skill: 1 }); const e = enemy(b), a = enemy(b, { x: 7 });
  const amount = u.s.atk * bbFor(1, 10).atk_scale;
  b.addBuff(e, { key: 'test:shield', mods: { shield: amount / 2 } }); cast(b, u); shot(b, u, e); advance(b, .9);
  const rs = outgoing(receipts, u); assert.equal(rs.length, 3); near(rs[0].amount, amount / 2); near(rs[2].amount, amount);
  const dodge = enemy(b); b.addBuff(dodge, { key: 'test:dodge', mods: { dodgeArts: 1 } });
  advance(b, 3); cast(b, u); shot(b, u, dodge); advance(b, .9); near(dodge.hp, dodge.s.maxHp);
  const lethal = enemy(b); lethal.hp = 1; advance(b, 3); cast(b, u); shot(b, u, lethal); advance(b, .9);
  assert.equal(outgoing(receipts, u).filter(r => r.target === lethal).length, 1); assert.equal(lethal.alive, false); assert.ok(a.hp < a.s.maxHp);
});
test('Volcano mode interrupts an unfinished ordinary shot and restores its clock cleanly', () => {
  const { b, u, receipts } = make({ skill: 2 }); const e = enemy(b); shot(b, u, e); advance(b, .2); cast(b, u);
  advance(b, .8); assert.equal(outgoing(receipts, u).length, 0);
  shot(b, u, e); advance(b, .3); assert.equal(outgoing(receipts, u).length, 1);
  u.skill.end('test'); shot(b, u, e); advance(b, .6); assert.equal(outgoing(receipts, u).length, 1);
  advance(b, .3); assert.equal(outgoing(receipts, u).length, 2); near(outgoing(receipts, u).at(-1).amount, u.s.atk);
});
