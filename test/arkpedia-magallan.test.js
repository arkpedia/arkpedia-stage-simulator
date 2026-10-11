// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import e from '../data/arkpedia-magallan-prefabs.json' with { type: 'json' };
import { StandardBattle } from '../server/sim/arkpedia.js';
import { normalizeChess } from '../server/sim/simdata.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { REGULAR_OPERATORS } from '../shared/arkpedia/operators.js';
import { deployRegularSummon, retreatRegularSummon, regularSummonCards } from '../server/sim/content/arkpedia-summons.js';
import { canTargetAlly, areaSelectable } from '../server/sim/targeting.js';
import { MAGALLAN_ID as ID, MAGALLAN_CORE_CONTRACT as CONTRACT, selectedMagallanBuild, prepareMagallanCore } from '../server/sim/content/arkpedia-magallan.js';
import { prepareMagallanSkills, MAGALLAN_SKILL_CONTRACT } from '../server/sim/content/arkpedia-magallan-skills.js';

const KEY = `summon:${ID}`;
const near = (a, z, eps = 1e-5) => assert.ok(Math.abs(a - z) < eps, `${a} != ${z}`);
function advance(b, seconds) {
  for (let n = 0; n < Math.ceil(seconds / b.dt - 1e-9); n++) b.step();
  assert.deepEqual(b.errors, []);
}
function until(f, condition, seconds = 12) {
  const end = f.b.time + seconds;
  while (!condition() && f.b.time < end) advance(f.b, f.b.dt);
  assert.ok(condition(), `Condition missing at ${f.b.time}`);
}
function owner(b, { skill = 1, elite = 2, rank = 10, level = e.tables.character.phases[elite].maxLevel,
  potential = 1, trust = 0, dir = 'RIGHT', defer = false, row = 5, col = 5, skills = false,
  contract = skills ? MAGALLAN_SKILL_CONTRACT : CONTRACT, mutate } = {}) {
  const build = { elite, level, potential, trust, skillRank: Math.min(rank, [4, 7, 10][elite]), skillId: `skchr_mgllan_${skill}` };
  const r = selectedMagallanBuild(build), c = e.tables.character;
  const def = normalizeChess({ chessId: ID, charId: ID, name: c.name, profession: c.profession, position: c.position,
    subProfessionId: c.subProfessionId, stats: r.stats, rangeGrid: r.rangeGrid, tags: r.tags, talents: r.talents,
    skill: { ...r.source, ...r.source.spData, skillId: build.skillId,
      rangeGrid: r.source.rangeId ? e.tables.ranges[r.source.rangeId].grids.map(g => [g.row, g.col]) : [],
      trigger: { rule: 'NEVER' } }, arkpedia: build });
  mutate?.(def);
  const u = b._makeAlly(b.getPlayer('arkpedia'), def, 'op', row, col, { dir });
  const prepared = (skills ? prepareMagallanSkills : prepareMagallanCore)(b, u, { contract });
  b._setupUnit(u, prepared.kit); prepared.controller.install();
  const hits = [], births = [], attacks = [];
  b.on('damaged', ctx => { if (ctx.source === u || ctx.source?.ownerUnit === u) hits.push({ ...ctx, time: b.time }); });
  b.on('magallanProjectileBirth', ctx => { if (ctx.owner === u) births.push({ ...ctx, time: b.time }); });
  b.on('attack', ctx => { if (ctx.attacker === u || ctx.attacker?.ownerUnit === u) attacks.push({ ...ctx, time: b.time }); });
  const deploy = () => { u.player.dp = 99; assert.ok(b._deploy(u, { initial: false })); u.player.dp = 99; };
  if (!defer) deploy();
  return { b, u, build, deploy, hits, births, attacks, ...prepared, deck: prepared.controller.deck, state: prepared.controller.deck.state };
}
function make(options = {}) {
  const d = structuredClone(data); d.stage.geometry.waves[0].spawns = []; d.stage.battle.dp_per_second = 0;
  d.stage.geometry.rows = 19; d.stage.geometry.cols = 21;
  d.stage.geometry.tileGrid = Array.from({ length: 19 }, () => Array(21).fill(2));
  const b = new StandardBattle(d, { operators: [defaultBuild(d.operators.char_289_gyuki)] });
  b.autoFinish = false; b.recordEvents = true; b.setViewport('fullscreen-workspace');
  b.grid.tiles = b.grid.tiles.map(t => ({ ...t, height: 'LOW', build: 'ALL', pass: 'ALL' }));
  return owner(b, options);
}
function enemy(f, { row = 5, col = 6, hp = 1e7, res = 0, def = 0, fly = false, flags = {} } = {}) {
  const t = f.b.spawnEnemy('enemy_1007_slime', { pos: [row, col] });
  Object.assign(t.base, { maxHp: hp, atk: 0, def, res, moveSpeed: 0 });
  t.markDirty(); void t.s; t.hp = hp; if (fly) t.motion = 'FLY';
  f.b.addBuff(t, { key: 'fixture:pin', flags: { noMove: true, disarm: true, ...flags } });
  f.b._buildEnemyIndex(); return t;
}
const place = (f, row = 12, col = 10, dir = 'RIGHT') => deployRegularSummon(f.b, KEY, row, col, dir);
const hits = (f, u) => f.hits.filter(h => h.source === u);

test('core requires complete source builds, original fresh owner and exact reviewed contract', () => {
  assert.deepEqual(REGULAR_OPERATORS[ID].skillIds, [1, 2, 3].map(n => `skchr_mgllan_${n}`));
  assert.ok(data.operators[ID]);
  assert.equal(CONTRACT.frameParity, false);
  assert.throws(() => make({ contract: { ...CONTRACT } }), /contract/);
  const valid = make().build;
  for (const change of [{ elite: 3 }, { level: 0 }, { level: 91 }, { potential: 0 }, { potential: 7 },
    { trust: 201 }, { trust: -1 }, { skillRank: 11 }, { skillRank: 0 }, { module: 'mod-x' },
    { elite: 0, skillId: 'skchr_mgllan_2' }, { elite: 1, skillId: 'skchr_mgllan_3' }])
    assert.throws(() => selectedMagallanBuild({ ...valid, ...change }));
  for (const mutate of [d => d.stats.atk++, d => d.skill.spCost++, d => d.skill.bb.atk = 99,
    d => d.rangeGrid.pop(), d => d.tags.push('wrong'), d => d.talents[0].bb.cnt = 99])
    assert.throws(() => make({ mutate }), /Incomplete/);
  const f = make({ defer: true });
  assert.throws(() => prepareMagallanCore(f.b, f.u, { contract: CONTRACT }), /fresh/);
});

test('all selected ranks keep owner skills held while retaining native SP and duration', () => {
  for (const skill of [1, 2, 3]) for (let rank = 1; rank <= 10; rank++) {
    const f = make({ skill, rank });
    assert.equal(f.u.skill.spTotal, f.record.source.spData.initSp);
    f.u.skill.addCharge(1); assert.equal(f.u.skill.activate(), false);
    assert.equal(f.u.skill.active, false);
    assert.equal(f.deck.record.id, `token_10005_mgllan_drone${skill}`);
  }
});

test('potential/trust affect owner alone; drone keyframes retain independent stock, deploy cap and stats', () => {
  for (const elite of [0, 1, 2]) for (const skill of [1, 2, 3].filter(n => n <= elite + 1)) {
    const f = make({ elite, skill }), p = make({ elite, skill, potential: 6, trust: 200 });
    near(p.u.base.atk, f.u.base.atk + 23 + 40);
    near(p.u.base.maxHp, f.u.base.maxHp + 300);
    near(p.u.base.cost, f.u.base.cost - 2); near(p.u.base.respawnTime, f.u.base.respawnTime - 4);
    assert.deepEqual(p.deck.record.stats, f.deck.record.stats);
    assert.equal(f.deck.stock, [3, 4, 5][elite]);
    assert.equal(f.deck.record.stats.maxDeployCount, 3);
    assert.equal(f.deck.record.stats.maxDeckStackCnt, [3, 4, 5][elite]);
    const t = place(f); near(t.s.maxHp, [1000, 1500, 2000][elite]); near(t.s.blockCnt, 0);
    assert.equal(t.base.atk, f.deck.record.stats.atk);
  }
  const mid = make({ elite: 1, skill: 2, level: 40 });
  const frames = e.tables.tokens.token_10005_mgllan_drone2.phases[1].attributesKeyFrames;
  const t = (40 - frames[0].level) / (frames.at(-1).level - frames[0].level);
  near(mid.deck.record.stats.atk, Math.round(frames[0].data.atk + (frames.at(-1).data.atk - frames[0].data.atk) * t));
});

test('placement enforces fullscreen, terrain, integer tiles, reservations, DP and both deployment limits', () => {
  for (const skill of [1, 2, 3]) {
    const f = make({ skill }), cost = f.deck.record.stats.cost, tile = f.b.grid.tile(12, 10);
    f.b.setViewport('inline'); assert.throws(() => place(f), /fullscreen/); f.b.setViewport('fullscreen-workspace');
    f.u.player.dp = cost - 1; assert.throws(() => place(f), /DP/); f.u.player.dp = 99;
    tile.build = skill === 2 ? 'RANGED' : skill === 3 ? 'MELEE' : 'NONE';
    assert.throws(() => place(f), /tile/); tile.build = 'ALL';
    for (const [r, c] of [[-1, 1], [2.5, 10], [1, 21]]) assert.throws(() => place(f, r, c), /tile/);
    assert.ok(f.b.reserveTile(f.u, 12, 10, 'fixture:return'));
    assert.throws(() => place(f), /reserved/); f.b.releaseTileReservations(f.u, 'fixture:return');
    f.b.unitLimit = 1; assert.throws(() => place(f), /Deployment limit/); f.b.unitLimit = 8;
    const dp = f.b.dp, slots = f.b.deployedSlots(), t = place(f, 12, 10, 'UP');
    near(dp - f.b.dp, cost); assert.equal(f.b.deployedSlots(), slots + 1);
    assert.equal(t.dir, skill === 3 ? 'UP' : 'RIGHT');
    assert.equal(f.deck.stock, 4); near(f.deck.readyAt, 10);
    assert.throws(() => place(f, 12, 11), /redeploying/);
    advance(f.b, 10); assert.throws(() => place(f), /occupied/);
    place(f, 12, 11); advance(f.b, 10); place(f, 12, 12); advance(f.b, 10);
    assert.equal(f.deck.own().length, 3); assert.equal(f.deck.stock, 2);
    assert.throws(() => place(f, 12, 13), /Drone deployment limit/);
  }
});

test('failed spawning spends neither DP nor stock and does not reset readiness', () => {
  const f = make(), before = [f.b.dp, f.deck.stock, f.deck.readyAt];
  const original = f.b.spawnToken; f.b.spawnToken = () => null;
  assert.throws(() => place(f), /placement failed/);
  assert.deepEqual([f.b.dp, f.deck.stock, f.deck.readyAt], before); f.b.spawnToken = original;
});

test('owner removal during a drone deployment leaves no detached token or card payment', () => {
  const f = make({ skill: 2 }), dp = f.b.dp;
  f.b.on('deploy', ({ unit }) => { if (unit.ownerUnit === f.u) f.b.retreat(f.u); });
  assert.throws(() => place(f), /owner became unavailable/);
  near(f.b.dp, dp); assert.equal(f.deck.stock, 0); assert.equal(f.controller.stopped, true);
  assert.equal(f.b.allyUnits.filter(t => t.ownerUnit === f.u && t.alive).length, 0);
  advance(f.b, 2); assert.equal(f.births.length, 0);
});

test('destroying all available cards cannot fabricate replacement stock after cooldown', () => {
  const f = make({ elite: 0 });
  for (let n = 0; n < 3; n++) { const t = place(f); f.b.kill(t, null); advance(f.b, 10); }
  assert.equal(f.deck.stock, 0); assert.equal(f.deck.own().length, 0);
  assert.throws(() => place(f), /No drones remaining/);
  assert.equal(regularSummonCards(f.b).find(c => c.key === KEY).available, false);
  assert.equal(f.deck.recycleOwned(), 0); assert.equal(f.deck.stock, 0);
});

test('invisibility uses drone promotion/potential duration and preserves area selection rules', () => {
  for (const elite of [0, 1, 2]) for (const potential of [1, 5]) {
    const f = make({ elite, potential }), t = place(f), enemyUnit = enemy(f, { row: 12, col: 10 });
    const duration = elite === 0 ? 0 : (elite === 1 ? 12 : 20) + (potential === 5 ? 2 : 0);
    assert.equal(f.record.hiddenDuration, duration);
    assert.equal(!!t.s.flags.stealth, duration > 0); assert.equal(!!t.s.flags.camou, false);
    assert.equal(canTargetAlly(enemyUnit, t, true), duration === 0);
    assert.equal(areaSelectable(enemyUnit, t), duration === 0);
    if (duration) {
      advance(f.b, duration - .1); assert.equal(t.s.flags.stealth, true);
      advance(f.b, .2); assert.equal(!!t.s.flags.stealth, false); assert.equal(canTargetAlly(enemyUnit, t, true), true);
    }
  }
});

test('all drones refuse ordinary healing, freezing drone cannot attack or block', () => {
  for (const skill of [1, 2, 3]) {
    const f = make({ skill }), t = place(f); t.hp = 100;
    f.b.heal(f.u, t, 999); near(t.hp, 100); assert.equal(t.s.flags.healFree, true);
    near(t.s.blockCnt, 0);
    if (skill === 1) {
      const target = enemy(f, { row: 12, col: 10 });
      advance(f.b, 5); assert.equal(f.births.filter(v => v.unit === t).length, 0);
      near(target.hp, target.s.maxHp); assert.equal(target.blockedBy, null);
      assert.equal(t.s.flags.disarm, true);
    }
  }
});

test('owner waits for original Born, releases one event-gated Arts projectile on all facings', () => {
  for (const dir of ['UP', 'DOWN', 'LEFT', 'RIGHT']) {
    const f = make({ dir }), target = enemy(f, { row: dir === 'UP' ? 6 : dir === 'DOWN' ? 4 : 5,
      col: dir === 'RIGHT' ? 6 : dir === 'LEFT' ? 4 : 5, res: 20 }), spare = enemy(f, { row: target.tileR, col: target.tileC });
    assert.equal(f.u.mem.regularFormVisual.clip, 'Start'); advance(f.b, .9); assert.equal(f.births.length, 0);
    until(f, () => f.controller.attack.phase?.kind === 'attack');
    const p = f.controller.attack.phase; near(p.releaseAt - p.startedAt, 19 / 30);
    advance(f.b, p.releaseAt - f.b.time - 2 * f.b.dt);
    assert.equal(f.births.length, 0); until(f, () => f.births.length === 1);
    assert.equal(f.births[0].projectile.speed, 10);
    until(f, () => hits(f, f.u).length === 1); near(hits(f, f.u)[0].amount, f.u.s.atk * .8);
    near(spare.hp, spare.s.maxHp); assert.equal(hits(f, f.u)[0].dmg.type, 'arts');
  }
});

test('ordinary windup interruption cancels unborn owner/mining/combat shots', () => {
  for (const skill of [1, 2, 3]) {
    const f = make({ skill }), t = skill === 1 ? f.u : place(f);
    enemy(f, { row: skill === 1 ? 5 : 12, col: skill === 1 ? 6 : skill === 2 ? 10 : 11 });
    const attack = t === f.u ? f.controller.attack : f.deck.attacks.get(t);
    until(f, () => attack.phase?.kind === 'attack');
    f.b.applyStatus(t, 'stun', { duration: 2 }); advance(f.b, .8);
    assert.equal(f.births.filter(v => v.unit === t).length, 0);
    until(f, () => f.births.some(v => v.unit === t));
  }
});

test('hidden state and invalid target lives cancel pending shots without a backlog', () => {
  const f = make(), t = enemy(f); until(f, () => f.controller.attack.phase?.kind === 'attack');
  f.u.hidden = true; advance(f.b, 2); assert.equal(f.births.length, 0);
  f.u.hidden = false; until(f, () => f.controller.attack.phase?.kind === 'attack');
  f.b.kill(t, null); advance(f.b, 1); assert.equal(f.births.length, 0);
  const next = enemy(f); until(f, () => f.births.length === 1); assert.equal(f.births[0].target, next);
});

test('original mining drone event and speed produce one Arts victim including aerial targets', () => {
  const f = make({ skill: 2 }), t = place(f), target = enemy(f, { row: 12, col: 10, fly: true, res: 25 }), spare = enemy(f, { row: 12, col: 10 });
  until(f, () => f.deck.attacks.get(t).phase?.kind === 'attack');
  const p = f.deck.attacks.get(t).phase; near(p.releaseAt - p.startedAt, 7 / 30);
  until(f, () => f.births.some(v => v.unit === t));
  assert.equal(f.births.find(v => v.unit === t).projectile.speed, 15);
  until(f, () => hits(f, t).length === 1); near(hits(f, t)[0].amount, t.s.atk * .75);
  assert.equal(hits(f, t)[0].target, target); near(spare.hp, spare.s.maxHp);
});

test('combat projectile hits only at target arrival and uses independent Physical mitigation per splash victim', () => {
  const f = make({ skill: 3 }), t = place(f), target = enemy(f, { row: 12, col: 12, def: 100 }),
    splash = enemy(f, { row: 12, col: 12.5, def: 200, flags: { camou: true } }),
    path = enemy(f, { row: 12, col: 10.5, flags: { camou: true } }),
    outside = enemy(f, { row: 12, col: 14, flags: { camou: true } }),
    hidden = enemy(f, { row: 12, col: 12.1, flags: { stealth: true } });
  until(f, () => f.deck.attacks.get(t).phase?.kind === 'attack');
  const p = f.deck.attacks.get(t).phase; near(p.releaseAt - p.startedAt, 21 / 30);
  until(f, () => f.births.some(v => v.unit === t));
  assert.equal(f.births.find(v => v.unit === t).projectile.speed, 12); assert.equal(hits(f, t).length, 0);
  until(f, () => hits(f, t).length > 0);
  assert.equal(hits(f, t).length, 2); near(hits(f, t).find(h => h.target === target).amount, t.s.atk - 100);
  near(hits(f, t).find(h => h.target === splash).amount, t.s.atk - 200);
  for (const victim of [path, outside, hidden]) near(victim.hp, victim.s.maxHp);
  assert.equal(new Set(hits(f, t).map(h => h.dmg.attackId)).size, 1);
});

test('projectiles read current source ATK at arrival and survive owner/token removal', () => {
  for (const skill of [1, 3]) {
    const f = make({ skill }), t = skill === 1 ? f.u : place(f), target = enemy(f, { row: skill === 1 ? 5 : 12, col: skill === 1 ? 8 : 12 });
    until(f, () => f.births.some(v => v.unit === t));
    const atk = t.base.atk; t.base.atk += 100; t.markDirty();
    if (skill === 1) f.b.retreat(f.u); else f.b.kill(t, null);
    until(f, () => hits(f, t).length === 1); near(hits(f, t)[0].amount, atk + 100);
    assert.ok(target.hp < target.s.maxHp);
  }
});

test('born projectiles cancel invalid target lives and never redirect onto a replacement', () => {
  for (const invalidation of ['death', 'hidden', 'life']) {
    const f = make({ skill: 3 }), t = place(f), target = enemy(f, { row: 12, col: 12 });
    until(f, () => f.births.some(v => v.unit === t));
    const spare = enemy(f, { row: 12, col: 12 });
    if (invalidation === 'death') f.b.kill(target, null);
    else if (invalidation === 'hidden') target.hidden = true;
    else target.deploySeq++;
    advance(f.b, .4);
    assert.equal(hits(f, t).length, 0); near(spare.hp, spare.s.maxHp);
  }
});

test('mining and combat facings affect their own ranges without copying the owner range', () => {
  for (const dir of ['UP', 'DOWN', 'LEFT', 'RIGHT']) {
    const f = make({ skill: 3 }), t = place(f, 12, 10, dir);
    const [row, col] = dir === 'UP' ? [14, 10] : dir === 'DOWN' ? [10, 10] : dir === 'LEFT' ? [12, 8] : [12, 12];
    const target = enemy(f, { row, col });
    until(f, () => hits(f, t).length === 1);
    assert.equal(hits(f, t)[0].target, target); assert.equal(t.dir, dir);
    assert.equal(f.births.filter(v => v.unit === f.u).length, 0);
  }
});

test('native owner/combat clip speed caps differ from uncapped mining-drone speed', () => {
  const f = make({ skill: 2 }), t = place(f), victim = enemy(f, { row: 12, col: 10 });
  f.b.addBuff(t, { key: 'fixture:aspd', mods: { aspd: 200 } });
  until(f, () => f.deck.attacks.get(t).phase?.kind === 'attack');
  const p = f.deck.attacks.get(t).phase;
  near(t.mem.regularFormVisual.speed, 3); near(p.releaseAt - p.startedAt, 7 / 90);
  const z = make({ skill: 3 }), q = place(z); enemy(z, { row: 12, col: 11 });
  z.b.addBuff(q, { key: 'fixture:aspd', mods: { aspd: 300 } });
  until(z, () => z.deck.attacks.get(q).phase?.kind === 'attack');
  const qp = z.deck.attacks.get(q).phase;
  near(q.mem.regularFormVisual.speed, 1); near(qp.releaseAt - qp.startedAt, .7);
  assert.ok(victim.alive);
});

test('death and manual retreat lose drones, whereas ordered recycling returns each surviving card once without DP', () => {
  const f = make(), a = place(f); advance(f.b, 10); const q = place(f, 12, 11); advance(f.b, 10);
  const z = place(f, 12, 12), dp = f.b.dp;
  retreatRegularSummon(f.b, `token:${a.id}`); near(f.b.dp - dp, 1); assert.equal(f.deck.stock, 2);
  f.b.kill(q, null); assert.equal(f.deck.stock, 2);
  const before = f.b.dp; assert.equal(f.deck.recycleOwned(), 1); near(f.b.dp, before);
  assert.equal(z.alive, false); assert.equal(f.deck.stock, 3); assert.equal(f.deck.own().length, 0);
  near(f.deck.readyAt, f.b.time + 10); assert.equal(f.deck.recycleOwned(), 0);
  f.deck.removed(z); assert.equal(f.deck.stock, 3);
});

test('multiple simultaneous recycled drones conserve stock and restore slots', () => {
  const f = make({ skill: 2 }); place(f); advance(f.b, 10); place(f, 12, 11); advance(f.b, 10); place(f, 12, 12);
  assert.equal(f.deck.stock, 2); assert.equal(f.b.deployedSlots(), 4);
  assert.equal(f.deck.recycleOwned(), 3); assert.equal(f.deck.stock, 5);
  assert.equal(f.b.deployedSlots(), 1); assert.equal(f.deck.attacks.size, 0);
  advance(f.b, 10); place(f); assert.equal(f.deck.stock, 4);
});

test('owner death clears deck, summons and hooks; a fresh owner has independent stock and selected drone type', () => {
  const f = make(), t = place(f); f.b.retreat(f.u);
  assert.equal(t.alive, false); assert.equal(f.deck.stock, 0); assert.equal(f.controller.stopped, true);
  assert.equal(f.controller.handles.length, 0); assert.equal(f.deck.attacks.size, 0);
  const next = owner(f.b, { skill: 3 }); assert.notEqual(next.deck, f.deck);
  assert.equal(next.deck.stock, 5); assert.equal(regularSummonCards(f.b).find(c => c.key === KEY).owner, next.u);
  const q = place(next); assert.equal(q.defId, 'token_10005_mgllan_drone3');
  f.deck.removed(q); assert.equal(next.deck.stock, 4);
});

test('battle end retires live projectiles, deck hooks and token attacks', () => {
  const f = make({ skill: 3 }), t = place(f); enemy(f, { row: 12, col: 12 });
  until(f, () => f.births.some(v => v.unit === t));
  f.b.finished = true; f.b.emit('battleEnd', {});
  assert.equal(f.b.projectiles.list.filter(p => p.data?.magallanCore === f.controller).length, 0);
  assert.equal(t.alive, false); assert.equal(f.deck.stock, 0); assert.equal(f.controller.handles.length, 0);
});

const cast = f => { f.u.skill.addCharge(1); assert.ok(f.u.skill.activate()); };

test('complete skill runtime requires its own reviewed contract independently of public approval', () => {
  assert.throws(() => make({ skills: true, contract: CONTRACT }), /skill contract/);
  assert.throws(() => make({ skills: true, contract: { ...MAGALLAN_SKILL_CONTRACT } }), /skill contract/);
  assert.equal(MAGALLAN_SKILL_CONTRACT.frameParity, false);
  assert.ok(data.operators[ID]); assert.equal(REGULAR_OPERATORS[ID].mechanic, 'magallan');
});

test('all thirty source ranks recover natural SP, run fifteen seconds and recycle a surviving drone once', () => {
  for (const skill of [1, 2, 3]) for (let rank = 1; rank <= 10; rank++) {
    const f = make({ skill, rank, skills: true }), t = place(f), cost = f.record.source.spData.spCost;
    assert.equal(f.u.skill.spTotal, f.record.source.spData.initSp);
    assert.equal(f.u.skill.ready, false); assert.equal(f.u.skill.activate(), false);
    advance(f.b, cost - f.record.source.spData.initSp - .1); assert.equal(f.u.skill.ready, false);
    until(f, () => f.u.skill.ready); assert.equal(f.u.skill.activations, 0);
    assert.ok(f.u.skill.activate()); assert.equal(f.u.skill.active, true); near(f.u.skill.spTotal, 0);
    const dp = f.b.dp; advance(f.b, 14.9); assert.equal(f.u.skill.active, true); near(f.u.skill.spTotal, 0);
    until(f, () => !f.u.skill.active, 1);
    assert.equal(t.alive, false); assert.equal(f.deck.stock, 5); near(f.b.dp, dp);
    assert.ok(f.deck.readyAt > f.b.time + 9.9); assert.equal(f.u.skill.activations, 1);
    assert.equal(f.u.findBuff(f.u.skill._buffKey), null);
  }
});

test('source holder allows silence but rejects stun, disarm, hidden state and dead owners without spending SP', () => {
  for (const skill of [1, 2, 3]) {
    const f = make({ skill, skills: true }); f.u.skill.addCharge(1);
    f.b.applyStatus(f.u, 'stun', { duration: 2 }); assert.equal(f.u.skill.activate(), false);
    assert.equal(f.u.skill.charges, 1); advance(f.b, 2.1);
    f.b.applyStatus(f.u, 'disarm', { duration: 2 }); assert.equal(f.u.skill.activate(), false);
    advance(f.b, 2.1); f.u.hidden = true; assert.equal(f.u.skill.activate(), false); f.u.hidden = false;
    f.b.applyStatus(f.u, 'silence', { duration: 30 }); assert.equal(f.u.skill.silenceBlocked, false);
    assert.ok(f.u.skill.activate()); f.b.retreat(f.u);
    assert.equal(f.u.skill.active, false); assert.equal(f.u.skill.activate(), false);
  }
});

test('S1 owner clock propagates slow pulses to freezing drones without producing attack damage', () => {
  const f = make({ skills: true }), t = place(f), target = enemy(f, { row: 12, col: 10, fly: true }),
    camo = enemy(f, { row: 12, col: 10, flags: { camou: true } }),
    hidden = enemy(f, { row: 12, col: 10, flags: { stealth: true } }),
    outside = enemy(f, { row: 17, col: 18 });
  const pulses = []; f.b.on('magallanPulse', ctx => pulses.push({ ...ctx, time: f.b.time }));
  advance(f.b, 2.9); assert.equal(target.findBuff('sluggish'), null);
  until(f, () => !!target.findBuff('sluggish'));
  near(target.findBuff('sluggish').mods.moveMul, .2); near(target.findBuff('sluggish').timeLeft, 1);
  assert.equal(camo.findBuff('sluggish') != null, true);
  assert.equal(hidden.findBuff('sluggish'), null); assert.equal(outside.findBuff('sluggish'), null);
  assert.equal(pulses.filter(p => p.source === t).length, 1);
  assert.equal(f.attacks.length, 0); assert.equal(f.hits.length, 0); near(target.hp, target.s.maxHp);
  advance(f.b, 1.1); assert.equal(target.findBuff('sluggish'), null);
});

test('S1 active pulses Bind for each selected rank, preserve RES and do not apply Freeze', () => {
  for (let rank = 1; rank <= 10; rank++) {
    const f = make({ skills: true, rank }), t = place(f), target = enemy(f, { row: 12, col: 10, res: 50 });
    cast(f); advance(f.b, 2.9); assert.equal(target.s.flags.bind, undefined);
    until(f, () => !!target.s.flags.bind);
    near(target.findBuff('bind').timeLeft, f.record.bb['attack@frozen_duration']);
    near(target.s.res, 50); assert.equal(!!target.s.flags.freeze, false); assert.equal(!!target.s.flags.stun, false);
    f.u.skill.end('manual'); assert.equal(t.alive, false); assert.equal(f.deck.stock, 5);
    assert.equal(target.s.flags.bind, true); // an existing independent status survives the host's mode ending
  }
});

test('S1 pulse ability keeps running through owner silence/stun and never catches up after hidden state', () => {
  const f = make({ skills: true }); place(f); const target = enemy(f, { row: 12, col: 10 });
  f.b.applyStatus(f.u, 'stun', { duration: 10 }); f.b.applyStatus(f.u, 'silence', { duration: 10 });
  until(f, () => !!target.findBuff('sluggish'));
  f.u.hidden = true; advance(f.b, 7); assert.equal(target.findBuff('sluggish'), null);
  f.u.hidden = false; advance(f.b, 2.8); assert.equal(target.findBuff('sluggish'), null);
  until(f, () => !!target.findBuff('sluggish'));
});

test('S2 shares only flat ASPD with existing/new drones and removes modifiers on early finish', () => {
  const f = make({ skill: 2, skills: true }), t = place(f), ownerAtk = f.u.s.atk, tokenAtk = t.s.atk;
  advance(f.b, 10); cast(f);
  near(f.u.s.aspd, 250); near(t.s.aspd, 250); near(f.u.s.atk, ownerAtk); near(t.s.atk, tokenAtk);
  const next = place(f, 12, 11); near(next.s.aspd, 250);
  f.u.skill.end('manual'); near(f.u.s.aspd, 100);
  assert.equal(t.alive, false); assert.equal(next.alive, false); assert.equal(f.deck.stock, 5);
  advance(f.b, 10); const fresh = place(f); near(fresh.s.aspd, 100);
});

test('S2 uses one uncapped native attack event for direct Arts damage to every area victim', () => {
  const f = make({ skill: 2, skills: true }), t = place(f);
  const a = enemy(f, { row: 12, col: 10, res: 25 }), q = enemy(f, { row: 12, col: 10, fly: true, res: 50 }),
    c = enemy(f, { row: 12, col: 10, flags: { camou: true } }),
    z = enemy(f, { row: 12, col: 10, flags: { stealth: true } }), out = enemy(f, { row: 12, col: 12 });
  cast(f); until(f, () => f.deck.attacks.get(t).phase?.kind === 'attack');
  const phase = f.deck.attacks.get(t).phase; near(phase.releaseAt - phase.startedAt, (7 / 30) / 2.5);
  until(f, () => hits(f, t).length > 0);
  assert.equal(hits(f, t).length, 3); near(hits(f, t).find(h => h.target === a).amount, t.s.atk * .75);
  near(hits(f, t).find(h => h.target === q).amount, t.s.atk * .5);
  near(hits(f, t).find(h => h.target === c).amount, t.s.atk);
  for (const victim of [z, out]) near(victim.hp, victim.s.maxHp);
  assert.equal(f.births.filter(p => p.unit === t).length, 0); assert.equal(f.attacks.filter(p => p.attacker === t).length, 1);
  assert.equal(new Set(hits(f, t).map(h => h.dmg.attackId)).size, 1);
  assert.equal(t.mem.regularVisualDirection, 'RIGHT');
});

test('S2 area selection occurs at release, including entrants and excluding removed targets', () => {
  const f = make({ skill: 2, skills: true }), t = place(f), first = enemy(f, { row: 12, col: 10 });
  cast(f); until(f, () => f.deck.attacks.get(t).phase?.kind === 'attack'); f.b.kill(first, null);
  const next = enemy(f, { row: 12, col: 10, res: 30 });
  until(f, () => hits(f, t).length === 1);
  assert.equal(hits(f, t)[0].target, next); near(hits(f, t)[0].amount, t.s.atk * .7);
});

test('S3 independently boosts owner/drone ATK and snapshots the larger collision radius at projectile birth', () => {
  const f = make({ skill: 3, skills: true }), t = place(f), ownerAtk = f.u.s.atk, tokenAtk = t.s.atk,
    target = enemy(f, { row: 12, col: 12, def: 100 }),
    extra = enemy(f, { row: 12, col: 13.2, def: 200, flags: { camou: true } }),
    path = enemy(f, { row: 12, col: 10.5, flags: { camou: true } });
  cast(f); near(f.u.s.atk, ownerAtk * 2.5); near(t.s.atk, tokenAtk * 2.5);
  until(f, () => f.births.some(v => v.unit === t));
  const shot = f.births.find(v => v.unit === t); assert.equal(shot.projectile.data.sourceKey, 'projectile_mgllan3_drone_3S');
  // The source projectile persists through skill finish, but its damage reads current ATK, after the mode buff is gone.
  f.u.skill.end('manual'); near(f.u.s.atk, ownerAtk);
  until(f, () => hits(f, t).length > 0);
  assert.equal(hits(f, t).length, 2); near(hits(f, t).find(h => h.target === target).amount, tokenAtk - 100);
  near(hits(f, t).find(h => h.target === extra).amount, tokenAtk - 200); near(path.hp, path.s.maxHp);
});

test('owner mode changes retain a pending ordinary Attack event without replaying a fabricated Skill clip', () => {
  for (const skill of [1, 2, 3]) for (const dir of ['RIGHT', 'UP']) {
    const f = make({ skill, dir, skills: true }); enemy(f, { row: dir === 'UP' ? 6 : 5, col: dir === 'RIGHT' ? 6 : 5 });
    until(f, () => f.controller.attack.phase?.kind === 'attack'); const p = f.controller.attack.phase;
    cast(f); assert.equal(f.controller.attack.phase, p); assert.equal(f.u.mem.regularFormVisual.clip, 'Attack');
    until(f, () => f.births.length === 1);
    assert.equal(f.births[0].projectile.data.sourceKey, 'projectile_mgllan_s');
    near(f.births[0].time, p.releaseAt, f.b.dt + 1e-7);
  }
});

test('owner death during a skill removes all tokens without recycling or affecting a fresh deck', () => {
  for (const skill of [1, 2, 3]) {
    const f = make({ skill, skills: true }), t = place(f); cast(f); f.b.kill(f.u, null);
    assert.equal(t.alive, false); assert.equal(f.deck.stock, 0); assert.equal(f.controller.stopped, true);
    const next = owner(f.b, { skill, skills: true }); assert.equal(next.deck.stock, 5);
    advance(f.b, 20); assert.equal(next.deck.stock, 5); assert.equal(next.u.skill.activations, 0);
  }
});

test('each active S2/S3 rank applies its own modifier and damage instead of reusing M3 values', () => {
  for (const skill of [2, 3]) for (let rank = 1; rank <= 10; rank++) {
    const f = make({ skills: true, skill, rank }), t = place(f), baseAtk = t.s.atk;
    const source = Object.fromEntries(e.tables.skills[`skchr_mgllan_${skill}`].levels[rank - 1].blackboard.map(v => [v.key, v.value]));
    const target = enemy(f, { row: 12, col: skill === 2 ? 10 : 12, res: 25, def: 100 });
    cast(f);
    if (skill === 2) { near(t.s.aspd, 100 + source.attack_speed); near(f.u.s.aspd, 100 + source.attack_speed); }
    else { near(t.s.atk, baseAtk * (1 + source.atk)); near(f.u.s.atk, f.u.base.atk * (1 + source.atk)); }
    until(f, () => hits(f, t).length === 1);
    near(hits(f, t)[0].amount, skill === 2 ? baseAtk * .75 : baseAtk * (1 + source.atk) - 100);
    assert.equal(hits(f, t)[0].target, target); assert.equal(hits(f, t)[0].dmg.isSkill, true);
  }
});

test('S2/S3 token controls cancel unborn active hits, while accepted attacks dispatch once', () => {
  for (const skill of [2, 3]) {
    const f = make({ skills: true, skill }), t = place(f); enemy(f, { row: 12, col: skill === 2 ? 10 : 12 });
    cast(f); until(f, () => f.deck.attacks.get(t).phase?.kind === 'attack');
    f.b.applyStatus(t, 'stun', { duration: 2 }); advance(f.b, .8);
    assert.equal(hits(f, t).length, 0); assert.equal(f.attacks.filter(a => a.attacker === t).length, 0);
    until(f, () => hits(f, t).length > 0);
    assert.equal(f.attacks.filter(a => a.attacker === t).length, 1);
    assert.equal(f.b.projectiles.list.filter(p => p.data?.magallanKind === `drone${skill}`).length, 0);
  }
});

test('natural completion recycles only surviving owned drones and never fills cards lost to combat', () => {
  const f = make({ skills: true, skill: 3 }), t = place(f); advance(f.b, 10);
  const next = place(f, 12, 11); cast(f); f.b.kill(t, null);
  assert.equal(f.deck.stock, 3); until(f, () => !f.u.skill.active, 16);
  assert.equal(next.alive, false); assert.equal(f.deck.stock, 4);
  assert.equal(f.deck.recycleOwned(), 0); assert.equal(f.deck.stock, 4);
});
