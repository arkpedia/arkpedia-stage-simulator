// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { deployRegularSummon, retreatRegularSummon, summonPlacementError } from '../server/sim/content/arkpedia-summons.js';
import { summonRecordFor } from '../shared/arkpedia/summons.js';
const ID = 'char_4048_doroth', TOKEN = 'token_10025_doroth_recttp', KEY = `summon:${ID}`;
const near = (a, z) => assert.ok(Math.abs(a - z) < 1e-5, `${a} != ${z}`);
function advance(b, seconds) { for (let i = 0; i < Math.ceil(seconds / b.dt - 1e-9); i++) b.step(); assert.deepEqual(b.errors, []); }
function make({ skill = 0, rank = 10, elite = 2, potential = 1, dir = 'RIGHT', retainBorn = false, defer = false } = {}) {
 const d = structuredClone(data), o = d.operators[ID];
 d.stage.geometry.waves[0].spawns = []; d.stage.battle.dp_per_second = 0;
 d.stage.geometry.rows = 19; d.stage.geometry.cols = 21;
 d.stage.geometry.tileGrid = Array.from({ length: 19 }, () => Array(21).fill(2));
 const build = { ...defaultBuild(o), elite, potential, level: o.phases[elite].maxLevel,
  skillId: o.skills[skill].id, skillRank: Math.min(rank, [4, 7, 10][elite]) };
 const b = new StandardBattle(d, { operators: [build] });
 b.autoFinish = false; b.setViewport('fullscreen-workspace'); b.recordEvents = true;
 b.grid.tiles = b.grid.tiles.map(t => ({ ...t, height: 'LOW', build: 'ALL', pass: 'ALL' }));
 const deploy = () => { b.addDp('arkpedia', 99); const u = b.deployOperator(ID, 5, 5, dir); u.atkCd = 1000; return u; };
 const receipts = []; b.on('damaged', c => receipts.push({ ...c, time: b.time }));
 const u = defer ? null : deploy(), state = b.regularSummons?.get(KEY);
 if (!defer && !retainBorn) {
  for (const t of b.allyUnits.filter(t => t.defId === TOKEN)) b.retreat(t, { permanent: true });
  state.readyAt = b.time; // isolate manually placed traps after verifying born cooldown separately
 }
 return { b, u, state, deploy, receipts, build };
}
function enemy(b, { x = 7, y = 5, def = 0, res = 0, fly = false } = {}) {
 const e = b.spawnEnemy('enemy_1007_slime', { pos: [y, x] });
 Object.assign(e.base, { maxHp: 100000, def, res, moveSpeed: 0 }); e.markDirty(); void e.s;
 e.hp = 100000; if (fly) e.motion = 'FLY';
 b.addBuff(e, { key: 'test:pin', flags: { noMove: true, disarm: true } }); b._buildEnemyIndex(); return e;
}
function place(b, row = 5, col = 7) { b.addDp('arkpedia', 99); return deployRegularSummon(b, KEY, row, col); }
const hits = (rs, t, e) => rs.filter(r => r.source === t && r.target === e);
const devices = b => b.allyUnits.filter(t => t.defId === TOKEN && t.alive && t.deployed);

test('all promotions/potentials retain stock independently of free traps and source cooldown', () => {
 for (const elite of [0, 1, 2]) for (let potential = 1; potential <= 6; potential++) {
  const { b, u, state } = make({ elite, potential, retainBorn: true });
  assert.equal(state.stock, [4, 6, 8][elite] + (potential >= 3 ? 2 : 0));
  assert.equal(state.record.stats.maxDeckStackCnt, [6, 8, 10][elite]);
  assert.equal(state.record.stats.maxDeployCount, [6, 8, 10][elite]);
  assert.equal(state.record.stats.cost, 3); assert.equal(state.record.stats.respawnTime, 5);
  assert.equal(devices(b).length, elite); assert.equal(b.deployedSlots(), 1);
  near(b.dp, 99 - u.base.cost); near(state.readyAt, elite ? 5 : 0);
  for (const t of devices(b)) { assert.ok(u.rangeKeySet.has(t.tileR * 21 + t.tileC)); assert.equal(t.mem.regularSummonCard, KEY); }
  assert.equal(u.mem.dorothyStacks, 0);
 }
});
test('free placement uses only eligible unoccupied ground tiles and tolerates no eligible tiles', () => {
 for (const available of [0, 1, 2]) {
  const { b, deploy } = make({ defer: true }); b.grid.tiles.forEach(t => t.build = 'RANGED');
  for (const col of [6, 7].slice(0, available)) b.grid.tile(5, col).build = 'MELEE';
  const u = deploy(); assert.equal(devices(b).length, available);
  assert.ok(devices(b).every(t => t.tileR === 5 && [6, 7].includes(t.tileC)));
  assert.equal(b.regularSummons.get(KEY).stock, 8); assert.equal(u.mem.dorothyStacks, 0);
 }
 const { b, deploy } = make({ defer: true }); b.grid.tiles.forEach(t => t.build = 'RANGED');
 b.grid.tile(5, 6).build = 'MELEE'; enemy(b, { x: 6 }); deploy(); assert.equal(devices(b).length, 0);
});
test('all thirty selected ranks preserve matching trap blackboards, one explosion and damage type', () => {
 for (const skill of [0, 1, 2]) for (let rank = 1; rank <= 10; rank++) {
  const { b, u, state, receipts } = make({ skill, rank }); u.skill.rule = 'NEVER';
  assert.deepEqual(state.record.skill.bb, u.def.skill.bb);
  const t = place(b), e = enemy(b, { x: 7.1, def: 200, res: 25 }); advance(b, .9);
  const rs = hits(receipts, t, e); assert.equal(rs.length, 1); assert.equal(t.alive, false);
  const amount = t.base.atk * u.skill.bb.atk_scale;
  near(rs[0].amount, skill === 2 ? amount * .75 : Math.max(amount - 200 * (skill === 0 ? 1 + u.skill.bb.def : 1), .05 * amount));
  assert.equal(rs[0].dmg.type, skill === 2 ? 'arts' : 'phys');
  assert.equal(rs[0].dmg.isSkill, true); assert.equal(u.mem.dorothyStacks, 1);
 }
});
test('rank/capacity validation rejects unsupported skill, missing cross and extra blackboard', () => {
 const { build } = make();
 assert.throws(() => summonRecordFor(ID, { ...build, skillId: 'fake' }, data.tokens), /Unsupported Dorothy/);
 assert.throws(() => summonRecordFor(ID, { ...build, elite: 0, level: 1, skillId: 'skchr_doroth_3' }, data.tokens), /Unsupported Dorothy/);
 for (const kind of ['capacity', 'range', 'bb']) {
  const raw = structuredClone(data.tokens);
  if (kind === 'capacity') raw[TOKEN].phases[2].attributesKeyFrames.forEach(k => k.data.maxDeckStackCnt = 20);
  if (kind === 'range') delete raw[TOKEN].skills[2].levels[9].rangeGrid;
  if (kind === 'bb') raw[TOKEN].skills[0].levels[9].blackboard.push({ key: 'fake', value: 1 });
  assert.throws(() => summonRecordFor(ID, kind === 'range' ? { ...build, skillId: 'skchr_doroth_3' } : build, raw), /Unreviewed/);
 }
});
test('automatic recharge pauses at full stock and resumes after paid placement', () => {
 const { b, u, state } = make(); advance(b, 24.1); assert.equal(state.stock, 10); assert.equal(u.s.flags.noSp, true);
 const sp = u.skill.spTotal; advance(b, 20); near(u.skill.spTotal, sp);
 place(b); assert.equal(state.stock, 9); assert.equal(!!u.s.flags.noSp, false);
 advance(b, 12.1); assert.equal(state.stock, 10);
 const full = make({ potential: 3 }); assert.equal(full.u.s.flags.noSp, true);
 full.u.skill.setSpTotal(full.u.skill.spCost); assert.equal(full.b.activateOperator(ID), false); assert.equal(full.state.stock, 10);
});
test('paid placement, invalid ground occupation, field limit and manual withdrawal preserve accounting', () => {
 const { b, state, u } = make(); b.unitLimit = b.deployedSlots(); const dp = b.dp, stock = state.stock;
 const t = deployRegularSummon(b, KEY, 5, 7, 'LEFT'); near(b.dp, dp - 3);
 assert.equal(state.stock, stock - 1); near(state.readyAt, 5); assert.equal(t.dir, 'RIGHT');
 assert.equal(t.s.flags.invulnerable, true); assert.equal(t.s.flags.untargetable, true);
 assert.equal(t.s.flags.healFree, true); assert.equal(b.deployedSlots(), 1);
 assert.throws(() => deployRegularSummon(b, KEY, 5, 8), /redeploying/); advance(b, 5.1);
 const e = enemy(b, { x: 8 }); const before = [b.dp, state.stock, state.readyAt];
 assert.throws(() => deployRegularSummon(b, KEY, 5, 8), /ground enemy/); assert.deepEqual([b.dp, state.stock, state.readyAt], before);
 e.motion = 'FLY'; assert.equal(summonPlacementError(b, KEY, 5, 8), null);
 const n = state.record.stats.maxDeployCount; state.record.stats.maxDeployCount = 1;
 assert.match(summonPlacementError(b, KEY, 5, 8), /Summon deployment limit/); state.record.stats.maxDeployCount = n;
 retreatRegularSummon(b, `token:${t.id}`); near(b.dp, dp - 3); assert.equal(state.stock, stock - 1); assert.equal(u.mem.dorothyStacks, 0);
});
test('entrance and first event precede a single hit; S1 retains its victim and DEF reduction after removal', () => {
 const { b, u, receipts } = make(); const t = place(b), e = enemy(b, { x: 7.1 }), z = enemy(b, { x: 7.2 });
 advance(b, .4); assert.equal(t.mem.regularFormVisual.clip, 'Start'); assert.equal(receipts.length, 0);
 advance(b, .067); assert.equal(t.mem.regularFormVisual.clip, 'Attack'); assert.equal(u.mem.dorothyStacks, 1);
 advance(b, .2); assert.equal(receipts.length, 0); advance(b, .2);
 assert.equal(hits(receipts, t, e).length, 1); near(z.hp, 100000); near(e.s.def, 0); assert.ok(e.findBuff('dorothy:def-down'));
 advance(b, 5.1); assert.equal(e.findBuff('dorothy:def-down'), null);
 const invalid = make(); const tt = place(invalid.b), ee = enemy(invalid.b); advance(invalid.b, .467);
 invalid.b.addBuff(ee, { key: 'free', flags: { untargetable: true } }); enemy(invalid.b);
 advance(invalid.b, .4); assert.equal(invalid.receipts.length, 0); assert.equal(tt.alive, false); assert.equal(invalid.u.mem.dorothyStacks, 1);
});
test('S2 resamples radius at impact and selects long Bind only for exactly one eligible victim', () => {
 for (const count of [1, 2]) {
  const { b, receipts } = make({ skill: 1 }); const t = place(b), e = enemy(b), z = enemy(b, { x: 8.1, fly: count === 1 });
  const outside = enemy(b, { x: 8.21 }); advance(b, .9);
  assert.equal(hits(receipts, t, e).length, 1); assert.equal(hits(receipts, t, z).length, count - 1); near(outside.hp, 100000);
  advance(b, 3.6); assert.equal(!!e.s.flags.root, count === 1); advance(b, 2.5); assert.equal(!!e.s.flags.root, false);
 }
 const { b, receipts } = make({ skill: 1 }); const t = place(b); enemy(b); advance(b, .467);
 const late = enemy(b, { x: 8 }); b.on('beforeStatus', c => c.cancel = true); advance(b, .4);
 assert.equal(hits(receipts, t, late).length, 1); assert.equal(!!late.s.flags.root, false);
});
test('air and hidden/free enemies cannot trigger traps; S3 cross excludes diagonals and scales Arts against RES', () => {
 for (const flag of ['air', 'sleep', 'camou', 'stealth', 'untargetable']) {
  const { b, receipts } = make({ skill: 2 }); const t = place(b), e = enemy(b);
  if (flag === 'air') e.motion = 'FLY'; else b.addBuff(e, { key: 'concealed', flags: { [flag]: true } });
  advance(b, 1); assert.equal(receipts.length, 0); assert.equal(t.alive, true);
 }
 const { b, receipts } = make({ skill: 2 }); const t = place(b); enemy(b);
 const cross = enemy(b, { x: 9, res: 50 }), diagonal = enemy(b, { x: 8, y: 6 }); advance(b, .9);
 near(hits(receipts, t, cross)[0].amount, t.base.atk * 3.5 * .5); near(diagonal.hp, 100000);
 assert.equal(!!cross.findBuff('sluggish'), true); advance(b, 5.1); assert.equal(!!cross.findBuff('sluggish'), false);
});
test('S3 chains through same-owner cross traps after 2s without enemy contact and cannot double-explode', () => {
 const { b, state, receipts, u } = make({ skill: 2 }); u.skill.rule = 'NEVER';
 const first = place(b); state.readyAt = b.time; const second = place(b, 5, 9); state.readyAt = b.time;
 const third = place(b, 5, 11); state.readyAt = b.time; const diagonal = place(b, 6, 10);
 const e = enemy(b), victim = enemy(b, { x: 10 }); advance(b, .9);
 assert.equal(first.alive, false); assert.equal(second.alive, true); assert.ok(second.mem.dorothyChainAt > b.time);
 assert.equal(third.mem.dorothyChainAt, undefined); assert.equal(hits(receipts, second, victim).length, 0);
 advance(b, 1.8); assert.equal(second.alive, true); advance(b, .6);
 assert.equal(second.alive, false); assert.equal(hits(receipts, second, victim).length, 1); assert.equal(!!victim.findBuff('sluggish'), true);
 assert.ok(third.mem.dorothyChainAt > b.time); assert.equal(diagonal.mem.dorothyChainAt, undefined);
 advance(b, 3); assert.equal(third.alive, false); assert.equal(diagonal.alive, true);
 assert.equal(u.mem.dorothyStacks, 3); assert.equal(hits(receipts, first, e).length, 1); assert.equal(hits(receipts, second, victim).length, 1);
});
test('pending chain coalesces refreshed marks and enemy contact cancels the later explosion', () => {
 const { b, receipts, u } = make({ skill: 2 }); const t = place(b); advance(b, .5);
 t.mem.dorothyChain(2); advance(b, 1); t.mem.dorothyChain(2); advance(b, 1.1); assert.equal(t.alive, true);
 const e = enemy(b); advance(b, .5); assert.equal(t.alive, false); advance(b, 3);
 assert.equal(hits(receipts, t, e).length, 1); assert.equal(u.mem.dorothyStacks, 1);
});
test('Dreamer gains at trigger start, caps by potential, preserves sampled trap ATK and original mode clips', () => {
 for (const potential of [1, 5]) {
  const { b, u, state } = make({ potential }); u.skill.rule = 'NEVER'; const atk = u.s.atk;
  for (let i = 0; i < 13; i++) {
   state.readyAt = b.time; state.stock = 10; const t = place(b), sampled = t.base.atk, e = enemy(b);
   advance(b, .467); near(t.base.atk, sampled); advance(b, .4); b.kill(e);
  }
  assert.equal(u.mem.dorothyStacks, potential >= 5 ? 12 : 10); near(u.s.atk, atk * (potential >= 5 ? 1.24 : 1.2));
  assert.equal(u.mem.regularFormVisual.clip, 'Idle_2'); assert.equal(u.profile.attackVisual(b, u), 'Attack_2');
 }
 const { b, u } = make({ elite: 1 }); place(b); enemy(b); advance(b, .9); assert.equal(u.mem.dorothyStacks, 0);
});
test('owner removal cancels trap/chain callbacks and redeployment resets Dreamer and stock', () => {
 const { b, u, state, receipts, deploy } = make({ skill: 2 }); const t = place(b); enemy(b); advance(b, .467);
 state.readyAt = b.time; const pending = place(b, 5, 10); pending.mem.dorothyChain(2);
 b.retreatOperator(ID); assert.equal(t.alive, false); assert.equal(pending.alive, false); advance(b, 100); assert.equal(receipts.length, 0);
 const fresh = deploy(); assert.notEqual(fresh, u); assert.equal(fresh.mem.dorothyStacks, 0); assert.equal(b.regularSummons.get(KEY).stock, 8);
});
test('ordinary tracked shots hit ground or air once, use source timing and survive owner removal after release', () => {
 for (const dir of ['LEFT', 'RIGHT', 'UP', 'DOWN']) {
  const { b, u, receipts } = make({ dir }); const e = enemy(b, { x: dir === 'LEFT' ? 4 : 6, fly: true });
  assert.equal(b.forceAttack(u, [e]), true); u.atkCd = 1000;
  advance(b, .2); assert.equal(b.projectiles.list.length, 0); advance(b, .334);
  assert.equal(hits(receipts, u, e).length, 1); near(hits(receipts, u, e)[0].amount, u.s.atk * u.s.atkScaleMul);
  assert.equal(hits(receipts, u, e)[0].dmg.isSkill, false);
 }
 const { b, u, receipts } = make(); const e = enemy(b, { x: 8, fly: true });
 b.forceAttack(u, [e]); u.atkCd = 1000; advance(b, .367); assert.equal(b.projectiles.list.length, 1);
 b.retreatOperator(ID); advance(b, 1); assert.equal(hits(receipts, u, e).length, 1);
});
