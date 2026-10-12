// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import e from '../data/arkpedia-muelsyse-prefabs.json' with { type: 'json' };
import { StandardBattle } from '../server/sim/arkpedia.js';
import { normalizeChess } from '../server/sim/simdata.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { summonUnitId } from '../shared/arkpedia/summons.js';
import { retreatRegularSummon, deployRegularSummon } from '../server/sim/content/arkpedia-summons.js';
import { MUELSYSE_ID as ID, selectedMuelsyseBuild } from '../server/sim/content/arkpedia-muelsyse.js';
import { flowingShapeSnapshot, MUELSYSE_DEVICE_CONTRACT as CONTRACT, prepareMuelsyseDevices } from '../server/sim/content/arkpedia-muelsyse-devices.js';

const TOKEN = 'token_10030_mlyss_wtrman', CARD = `summon:${ID}`;
const near = (a, z, eps = 1e-5) => assert.ok(Math.abs(a - z) < eps, `${a} != ${z}`);
function advance(f, seconds) {
  for (let n = 0; n < Math.ceil(seconds / f.b.dt - 1e-9); n++) f.b.step();
  assert.deepEqual(f.b.errors, []);
}
function until(f, condition, seconds = 25) {
  const end = f.b.time + seconds;
  while (!condition() && f.b.time < end) advance(f, f.b.dt);
  assert.ok(condition(), `Condition missing at ${f.b.time}`);
}
function make({ skill = 1, elite = 2, rank = 10, dir = 'RIGHT', defer = false, contract = CONTRACT } = {}) {
  const d = structuredClone(data); d.stage.geometry.waves[0].spawns = []; d.stage.battle.dp_per_second = 0;
  d.stage.geometry.rows = 19; d.stage.geometry.cols = 21;
  d.stage.geometry.tileGrid = Array.from({ length: 19 }, () => Array(21).fill(2));
  const donorNames = ['char_208_melan', 'char_103_angel', 'char_426_billro', 'char_147_shining', 'char_433_windft', 'char_1020_reed2', 'char_107_liskam'];
  const builds = donorNames.map(id => defaultBuild(d.operators[id]));
  const b = new StandardBattle(d, { operators: builds });
  b.autoFinish = false; b.recordEvents = true; b.setViewport('fullscreen-workspace');
  b.grid.tiles = b.grid.tiles.map(t => ({ ...t, height: 'LOW', build: 'ALL', pass: 'ALL' }));
  const build = { elite, level: e.tables.character.phases[elite].maxLevel, potential: 1, trust: 0,
    skillRank: Math.min(rank, [4, 7, 10][elite]), skillId: `skchr_mlyss_${skill}` };
  const r = selectedMuelsyseBuild(build), c = e.tables.character;
  const def = normalizeChess({ chessId: ID, charId: ID, name: c.name, profession: c.profession,
    position: c.position, subProfessionId: c.subProfessionId, stats: r.stats, rangeGrid: r.rangeGrid,
    tags: r.tags, talents: r.talents, skill: { ...r.source, ...r.source.spData, skillId: build.skillId,
      rangeGrid: r.source.rangeId ? e.tables.ranges[r.source.rangeId].grids.map(g => [g.row, g.col]) : [],
      trigger: { rule: 'NEVER' } }, arkpedia: build });
  const u = b._makeAlly(b.getPlayer('arkpedia'), def, 'op', 5, 5, { dir });
  const prepared = prepareMuelsyseDevices(b, u, { contract });
  b._setupUnit(u, prepared.kit); prepared.controller.install();
  const hits = [];
  b.on('damaged', ctx => hits.push({ ...ctx, time: b.time }));
  const deploy = () => { u.player.dp = 99; assert.ok(b._deploy(u, { initial: false })); };
  if (!defer) deploy();
  return { b, u, d, build, hits, deploy, ...prepared };
}
function enemy(f, { row = 5, col = 6, hp = 1e7, def = 1000, fly = false, flags = {} } = {}) {
  const t = f.b.spawnEnemy('enemy_1007_slime', { pos: [row, col] });
  Object.assign(t.base, { maxHp: hp, atk: 500, def, res: 0, moveSpeed: 0 });
  t.markDirty(); void t.s; t.hp = hp; if (fly) t.motion = 'FLY';
  f.b.addBuff(t, { key: 'fixture:pin', flags: { noMove: true, disarm: true, ...flags } });
  f.b._buildEnemyIndex(); return t;
}
function point(f, row = 5, col = 6) {
  const t = f.deck.place(row, col); until(f, () => t.mem.muelsyseMode === 1); return t;
}
function defeat(f, t, source = enemy(f, { row: 10, col: 10 })) {
  return f.b.dealDamage(source, t, { amount: t.hp + 1e5, type: 'true' });
}

function copy(f, t, id = 'char_208_melan', dir = 'RIGHT') {
  until(f, () => t.skill.ready, 110);
  assert.equal(f.deck.beginCopy(t), true);
  assert.equal(f.deck.copyFrom(t, id, dir), true);
  until(f, () => [2, 3].includes(t.mem.muelsyseMode));
  return f.deck.tokens.get(t);
}
const shapeHits = (f, t) => f.hits.filter(h => h.source === t && h.dmg.tags?.includes('muelsyse:shape-ordinary'));

test('device contract preserves every selected rank while owner skills remain held', () => {
  assert.throws(() => make({ contract: { ...CONTRACT } }), /reviewed device contract/);
  for (let skill = 1; skill <= 3; skill++) for (let rank = 1; rank <= 10; rank++) {
    const f = make({ skill, rank });
    assert.equal(f.deck.stock, 1); assert.equal(f.record.token.skill.prefabId, `sktok_mlyss_wtrman_${skill}`);
    assert.equal(f.u.skill.activate('manual', { free: true }), false);
  }
});

test('both terrain types use one zero-slot point without payment or direction picking', () => {
  for (const terrain of ['MELEE', 'RANGED', 'ALL']) {
    const f = make(); f.b.grid.tile(5, 6).build = terrain; f.u.player.dp = 0;
    const slots = f.b.deployedSlots(), t = deployRegularSummon(f.b, CARD, 5, 6, 'UP');
    assert.equal(t.dir, 'RIGHT'); assert.equal(t.deploymentSlotCost, 0); near(f.b.dp, 0);
    assert.equal(f.b.deployedSlots(), slots); assert.equal(f.deck.stock, 0);
    assert.throws(() => f.deck.place(5, 7), /already placed/);
    until(f, () => t.mem.muelsyseMode === 1); assert.equal(t.s.blockCnt, 1);
  }
});

test('invalid placement and callbacks cannot consume another card or orphan a point', () => {
  const f = make();
  for (const [r, c] of [[-1, 0], [5.5, 6], [20, 0], [5, 5], [12, 12]]) assert.throws(() => f.deck.place(r, c));
  f.b.grid.tile(5, 6).build = 'NONE'; assert.throws(() => f.deck.place(5, 6));
  f.b.grid.tile(5, 6).build = 'ALL';
  f.b.reserveTile(f.u, 5, 6, 'fixture'); assert.throws(() => f.deck.place(5, 6)); f.b.releaseTileReservations(f.u);
  f.b.setViewport('embedded'); assert.throws(() => f.deck.place(5, 6), /fullscreen/);
  f.b.setViewport('fullscreen-workspace'); assert.equal(f.deck.stock, 1);
  f.b.on('deploy', ({ unit }) => {
    if (unit.defId === TOKEN) assert.throws(() => f.deck.place(5, 7), /already placed/);
  });
  assert.ok(f.deck.place(5, 6)); assert.equal(f.deck.tokens.size, 1);
});

test('placement follows all four host facings', () => {
  for (const [dir, r, c] of [['RIGHT', 5, 6], ['UP', 6, 5], ['LEFT', 5, 4], ['DOWN', 4, 5]]) {
    const f = make({ dir }); assert.ok(f.deck.place(r, c));
  }
});

test('manual copy starts naturally from 95 SP and expires without selecting a nearby deployed ally', () => {
  const f = make(), t = point(f), dp = f.b.dp;
  assert.equal(f.deck.beginCopy(t), false);
  f.b.deployOperator('char_208_melan', 6, 6, 'RIGHT');
  until(f, () => t.skill.ready); assert.equal(f.deck.beginCopy(t), true);
  assert.equal(t.skill.sp, 0); assert.equal(f.deck.copying.unit, t);
  assert.throws(() => f.deck.copyFrom(t, 'char_208_melan', 'RIGHT'), /undeployed/);
  assert.throws(() => f.deck.copyFrom(t, 'foreign', 'RIGHT'), /undeployed/);
  assert.throws(() => f.deck.copyFrom(t, 'char_103_angel', 'bad'), /donor/);
  advance(f, 21); assert.equal(t.skill.active, false); assert.equal(f.deck.copying, null);
  assert.equal(f.deck.tokens.get(t).copy, null);
  assert.ok(f.b.dp < dp); // only the real Melantha deployment paid DP
});

test('selected copy scales four card stats, preserves block/BAT and leaves donor card available', () => {
  for (let elite = 0; elite <= 2; elite++) {
    const f = make({ elite }), t = point(f), def = f.b.data.getChess('char_107_liskam');
    const dp = f.b.dp, s = copy(f, t, 'char_107_liskam');
    for (const k of ['maxHp', 'atk', 'def', 'res']) near(t.base[k], def.stats[k] * [.5, .7, .9][elite]);
    for (const k of ['blockCnt', 'bat']) near(t.base[k], def.stats[k]);
    near(t.base.aspd, f.record.token.stats.attackSpeed);
    assert.equal(s.copy.donorId, 'char_107_liskam'); assert.equal(s.copy.damageType, 'phys');
    assert.equal(f.b.bench.char_107_liskam.deployments, 0); near(f.b.dp, dp);
    assert.equal(f.b.bench.char_107_liskam.unit, null);
    assert.equal(t.hp, t.s.maxHp); assert.equal(t.s.flags.healFree, true);
  }
});

test('original subprofession table overrides misleading generic profession damage defaults', () => {
  const f = make();
  for (const [id, native, damage] of [['char_433_windft', 'PHYSICAL', 'phys'],
    ['char_1020_reed2', 'MAGICAL', 'arts'], ['char_147_shining', 'HEAL', 'arts'],
    ['char_426_billro', 'NONE', 'arts']]) {
    const def = f.b.data.getChess(id), snapshot = flowingShapeSnapshot(def, .9, 'LEFT');
    assert.equal(snapshot.initialDamageType, native); assert.equal(snapshot.damageType, damage);
    assert.equal(snapshot.dir, 'LEFT'); assert.equal(snapshot.stats.blockCnt, def.stats.blockCnt);
  }
  const def = structuredClone(f.b.data.getChess('char_103_angel'));
  def.stats.aspd = 999; def.dmgType = 'heal'; def.profile = { splashRadius: 9, hits: 10, noAttack: true };
  const snapshot = flowingShapeSnapshot(def, .9, 'RIGHT');
  assert.equal(snapshot.damageType, 'phys'); assert.equal(snapshot.stats.aspd, undefined);
  assert.equal(snapshot.profile, undefined);
});

test('copy switching restores full HP and discards stolen gains and previous range', () => {
  const f = make(), t = point(f); let s = copy(f, t);
  const a = enemy(f); until(f, () => shapeHits(f, t).length >= 2);
  assert.ok(s.stolenAtk > 0); assert.ok(a.s.def < a.base.def);
  t.hp = 1; s = copy(f, t, 'char_103_angel', 'LEFT');
  assert.equal(s.stolenAtk, 0); assert.equal(s.stolenDef, 0); assert.equal(s.casts, 0);
  assert.equal(t.dir, 'LEFT'); assert.equal(t.hp, t.s.maxHp);
  assert.deepEqual(t.rangeGrid, f.b.data.getChess('char_103_angel').rangeGrid);
  near(a.s.def, a.base.def);
});

test('single retained melee attack uses the original event and capped stealing', () => {
  const f = make(), t = point(f), s = copy(f, t), a = enemy(f), z = enemy(f, { col: 6.2 });
  until(f, () => s.phase != null); near(s.phase.releaseAt - s.phase.startedAt, .30000001192092896);
  until(f, () => shapeHits(f, t).length === 1);
  assert.equal(shapeHits(f, t)[0].target, a); assert.equal(shapeHits(f, t)[0].dmg.isSplash, false);
  assert.equal(shapeHits(f, t).some(h => h.target === z), false);
  until(f, () => s.stolenDef === 250, 55); assert.equal(s.stolenAtk, 250);
  const atk = t.s.atk; advance(f, 4); near(t.s.atk, atk);
  assert.equal(s.stolenDef, 250); assert.equal(s.stolenAtk, 250);
});

test('copied melee and ranged native selectors both admit flying targets, unlike default water form', () => {
  for (const id of ['char_208_melan', 'char_103_angel']) {
    const f = make(), t = point(f); copy(f, t, id); const a = enemy(f, { fly: true });
    until(f, () => shapeHits(f, t).length === 1); assert.equal(shapeHits(f, t)[0].target, a);
  }
  const f = make(), t = point(f); enemy(f, { fly: true }); advance(f, 4); assert.equal(shapeHits(f, t).length, 0);
});

test('sleep and stealth reject copied targets and unsolicited force attacks cannot hit', () => {
  const f = make(), t = point(f); copy(f, t, 'char_103_angel');
  const hidden = enemy(f, { col: 7, flags: { stealth: true } }), asleep = enemy(f, { col: 7 });
  f.b.applyStatus(asleep, 'sleep', { duration: 99 });
  f.b.forceAttack(t, [hidden]); advance(f, 4); assert.equal(shapeHits(f, t).length, 0);
});

test('ranged casts split without rescaling stats, slot cost or inherited attack traits', () => {
  const f = make(), t = point(f), s = copy(f, t, 'char_103_angel'), slots = f.b.deployedSlots();
  // Control only the random choice, leaving all attack/counter timing natural.
  f.b.rng.pick = values => values.find(v => v.r === 5 && v.c === 7) ?? values[0];
  enemy(f, { col: 7 }); until(f, () => f.deck.tokens.size > 1, 25);
  const clone = [...f.deck.tokens.values()].find(v => v.clone);
  assert.ok(clone); assert.equal(f.b.deployedSlots(), slots);
  for (const k of ['maxHp', 'atk', 'def', 'res', 'blockCnt', 'bat']) near(clone.unit.base[k], t.base[k]);
  assert.equal(s.casts, 0); assert.equal(clone.unit.skill.activate('manual', { free: true }), false);
  assert.ok(f.b.projectiles.list.some(p => p.data?.zeroDamage && p.speed === 4));
  f.b.addBuff(t, { key: 'fixture:hold', flags: { disarm: true } });
  f.b.addBuff(clone.unit, { key: 'fixture:hold', flags: { disarm: true } });
  advance(f, 26); assert.equal(clone.unit.alive, false); assert.equal(f.deck.tokens.has(clone.unit), false);
  assert.equal(t.alive, true); assert.equal(t.mem.muelsyseMode, 3);
});

test('overlap refresh heals an existing same-host ranged copy without duplicating it', () => {
  const f = make(), t = point(f), s = copy(f, t, 'char_103_angel');
  t.hp = 1; f.b.rng.pick = values => values.find(v => v.state === s);
  f.deck.split(s); assert.equal(f.deck.tokens.size, 1); assert.equal(t.hp, t.s.maxHp);
});

test('main point fatal loss retains tile and copied state through source promotion recovery', () => {
  for (let elite = 0; elite <= 2; elite++) {
    const f = make({ elite }), t = point(f), s = copy(f, t), a = enemy(f);
    until(f, () => s.stolenAtk > 0); const gain = s.stolenAtk, hp = t.hp;
    near(defeat(f, t), hp); assert.equal(t.hp, 1); assert.equal(t.mem.muelsyseMode, 0);
    assert.equal(f.b.unitAt(5, 6), t); assert.equal(t.s.blockCnt, 0); assert.equal(a.blockedBy, null);
    near(a.s.atk, a.base.atk); assert.equal(s.stolenAtk, gain); assert.equal(t.skill.sp, 0);
    advance(f, [30, 28, 25][elite] - .1); assert.equal(t.mem.muelsyseMode, 0);
    until(f, () => t.mem.muelsyseMode === 2, 3); assert.equal(t.hp, t.s.maxHp);
    assert.equal(s.stolenAtk, gain); assert.equal(s.copy.donorId, 'char_208_melan');
  }
});

test('stale lives, transient stun and reentrant retirement cannot release an old attack', () => {
  for (const kind of ['target', 'stun', 'retire']) {
    const f = make(), t = point(f), s = copy(f, t), a = enemy(f);
    until(f, () => s.phase != null); const p = s.phase;
    if (kind === 'target') a.deploySeq++;
    else if (kind === 'stun') f.b.applyStatus(t, 'stun', { duration: .05 });
    else f.b.on('beforeAttack', ({ attacker }) => { if (attacker === t) f.deck.retreat(t); });
    while (f.b.time < p.releaseAt + .1) advance(f, f.b.dt);
    assert.equal(shapeHits(f, t).length, 0);
  }
});

test('owner finish clears all tokens, donor locks, victim debuffs and deck hooks', () => {
  const f = make(), t = point(f), s = copy(f, t), a = enemy(f);
  until(f, () => s.stolenAtk > 0); until(f, () => t.skill.ready, 110);
  assert.equal(f.deck.beginCopy(t), true); f.b.retreat(f.u);
  assert.equal(t.alive, false); assert.equal(f.deck.tokens.size, 0);
  assert.equal(f.deck.copying, null); assert.equal(f.b.regularSummons.has(CARD), false);
  assert.deepEqual(f.deck.handles, []); near(a.s.atk, a.base.atk);
  advance(f, 5); assert.deepEqual(f.b.errors, []);
});

test('stealing uses final additions with independent victim caps even after owner gains reach 250', () => {
  const f = make(), t = point(f), s = copy(f, t), a = enemy(f);
  f.b.addBuff(t, { key: 'fixture:double', mods: { atkMul: 2, defMul: 2 } });
  until(f, () => s.stolenAtk === 250, 60);
  near(t.s.atk, t.base.atk * 2 + 250); near(t.s.def, t.base.def * 2 + 250);
  near(a.s.atk, 250); near(a.s.def, 750);
  f.b._remove(a, 'fixture-next-enemy', null, true);
  const z = enemy(f, { def: 0 }); z.base.atk = 0; z.markDirty();
  until(f, () => s.victims.get(z)?.def >= 20);
  assert.equal(s.stolenAtk, 250); assert.equal(s.stolenDef, 250);
  assert.equal(z.s.atk, 0); assert.equal(z.s.def, 0);
  assert.equal(s.victims.has(a), false); near(a.s.atk, a.base.atk);
});

test('card copying keeps independent selected stats and range storage in every facing', () => {
  for (const dir of ['UP', 'DOWN', 'LEFT', 'RIGHT']) {
    const f = make(), t = point(f), def = f.b.data.getChess('char_103_angel');
    const original = structuredClone(def);
    copy(f, t, 'char_103_angel', dir);
    assert.equal(t.dir, dir); assert.equal(t.s.atk, def.stats.atk * .9);
    t.rangeGrid[0][0] = 99;
    assert.deepEqual(f.b.data.getChess('char_103_angel'), original);
  }
});

test('spawned copies cannot copy donors and retire permanently on defeat', () => {
  const f = make(), t = point(f), s = copy(f, t, 'char_103_angel');
  f.b.rng.pick = values => values.find(v => v.r === 5 && v.c === 7);
  f.deck.split(s); const clone = [...f.deck.tokens.values()].find(v => v.clone);
  assert.ok(clone); assert.equal(clone.unit.skill.sp, 0);
  until(f, () => clone.mode === 3);
  assert.equal(f.deck.beginCopy(clone.unit), false);
  defeat(f, clone.unit);
  assert.equal(clone.unit.alive, false); assert.equal(f.deck.tokens.has(clone.unit), false);
  advance(f, 35); assert.equal(f.deck.tokens.size, 1); assert.equal(t.alive, true);
});

test('a reentrant owner removal during token deployment cannot leave a paid or orphaned point', () => {
  const f = make(); f.b.on('deploy', ({ unit }) => { if (unit.defId === TOKEN) f.b.retreat(f.u); });
  assert.throws(() => f.deck.place(5, 6), /placement failed/);
  assert.equal(f.b.unitAt(5, 6), null); assert.equal(f.deck.tokens.size, 0);
  assert.equal(f.b.regularSummons.has(CARD), false); advance(f, 5);
});

test('split selection cannot overwrite a squad operator or cross a reservation', () => {
  const f = make(), t = point(f), s = copy(f, t, 'char_103_angel');
  const occupied = f.b.deployOperator('char_208_melan', 5, 7, 'RIGHT');
  f.b.reserveTile(f.u, 6, 6, 'fixture');
  f.b.rng.pick = values => {
    assert.equal(values.some(v => v.r === 5 && v.c === 7), false);
    assert.equal(values.some(v => v.r === 6 && v.c === 6), false);
    return values.find(v => v.state === s);
  };
  f.deck.split(s); assert.equal(f.deck.tokens.size, 1); assert.equal(f.b.unitAt(5, 7), occupied);
});

test('main recovery stops SP and attacks, rejects healing and releases blocked enemies', () => {
  const f = make(), t = point(f), s = copy(f, t), a = enemy(f);
  until(f, () => a.blockedBy === t); until(f, () => s.stolenAtk > 0);
  retreatRegularSummon(f.b, summonUnitId(t)); const before = shapeHits(f, t).length;
  assert.equal(t.mem.muelsyseMode, 0); assert.equal(a.blockedBy, null);
  assert.equal(f.deck.beginCopy(t), false); assert.equal(f.b.heal(f.u, t, 999), 0);
  advance(f, 10); assert.equal(t.skill.sp, 0); assert.equal(shapeHits(f, t).length, before);
});

test('copied attack playback caps fast attacks and slows the native release under reduced ASPD', () => {
  for (const [aspd, expectedSpeed] of [[900, 1], [-50, .5]]) {
    const f = make(), t = point(f), s = copy(f, t);
    f.b.addBuff(t, { key: 'fixture:aspd', mods: { aspd } }); enemy(f);
    until(f, () => s.phase != null); const p = s.phase;
    near(p.releaseAt - p.startedAt, .30000001192092896 / expectedSpeed);
    near(t.mem.regularFormVisual.speed, expectedSpeed);
    while (f.b.time + f.b.dt < p.releaseAt) advance(f, f.b.dt);
    assert.equal(shapeHits(f, t).length, 0);
    until(f, () => shapeHits(f, t).length === 1);
    assert.ok(shapeHits(f, t)[0].time >= p.releaseAt - 1e-9);
  }
});

test('battle end removes the full copy tree and cannot replay stale work', () => {
  const f = make(), t = point(f), s = copy(f, t, 'char_103_angel');
  f.b.rng.pick = values => values.find(v => v.r === 5 && v.c === 7);
  f.deck.split(s); const units = [...f.deck.tokens.keys()]; assert.equal(units.length, 2);
  f.b.forceEnd('fixture');
  assert.equal(f.deck.tokens.size, 0); assert.equal(f.deck.handles.length, 0);
  assert.equal(f.b.regularSummons.has(CARD), false);
  assert.ok(units.every(u => !u.alive));
});

test('unknown donor subprofessions fail closed without consuming the copy selection', () => {
  const f = make(), t = point(f); until(f, () => t.skill.ready);
  assert.equal(f.deck.beginCopy(t), true);
  const def = structuredClone(f.b.data.getChess('char_103_angel'));
  for (const subProf of ['invented', 'constructor', '__proto__']) {
    def.subProf = subProf; assert.throws(() => flowingShapeSnapshot(def, .9, 'RIGHT'), /Unreviewed/);
  }
  assert.equal(t.skill.active, true); assert.equal(f.deck.copying.unit, t);
});

test('retirement from a steal modifier callback leaves no victim penalty or dead-source gain', () => {
  for (const trigger of ['victim', 'owner']) {
    const f = make(), t = point(f); copy(f, t); const a = enemy(f);
    f.b.on('beforeBuff', ({ unit, buff }) => {
      if (trigger === 'victim' && unit === a && buff.key.startsWith('muelsyse:stolen-from:')
        || trigger === 'owner' && unit === t && buff.key === 'muelsyse:stolen') f.b.retreat(f.u);
    });
    until(f, () => !t.alive);
    assert.equal(shapeHits(f, t).length, 0); assert.equal(f.deck.tokens.size, 0);
    assert.equal(a.buffs.some(v => v.key.startsWith('muelsyse:stolen-from:')), false);
    assert.equal(t.findBuff('muelsyse:stolen'), null); near(a.s.atk, a.base.atk);
  }
});
