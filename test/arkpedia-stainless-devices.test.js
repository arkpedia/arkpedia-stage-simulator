// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import evidence from '../data/arkpedia-stainless-prefabs.json' with { type: 'json' };
import { StandardBattle } from '../server/sim/arkpedia.js';
import { normalizeChess } from '../server/sim/simdata.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { summonUnitId } from '../shared/arkpedia/summons.js';
import { canTargetAlly, canTargetEnemy } from '../server/sim/targeting.js';
import { regularSummonCards, selectedRegularSummon, retreatRegularSummon } from '../server/sim/content/arkpedia-summons.js';
import { STAINLESS_ID as ID, selectedStainlessBuild } from '../server/sim/content/arkpedia-stainless.js';
import { STAINLESS_DEVICE_CONTRACT as CONTRACT, prepareStainlessDevices } from '../server/sim/content/arkpedia-stainless-devices.js';
const near = (a, z, eps = 1e-5) => assert.ok(Math.abs(a - z) < eps, `${a} != ${z}`);
function advance(f, seconds) { for (let n = 0; n < Math.ceil(seconds / f.b.dt - 1e-9); n++) f.b.step(); assert.deepEqual(f.b.errors, []); }
function until(f, condition, seconds = 10) {
  const end = f.b.time + seconds;
  while (!condition() && f.b.time < end) advance(f, f.b.dt);
  assert.ok(condition(), `Condition missing at ${f.b.time}`);
}
function make({ skill = 1, rank = 10, elite = 2, potential = 1, defer = false, contract = CONTRACT } = {}) {
  const d = structuredClone(data); d.stage.geometry.waves[0].spawns = []; d.stage.battle.dp_per_second = 0;
  d.stage.geometry.rows = 19; d.stage.geometry.cols = 21;
  d.stage.geometry.tileGrid = Array.from({ length: 19 }, () => Array(21).fill(2));
  const b = new StandardBattle(d, { operators: [defaultBuild(d.operators.char_289_gyuki)] });
  b.autoFinish = false; b.recordEvents = true; b.setViewport('fullscreen-workspace');
  b.grid.tiles = b.grid.tiles.map(t => ({ ...t, height: 'LOW', build: 'ALL', pass: 'ALL' }));
  const build = { elite, level: evidence.tables.character.phases[elite].maxLevel,
    potential, trust: 0, skillRank: Math.min(rank, [4, 7, 10][elite]), skillId: `skchr_ironmn_${skill}` };
  const r = selectedStainlessBuild(build), c = evidence.tables.character;
  const def = normalizeChess({ chessId: ID, charId: ID, name: c.name, profession: c.profession,
    subProfessionId: c.subProfessionId, position: c.position, stats: r.stats,
    rangeGrid: r.rangeGrid, tags: r.tags, talents: r.talents,
    skill: { ...r.source, ...r.source.spData, skillId: build.skillId, rangeGrid: [], trigger: { rule: 'NEVER' } }, arkpedia: build });
  const u = b._makeAlly(b.getPlayer('arkpedia'), def, 'op', 5, 5, { dir: 'RIGHT' });
  const prepared = prepareStainlessDevices(b, u, { contract });
  b._setupUnit(u, prepared.kit); prepared.controller.install();
  const deploy = () => { u.player.dp = 99; assert.ok(b._deploy(u, { initial: false })); };
  if (!defer) deploy();
  return { b, u, d, build, deploy, ...prepared };
}
function ally(f, { row = 7, col = 8, profession = 'WARRIOR', subProf = null, spType = 'INCREASE_WITH_TIME',
  hp = 10000, atk = 100, kind = 'op' } = {}) {
  const def = normalizeChess({ chessId: 'fixture:ally', name: 'Fixture', profession, subProfessionId: subProf,
    stats: { maxHp: hp, atk, def: 0, blockCnt: 0 }, rangeGrid: [[0, 0], [0, 1]],
    skill: { skillId: 'fixture:skill', skillType: 'MANUAL', spType, spCost: 999, initSp: 0, maxChargeTime: 1,
      duration: 10, trigger: { rule: 'NEVER' } } });
  const a = f.b._makeAlly(f.u.player, def, kind, row, col);
  f.b._setupUnit(a, { trait: { noAttack: true }, talents: [], skill: { kind: 'instant', trigger: { rule: 'NEVER' } } });
  assert.ok(f.b._deploy(a, { initial: false })); return a;
}
function enemy(f, { row = 7, col = 9, hp = 1e7, def = 0, fly = false, flags = {} } = {}) {
  const t = f.b.spawnEnemy('enemy_1007_slime', { pos: [row, col] });
  Object.assign(t.base, { maxHp: hp, atk: 0, def, res: 0, moveSpeed: 0 });
  t.markDirty(); void t.s; t.hp = hp; if (fly) t.motion = 'FLY';
  f.b.addBuff(t, { key: 'fixture:pin', flags: { noMove: true, disarm: true, unblockable: true, ...flags } });
  f.b._buildEnemyIndex(); return t;
}
function input(f, t, source = f.u, opts = {}) {
  return f.b.dealDamage(source, t, { amount: 1000, type: 'phys', isAttack: true, ...opts });
}
function move(a, row, col) { a.tileR = row; a.tileC = col; a.x = col; a.y = row; }

test('device contract is explicit; owner active skills stay held for all thirty ranks', () => {
  assert.throws(() => make({ contract: { ...CONTRACT } }), /reviewed device contract/);
  for (let skill = 1; skill <= 3; skill++) for (let rank = 1; rank <= 10; rank++) {
    const f = make({ skill, rank });
    assert.equal(f.deck.record.skill.prefabId, `sktok_ironmn_pile${skill}`);
    assert.equal(f.u.skill.activate('manual', { free: true }), false);
  }
});

test('source stock, independent devices, zero operator slots, costs and placement cooldowns', () => {
  for (const [skill, elite, stock, cap] of [[1, 0, 2, 1], [2, 1, 2, 2], [3, 2, 3, 2]]) {
    const f = make({ skill, elite }), slots = f.b.deployedSlots(), dp = f.b.dp;
    const t = f.deck.place(7, 7), record = f.record.token;
    assert.equal(f.deck.stock, stock - 1); assert.equal(f.deck.record.stats.maxDeployCount, cap);
    near(t.s.maxHp, record.stats.maxHp); near(t.s.atk, record.stats.atk);
    near(f.b.dp, dp - record.stats.cost); assert.equal(f.b.deployedSlots(), slots);
    assert.equal(t.deploymentSlotCost, 0); assert.equal(f.deck.readyAt, f.b.time + record.stats.respawnTime);
    assert.equal(t.kind, skill === 3 ? 'token' : 'device');
    assert.equal(t.side, skill === 3 ? 'enemy' : 'ally');
    assert.match(f.deck.placementError(8, 7), /redeploying/);
    advance(f, record.stats.respawnTime);
    if (cap === 1) assert.match(f.deck.placementError(8, 7), /limit/);
    else { f.deck.place(8, 7); assert.equal(f.deck.own().length, 2); }
  }
});

test('native terrain rules, occupancy, reservations, DP, viewport and facing reject atomically', () => {
  const f = make();
  const stock = f.deck.stock, dp = f.b.dp;
  for (const coords of [[5, 5], [-1, 0], [1.5, 1], [20, 0]]) assert.throws(() => f.deck.place(...coords));
  assert.throws(() => f.deck.place(7, 7, 'bad'), /facing/);
  f.b.reserveTile(f.u, 7, 7, 'fixture:reservation'); assert.throws(() => f.deck.place(7, 7), /reserved/);
  f.b.releaseTileReservations(f.u);
  f.b.setViewport('embedded'); assert.throws(() => f.deck.place(7, 7), /fullscreen/);
  f.b.setViewport('fullscreen-workspace'); f.u.player.dp = 0;
  assert.throws(() => f.deck.place(7, 7), /DP/); f.u.player.dp = dp;
  assert.equal(f.deck.stock, stock); near(f.b.dp, dp);
  const tile = f.b.grid.tile(7, 7); tile.build = 'RANGED';
  assert.ok(f.deck.place(7, 7));
  const z = make({ skill: 3 }); z.b.grid.tile(7, 7).build = 'RANGED';
  assert.throws(() => z.deck.place(7, 7), /melee/); assert.equal(z.deck.stock, 3);
});

test('platforms cannot be enemy attack targets and use their single source skeleton', () => {
  for (const skill of [1, 2]) {
    const f = make({ skill }), t = f.deck.place(7, 7, 'UP'), e = enemy(f);
    assert.equal(canTargetAlly(e, t, true), false);
    assert.equal(f.deck.model(t), f.record.token.models.Single);
    assert.equal(t.mem.regularFormVisual.clip, 'Start');
    assert.equal(f.b.heal(f.u, t, 100), 0);
    advance(f, 2); assert.equal(t.stats.attacks, 0); assert.equal(t.mem.regularFormVisual.clip, 'Idle');
  }
});

test('S1 support rotates through four facings and excludes devices, isolated and target-free recipients', () => {
  for (const [dir, row, col] of [['RIGHT', 7, 8], ['UP', 8, 7], ['LEFT', 7, 6], ['DOWN', 6, 7]]) {
    const f = make(), a = ally(f, { row, col }), t = f.deck.place(7, 7, dir);
    near(a.s.atk, 112);
    const outside = ally(f, { row: 9, col: 9 }); advance(f, .1); near(outside.s.atk, 100);
    f.b.addBuff(a, { key: 'fixture:isolated', flags: { isolated: true } }); advance(f, .1); near(a.s.atk, 100);
    f.b.removeBuff(a, 'fixture:isolated'); advance(f, .1); near(a.s.atk, 112);
    f.b.addBuff(a, { key: 'fixture:target-free', flags: { untargetable: true } }); advance(f, .1); near(a.s.atk, 100);
    f.b.removeBuff(a, 'fixture:target-free'); move(a, 9, 10); advance(f, .1); near(a.s.atk, 100);
    f.b.kill(t); near(a.s.atk, 100);
  }
  const f = make(), t = ally(f, { kind: 'token' }); f.deck.place(7, 7); near(t.s.atk, 100);
});

test('independent ATK platform sources stack and cleanup removes only the departing device', () => {
  const f = make(), a = ally(f), first = f.deck.place(7, 7);
  advance(f, 10); const second = f.deck.place(7, 9, 'LEFT'); near(a.s.atk, 124);
  f.b.kill(first); near(a.s.atk, 112);
  f.b.kill(second); near(a.s.atk, 100);
});

test('SP platform grants one external SP per selected interval and drains its own HP, not the recipient', () => {
  for (const spType of ['INCREASE_WITH_TIME', 'INCREASE_WHEN_ATTACK', 'INCREASE_WHEN_TAKEN_DAMAGE']) {
    const f = make({ skill: 2 }), a = ally(f, { spType }), t = f.deck.place(7, 7);
    const hp = t.hp, recipientHp = a.hp;
    f.b.addBuff(a, { key: 'fixture:no-natural-sp', mods: { spRecoveryMul: 0 } });
    advance(f, 3.4); assert.equal(a.skill.sp, 0);
    until(f, () => a.skill.sp === 1); near(t.hp, hp - t.s.maxHp * .004 * 3); near(a.hp, recipientHp);
    f.b.addBuff(a, { key: 'fixture:no-sp', flags: { noSp: true } }); advance(f, 3.6); near(a.skill.sp, 1);
    f.b.removeBuff(a, 'fixture:no-sp'); until(f, () => a.skill.sp === 2);
    assert.equal(t.skill.sp, 0);
  }
});

test('SP attachment timers reset on exit/re-entry and retired device emits no future gifts', () => {
  const f = make({ skill: 2 }), a = ally(f, { spType: 'INCREASE_WHEN_ATTACK' }), t = f.deck.place(7, 7);
  advance(f, 2); move(a, 9, 9); advance(f, .1); move(a, 7, 8); advance(f, .1);
  advance(f, 2); assert.equal(a.skill.sp, 0); until(f, () => a.skill.sp === 1);
  f.b.kill(t); advance(f, 5); assert.equal(a.skill.sp, 1);
});

test('turret is allied-targetable but cannot be a wave, enemy attacker, blocker, leak or occupied-slot count', () => {
  const f = make({ skill: 3 }), total = f.b.total, t = f.deck.place(7, 7), e = enemy(f);
  assert.equal(canTargetEnemy(f.u, t, { canHitFly: false }), true);
  assert.equal(f.b.allyUnits.includes(t), false); assert.equal(f.b.enemies.includes(t), true);
  assert.equal(f.u.player.units.includes(t), false); assert.equal(t.counted, false);
  assert.equal(f.b.total, total + 1); // Only the real fixture enemy increments the wave count.
  assert.equal(canTargetAlly(e, t, true), true); // Registry partition, not ally flags, prevents enemy acquisition.
  const start = [t.x, t.y]; advance(f, 3);
  assert.deepEqual([t.x, t.y], start); assert.equal(t.blockedBy, null); assert.equal(t.stats.attacks, 0);
  assert.equal(f.b.unitAt(7, 7), t);
  f.b._timeout(); assert.equal(f.b.leakedCount, 1); // Device is not recorded as a leak.
});

test('turret does not hold stage completion and both target-side token paths preserve existing friendly behavior', () => {
  const f = make({ skill: 3 }), t = f.deck.place(7, 7);
  f.b.autoFinish = true; advance(f, .1); assert.equal(f.b.finished, true);
  assert.equal(f.b.total, 0); assert.equal(f.b.leakedCount, 0); assert.equal(t.alive, false);
  const z = make(); assert.throws(() => z.b.spawnToken(z.u, z.record.token.id, 7, 7,
    { def: z.record.token, targetSide: 'bad' }), /target side/);
});

test('accepted allied HP inputs cancel turret damage; misses and evade produce no SP or repair', () => {
  const f = make({ skill: 3 }), t = f.deck.place(7, 7), a = ally(f);
  const hp = t.hp;
  input(f, t, a); input(f, t, a, { type: 'arts' }); input(f, t, a, { type: 'true' });
  near(t.hp, hp); assert.equal(t.skill.sp, 3);
  f.b.addBuff(a, { key: 'fixture:miss', mods: { hitRatePhys: -1 } });
  assert.equal(a.s.hitRatePhys, 0);
  input(f, t, a); assert.equal(t.skill.sp, 3); f.b.removeBuff(a, 'fixture:miss');
  f.b.addBuff(t, { key: 'fixture:evade', mods: { dodgePhys: 1 } });
  input(f, t, a); assert.equal(t.skill.sp, 3); f.b.removeBuff(t, 'fixture:evade');
  input(f, t, a, { noSp: true }); assert.equal(t.skill.sp, 3);
  f.b.addBuff(t, { key: 'fixture:invuln', flags: { invulnerable: true } }); input(f, t, a);
  assert.equal(t.skill.sp, 3); near(t.hp, hp);
});

test('Artificer repair uses selected turret HP and bypasses HealFree; other professions do not repair', () => {
  const f = make({ skill: 3 }), t = f.deck.place(7, 7);
  f.b.loseHp(t, 1000, { source: t }); const before = t.hp;
  input(f, t); near(t.hp, before + t.s.maxHp * .01); assert.equal(t.skill.sp, 1);
  const a = ally(f); input(f, t, a); near(t.hp, before + t.s.maxHp * .01);
  near(f.b.heal(a, t, 1000), 0);
  const wrong = ally(f, { row: 8, col: 8, profession: 'SUPPORT', subProf: 'bard' });
  input(f, t, wrong); near(t.hp, before + t.s.maxHp * .01);
});

test('four turret facings retain original Front, Back and Down hit clips and rotate range', () => {
  for (const [dir, row, col, face] of [['RIGHT', 7, 9, 'Front'], ['UP', 9, 7, 'Back'],
    ['LEFT', 7, 5, 'Front'], ['DOWN', 5, 7, 'Down']]) {
    const f = make({ skill: 3 }), t = f.deck.place(7, 7, dir), e = enemy(f, { row, col });
    advance(f, 1.1); for (let n = 0; n < 5; n++) input(f, t);
    until(f, () => f.deck.devices.get(t)?.phase);
    const p = f.deck.devices.get(t).phase;
    near(p.releaseAt - t.skill.lastStart, .06666667014360428);
    assert.equal(p.target, e); assert.equal(f.deck.model(t), f.record.token.models[face]);
    until(f, () => e.hp < e.s.maxHp); near(e.s.maxHp - e.hp, t.s.atk * 3);
  }
});

test('all ten turret ranks preserve selected damage/SP and self-drain, without main-target double splash', () => {
  for (let rank = 1; rank <= 10; rank++) {
    const f = make({ skill: 3, rank }), t = f.deck.place(7, 7), e = enemy(f), neighbour = enemy(f, { row: 7.4, col: 9.2 });
    advance(f, 1.1); const hp = t.hp;
    const receipts = []; f.b.on('damaged', x => { if (x.source === t) receipts.push(x); });
    for (let n = 0; n < 5; n++) input(f, t, ally(f, { row: 9 + n, col: 9 }));
    until(f, () => receipts.some(x => x.target === e));
    near(e.s.maxHp - e.hp, t.s.atk * f.deck.skill.atk_scale);
    near(neighbour.s.maxHp - neighbour.hp, t.s.atk * f.deck.skill.atk_scale_2);
    near(t.hp, hp - t.s.maxHp * f.deck.skill.hp_ratio); near(t.skill.sp, 0);
    assert.equal(receipts.filter(x => x.target === e).length, 1);
    assert.equal(receipts.find(x => x.target === neighbour).dmg.isSplash, true);
  }
});

test('turret holds full SP without a legal target and fires only after Born, with arrival-time ATK', () => {
  const f = make({ skill: 3 }), t = f.deck.place(7, 7), a = ally(f);
  for (let n = 0; n < 5; n++) input(f, t, a);
  advance(f, 2); assert.equal(t.skill.ready, true); assert.equal(f.deck.devices.get(t).phase, null);
  const e = enemy(f), hp = e.hp;
  until(f, () => f.b.projectiles.list.some(p => p.data?.stainlessCore));
  assert.equal(e.hp, hp);
  f.b.addBuff(t, { key: 'fixture:atk', mods: { atkPct: 1 } });
  until(f, () => e.hp < hp); near(hp - e.hp, t.s.atk * 3);
});

test('turret target filtering keeps free flight, excludes stealth, sleep, camou and other device targets', () => {
  const f = make({ skill: 3 }), t = f.deck.place(7, 7), flying = enemy(f, { fly: true });
  const hidden = enemy(f, { flags: { stealth: true } }), camou = enemy(f, { flags: { camou: true } });
  const sleeping = enemy(f); f.b.applyStatus(sleeping, 'sleep', { duration: 99 });
  assert.deepEqual(f.deck.targets(t), [flying]);
  assert.equal(f.deck.targets(t).includes(hidden), false); assert.equal(f.deck.targets(t).includes(camou), false);
});

test('turret projectile preserves retained life, excludes out-of-radius splash and survives source removal', () => {
  const f = make({ skill: 3 }), t = f.deck.place(7, 7), e = enemy(f), far = enemy(f, { row: 9, col: 9 });
  advance(f, 1.1); for (let n = 0; n < 5; n++) input(f, t, ally(f, { row: 10 + n, col: 10 }));
  until(f, () => f.b.projectiles.list.some(p => p.data?.stainlessCore));
  f.b._remove(t, 'retreat', null, true); until(f, () => e.hp < e.s.maxHp);
  near(far.hp, far.s.maxHp);
  const z = make({ skill: 3 }), zz = z.deck.place(7, 7), target = enemy(z);
  advance(z, 1.1); for (let n = 0; n < 5; n++) input(z, zz);
  until(z, () => z.b.projectiles.list.some(p => p.data?.stainlessCore)); target.deploySeq++;
  advance(z, 1); near(target.hp, target.s.maxHp);
});

test('physical resistance protects the operator behind; overlap is nonstacking and never reduces Arts', () => {
  const f = make({ skill: 3 }), a = ally(f, { row: 7, col: 6 }), t = f.deck.place(7, 7);
  near(a.s.physTakenMul, .8); near(a.s.artsTakenMul, 1);
  const e = enemy(f); f.b.dealDamage(e, a, { amount: 100, type: 'phys' }); near(a.hp, a.s.maxHp - 80);
  f.b.dealDamage(e, a, { amount: 100, type: 'arts' }); near(a.hp, a.s.maxHp - 180);
  advance(f, 20); const second = f.deck.place(7, 5, 'LEFT'); near(a.s.physTakenMul, .8);
  f.b._remove(t, 'retreat', null, true); near(a.s.physTakenMul, .8);
  f.b._remove(second, 'retreat', null, true); near(a.s.physTakenMul, 1);
});

test('finish recycling uses source promotion, probability, potential, range and bounded capacity', () => {
  for (const [potential, roll, recycled] of [[1, .69, true], [1, .71, false], [6, .79, true]]) {
    const f = make({ potential }), t = f.deck.place(5, 6); let calls = 0;
    f.b.rng = () => { calls++; return roll; }; f.b.kill(t);
    assert.equal(calls, 1); assert.equal(f.deck.stock, recycled ? 3 : 2);
    if (recycled) near(f.deck.readyAt, f.b.time + 10);
  }
  for (const opts of [{ elite: 1 }, {}]) {
    const f = make(opts), t = f.deck.place(8, 8); let calls = 0;
    f.b.rng = () => { calls++; return 0; }; f.b.kill(t); assert.equal(calls, 0);
  }
});

test('selection, retreat, owner death and battle end release both-side occupancy, auras, cards and hooks', () => {
  for (const skill of [1, 2, 3]) for (const reason of ['retreat', 'ownerDeath', 'battleEnd']) {
    const f = make({ skill }), a = ally(f), t = f.deck.place(7, 7), slots = f.b.deployedSlots();
    const key = summonUnitId(t);
    assert.equal(selectedRegularSummon(f.b, key)?.unit, t);
    assert.equal(regularSummonCards(f.b).find(x => x.ownerId === ID).deployed, 1);
    if (reason === 'retreat') { retreatRegularSummon(f.b, key); assert.equal(f.b.unitAt(7, 7), null); }
    else if (reason === 'ownerDeath') f.b.kill(f.u);
    else { f.b.finished = true; f.b.emit('battleEnd', {}); }
    assert.equal(t.alive, false); assert.equal(f.b.unitAt(7, 7), null);
    assert.equal(selectedRegularSummon(f.b, key), null); near(a.s.atk, 100);
    if (reason !== 'retreat') { assert.equal(f.deck.devices.size, 0); assert.deepEqual(f.deck.handles, []);
      assert.equal(f.b.regularSummons.has(`summon:${ID}`), false); }
    assert.ok(f.b.deployedSlots() <= slots);
    advance(f, 5); assert.deepEqual(f.b.errors, []);
  }
});

test('turret cancellation is per recipient and cannot poison a shared area-damage descriptor', () => {
  const f = make({ skill: 3 }), t = f.deck.place(7, 7), e = enemy(f);
  const packet = f.b.makeDamage({ amount: 1000, type: 'phys', isAttack: true, isSplash: true });
  assert.equal(f.b.dealDamage(f.u, t, packet), 0);
  assert.equal(packet.cancel, false); near(f.b.dealDamage(f.u, e, packet), 1000);
  near(t.hp, t.s.maxHp); // Repair clamps at source maximum.
});

test('turret cast phase blocks hurt and external SP but continues Artificer repair', () => {
  const f = make({ skill: 3 }), t = f.deck.place(7, 7), e = enemy(f);
  advance(f, 1.1); for (let n = 0; n < 5; n++) input(f, t);
  until(f, () => f.deck.devices.get(t)?.phase);
  const before = t.hp; input(f, t); near(t.hp, before + t.s.maxHp * .01);
  assert.equal(t.skill.sp, 0); t.skill.gainSp(5, 'fixture:gift'); assert.equal(t.skill.sp, 0);
  until(f, () => !f.deck.devices.get(t).phase);
  input(f, t); assert.equal(t.skill.sp, 1); assert.ok(e.alive);
});

test('owner removal during a device deploy rolls back occupancy without charging detached stock or DP', () => {
  for (const skill of [1, 2, 3]) {
    const f = make({ skill });
    const dp = f.b.dp;
    f.b.on('deploy', ({ unit }) => { if (unit.ownerUnit === f.u) f.b.retreat(f.u); });
    assert.throws(() => f.deck.place(7, 7), /owner became unavailable/);
    near(f.b.dp, dp); assert.equal(f.b.unitAt(7, 7), null);
    assert.equal(f.deck.own().length, 0); assert.equal(f.deck.stock, 0);
    advance(f, .1); assert.deepEqual(f.b.errors, []);
  }
});

test('turret hit clocks respect native visual-speed cap and slowed intervals', () => {
  for (const [aspd, speed] of [[200, 1], [-50, .5]]) {
    const f = make({ skill: 3 }), t = f.deck.place(7, 7); enemy(f);
    f.b.addBuff(t, { key: 'fixture:aspd', mods: { aspd } });
    advance(f, 1.1); for (let n = 0; n < 5; n++) input(f, t);
    until(f, () => f.deck.devices.get(t)?.phase);
    const phase = f.deck.devices.get(t).phase;
    near(t.mem.regularFormVisual.speed, speed);
    near(phase.releaseAt - t.skill.lastStart, .06666667014360428 / speed);
    near(phase.finishAt - t.skill.lastStart, .333 / speed);
  }
});

test('a retained turret target cannot redirect after death; interrupted work cannot release later', () => {
  for (const changed of ['targetDeath', 'controlEpoch']) {
    const f = make({ skill: 3 }), t = f.deck.place(7, 7), e = enemy(f), other = enemy(f, { row: 7.4, col: 9 });
    advance(f, 1.1); for (let n = 0; n < 5; n++) input(f, t);
    until(f, () => f.deck.devices.get(t)?.phase);
    if (changed === 'targetDeath') f.b.kill(e); else t.attackControlEpoch++;
    advance(f, 1); near(other.hp, other.s.maxHp);
    assert.equal(f.b.projectiles.list.some(p => p.data?.stainlessCore), false);
    assert.equal(t.skill.sp, 0);
  }
});
