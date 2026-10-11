// SPDX-License-Identifier: GPL-3.0-or-later
// Original-source engine fixtures; Ela remains outside the public roster.
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import e from '../data/arkpedia-ela-prefabs.json' with { type: 'json' };
import { StandardBattle } from '../server/sim/arkpedia.js';
import { normalizeChess } from '../server/sim/simdata.js';
import { sourceCandidate } from '../shared/arkpedia/summons.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { ELA_ID, ELA_MINE, ELA_INFLUENCE, ElaMineDeck, selectedElaMine, applyElaMineEffects }
  from '../server/sim/content/arkpedia-ela-mines.js';
const near = (a, z) => assert.ok(Math.abs(a - z) < 1e-5, `${a} != ${z}`);
function advance(b, seconds) {
  for (let i = 0; i < Math.ceil(seconds / b.dt - 1e-9); i++) b.step();
  assert.deepEqual(b.errors, []);
}
function make(options = {}) {
  const { elite = 2, potential = 1, skill = 1, rank = 10, defer = false } = options;
  const d = structuredClone(data);
  d.stage.geometry.waves[0].spawns = []; d.stage.battle.dp_per_second = 0;
  d.stage.geometry.rows = 19; d.stage.geometry.cols = 21;
  d.stage.geometry.tileGrid = Array.from({ length: 19 }, () => Array(21).fill(2));
  const b = options.battle ?? new StandardBattle(d, { operators: [defaultBuild(d.operators.char_289_gyuki)] });
  b.autoFinish = false; b.setViewport('fullscreen-workspace'); b.recordEvents = true;
  b.grid.tiles = b.grid.tiles.map(t => ({ ...t, height: 'LOW', build: 'ALL', pass: 'ALL' }));
  const c = e.tables.character, phase = c.phases[elite], id = `skchr_ela_${skill}`;
  const build = { elite, potential, level: phase.maxLevel, skillId: id, skillRank: Math.min(rank, [4, 7, 10][elite]) };
  const level = e.tables.skills[id].levels[build.skillRank - 1];
  const def = normalizeChess({ chessId: ELA_ID, charId: ELA_ID, name: c.name,
    stats: phase.attributesKeyFrames.at(-1).data, profession: c.profession, position: c.position,
    rangeGrid: e.tables.ranges[phase.rangeId].grids.map(g => [g.row, g.col]),
    talents: c.talents.map(t => sourceCandidate(t.candidates, build)).filter(Boolean),
    skill: { ...level, ...level.spData, skillId: id, trigger: { rule: 'NEVER' } }, arkpedia: build });
  const u = b._makeAlly(b.getPlayer('arkpedia'), def, 'op', 5, 5, { dir: 'RIGHT' });
  b._setupUnit(u, { trait: { noAttack: true }, skill: { id, kind: 'instant', trigger: 'NEVER' } });
  const deck = new ElaMineDeck(b, u, build);
  const deploy = () => { assert.equal(b._deploy(u, { initial: false }), true); b.addDp('arkpedia', 99); };
  if (!defer) deploy();
  const outputs = [], receipts = [];
  b.on('elaMine', ctx => outputs.push({ ...ctx, time: b.time }));
  b.on('damaged', ctx => receipts.push(ctx));
  return { b, u, deck, build, deploy, outputs, receipts };
}
function enemy(b, { x = 8.2, y = 5, fly = false, area = null } = {}) {
  const t = b.spawnEnemy('enemy_1007_slime', { pos: [y, x] });
  Object.assign(t.base, { maxHp: 100000, atk: 500, def: 0, res: 0, moveSpeed: 0 });
  t.hp = 100000; if (fly) t.motion = 'FLY'; if (area) t.hitArea = area;
  b.addBuff(t, { key: 'fixture:pin', flags: { noMove: true, disarm: true } });
  t.markDirty(); void t.s; b._buildEnemyIndex(); return t;
}
const devices = f => f.b.allyUnits.filter(t => t.defId === ELA_MINE && t.alive && t.deployed);

test('every promotion/potential selects initial supply, total capacity and independent token stats', () => {
  for (const elite of [0, 1, 2]) for (let potential = 1; potential <= 6; potential++) {
    const f = make({ elite, potential }), r = f.deck.record;
    assert.equal(f.deck.state.stock, elite + 1 + (potential >= 3 ? 1 : 0));
    assert.equal(r.stats.maxDeckStackCnt, elite + 2); assert.equal(r.stats.maxDeployCount, elite + 2);
    assert.equal(r.sourceStats.maxDeckStackCnt, elite + 1);
    assert.equal(r.stats.cost, 5); assert.equal(r.stats.respawnTime, 5); assert.equal(r.stats.atk, 100);
    assert.equal(devices(f).length, 0); assert.equal(f.b.deployedSlots(), 1);
    f.b.addBuff(f.u, { key: 'fixture:owner-atk', mods: { atkPct: 2 } });
    assert.equal(f.deck.record.stats.atk, 100);
  }
});

test('all thirty selected ranks retain owner/mine pairing and reject invalid or module builds', () => {
  for (const skill of [1, 2, 3]) for (let rank = 1; rank <= 10; rank++) {
    const f = make({ skill, rank });
    assert.deepEqual(f.deck.record.skill.bb, f.u.def.skill.bb);
    assert.equal(f.deck.record.index, skill - 1);
  }
  const build = make().build;
  for (const bad of [null, { ...build, elite: -1 }, { ...build, level: 91 }, { ...build, potential: 7 },
    { ...build, skillId: 'fake' }, { ...build, elite: 0, level: 1, skillId: 'skchr_ela_2', skillRank: 1 },
    { ...build, skillRank: 11 }, { ...build, module: { id: 'uniequip_ela', stage: 3 } }])
    assert.throws(() => selectedElaMine(bad));
});

test('paid placement charges five DP, ignores unit slots/host range and holds a five-second clock', () => {
  const f = make(), { b, deck } = f; b.unitLimit = 1;
  const dp = b.dp, stock = deck.state.stock, t = deck.place(5, 12);
  assert.equal(t.dir, 'RIGHT'); near(b.dp, dp - 5); assert.equal(deck.state.stock, stock - 1);
  assert.equal(b.deployedSlots(), 1); near(deck.state.readyAt, b.time + 5);
  assert.equal(t.s.flags.invulnerable, true); assert.equal(t.s.flags.untargetable, true);
  assert.equal(t.s.flags.healFree, true); assert.equal(t.mem.regularFormVisual.die, null);
  const old = [b.dp, deck.state.stock, deck.state.readyAt];
  assert.throws(() => deck.place(5, 13), /redeploying/);
  assert.deepEqual([b.dp, deck.state.stock, deck.state.readyAt], old);
  advance(b, 5.1); deck.place(5, 13); assert.equal(deck.state.stock, stock - 2);
});

test('invalid placements do not spend DP/stock/cooldown; ground occupation differs from air', () => {
  const f = make(), { b, deck } = f, occupied = enemy(b, { x: 7 });
  const check = (row, col, pattern) => {
    const old = [b.dp, deck.state.stock, deck.state.readyAt];
    assert.throws(() => deck.place(row, col), pattern);
    assert.deepEqual([b.dp, deck.state.stock, deck.state.readyAt], old);
  };
  check(5, 7, /ground enemy/); check(-1, 7, /tile on the map/); check(5, 5, /occupied/);
  b.grid.tile(5, 8).build = 'RANGED'; check(5, 8, /melee tile/);
  b.setViewport('embedded'); check(5, 9, /fullscreen/); b.setViewport('fullscreen-workspace');
  b.getPlayer('arkpedia').dp = 4; check(5, 9, /DP/); b.addDp('arkpedia', 99);
  occupied.motion = 'FLY'; assert.ok(deck.place(5, 7));
});

test('field limits, source capacity, manual removal and recharge remain independent', () => {
  const f = make(), { b, deck } = f;
  for (let i = 0; i < 4; i++) {
    deck.recharge(2); deck.state.readyAt = b.time; deck.place(5, 7 + i);
  }
  deck.recharge(1); deck.state.readyAt = b.time;
  assert.throws(() => deck.place(5, 11), /Summon deployment limit/);
  const dp = b.dp, t = devices(f)[0], stock = deck.state.stock;
  b.retreat(t, { permanent: true }); near(b.dp, dp); assert.equal(deck.state.stock, stock);
  assert.ok(deck.place(5, 11)); assert.equal(deck.recharge(100), true);
  assert.equal(deck.state.stock, 4); assert.throws(() => deck.recharge(0));
});

test('a reserved tile that fails token creation cannot spend the deck or leave a running watcher', () => {
  const { b, u, deck } = make();
  assert.equal(b.reserveTile(u, 5, 7, 'fixture:reserved'), true);
  const old = [b.dp, deck.state.stock, deck.state.readyAt];
  assert.throws(() => deck.place(5, 7), /placement failed/);
  assert.deepEqual([b.dp, deck.state.stock, deck.state.readyAt], old);
  advance(b, .1);
  assert.equal(b._sched.filter(s => !s.cancelled && s.owner?.defId === ELA_MINE).length, 0);
  assert.equal(deck.mines.size, 0);
});

test('only S1 blocks time SP at full stock and paid placement releases that gate', () => {
  for (const skill of [1, 2, 3]) {
    const { deck, u } = make({ skill, potential: 3 });
    assert.equal(!!u.s.flags.noSp, skill === 1);
    deck.place(5, 7); assert.equal(!!u.s.flags.noSp, false);
    deck.recharge(2); assert.equal(!!u.s.flags.noSp, skill === 1);
  }
});

test('arming follows original OnStart; one OnAttack effect precedes one forced withdrawal', () => {
  const f = make(), t = f.deck.place(5, 7), victim = enemy(f.b);
  advance(f.b, .067); assert.equal(f.outputs.length, 0); assert.equal(t.mem.regularFormVisual.clip, 'Start');
  advance(f.b, .1); assert.equal(t.mem.regularFormVisual.clip, 'Attack'); assert.equal(f.outputs.length, 0);
  advance(f.b, .2); assert.equal(f.outputs.length, 1); assert.equal(t.alive, true);
  assert.equal(victim.findBuff(ELA_INFLUENCE).source, t); assert.equal(f.receipts.length, 0);
  advance(f.b, .2); assert.equal(t.alive, false); assert.equal(t.removeReason, 'ela-triggered');
  advance(f.b, 1); assert.equal(f.outputs.length, 1);
});

test('trigger circle and effect circle are distinct, with impact-time recipient resampling', () => {
  const f = make({ skill: 3 }), t = f.deck.place(5, 7);
  const outer = enemy(f.b, { x: 8.6 }); advance(f.b, .4);
  assert.equal(t.alive, true); assert.equal(f.outputs.length, 0);
  const trigger = enemy(f.b, { x: 8.3 }); advance(f.b, .034);
  const late = enemy(f.b, { x: 7, y: 6.6 }), outside = enemy(f.b, { x: 8.71 });
  f.b.kill(trigger); advance(f.b, .3);
  assert.equal(f.outputs.length, 1); assert.ok(outer.findBuff(ELA_INFLUENCE)); assert.ok(late.findBuff(ELA_INFLUENCE));
  assert.equal(outside.findBuff(ELA_INFLUENCE), null); assert.equal(f.receipts.length, 0);
});

test('huge bodies enter radius checks through their closest body point', () => {
  const f = make({ skill: 2 }), t = f.deck.place(5, 7);
  const huge = enemy(f.b, { x: 9, area: { w: 2, h: 1, dx: 0, dy: 0 } });
  advance(f.b, .4); assert.equal(f.outputs.length, 1); assert.ok(huge.s.flags.stun);
  assert.equal(huge.findBuff(ELA_INFLUENCE).source, t);
});

test('air, concealment and target-free prevent triggering; blocked camouflage may trigger', () => {
  for (const flag of ['air', 'sleep', 'camou', 'stealth', 'untargetable']) {
    const f = make(), t = f.deck.place(5, 7), victim = enemy(f.b, { fly: flag === 'air' });
    if (flag !== 'air') f.b.addBuff(victim, { key: 'fixture:conceal', flags: { [flag]: true } });
    advance(f.b, .7); assert.equal(f.outputs.length, 0); assert.equal(t.alive, true);
    if (flag === 'camou') { victim.blockedBy = f.u; advance(f.b, .4); assert.equal(f.outputs.length, 1); }
  }
});

test('effects ignore camouflage but exclude air, stealth and unselectable recipients', () => {
  const f = make({ skill: 2 }), t = f.deck.place(5, 7); enemy(f.b);
  const camou = enemy(f.b, { x: 8.6 }), hidden = enemy(f.b, { x: 7.2 }), air = enemy(f.b, { x: 7.3, fly: true });
  f.b.addBuff(camou, { key: 'fixture:camou', flags: { camou: true } });
  f.b.addBuff(hidden, { key: 'fixture:stealth', flags: { stealth: true } });
  advance(f.b, .4); assert.ok(camou.findBuff(ELA_INFLUENCE)); assert.equal(hidden.findBuff(ELA_INFLUENCE), null);
  assert.equal(air.findBuff(ELA_INFLUENCE), null); assert.equal(t.mem.regularFormVisual.die, null);
});

test('all ranks apply selected effects without direct damage, including actual Fragile mitigation', () => {
  for (const skill of [1, 2, 3]) for (let rank = 1; rank <= 10; rank++) {
    const f = make({ skill, rank }), t = f.deck.place(5, 7), victim = enemy(f.b);
    advance(f.b, .4); const bb = f.deck.record.skill.bb;
    assert.ok(victim.findBuff(ELA_INFLUENCE)); near(victim.hp, 100000); assert.equal(f.receipts.length, 0);
    if (skill === 1) { near(victim.s.hitRatePhys, 1 + bb.damage_hitrate_physical); near(victim.s.hitRateArts, 1 + bb.damage_hitrate_magical); }
    if (skill === 2) assert.ok(victim.s.flags.stun);
    if (skill === 3) {
      near(victim.s.dmgTakenMul, bb.damage_scale);
      f.b.dealDamage(f.u, victim, { amount: 100, type: 'phys', canDodge: false });
      near(100000 - victim.hp, 100 * bb.damage_scale);
    }
    assert.equal(t.stats.attacks, 1);
  }
});

test('immune/canceled Stun stays separate from the influence marker, while control resistance does not shorten it', () => {
  for (const mode of ['immune', 'cancel', 'resist']) {
    const f = make({ skill: 2 }), t = f.deck.place(5, 7), victim = enemy(f.b);
    if (mode === 'immune') victim.def.immune.add('stun');
    if (mode === 'cancel') f.b.on('beforeStatus', ctx => { if (ctx.status === 'stun') ctx.cancel = true; });
    if (mode === 'resist') f.b.applyStatus(victim, 'resist', { value: .5 });
    advance(f.b, .4); assert.ok(victim.findBuff(ELA_INFLUENCE));
    assert.equal(!!victim.s.flags.stun, mode === 'resist');
    if (mode === 'resist') {
      advance(f.b, 2.5); assert.equal(!!victim.s.flags.stun, false); assert.ok(victim.findBuff(ELA_INFLUENCE));
    }
    assert.equal(t.stats.attacks, 1);
  }
});

test('same marker does not add hit-rate penalties twice, and Fragile shares strongest-value fallback', () => {
  const f = make(), victim = enemy(f.b), r = f.deck.record;
  applyElaMineEffects(f.b, f.u, r, victim.x, victim.y);
  applyElaMineEffects(f.b, f.u, r, victim.x, victim.y);
  assert.equal(victim.buffs.filter(b => b.key === ELA_INFLUENCE).length, 1); near(victim.s.hitRatePhys, .6);
  const g = make({ skill: 3 }), v = enemy(g.b);
  g.b.applyStatus(v, 'fragile', { source: g.u, value: .8, duration: 1 });
  applyElaMineEffects(g.b, g.u, g.deck.record, v.x, v.y); near(v.s.dmgTakenMul, 1.8);
  advance(g.b, 1.1); near(v.s.dmgTakenMul, 1.35);
});

test('owner removal and battle end cancel unborn effects; redeployment resets deck and cannot reuse old timers', () => {
  for (const reason of ['retreat', 'killed', 'battleEnd']) {
    const f = make(), t = f.deck.place(5, 7); enemy(f.b); advance(f.b, .167);
    if (reason === 'retreat') f.b.retreat(f.u); else if (reason === 'killed') f.b.kill(f.u); else f.b.emit('battleEnd', {});
    assert.equal(t.alive, false); assert.equal(f.deck.recharge(2), false);
    advance(f.b, 1); assert.equal(f.outputs.length, 0); assert.equal(f.receipts.length, 0);
    if (reason !== 'battleEnd') {
      // Standard stages construct a fresh owner object for every placement.
      const fresh = make({ battle: f.b }); assert.notEqual(fresh.u, f.u);
      assert.equal(fresh.deck.state.stock, 3); assert.equal(fresh.deck.state.readyAt, f.b.time);
      assert.equal(f.deck.recharge(2), false);
      advance(f.b, 1); assert.equal(f.outputs.length, 0);
    }
  }
});

test('manual mine removal cancels its pending effect but accepted effects outlive mine and owner removal', () => {
  const f = make(), t = f.deck.place(5, 7), victim = enemy(f.b);
  advance(f.b, .167); f.b.retreat(t, { permanent: true }); advance(f.b, .4);
  assert.equal(f.outputs.length, 0); assert.equal(victim.findBuff(ELA_INFLUENCE), null);
  f.deck.state.readyAt = f.b.time; f.deck.recharge(1); f.deck.place(5, 7); advance(f.b, .4);
  assert.ok(victim.findBuff(ELA_INFLUENCE)); f.b.retreat(f.u); advance(f.b, 1);
  assert.ok(victim.findBuff(ELA_INFLUENCE)); advance(f.b, 10.1); assert.equal(victim.findBuff(ELA_INFLUENCE), null);
  near(victim.s.hitRatePhys, 1);
});

test('a living controlled owner does not stop its independent mine ability', () => {
  const f = make({ skill: 3 });
  f.b.applyStatus(f.u, 'stun', { duration: 10 });
  f.deck.place(5, 7); const victim = enemy(f.b);
  advance(f.b, .4); assert.equal(f.outputs.length, 1); assert.ok(victim.findBuff(ELA_INFLUENCE));
  near(victim.s.dmgTakenMul, 1.35); assert.equal(f.u.s.flags.stun, true);
});
