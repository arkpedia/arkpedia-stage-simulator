// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import evidence from '../data/arkpedia-tragodia-prefabs.json' with { type: 'json' };
import { StandardBattle } from '../server/sim/arkpedia.js';
import { normalizeChess } from '../server/sim/simdata.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { TRAGODIA_ID as ID, selectedTragodiaBuild } from '../server/sim/content/arkpedia-tragodia-source.js';
import { TRAGODIA_CAGE as TOKEN, TRAGODIA_CAGE_CONTRACT as CONTRACT,
  prepareTragodiaCages } from '../server/sim/content/arkpedia-tragodia-cage.js';
import { enforceBlockCapacity } from '../server/sim/ai.js';
import { makeDamageInfo } from '../server/sim/damage.js';
import { bodyInKeys } from '../server/sim/body.js';

function advance(b, seconds) {
  for (let n = 0; n < Math.ceil(seconds / b.dt - 1e-9); n++) b.step();
  assert.deepEqual(b.errors, []);
}
function addOwner(b, { rank = 10, level = 90, trust = 0, potential = 1,
  skill = 3, row = 5, col = 5, dir = 'RIGHT', contract = CONTRACT, defer = false } = {}) {
  const build = { elite: 2, level, potential, trust, skillRank: rank, skillId: `skchr_phatm2_${skill}` };
  const r = selectedTragodiaBuild(build), c = evidence.tables.character;
  const def = normalizeChess({ chessId: ID, charId: ID, name: c.name, profession: c.profession,
    position: c.position, subProfessionId: c.subProfessionId, stats: r.stats, rangeGrid: r.rangeGrid,
    tags: r.tags, talents: r.talents, arkpedia: build,
    skill: { ...r.source, ...r.source.spData, skillId: build.skillId,
      rangeGrid: r.skillRangeGrid, trigger: { rule: 'NEVER' } } });
  const u = b._makeAlly(b.getPlayer('arkpedia'), def, 'op', row, col, { dir });
  const prepared = prepareTragodiaCages(b, u, { contract });
  b._setupUnit(u, prepared.kit); prepared.controller.install();
  const deploy = () => { u.player.dp = 99; assert.ok(b._deploy(u, { initial: false }));
    b.addBuff(u, { key: 'fixture:disarm-owner', flags: { disarm: true } }); };
  if (!defer) deploy();
  return { b, u, build, deploy, ...prepared };
}
function make(options = {}) {
  const d = structuredClone(data); d.stage.geometry.waves[0].spawns = [];
  d.stage.battle.dp_per_second = 0; d.stage.geometry.rows = 19; d.stage.geometry.cols = 21;
  d.stage.geometry.tileGrid = Array.from({ length: 19 }, () => Array(21).fill(2));
  const b = new StandardBattle(d, { operators: [defaultBuild(d.operators.char_289_gyuki)] });
  b.autoFinish = false; b.recordEvents = true; b.setViewport('fullscreen-workspace');
  b.grid.tiles = b.grid.tiles.map(t => ({ ...t, height: 'LOW', build: 'ALL', pass: 'ALL' }));
  return addOwner(b, options);
}
function enemy(f, { row = 5, col = 6, hp = 1e7, fly = false, flags = {} } = {}) {
  const t = f.b.spawnEnemy('enemy_1007_slime', { pos: [row, col] });
  Object.assign(t.base, { maxHp: hp, atk: 100, moveSpeed: 0, rangeRadius: 0, bat: 1, aspd: 100 });
  t.markDirty(); void t.s; t.hp = hp; if (fly) t.motion = 'FLY';
  f.b.addBuff(t, { key: 'fixture:pin', flags: { noMove: true, disarm: true, ...flags } });
  f.b._buildEnemyIndex(); return t;
}
function cast(f) { f.u.skill.setSpTotal(f.u.skill.spCost); assert.ok(f.u.skill.activate('manual')); }
function burst(f, t, { element = 'neural', source = null } = {}) {
  f.b.removeBuff(t, `${element}Burst`); t.elem[element] = 0;
  f.b.dealDamage(source, t, { amount: t.gaugeMax + 1, type: 'element', element, canDodge: false });
}
const cages = f => [...f.cages.tokens.keys()];
function captured(f, t = enemy(f)) { cast(f); burst(f, t); assert.equal(cages(f).length, 1); return { t, cage: cages(f)[0] }; }
const hit = (f, t, cage, attackId = ++f.b._attackSeq, extra = {}) =>
  f.b.dealDamage(t, cage, { amount: 1e6, type: 'phys', isAttack: true, attackId, canDodge: false, ...extra });

test('cage adapter requires its own contract and a fresh selected S3 owner', () => {
  assert.throws(() => make({ contract: { ...CONTRACT } }), /reviewed cage contract/);
  assert.throws(() => make({ skill: 1 }), /fresh S3 owner/);
  assert.throws(() => make({ skill: 2 }), /fresh S3 owner/);
  assert.ok(data.operators[ID]);
  const f = make(); assert.equal(f.b.regularSummons?.has(`summon:${ID}`) ?? false, false);
  assert.equal(CONTRACT.frameParity, false);
});

for (let rank = 1; rank <= 10; rank++) test(`S3 rank ${rank} selects independent cage stats and zero slots`, () => {
  const f = make({ rank, trust: 200, potential: 6 });
  const t = enemy(f); const dp = f.b.dp, count = f.b.deployedSlots();
  cast(f); burst(f, t); const cage = cages(f)[0]; assert.ok(cage);
  assert.equal(cage.def.charId ?? cage.def.tokenId, TOKEN);
  assert.equal(cage.hp, 3); assert.equal(cage.s.maxHp, 3); assert.equal(cage.s.atk, 100);
  assert.equal(cage.s.blockCnt, 0); assert.equal(cage.deploymentSlotCost, 0);
  assert.equal(f.b.dp, dp); assert.equal(f.b.deployedSlots(), count);
  assert.equal(cage.profile.noAttack, true); assert.equal(cage.skill.activate(), false);
  assert.equal(cage.mem.regularNativeEffect, 'phatm2_skill_03_prison_01');
  assert.equal(cage.mem.regularModelFacing, undefined);
  assert.equal(t.blockedBy, cage);
});

test('level, trust, potential and live owner ATK never replace cage stats', () => {
  for (const options of [{ level: 1 }, { level: 90, trust: 200, potential: 6 }]) {
    const f = make(options); f.b.addBuff(f.u, { key: 'fixture:owner-atk', mods: { atkPct: 10 } });
    const { cage } = captured(f); assert.equal(cage.hp, 3); assert.equal(cage.s.atk, 100);
    assert.equal(cage.s.def, 0); assert.equal(cage.s.res, 0);
  }
});

test('existing Nervous bursts are captured at S3 start while other element bursts are not', () => {
  const f = make(), t = enemy(f); burst(f, t); assert.equal(cages(f).length, 0);
  const other = enemy(f, { row: 4 }); burst(f, other, { element: 'burn' });
  cast(f); assert.equal(cages(f).length, 1); assert.equal(t.blockedBy, cages(f)[0]);
  assert.equal(other.blockedBy, null);
});

test('all in-range burst tiles can create independent cages rather than a one-card stock limit', () => {
  const f = make(), enemies = [enemy(f), enemy(f, { row: 4 }), enemy(f, { row: 6 })];
  cast(f); for (const t of enemies) burst(f, t);
  assert.equal(cages(f).length, 3);
  assert.equal(new Set(enemies.map(t => t.blockedBy)).size, 3);
});

test('cage creation checks root lowland and occupancy but not manual buildability', () => {
  const f = make(), t = enemy(f); const tile = f.b.grid.tile(5, 6); tile.build = 'NONE';
  cast(f); burst(f, t); assert.equal(cages(f).length, 1);
  const high = enemy(f, { row: 4 }); f.b.grid.tile(4, 6).height = 'HIGH'; burst(f, high);
  assert.equal(cages(f).length, 1);
  const occupied = enemy(f, { row: 6 }); f.b.spawnDevice('fixture:box', 6, 6, { hp: 1e6 }); burst(f, occupied);
  assert.equal(cages(f).length, 1); assert.equal(occupied.blockedBy, null);
});

test('unrelated producers trigger the owner aura; inactive, out-of-range and hidden enemies do not', () => {
  const f = make(), t = enemy(f), far = enemy(f, { row: 14, col: 15 });
  burst(f, t); assert.equal(cages(f).length, 0); cast(f);
  burst(f, far); assert.equal(cages(f).length, 1, 'only opening in-range burst is captured');
  const hidden = enemy(f, { row: 4 }); f.b._setHidden(hidden, true); burst(f, hidden);
  assert.equal(cages(f).length, 1);
  const another = enemy(f, { row: 6 }); burst(f, another, { source: f.b.allyUnits.find(u => u !== f.u) });
  assert.equal(cages(f).length, 2);
});

test('creation captures all eligible ground enemies already on the tile, regardless of block weight', () => {
  const f = make(), t = enemy(f), another = enemy(f); another.blockWeight = 99;
  const fly = enemy(f, { fly: true }); const immune = enemy(f, { flags: { unblockable: true } });
  cast(f); burst(f, t); const cage = cages(f)[0];
  assert.equal(t.blockedBy, cage); assert.equal(another.blockedBy, cage);
  assert.equal(fly.blockedBy, null); assert.equal(immune.blockedBy, null);
  enforceBlockCapacity(f.b, cage); assert.equal(cage.blocking.length, 2);
  advance(f.b, .3); assert.equal(cage.blocking.length, 2);
});

test('later arrivals stay unblocked until a refresh and refresh does not heal the cage', () => {
  const f = make(), { t, cage } = captured(f); hit(f, t, cage); assert.equal(cage.hp, 2);
  const later = enemy(f); advance(f.b, .3); assert.equal(later.blockedBy, null);
  burst(f, later); assert.equal(cages(f).length, 1);
  assert.equal(later.blockedBy, cage); assert.equal(cage.hp, 2);
});

test('opening S3 on an existing cage clears its own clock without refreshing its capture snapshot', () => {
  const f = make(), { t, cage } = captured(f); f.u.skill.end();
  const later = enemy(f); burst(f, later); assert.equal(later.blockedBy, null);
  cast(f); assert.equal(later.blockedBy, null); assert.equal(t.blockedBy, cage);
  assert.equal(cage.findBuff('phatm2_s_3[token_cooldown]'), null);
});

test('positive landed attacks consume one HP per attack, ignoring repeated receipts and unrelated damage', () => {
  const f = make(), { t, cage } = captured(f), foreign = enemy(f, { row: 4 });
  assert.equal(hit(f, foreign, cage), 0);
  assert.equal(hit(f, t, cage, 1, { isAttack: false }), 0);
  assert.equal(hit(f, t, cage, 1, { sourceless: true }), 0);
  assert.equal(hit(f, t, cage, 1), 1); assert.equal(hit(f, t, cage, 1), 0);
  assert.equal(cage.hp, 2);
  assert.equal(hit(f, t, cage, 2, { type: 'arts' }), 1);
  assert.equal(hit(f, t, cage, 3, { type: 'true' }), 1);
  assert.equal(cage.alive, false); assert.equal(t.blockedBy, null); assert.equal(cages(f).length, 0);
});

test('shielded, cancelled and dodged receipts do not spend the same attack identity', () => {
  const f = make(), { t, cage } = captured(f);
  f.b.addBuff(cage, { key: 'fixture:shield', shieldHits: 1 });
  assert.equal(hit(f, t, cage, 7), 0); assert.equal(hit(f, t, cage, 7), 1);
  f.b.addBuff(cage, { key: 'fixture:dodge', mods: { dodgePhys: 1 } });
  assert.equal(hit(f, t, cage, 8, { canDodge: true }), 0);
  f.b.removeBuff(cage, 'fixture:dodge'); assert.equal(hit(f, t, cage, 8), 1);
  const h = f.b.on('hit', ctx => { if (ctx.target === cage) ctx.dmg.cancel = true; });
  assert.equal(hit(f, t, cage, 9), 0); f.b.off(h); assert.equal(hit(f, t, cage, 9), 1);
  assert.equal(cage.alive, false);
});

test('element gauges, healing, HP regeneration and Inspiration do not replenish cage lives', () => {
  const f = make(), { t, cage } = captured(f); hit(f, t, cage);
  const hp = cage.hp;
  assert.equal(f.b.heal(f.u, cage, 100), 0);
  assert.equal(f.b.heal(cage, cage, 100, { self: true }), 0);
  assert.equal(f.b.heal(cage, cage, 100, { regen: true }), 0);
  assert.equal(f.b.addBuff(cage, { key: 'fixture:inspire', status: 'inspire', mods: { atkFlat: 100 } }), null);
  f.b.dealDamage(t, cage, { amount: 10000, type: 'element', element: 'neural' });
  assert.equal(cage.elem.neural, 0); assert.equal(cage.hp, hp); assert.equal(cage.s.atk, 100);
});

test('real enemy attacks retain the cage target and remove it after three landed attacks', () => {
  const f = make(), { t, cage } = captured(f);
  f.b.removeBuff(t, 'fixture:pin'); f.b.removeBuff(t, 'palsy');
  f.b.addBuff(t, { key: 'fixture:no-move', flags: { noMove: true } });
  t.profile = { ...t.profile, noAttack: false, melee: true, dmgType: 'phys' };
  const hits = []; f.b.on('damaged', ctx => { if (ctx.target === cage && ctx.hpLoss > 0) hits.push(ctx); });
  const limit = f.b.time + 12;
  while (cage.alive && f.b.time < limit) advance(f.b, f.b.dt);
  assert.equal(cage.alive, false); assert.equal(hits.length, 3);
  assert.ok(hits.every(ctx => ctx.source === t && ctx.dmg.isAttack));
  assert.equal(t.blockedBy, null);
});

test('natural Nervous palsy interruptions do not spend any of the cage three landed-attack lives', () => {
  const f = make(), { t, cage } = captured(f); let interrupted = 0; const hits = [];
  f.b.on('palsyTriggered', ({ unit }) => { if (unit === t) interrupted++; });
  f.b.on('damaged', ctx => { if (ctx.target === cage && ctx.hpLoss > 0) hits.push(ctx); });
  f.b.removeBuff(t, 'fixture:pin');
  f.b.addBuff(t, { key: 'fixture:no-move', flags: { noMove: true } });
  t.profile = { ...t.profile, noAttack: false, melee: true, dmgType: 'phys' };
  const limit = f.b.time + 12;
  while (cage.alive && f.b.time < limit) advance(f.b, f.b.dt);
  assert.equal(interrupted, 3); assert.equal(hits.length, 3); assert.equal(cage.alive, false);
  assert.equal(new Set(hits.map(h => h.dmg.attackId)).size, 3);
});

for (const reason of ['kill', 'hide', 'unblock', 'life']) test(`last captured enemy ${reason} removes the empty cage`, () => {
  const f = make(), { t, cage } = captured(f);
  if (reason === 'kill') f.b.kill(t);
  else if (reason === 'hide') f.b._setHidden(t, true);
  else if (reason === 'unblock') f.b._unblock(t);
  else { t.deploySeq++; advance(f.b, f.b.dt); }
  assert.equal(cage.alive, false); assert.equal(cages(f).length, 0); assert.equal(t.blockedBy, null);
});

test('one remaining capture keeps a cage alive after another target dies', () => {
  const f = make(), t = enemy(f), other = enemy(f); const { cage } = captured(f, t);
  f.b.kill(t); assert.equal(cage.alive, true); assert.equal(other.blockedBy, cage);
  f.b.kill(other); assert.equal(cage.alive, false);
});

test('skill finish preserves existing cages for thirty seconds and disables new creation', () => {
  const f = make(), { t, cage } = captured(f); f.u.skill.end();
  const later = enemy(f, { row: 4 }); burst(f, later); assert.equal(cages(f).length, 1);
  const expiry = cage.findBuff('phatm2_s_3[token_cooldown]'); assert.ok(expiry);
  assert.equal(expiry.source, f.u); advance(f.b, 29.9); assert.equal(cage.alive, true);
  advance(f.b, .2); assert.equal(cage.alive, false); assert.equal(t.blockedBy, null);
});

test('restart clears expiry even when the surviving owned cage is outside the new skill range', () => {
  const f = make(), { t, cage } = captured(f); f.u.skill.end(); advance(f.b, 10);
  assert.ok(f.b.relocate(f.u, 14, 14)); cast(f);
  assert.equal(bodyInKeys(t, f.controller.keys()), false);
  assert.equal(cage.findBuff('phatm2_s_3[token_cooldown]'), null);
  advance(f.b, 20.1); assert.equal(cage.alive, true); assert.equal(t.blockedBy, cage);
});

test('foreign refresh neither changes cage ownership nor clears its original expiry clock', () => {
  const f = make(), { cage } = captured(f); f.u.skill.end();
  const second = addOwner(f.b, { row: 4, col: 5 }); cast(second);
  const newcomer = enemy(f); burst(second, newcomer);
  assert.equal(newcomer.blockedBy, cage); assert.equal(cages(second).length, 0);
  assert.equal(cage.ownerUnit, f.u); assert.equal(cage.findBuff('phatm2_s_3[token_cooldown]').source, f.u);
  advance(f.b, 30.1); assert.equal(cage.alive, false);
});

test('overlapping auras keep the first accepted producer and do not double-create', () => {
  const f = make(), second = addOwner(f.b, { row: 4, col: 5 }), t = enemy(f);
  cast(f); cast(second); burst(second, t);
  assert.equal(cages(f).length, 1); assert.equal(cages(second).length, 0);
  assert.equal(t.findBuff('phatm2_s_3[token]').source, f.u);
});

for (const reason of ['retreat', 'kill', 'end']) test(`owner ${reason} releases captures and removes owned aura/cages/hooks`, () => {
  const f = make(), { t, cage } = captured(f);
  if (reason === 'retreat') f.b.retreat(f.u, { permanent: true });
  else if (reason === 'kill') f.b.kill(f.u); else f.b.forceEnd('fixture');
  assert.equal(cage.alive, false); assert.equal(t.blockedBy, null); assert.equal(cages(f).length, 0);
  assert.equal(t.findBuff('phatm2_s_3[token]'), null); assert.equal(f.cages.handles.length, 0);
});

test('a deployment callback that retires the owner leaves no born cage or captured target', () => {
  const f = make(), t = enemy(f); cast(f);
  f.b.on('deploy', ({ unit }) => { if (unit.def.tokenId === TOKEN || unit.def.charId === TOKEN)
    f.b.retreat(f.u, { permanent: true }); });
  burst(f, t); assert.equal(cages(f).length, 0); assert.equal(t.blockedBy, null);
  assert.ok(f.b.allyUnits.filter(u => u.kind === 'token').every(u => !u.alive));
});

test('a capture callback that removes the target cleans up an empty cage once', () => {
  const f = make(), t = enemy(f); cast(f); let deaths = 0;
  f.b.on('blocked', ({ blocker, enemy }) => { if (blocker.kind === 'token') f.b.kill(enemy); });
  f.b.on('death', ({ unit }) => { if (unit.kind === 'token') deaths++; });
  burst(f, t); assert.equal(cages(f).length, 0); assert.equal(t.blockedBy, null); assert.equal(deaths, 1);
});

test('ordinary block capacity still drops excess enemies, while an unrelated added block is not retained by a cage', () => {
  const f = make(), { t, cage } = captured(f), foreign = enemy(f, { row: 4 });
  foreign.blockedBy = cage; cage.blocking.push(foreign);
  enforceBlockCapacity(f.b, cage); assert.equal(foreign.blockedBy, null); assert.equal(t.blockedBy, cage);
  const normal = f.b.spawnDevice('fixture:normal', 4, 7, { hp: 1000, blockCnt: 1 });
  const another = enemy(f, { row: 4 });
  foreign.blockedBy = normal; another.blockedBy = normal; normal.blocking.push(foreign, another);
  enforceBlockCapacity(f.b, normal); assert.equal(foreign.blockedBy, normal); assert.equal(another.blockedBy, null);
});

for (const reason of ['owner-retreat', 'skill-end', 'deny-passive'])
  test(`passive admission ${reason} cannot leave a late-born half-installed cage`, () => {
    const f = make(), t = enemy(f); cast(f);
    f.b.on('beforeBuff', ctx => {
      if (ctx.buff.key !== 'tragodia:cage-passive') return;
      if (reason === 'owner-retreat') f.b.retreat(f.u, { permanent: true });
      else if (reason === 'skill-end') f.u.skill.end(); else ctx.cancel = true;
    });
    burst(f, t); assert.equal(cages(f).length, 0); assert.equal(t.blockedBy, null);
    assert.ok(f.b.allyUnits.filter(u => u.kind === 'token').every(u => !u.alive));
    assert.equal(f.b.unitAt(5, 6), null); assert.deepEqual(f.b.errors, []);
  });

test('a rejected aura does not grant creation, and admission retirement leaves no stale claim', () => {
  for (const retire of [false, true]) {
    const f = make(), t = enemy(f);
    f.b.on('beforeBuff', ctx => { if (ctx.buff.key === 'phatm2_s_3[token]') {
      if (retire) f.b.retreat(f.u, { permanent: true }); else ctx.cancel = true;
    } });
    cast(f); burst(f, t); assert.equal(cages(f).length, 0);
    assert.equal(t.findBuff('phatm2_s_3[token]'), null); assert.equal(f.cages.claims.size, 0);
  }
});

test('expiry admission that restarts S3 cannot attach a late expiry to the new active skill', () => {
  const f = make(), { cage } = captured(f); let once = false;
  f.b.on('beforeBuff', ({ buff }) => { if (buff.key === 'phatm2_s_3[token_cooldown]' && !once) {
    once = true; cast(f);
  } });
  f.u.skill.end(); assert.equal(f.u.skill.active, true);
  assert.equal(cage.findBuff('phatm2_s_3[token_cooldown]'), null);
  advance(f.b, 29.9); assert.equal(cage.alive, true);
});

test('capture transfer releases the old blocker and preserves ordinary blocker bookkeeping', () => {
  const f = make(), t = enemy(f), old = f.b.spawnDevice('fixture:old', 5, 7, { hp: 1000, blockCnt: 1 });
  t.blockedBy = old; old.blocking.push(t);
  const { cage } = captured(f, t); assert.equal(t.blockedBy, cage); assert.deepEqual(old.blocking, []);
});

test('displacement and new unblockability release a capture and remove an empty cage', () => {
  for (const mode of ['push', 'immune']) {
    const f = make(), { t, cage } = captured(f);
    if (mode === 'push') assert.ok(f.b.displace(t, { x: 1, y: 0 }, 1) > 0);
    else { f.b.addBuff(t, { key: 'fixture:immune', flags: { unblockable: true } }); advance(f.b, f.b.dt); }
    assert.equal(t.blockedBy, null); assert.equal(cage.alive, false); assert.equal(cages(f).length, 0);
  }
});

test('a stale token lifetime cannot be killed by a prior expiry or owner cleanup', () => {
  const f = make(), { cage } = captured(f); f.u.skill.end(); cage.deploySeq++;
  advance(f.b, f.b.dt); assert.equal(cages(f).length, 0); assert.equal(cage.alive, true);
  advance(f.b, 30.1); assert.equal(cage.alive, true);
  f.b.retreat(f.u, { permanent: true }); assert.equal(cage.alive, true);
});

test('cage-created Nervous burst damage still uses the shared enemy cooldown and does not count as a cage attack', () => {
  const f = make(), { t, cage } = captured(f);
  assert.ok(t.findBuff('neuralBurst')); assert.ok(t.findBuff('palsy'));
  assert.equal(cage.hp, 3); assert.equal(t.elem.neural, t.gaugeMax);
  advance(f.b, .3); assert.equal(cage.hp, 3); assert.ok(t.findBuff('neuralBurst'));
});

test('a cage rejection does not cancel a shared HP or elemental damage instance for other recipients', () => {
  const f = make(), { cage } = captured(f), source = enemy(f, { row: 4 }), other = enemy(f, { row: 14, col: 15 });
  for (const kind of ['hp', 'element']) {
    const info = makeDamageInfo(kind === 'hp' ? { amount: 10, type: 'phys', isAttack: true, attackId: 81 }
      : { amount: 10, type: 'element', element: 'neural' });
    assert.equal(f.b.dealDamage(source, cage, info), 0);
    assert.equal(info.cancel, false);
    assert.ok(f.b.dealDamage(source, other, info) > 0);
  }
  assert.equal(cage.hp, 3); assert.equal(cage.elem.neural, 0);
});

test('leaving source range removes the owned aura without removing a previously captured cage', () => {
  const f = make(), { t, cage } = captured(f), stranger = enemy(f, { row: 4 });
  assert.ok(f.b.relocate(f.u, 14, 14)); advance(f.b, .1);
  assert.equal(bodyInKeys(stranger, f.controller.keys()), false);
  assert.equal(stranger.findBuff('phatm2_s_3[token]'), null);
  burst(f, stranger); assert.equal(cages(f).length, 1); assert.equal(stranger.blockedBy, null);
  assert.equal(cage.alive, true); assert.equal(t.blockedBy, cage);
});

test('a deployment callback that kills the pending target cannot leave an empty cage', () => {
  const f = make(), t = enemy(f); cast(f);
  f.b.on('deploy', ({ unit }) => { if (unit.kind === 'token') f.b.kill(t); });
  burst(f, t); assert.equal(cages(f).length, 0); assert.equal(f.b.unitAt(5, 6), null);
  assert.ok(f.b.allyUnits.filter(u => u.kind === 'token').every(u => !u.alive));
});

for (const [dir, row, col] of [['RIGHT', 5, 8], ['LEFT', 5, 2], ['UP', 8, 5], ['DOWN', 2, 5]])
  test(`${dir} native S3 range owns the burst capture before its root-tile search`, () => {
    const f = make({ dir }), t = enemy(f, { row, col });
    cast(f); assert.equal(bodyInKeys(t, f.controller.keys()), true); burst(f, t);
    assert.equal(cages(f).length, 1); assert.equal(t.blockedBy, cages(f)[0]);
    assert.equal(cages(f)[0].tileR, row); assert.equal(cages(f)[0].tileC, col);
  });

test('source body-grid selection can create on a root outside host range without inheriting host placement limits', () => {
  const f = make(), t = enemy(f, { col: 9 }); t.hitArea = { w: 3, h: 1, dx: 0, dy: 0 };
  cast(f); assert.equal(bodyInKeys(t, f.controller.keys()), true); burst(f, t);
  assert.equal(cages(f).length, 1); assert.equal(cages(f)[0].tileC, 9); assert.equal(t.blockedBy, cages(f)[0]);
});

test('a flying burst can create a ground cage for other ground enemies sharing the root tile', () => {
  const f = make(), fly = enemy(f, { fly: true }), ground = enemy(f); cast(f); burst(f, fly);
  assert.equal(cages(f).length, 1); assert.equal(fly.blockedBy, null); assert.equal(ground.blockedBy, cages(f)[0]);
});

test('remaining producers can claim a target after the first aura owner retires', () => {
  const f = make(), second = addOwner(f.b, { row: 4, col: 5 }), t = enemy(f);
  cast(f); cast(second); burst(f, t); f.b.retreat(f.u, { permanent: true });
  burst(second, t); assert.equal(cages(f).length, 0); assert.equal(cages(second).length, 1);
  assert.equal(t.findBuff('phatm2_s_3[token]').source, second.u);
});
