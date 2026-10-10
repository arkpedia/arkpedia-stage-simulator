// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import e from '../data/arkpedia-swire-alter-prefabs.json' with { type: 'json' };
import { StandardBattle } from '../server/sim/arkpedia.js';
import { normalizeChess } from '../server/sim/simdata.js';
import { sourceCandidate } from '../shared/arkpedia/summons.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { REGULAR_OPERATORS } from '../shared/arkpedia/operators.js';
import { SWIRE_ALTER_ID as ID, SWIRE_ECONOMY_CONTRACT as CONTRACT,
  selectedSwireEconomy, SwireCoinEconomy } from '../server/sim/content/arkpedia-swire-alter-economy.js';
const near = (a, z) => assert.ok(Math.abs(a - z) < 1e-5, `${a} != ${z}`);
function advance(b, seconds) {
  for (let i = 0; i < Math.ceil(seconds / b.dt - 1e-9); i++) b.step();
  assert.deepEqual(b.errors, []);
}
function make({ elite = 2, potential = 1, skill = 1, rank = 10, defer = false, battle = null } = {}) {
  const d = structuredClone(data);
  d.stage.geometry.waves[0].spawns = []; d.stage.battle.dp_per_second = 0;
  const b = battle ?? new StandardBattle(d, { operators: [defaultBuild(d.operators.char_289_gyuki)] });
  b.autoFinish = false; b.setViewport('fullscreen-workspace'); b.recordEvents = true;
  b.grid.tiles = b.grid.tiles.map(t => ({ ...t, height: 'LOW', build: 'ALL', pass: 'ALL' }));
  const c = e.tables.character, phase = c.phases[elite], skillId = `skchr_swire2_${skill}`;
  const build = { elite, potential, level: phase.maxLevel, skillId, skillRank: Math.min(rank, [4, 7, 10][elite]) };
  const level = e.tables.skills[skillId].levels[build.skillRank - 1];
  const def = normalizeChess({ chessId: ID, charId: ID, name: c.name,
    stats: phase.attributesKeyFrames.at(-1).data, profession: c.profession, position: c.position,
    rangeGrid: e.tables.ranges[phase.rangeId].grids.map(g => [g.row, g.col]),
    talents: c.talents.map(t => sourceCandidate(t.candidates, build)).filter(Boolean),
    skill: { ...level, ...level.spData, skillId, trigger: { rule: 'NEVER' } }, arkpedia: build });
  const u = b._makeAlly(b.getPlayer('arkpedia'), def, 'op', 2, 2, { dir: 'RIGHT' });
  b._setupUnit(u, { trait: { noAttack: true }, skill: { id: skillId,
    kind: skill === 3 ? 'toggle' : 'passive', trigger: skill === 3 ? 'SP_FULL' : 'NEVER' } });
  const wallet = new SwireCoinEconomy(b, u, build, CONTRACT);
  const deploy = () => { assert.equal(b._deploy(u, { initial: false }), true); b.getPlayer('arkpedia').dp = 99; };
  if (!defer) deploy();
  return { b, u, wallet, build, deploy };
}
function enemy(b) {
  const t = b.spawnEnemy('enemy_1007_slime', { pos: [1, 7] });
  Object.assign(t.base, { maxHp: 100000, atk: 0, def: 0, res: 0, moveSpeed: 0 });
  t.hp = 100000;
  b.addBuff(t, { key: 'fixture:pin', flags: { noMove: true, disarm: true } });
  t.markDirty(); return t;
}
function lethal(f, source = enemy(f.b)) { return f.b.loseHp(f.u, f.u.s.maxHp * 2, { source }); }

test('private economy cannot enable the incomplete operator or change public coverage', () => {
  assert.equal(REGULAR_OPERATORS[ID], undefined); assert.equal(data.operators[ID], undefined);
  assert.deepEqual(e.enabledOperators, []); assert.equal(e.runtimeMapping, undefined);
  assert.equal(CONTRACT.frameParity, false);
});
test('all thirty ranks select their exact source coin capacities and blackboards', () => {
  for (const skill of [1, 2, 3]) for (let rank = 1; rank <= 10; rank++) {
    const f = make({ skill, rank }), r = f.wallet.record;
    assert.deepEqual(r.bb, f.u.def.skill.bb);
    assert.equal(r.capacity, e.tables.skills[f.build.skillId].levels[rank - 1].blackboard.find(z => z.key === 'sp').value);
  }
});
test('promotion/potential select starting coins, ATK cap and fatal recovery independently', () => {
  for (const elite of [0, 1, 2]) for (let potential = 1; potential <= 6; potential++) {
    const { wallet: w } = make({ elite, potential });
    assert.equal(w.coins, elite === 2 ? 1 : 0);
    assert.equal(w.record.talent.max_stack_cnt, elite === 0 ? 0 : elite === 1 ? potential >= 5 ? 6 : 5 : potential >= 5 ? 9 : 8);
    assert.equal(w.record.talent.atk, [0, .03, .04][elite]);
    assert.equal(w.fatalCost, elite === 2 ? 5 : 0);
    assert.equal(w.record.fatal?.hp_ratio, elite === 2 ? potential >= 3 ? .8 : .7 : undefined);
  }
});
test('invalid builds, mismatched installed skills and missing contracts reject before installing hooks', () => {
  const f = make({ defer: true }), build = f.build;
  for (const bad of [null, { ...build, elite: -1 }, { ...build, level: 91 }, { ...build, potential: 7 },
    { ...build, skillId: 'fake' }, { ...build, skillRank: 11 }, { ...build, skillRank: 1.5 },
    { ...build, elite: 0, level: 1, skillId: 'skchr_swire2_2', skillRank: 1 },
    { ...build, module: { id: 'merchant', stage: 3 } }]) assert.throws(() => selectedSwireEconomy(bad));
  assert.throws(() => new SwireCoinEconomy(f.b, f.u, build), /contract/);
  assert.throws(() => new SwireCoinEconomy(f.b, f.u, { ...build, skillRank: 1 }, CONTRACT), /installed skill/);
  assert.throws(() => new SwireCoinEconomy(f.b, f.u, build, CONTRACT), /already installed/);
});
test('S1/S2 initialize once on deployment; ordinary SP gifts and forced setters do not create coins', () => {
  for (const skill of [1, 2]) {
    const f = make({ skill }), { u, wallet: w } = f;
    assert.equal(w.active, true); assert.equal(w.coins, 1);
    assert.equal(w.beginSkill(), false);
    u.skill.gainSp(100, 'grant'); u.skill.setSpTotal(100);
    assert.equal(w.coins, 1); assert.equal(u.skill.sp, 0);
    assert.equal(w.spend(), true); assert.equal(w.spend(), false); assert.equal(w.coins, 0);
    for (const v of [0, -1, NaN, 1.5]) { assert.throws(() => w.spend(v)); assert.throws(() => w.gain(v)); }
  }
});
test('upkeep begins after three seconds, charges exactly once and credits capped coins', () => {
  const f = make(), { b, u, wallet: w } = f;
  advance(b, 3); near(b.dp, 99); assert.equal(w.stacks, 0);
  advance(b, b.dt); near(b.dp, 96); assert.equal(w.coins, 2); assert.equal(w.stacks, 1);
  advance(b, 3); near(b.dp, 93); assert.equal(w.coins, 3); assert.equal(w.stacks, 2);
  advance(b, 3); near(b.dp, 90); assert.equal(w.coins, 3); assert.equal(w.stacks, 3);
  near(u.s.atk, u.base.atk * 1.12);
});
test('ATK stacks add with other ordinary ATK buffs, cap independently of coins and persist through skill end', () => {
  for (const potential of [1, 5]) {
    const { b, u, wallet: w } = make({ potential });
    b.addBuff(u, { key: 'fixture:atk', mods: { atkPct: .5 } });
    advance(b, 30.1);
    assert.equal(w.stacks, potential === 1 ? 8 : 9); assert.equal(w.coins, 3);
    near(u.s.atk, u.base.atk * (1.5 + .04 * w.stacks));
    w.finishSkill(); advance(b, 3); assert.equal(w.coins, 0);
    near(u.s.atk, u.base.atk * (1.5 + .04 * w.stacks));
  }
});
test('upkeep and nonsilenceable talent continue through controls and no-SP states', () => {
  const { b, u, wallet: w } = make();
  b.addBuff(u, { key: 'fixture:controls', flags: { stun: true, silence: true, noSp: true } });
  advance(b, 3.1); assert.equal(w.stacks, 1); assert.equal(w.coins, 2); near(b.dp, 96);
});
test('insufficient upkeep DP forces withdrawal without partial charge, coin or fatal-talent payment', () => {
  const { b, u, wallet: w } = make(); b.getPlayer('arkpedia').dp = 2.99;
  advance(b, 3.1); assert.equal(u.alive, false); assert.equal(u.removeReason, 'merchant');
  near(b.dp, 2.99); assert.equal(w.coins, 0); assert.equal(w.stacks, 0); assert.equal(w.repair, null);
});
test('S3 pays inactive upkeep, then AUTO casts at full five SP without an enemy and starts its coin gauge', () => {
  const { b, u, wallet: w } = make({ skill: 3 });
  assert.equal(w.active, false); assert.equal(w.beginSkill(), false);
  advance(b, 3.1); near(b.dp, 96); assert.equal(w.coins, 0); assert.equal(w.stacks, 0);
  advance(b, 2); assert.equal(u.skill.active, true); assert.equal(w.active, true); assert.equal(w.coins, 1);
  assert.equal(u.skill.sp, 0); assert.equal(u.skill.charges, 0);
  u.skill.gainSp(100, 'grant'); u.skill.setSpTotal(100); assert.equal(w.coins, 1);
  advance(b, 1); assert.equal(w.coins, 2); assert.equal(w.stacks, 1);
});
test('only owner-credited S3 enemy kills give coins; active cap does not automatically finish the skill', () => {
  const f = make({ skill: 3 }), { b, u, wallet: w } = f;
  const other = b.allyUnits.find(z => z !== u);
  b.kill(enemy(b), u); assert.equal(w.coins, 0);
  u.skill.gainSp(5, 'grant'); u.skill.activate('auto'); assert.equal(w.coins, 1);
  b.kill(enemy(b), other); assert.equal(w.coins, 1);
  b.kill(enemy(b), u); assert.equal(w.coins, 2);
  for (let i = 0; i < 20; i++) b.kill(enemy(b), u);
  assert.equal(w.coins, 10); assert.equal(u.skill.active, true);
  for (const skill of [1, 2]) {
    const g = make({ skill }); g.b.kill(enemy(g.b), g.u); assert.equal(g.wallet.coins, 1);
  }
});
test('S3 finish captures all coins once, clears them, retains ATK and recharges the ordinary SP gauge', () => {
  const { b, u, wallet: w } = make({ skill: 3 }); advance(b, 6.1);
  const atk = u.s.atk; w.gain(6);
  // Even an internal forced/init SP write cannot carry into the next cooldown.
  u.skill.gainSp(100, 'init', true); assert.equal(w.coins, 8);
  assert.equal(w.finishSkill(), 8); assert.equal(w.finishSkill(), 0); u.skill.end('manual');
  assert.equal(w.coins, 0); assert.equal(w.stacks, 1); near(u.s.atk, atk);
  assert.equal(w.gain(1), 0); assert.equal(w.spend(), false);
  advance(b, 2); near(u.skill.sp, 2); assert.equal(w.active, false);
  advance(b, 3.1); assert.equal(u.skill.active, true); assert.equal(w.coins, 1); assert.equal(w.stacks, 1);
});
test('lethal recovery charges 5/10/20 DP, protects short HP loss and heals after damage is credited', () => {
  const f = make(), { b, u, wallet: w } = f, src = enemy(b), maxHp = u.s.maxHp;
  for (const cost of [5, 10, 20]) {
    u.hp = maxHp; const dp = b.dp, before = src.stats.dmg;
    near(lethal(f, src), maxHp - 1); near(src.stats.dmg - before, maxHp - 1);
    near(b.dp, dp - cost); assert.equal(u.hp, 1); assert.equal(u.alive, true);
    assert.equal(u.s.flags.undeadable, true); assert.equal(w.fatalCost, cost * 2);
    const newDp = b.dp; lethal(f, src); near(b.dp, newDp); assert.equal(u.hp, 1);
    advance(b, .05); near(u.hp, 1 + maxHp * .7); assert.equal(!!u.s.flags.undeadable, false);
    assert.equal(w.coins, 1); assert.equal(w.stacks, 0);
  }
});
test('P3 recovery uses selected 80% ratio, ignores HealFree but retains healing modifiers/events', () => {
  const f = make({ potential: 3 }), { b, u } = f, seen = [];
  b.addBuff(u, { key: 'fixture:healing', mods: { healingTakenMul: .5 }, flags: { healFree: true, silence: true } });
  b.on('heal', ctx => { if (ctx.target === u) seen.push(ctx); });
  lethal(f); advance(b, .05);
  near(u.hp, 1 + u.s.maxHp * .8 * .5);
  assert.equal(seen.length, 1); assert.equal(seen[0].opts.ignoreHealFree, true);
  near(seen[0].amount, u.s.maxHp * .4);
});
test('ordinary damage, shields and exact available DP reach the same fatal boundary without false charges', () => {
  const f = make(), { b, u, wallet: w } = f, src = enemy(b);
  b.getPlayer('arkpedia').dp = 5;
  b.addBuff(u, { key: 'fixture:shield', shield: 10000 });
  near(b.dealDamage(src, u, { type: 'true', amount: 5000 }), 0); near(b.dp, 5);
  assert.equal(w.repair, null); b.removeBuff(u, 'fixture:shield');
  near(b.dealDamage(src, u, { type: 'true', amount: 10 }), 10); near(b.dp, 5);
  near(b.dealDamage(src, u, { type: 'true', amount: 10000 }), u.s.maxHp - 11);
  near(b.dp, 0); assert.equal(w.fatalCost, 10); assert.equal(u.hp, 1);
  advance(b, .05); assert.equal(u.alive, true); assert.ok(u.hp > 1);
});
test('canceled healing leaves one HP and no protection, while consuming and escalating its accepted DP cost', () => {
  const f = make(), { b, u, wallet: w } = f;
  b.on('heal', ctx => { if (ctx.target === u) ctx.amount = 0; });
  lethal(f); advance(b, .05); assert.equal(u.hp, 1); assert.equal(!!u.s.flags.undeadable, false);
  near(b.dp, 94); assert.equal(w.fatalCost, 10);
});
test('insufficient lethal DP or promotion cannot prevent death; an existing protector is not consumed', () => {
  for (const options of [{ elite: 0 }, { elite: 1 }, {}]) {
    const f = make(options); f.b.getPlayer('arkpedia').dp = 4.99;
    lethal(f); assert.equal(f.u.alive, false); near(f.b.dp, 4.99); assert.equal(f.wallet.repair, null);
  }
  const f = make(); f.b.addBuff(f.u, { key: 'fixture:undead', flags: { undeadable: true } });
  lethal(f); near(f.b.dp, 99); assert.equal(f.wallet.fatalCost, 5); assert.equal(f.wallet.repair, null);
  const g = make(); const ctx = { unit: g.u, prevented: true };
  g.wallet.preventFatal(ctx); near(g.b.dp, 99); assert.equal(g.wallet.repair, null);
});
test('owner finish cancels pending healing/upkeep, removes ATK and cannot affect the next deployment', () => {
  const f = make(), { b, u, wallet: w } = f; advance(b, 3.1);
  assert.equal(w.stacks, 1); lethal(f); const oldRepair = w.repair, oldUpkeep = w.upkeep;
  b.retreat(u); assert.equal(oldRepair.cancelled, true); assert.equal(oldUpkeep.cancelled, true);
  assert.equal(w.coins, 0); assert.equal(w.seq, null); assert.equal(w.stacks, 0);
  near(u.s.atk, u.base.atk); const dp = b.dp; advance(b, .1); near(b.dp, dp);
  // Ordinary stage placement creates a fresh owner; old hooks are released.
  const fresh = make({ battle: b }), freshWallet = fresh.wallet;
  assert.equal(freshWallet.fatalCost, 5); assert.equal(freshWallet.coins, 1); assert.equal(freshWallet.stacks, 0);
  const freshHp = fresh.u.hp; oldRepair.fn(); near(fresh.u.hp, freshHp); assert.equal(freshWallet.coins, 1);
  lethal(fresh); const freshRepair = freshWallet.repair; oldRepair.fn(); assert.equal(freshWallet.repair, freshRepair);
  advance(b, .05); near(fresh.u.hp, 1 + fresh.u.s.maxHp * .7); b.getPlayer('arkpedia').dp = 99;
  advance(b, 2.9); near(b.dp, 99); advance(b, .2); near(b.dp, 96);
});
test('battle finish closes hooks, timers and resources without healing or paying after the result', () => {
  const f = make(), { b, u, wallet: w } = f; lethal(f); const repair = w.repair, upkeep = w.upkeep;
  b.forceEnd('forced'); const dp = b.dp, hp = u.hp;
  assert.equal(w.closed, true); assert.equal(repair.cancelled, true); assert.equal(upkeep.cancelled, true);
  assert.equal(u.mem.swireCoinEconomy, undefined); assert.equal(w.spend(), false);
  repair.fn(); upkeep.fn(); near(b.dp, dp); near(u.hp, hp); assert.deepEqual(b.errors, []);
});
