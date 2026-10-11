// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import evidence from '../data/arkpedia-pozemka-prefabs.json' with { type: 'json' };
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { effectiveProfile } from '../server/sim/ai.js';
import { absoluteRangeKeys } from '../server/sim/targeting.js';
import { summonRecordFor } from '../shared/arkpedia/summons.js';
import { deployRegularSummon, retreatRegularSummon, summonPlacementError } from '../server/sim/content/arkpedia-summons.js';
const ID = 'char_4055_bgsnow', TOKEN = 'token_10026_bgsnow_subbow', KEY = `summon:${ID}`;
const near = (a, z) => assert.ok(Math.abs(a - z) < 1e-5, `${a} != ${z}`);
function advance(b, s) { for (let i = 0; i < Math.ceil(s / b.dt - 1e-9); i++) b.step(); assert.deepEqual(b.errors, []); }
function make({ skill = 0, rank = 10, elite = 2, potential = 1, dir = 'RIGHT' } = {}) {
  const d = structuredClone(data), o = d.operators[ID];
  d.stage.geometry.waves[0].spawns = []; d.stage.battle.dp_per_second = 0;
  d.stage.geometry.rows = 19; d.stage.geometry.cols = 21;
  d.stage.geometry.tileGrid = Array.from({ length: 19 }, () => Array(21).fill(2));
  const build = { ...defaultBuild(o), elite, potential, level: o.phases[elite].maxLevel,
    skillId: o.skills[skill].id, skillRank: Math.min(rank, [4, 7, 10][elite]) };
  const b = new StandardBattle(d, { operators: [build] });
  b.autoFinish = false; b.setViewport('fullscreen-workspace'); b.recordEvents = true;
  b.grid.tiles = b.grid.tiles.map(t => ({ ...t, height: 'HIGH', build: 'ALL', pass: 'ALL' }));
  b.addDp('arkpedia', 99); const u = b.deployOperator(ID, 5, 5, dir); u.skill.rule = 'NEVER';
  const receipts = []; b.on('damaged', c => receipts.push({ ...c, time: b.time }));
  const activate = () => { u.skill.setSpTotal(u.skill.spCost * u.skill.maxCharges);
    if (skill === 0) { u.skill.rule = 'SP_FULL'; advance(b, b.dt); assert.equal(u.skill.active, true); }
    else assert.equal(b.activateOperator(ID), true); };
  const place = (row = 10, col = 5, facing = dir) => { b.addDp('arkpedia', 99);
    return deployRegularSummon(b, KEY, row, col, facing); };
  return { b, u, receipts, activate, place, build, state: b.regularSummons.get(KEY) };
}
function enemy(b, { x = 6, y = 5, def = 0, hp = 100000, fly = false, flag } = {}) {
  const e = b.spawnEnemy('enemy_1007_slime', { pos: [y, x] });
  Object.assign(e.base, { maxHp: hp, def, res: 0, moveSpeed: 0 }); e.markDirty(); void e.s; e.hp = hp;
  if (fly) e.motion = 'FLY';
  b.addBuff(e, { key: 'test:pin', flags: { noMove: true, disarm: true, ...(flag ? { [flag]: true } : {}) } });
  b._buildEnemyIndex(); return e;
}
function force(b, u, e) { u.atkCd = 1000; b.forceAttack(u, [e]); u.atkCd = 1000; }

test('all thirty ranks retain independent owner/token skills, SP charges and no visible token control', () => {
  for (const skill of [0, 1, 2]) for (let rank = 1; rank <= 10; rank++) {
    const { b, u, state, place, build } = make({ skill, rank });
    assert.equal(state.stock, 1); assert.equal(state.record.stats.cost, 5);
    assert.equal(state.record.stats.respawnTime, 40); assert.equal(state.record.stats.atk, 866);
    assert.equal(u.skill.maxCharges, skill === 1 && rank >= 4 ? 2 : 1);
    const expected = Object.fromEntries(evidence.tables.tokenSkills[`sktok_bgsnow_${skill + 1}`]
      .levels[rank - 1].blackboard.map(r => [r.key, r.value]));
    assert.deepEqual(state.record.skill.bb, expected);
    const t = place(); assert.equal(t.skill.noSkill, true); assert.equal(t.s.atk, 866);
    assert.equal(t.base.atk, 866); assert.notEqual(t.s.atk, u.s.atk); assert.equal(b.deployedSlots(), 1);
    assert.equal(build.skillRank, rank); assert.deepEqual(b.errors, []);
  }
});
test('promotion rules and malformed selected token records fail closed', () => {
  for (const elite of [0, 1, 2]) {
    const { build, state, place } = make({ elite });
    assert.equal(state.record.talents[0].bb.interval, [15, 20, 25][elite]);
    assert.equal(place().base.atk, [506, 666, 866][elite]);
    if (elite < 2) assert.equal(state.record.talents[1], undefined);
    if (elite < 2) assert.throws(() => summonRecordFor(ID, { ...build, skillId: 'skchr_bgsnow_3' }, data.tokens), /Unsupported/);
    assert.throws(() => summonRecordFor(ID, { ...build, skillRank: 11 }, data.tokens), /Unsupported/);
  }
  const { build } = make();
  for (const change of [r => r.skills[0].levels[9].blackboard.push({ key: 'fake', value: 1 }),
    r => r.phases[2].attributesKeyFrames.forEach(k => k.data.respawnTime = 20), r => r.talents = []]) {
    const tokens = structuredClone(data.tokens); change(tokens[TOKEN]);
    assert.throws(() => summonRecordFor(ID, build, tokens), /Unreviewed/);
  }
});
test('Typewriter uses raised tiles, chosen facing, cost5, zero slots and one active device', () => {
  const { b, u, state, place } = make();
  b.grid.tiles[10 * 21 + 5].build = 'MELEE';
  assert.match(summonPlacementError(b, KEY, 10, 5), /high-ground/);
  b.grid.tiles[10 * 21 + 5].build = 'RANGED';
  assert.equal(summonPlacementError(b, KEY, 5, 5), 'Tile is occupied.');
  b.getPlayer('arkpedia').dp = 4; assert.match(summonPlacementError(b, KEY, 10, 5), /DP/);
  b.addDp('arkpedia', 99); const dp = b.dp;
  const t = deployRegularSummon(b, KEY, 10, 5, 'LEFT'); near(b.dp, dp - 5);
  assert.equal(t.dir, 'LEFT'); assert.equal(t.kind, 'device'); assert.equal(t.s.blockCnt, 0);
  assert.equal(t.s.flags.invulnerable, true); assert.equal(t.s.flags.untargetable, true);
  assert.equal(state.stock, 0); assert.match(summonPlacementError(b, KEY, 10, 6), /remaining/);
  assert.deepEqual(t.rangeKeys, absoluteRangeKeys(t.def.rangeGrid, 10, 5, 'LEFT'));
  assert.equal(u.alive, true); assert.equal(b.deployedSlots(), 1); assert.equal(t.mem.noInspire, true);
});
test('ordinary first-only Begin resets after losing targets; attack speed remains uncapped', () => {
  const { b, u, receipts } = make(), e = enemy(b); u.atkCd = 1000;
  const p = effectiveProfile(u); near(p.windup(b, u), .5 + .13333334028720856);
  assert.equal(typeof p.attackVisual(b, u), 'object'); near(p.windup(b, u), .13333334028720856);
  b.addBuff(u, { key: 'test:speed', mods: { aspd: 100 } }); u.mem.pozemkaEngaged = false;
  near(p.windup(b, u), (.5 + .13333334028720856) / 2);
  e.hidden = true; advance(b, .1); assert.equal(u.mem.pozemkaEngaged, false); e.hidden = false;
  u.mem.pozemkaEngaged = false; force(b, u, e); advance(b, .2); assert.equal(receipts.length, 0);
  advance(b, .25); assert.equal(receipts.length, 1); assert.equal(receipts[0].dmg.type, 'phys');
  near(receipts[0].amount, u.s.atk);
});
test('normal owner and Typewriter attacks hit one target including flyers; no splash', () => {
  for (const fly of [false, true]) {
    const { b, u, place, receipts } = make(); u.atkCd = 1000;
    const e = enemy(b, { fly }), other = enemy(b, { x: 6.1, fly });
    force(b, u, e); advance(b, .9);
    assert.equal(receipts.filter(r => r.source === u).length, 1); near(other.hp, 100000);
    const t = place(); advance(b, .7); t.atkCd = 1000;
    const te = enemy(b, { x: 6, y: 10, fly }); force(b, t, te); advance(b, .3);
    near(te.hp, 100000 - t.s.atk); assert.equal(receipts.filter(r => r.source === t).length, 1);
  }
});
for (const rank of Array.from({ length: 10 }, (_, i) => i + 1)) test(`S1 rank${rank} applies own ATK and calculated-damage Dice to both independent sources`, () => {
  const { b, u, place, activate, receipts } = make({ rank }); u.atkCd = 1000;
  activate(); const t = place(); t.atkCd = 1000; advance(b, .7); u.atkCd = t.atkCd = 1000;
  near(u.s.atk, u.base.atk * (1 + u.skill.bb.atk)); near(t.s.atk, t.base.atk * (1 + t.def.skill.bb.atk));
  assert.equal(t.mem.pozemkaMode, 1);
  for (const [a, x, y] of [[u, 6, 5], [t, 6, 10]]) {
    const e = enemy(b, { x, y }); b.rng = () => .999;
    force(b, a, e); advance(b, .5); near(receipts.at(-1).amount, a.s.atk);
    b.rng = () => 0; force(b, a, e); advance(b, .5);
    near(receipts.at(-1).amount, a.s.atk * a.def.skill.bb.atk_scale);
  }
});
test('S1 is attack-recovery automatic and remains active indefinitely; Back event is later than Front', () => {
  for (const dir of ['RIGHT', 'LEFT']) {
    const { b, u } = make({ dir }); const e = enemy(b, { x: dir === 'LEFT' ? 4 : 6 });
    u.skill.rule = 'DEFAULT'; u.skill.setSpTotal(u.skill.spCost - 1);
    force(b, u, e); advance(b, .9); assert.equal(u.skill.ready, true);
    u.atkCd = 0; advance(b, .1); assert.equal(u.skill.active, true);
    advance(b, .7); const p = effectiveProfile(u);
    near(p.windup(b, u), dir === 'LEFT' ? .30000001192092896 : .13333334028720856);
    b.addBuff(u, { key: 'test:speed', mods: { aspd: 100 } });
    near(p.windup(b, u), dir === 'LEFT' ? .30000001192092896 : .13333334028720856);
    e.hidden = true; advance(b, 50); assert.equal(u.skill.active, true);
  }
});
for (const rank of Array.from({ length: 10 }, (_, i) => i + 1)) test(`S2 rank${rank} casts one projectile with three separately mitigated same-target receipts for each source`, () => {
  const { b, u, place, activate, receipts } = make({ skill: 1, rank }); u.atkCd = 1000;
  const e = enemy(b, { def: 100 }), other = enemy(b, { x: 6.1 });
  const t = place(); t.atkCd = 1000; const te = enemy(b, { x: 6, y: 10, def: 100 });
  advance(b, .7); u.atkCd = t.atkCd = 1000; activate(); advance(b, .8);
  for (const [a, target, defense] of [[u, e, 100], [t, te, 82]]) {
    const hits = receipts.filter(r => r.source === a && r.dmg.tags.includes('pozemka:s2'));
    assert.equal(hits.length, 3); assert.ok(hits.every(r => r.target === target));
    near(hits[0].time, hits[1].time); near(hits[1].time, hits[2].time);
    assert.deepEqual(hits.map(r => r.dmg.isAttack), [true, false, false]);
    for (const r of hits) near(r.amount, a.s.atk * a.def.skill.bb.atk_scale - defense);
  }
  near(other.hp, 100000); assert.equal(b.projectiles.list.length, 0);
});
test('S2 checks expanded selected range, cannot cast without an owner target, and token can miss independently', () => {
  const { b, u, place, activate, receipts } = make({ skill: 1 }); u.atkCd = 1000;
  const t = place(); t.atkCd = 1000; advance(b, .7); t.atkCd = 1000;
  u.skill.setSpTotal(18); assert.equal(b.activateOperator(ID), false); near(u.skill.spTotal, 18);
  const e = enemy(b, { x: 8 }); assert.equal(u.rangeKeySet.has(5 * 21 + 8), false);
  activate(); advance(b, .9); assert.equal(receipts.filter(r => r.source === u).length, 3);
  assert.equal(receipts.filter(r => r.source === t).length, 0); assert.equal(e.alive, true);
  advance(b, 1); assert.equal(u.skill.active, false); assert.equal(u.skill.charges, 1);
  assert.equal(t.skill.noSkill, true);
});
test('S2 cast cancellation prevents unfired shots; fired shots survive retreat', () => {
  for (const afterFire of [false, true]) {
    const { b, u, activate, receipts } = make({ skill: 1 }); u.atkCd = 1000;
    const e = enemy(b, { x: 8 }); activate(); advance(b, afterFire ? .65 : .2);
    if (afterFire) { b.retreatOperator(ID); advance(b, .6); assert.equal(receipts.length, 3); }
    else { b.applyStatus(u, 'stun', { duration: .1 }); advance(b, .9); assert.equal(receipts.length, 0); }
    assert.equal(e.alive, true);
  }
});
for (const rank of Array.from({ length: 10 }, (_, i) => i + 1)) test(`S3 rank${rank} has front focus, lateral base coefficient and Typewriter's own full coefficient`, () => {
  const { b, u, place, activate, receipts } = make({ skill: 2, rank }); u.atkCd = 1000;
  activate(); const t = place(); t.atkCd = 1000; advance(b, .7); u.atkCd = t.atkCd = 1000;
  near(u.s.bat, 1.6 + u.skill.bb.base_attack_time); near(t.s.bat, 1.6 + t.def.skill.bb.base_attack_time);
  assert.equal(t.mem.pozemkaMode, 3); assert.ok(t.rangeKeySet.has(10 * 21 + 9));
  for (const [a, x, y, scale] of [[u, 6, 5, u.skill.bb['bgsnow_s_3[atk_up].atk_scale']],
    [u, 6, 6, u.skill.bb.atk_scale], [t, 9, 10, t.def.skill.bb['attack@atk_scale']]]) {
    const e = enemy(b, { x, y }); force(b, a, e); advance(b, .65);
    near(receipts.at(-1).amount, a.s.atk * scale);
  }
});
test('S3 focus is facing-specific and never borrowed from a different owner', () => {
  for (const [dir, x, y] of [['RIGHT', 6, 5], ['LEFT', 4, 5], ['UP', 5, 6], ['DOWN', 5, 4]]) {
    const { b, u, activate, receipts } = make({ skill: 2, dir }); u.atkCd = 1000;
    const e = enemy(b, { x, y }); activate(); advance(b, .8); u.atkCd = 1000;
    force(b, u, e); advance(b, .6); near(receipts.at(-1).amount, u.s.atk * 2.55);
  }
});
test('S3 late token inherits active mode and restores range/interval at owner end without its own timer', () => {
  const { b, u, place, activate } = make({ skill: 2 }); u.atkCd = 1000;
  activate(); advance(b, 5); const t = place(); t.atkCd = 1000; advance(b, .7);
  near(t.s.bat, 1); assert.equal(t.mem.pozemkaMode, 3);
  assert.ok(t.rangeKeySet.has(10 * 21 + 9)); advance(b, 20);
  assert.equal(t.mem.pozemkaMode, 3); assert.equal(u.skill.active, true);
  u.skill.end(); near(t.s.bat, 1.6); assert.equal(t.mem.pozemkaMode, 0);
  assert.equal(t.rangeKeySet.has(10 * 21 + 9), false);
  advance(b, .6); assert.equal(u.mem.regularFormVisual, null);
});
test('Typewriter DEF reduction precedes first-hit mitigation and lasts for selected potential duration', () => {
  for (const potential of [1, 5]) for (const adjacent of [false, true]) {
    const { b, u, place, receipts } = make({ potential }); u.atkCd = 1000;
    const t = place(adjacent ? 5 : 10, 6); t.atkCd = 1000; advance(b, .7); t.atkCd = 1000;
    const e = enemy(b, { x: 7, y: adjacent ? 5 : 10, def: 500 }); force(b, t, e); advance(b, .3);
    const ratio = potential === 5 ? adjacent ? .25 : .2 : adjacent ? .23 : .18;
    near(e.s.def, 500 * (1 - ratio)); near(receipts.at(-1).amount, 866 - e.s.def);
    advance(b, potential === 5 ? 5 : 4); near(e.s.def, 500);
  }
});
test('base and adjacent DEF holders do not multiply; weaker survives stronger expiry and unrelated reduction composes', () => {
  const { b, u, place } = make(); u.atkCd = 1000;
  const t = place(5, 6); t.atkCd = 1000; advance(b, .7); t.atkCd = 1000;
  const e = enemy(b, { x: 7, def: 1000 }); force(b, t, e); advance(b, .3); near(e.s.def, 770);
  advance(b, 2); t.tileR = 10; t.y = 10; force(b, t, e); advance(b, .8);
  near(e.s.def, 770); assert.ok(e.findBuff('bgsnow_token[def_down]_1'));
  b.addBuff(e, { key: 'other:def', mods: { defPct: -.2 } }); near(e.s.def, 616);
  advance(b, 1.5); near(e.s.def, 656); advance(b, 2.8); near(e.s.def, 800);
});
test('Typewriter lifetime/finish recharge uses elite seconds and S2 equipped ratio; early retreat starts clock at finish', () => {
  for (const elite of [0, 1, 2]) for (const skill of [0, ...(elite ? [1] : [])]) {
    const { b, state, place } = make({ elite, skill }); const t = place();
    const lifetime = [15, 20, 25][elite]; advance(b, lifetime - .1); assert.equal(t.alive, true);
    advance(b, .2); assert.equal(t.alive, false); assert.equal(state.stock, 1);
    const cooldown = 40 * (skill === 1 ? state.record.skill.bb.respawn_time : 1);
    near(state.readyAt, lifetime + cooldown);
    assert.match(summonPlacementError(b, KEY, 10, 5), /redeploying/);
    advance(b, cooldown); assert.equal(summonPlacementError(b, KEY, 10, 5), null);
  }
  const { b, state, place } = make({ skill: 1 }); const t = place(); advance(b, 3);
  const dp = b.dp; retreatRegularSummon(b, `token:${t.id}`); near(b.dp, dp); near(state.readyAt, b.time + 20);
});
test('owner removal clears all owned devices and keeps Typewriter cooldown through owner redeployment', () => {
  const { b, state, place } = make(); const t = place(); advance(b, 2);
  b.retreatOperator(ID); assert.equal(t.alive, false); assert.equal(state.stock, 1);
  const readyAt = state.readyAt; advance(b, 5);
  b.bench[ID].readyAt = b.time;
  b.addDp('arkpedia', 99); b.deployOperator(ID, 5, 5, 'RIGHT');
  assert.equal(b.regularSummons.get(KEY).readyAt, readyAt); assert.equal(b.regularSummons.get(KEY).stock, 1);
});
