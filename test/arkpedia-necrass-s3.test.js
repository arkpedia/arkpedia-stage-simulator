// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import publicData from '../data/arkpedia-mvp.json' with { type: 'json' };
import e from '../data/arkpedia-necrass-prefabs.json' with { type: 'json' };
import { StandardBattle } from '../server/sim/arkpedia.js';
import { normalizeChess } from '../server/sim/simdata.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { NECRASS_ID as ID, selectedNecrassBuild } from '../server/sim/content/arkpedia-necrass-source.js';
import { NECRASS_S3_CONTRACT as S3, prepareNecrassS3 }
  from '../server/sim/content/arkpedia-necrass-s3.js';
const TOKEN = 'token_10043_necras_skeltn';
const near = (a, z, eps = 1e-5) => assert.ok(Math.abs(a - z) < eps, `${a} != ${z}`);
function advance(b, seconds) {
  for (let i = 0; i < Math.ceil(seconds / b.dt - 1e-9); i++) b.step();
  assert.deepEqual(b.errors, []);
}
function until(f, fn, seconds = 12) {
  const end = f.b.time + seconds;
  while (!fn() && f.b.time < end) advance(f.b, f.b.dt);
  assert.ok(fn(), `Missing condition at ${f.b.time}`);
}
function make({ skill = 3, rank = 10, elite = 2, level = e.tables.character.phases[elite].maxLevel,
  potential = 1, trust = 0, dir = 'RIGHT', defer = false,
  contract = S3, mutate } = {}) {
  const d = structuredClone(publicData); d.stage.geometry.waves[0].spawns = []; d.stage.battle.dp_per_second = 0;
  d.stage.geometry.rows = 19; d.stage.geometry.cols = 21;
  d.stage.geometry.tileGrid = Array.from({ length: 19 }, () => Array(21).fill(2));
  const b = new StandardBattle(d, { operators: [defaultBuild(d.operators.char_289_gyuki)] });
  b.autoFinish = false; b.recordEvents = true; b.setViewport('fullscreen-workspace');
  b.grid.tiles = b.grid.tiles.map(t => ({ ...t, height: 'LOW', build: 'ALL', pass: 'ALL' }));
  const build = { elite, level, potential, trust, skillId: `skchr_necras_${skill}`, skillRank: Math.min(rank, [4, 7, 10][elite]) };
  const r = selectedNecrassBuild(build), c = e.tables.character;
  const def = normalizeChess({ chessId: ID, charId: ID, name: c.name, profession: c.profession,
    position: c.position, subProfessionId: c.subProfessionId, stats: r.stats, rangeGrid: r.rangeGrid,
    tags: r.tags, talents: r.talents, arkpedia: build,
    skill: { ...r.source, ...r.source.spData, skillId: build.skillId, rangeGrid: r.skillRangeGrid,
      trigger: { rule: 'NEVER' } } });
  mutate?.(def);
  const u = b._makeAlly(b.getPlayer('arkpedia'), def, 'op', 5, 5, { dir });
  const prepared = prepareNecrassS3(b, u, { contract });
  b._setupUnit(u, prepared.kit); prepared.controller.install();
  const hits = [], attacks = [];
  b.on('damaged', ctx => { if (ctx.source?.def?.charId === ID || ctx.source?.defId === TOKEN) hits.push({ ...ctx, time: b.time }); });
  b.on('attack', ctx => { if (ctx.attacker === u || ctx.attacker.defId === TOKEN) attacks.push({ ...ctx, time: b.time }); });
  const deploy = () => { u.player.dp = 99; assert.ok(b._deploy(u, { initial: false })); };
  if (!defer) deploy();
  return { b, u, d, build, deploy, hits, attacks, ...prepared };
}
function enemy(f, { row = 5, col = 6, hp = 1e7, res = 0, fly = false, blockable = false, flags = {} } = {}) {
  const t = f.b.spawnEnemy('enemy_1007_slime', { pos: [row, col] });
  Object.assign(t.base, { maxHp: hp, atk: 0, def: 0, res, moveSpeed: 0 });
  t.markDirty(); void t.s; t.hp = hp; if (fly) t.motion = 'FLY';
  f.b.addBuff(t, { key: 'fixture:pin', flags: { noMove: true, disarm: true, unblockable: !blockable, ...flags } });
  f.b._buildEnemyIndex(); return t;
}
const ordinary = f => f.hits.filter(h => h.dmg.tags.includes('necrass:ordinary'));
const pinOwner = f => f.b.addBuff(f.u, { key: 'fixture:owner-pin', flags: { disarm: true } });

const volleyHits = f => f.hits.filter(h => h.dmg.tags.includes('necrass:s3-volley'));
const flameHits = f => f.hits.filter(h => h.dmg.tags.includes('necrass:dragon-flame'));
const charge = f => f.u.skill.setSpTotal(f.u.skill.spCost);

test('S3 contract rejects other selected skills and altered contracts', () => {
  assert.throws(() => make({ skill: 1 }), /original selected skill/);
  assert.throws(() => make({ contract: { ...S3 } }), /reviewed S3/);
  assert.ok(publicData.operators[ID]);
});

for (let rank = 1; rank <= 10; rank++) {
  test(`S3 rank ${rank} retains its source volley count, live Arts scale and cast/SP clock`, () => {
    const f = make({ rank }); pinOwner(f); const a = enemy(f), z = enemy(f, { col: 7 });
    charge(f); assert.ok(f.u.skill.activate('manual'));
    assert.equal(f.u.mem.regularFormVisual.clip, 'Skill_3_Begin'); assert.equal(f.u.skill.spTotal, 0);
    until(f, () => !f.u.skill.active);
    const count = rank < 8 ? 2 : 3;
    assert.equal(volleyHits(f).length, count * 2); assert.equal(f.skills.phase, null);
    for (const h of volleyHits(f)) near(h.hpLoss, f.u.s.atk * f.controller.record.bb['attack@atk_scale']);
    assert.ok(volleyHits(f).every(h => h.target === a || h.target === z));
    assert.equal(ordinary(f).length, 0);
    const events = f.attacks.filter(a => a.attacker === f.u);
    assert.equal(events.length, count); assert.ok(events.every(a => a.isSkill && a.targets.length === 2));
    assert.equal(f.u.s.flags.noSp, undefined);
    assert.equal(f.u.mem.regularFormVisual.clip, 'Idle');
  });
}

test('first source servant is the unique dragon, with independent stats, zero slots and unlocked recovery', () => {
  const f = make(); pinOwner(f);
  const d = f.servants.create(5, 6), n = f.servants.create(5, 7);
  assert.equal(f.servants.dragon, d); assert.equal(f.servants.units.get(d).special, true);
  assert.equal(f.servants.units.get(n).special, false);
  near(d.s.maxHp, 5550); near(d.s.atk, 924); near(d.s.def, 510);
  near(d.s.res, 20); near(d.s.bat, 2.5); assert.equal(d.s.blockCnt, 2);
  assert.equal(d.s.flags.healFree, true); assert.equal(n.s.flags.healFree, true);
  assert.equal(d.s.flags.noSp, undefined); assert.equal(n.s.flags.noSp, true);
  assert.equal(d.deploymentSlotCost, 0); assert.equal(n.deploymentSlotCost, 0);
  assert.equal(d.mem.regularFormVisual.clip, 'Start'); assert.equal(n.mem.regularFormVisual.clip, 'Start_2');
  advance(f.b, 2); assert.ok(d.skill.spTotal >= 1.99); assert.equal(n.skill.spTotal, 0);
  assert.equal(n.skill.activate('manual'), false);
});

test('normal Rekindle upgrades exclude the dragon and external healing cannot bypass heal-free', () => {
  const f = make(); pinOwner(f); const d = f.servants.create(5, 6), n = f.servants.create(5, 7);
  assert.equal(f.servants.upgradeOrHeal(), n); near(n.s.atk, 616); near(d.s.atk, 924);
  assert.equal(f.servants.units.get(d).upgrades, 0);
  d.hp = 100; n.hp = 100;
  assert.equal(f.b.heal(f.u, d, 1000), 0); assert.equal(f.b.heal(f.u, n, 1000), 0);
  assert.ok(f.servants.heal(n) > 0);
});

test('dragon death clears the original host marker and allows the next birth to be special', () => {
  const f = make(); pinOwner(f); const d = f.servants.create(5, 6); f.servants.create(5, 7);
  assert.ok(f.u.findBuff('nectas_t_4[has_dragon]')); f.b.kill(d);
  assert.equal(f.servants.dragon, null); assert.equal(f.u.findBuff('nectas_t_4[has_dragon]'), null);
  const replacement = f.servants.create(5, 6);
  assert.equal(f.servants.dragon, replacement); assert.equal(f.servants.units.get(replacement).special, true);
  assert.notEqual(replacement, d); assert.equal(d.mem.necrassServantClock.stopped, true);
});

test('natural enemy deaths use the S3 factory and initialize the source dragon role', () => {
  const f = make(); pinOwner(f); f.b.kill(enemy(f));
  until(f, () => f.servants.all().length === 1);
  assert.equal(f.servants.units.get(f.servants.all()[0]).special, true);
});

test('selected six upgrade limit applies stats once and adds block/range at three-stack thresholds', () => {
  const f = make(); pinOwner(f); const d = f.servants.create(5, 6);
  for (let n = 1; n <= 8; n++) {
    f.servants.upgradeDragon(); const valid = Math.min(n, 6);
    near(d.s.atk, 308 * (3 + .8 * valid)); near(d.s.maxHp, 1850 * (3 + .8 * valid));
    near(d.s.def, 255 * (2 + .4 * valid));
    assert.equal(d.s.blockCnt, 2 + Math.floor(valid / 3)); assert.equal(d.s.rangeExtend, Math.floor(valid / 3));
    assert.equal(f.servants.units.get(d).upgrades, valid);
  }
});

test('dragon healing uses its max-HP ratio, bypasses heal-free and participates in heal modifiers', () => {
  const f = make(); pinOwner(f); const d = f.servants.create(5, 6); d.hp = 100;
  let requested;
  f.b.on('heal', ctx => { if (ctx.target === d) { requested = ctx.amount; ctx.amount = 100; } });
  f.b.addBuff(d, { key: 'fixture:heal-scale', mods: { healingTakenMul: .5 } });
  const oldRatio = d.hp / d.s.maxHp;
  f.servants.upgradeDragon(); near(requested, d.s.maxHp * .2 * .5);
  near(d.hp, oldRatio * d.s.maxHp + 100);
});

test('normal sacrifice upgrades before removal; upgraded sacrifice adds a delayed second stack', () => {
  for (const upgraded of [false, true]) {
    const f = make(); pinOwner(f); const d = f.servants.create(5, 6), n = f.servants.create(5, 7);
    if (upgraded) f.servants.upgradeOrHeal();
    assert.equal(f.servants.sacrifice(), n); assert.equal(n.alive, false);
    assert.equal(n.removeReason, 'necrass-s3-consumed'); assert.equal(d.alive, true);
    assert.equal(f.servants.units.get(d).upgrades, 1);
    advance(f.b, .15); assert.equal(f.servants.units.get(d).upgrades, upgraded ? 2 : 1);
  }
});

test('real S3 volley consumes ordinary servants and never consumes its special servant', () => {
  const f = make(); pinOwner(f); const d = f.servants.create(5, 6), n = f.servants.create(5, 7), z = f.servants.create(6, 6);
  enemy(f, { col: 8 }); charge(f); f.u.skill.activate('manual');
  until(f, () => !f.u.skill.active);
  assert.equal(n.alive, false); assert.equal(z.alive, false); assert.equal(d.alive, true);
  assert.equal(f.servants.all().length, 1); assert.equal(f.servants.units.get(d).upgrades, 2);
});

test('S3 reselects its area at each release, including flyers but excluding Sleep/stealth recipients', () => {
  const f = make(); pinOwner(f); const a = enemy(f), fly = enemy(f, { col: 7, fly: true });
  const asleep = enemy(f, { row: 6, col: 6 }); f.b.applyStatus(asleep, 'sleep', { duration: 20 });
  const hidden = enemy(f, { row: 4, col: 6, flags: { stealth: true } });
  charge(f); f.u.skill.activate('manual'); until(f, () => volleyHits(f).length === 2);
  a.x = 15; a.y = 15; const late = enemy(f, { col: 8 });
  until(f, () => !f.u.skill.active);
  assert.equal(volleyHits(f).filter(h => h.target === a).length, 1);
  assert.equal(volleyHits(f).filter(h => h.target === fly).length, 3);
  assert.equal(volleyHits(f).filter(h => h.target === late).length, 2);
  assert.equal(volleyHits(f).some(h => h.target === asleep || h.target === hidden), false);
});

test('S3 empty release still advances the selected volley counter without inventing hits', () => {
  const f = make(); pinOwner(f); charge(f); assert.ok(f.u.skill.activate('manual'));
  until(f, () => !f.u.skill.active);
  assert.equal(volleyHits(f).length, 0); assert.equal(f.u.skill.activations, 1);
});

test('dragon ordinary attacks use the original Attack event and Arts damage', () => {
  const f = make(); pinOwner(f); const d = f.servants.create(5, 6); const t = enemy(f, { col: 7 });
  until(f, () => f.hits.some(h => h.source === d));
  const h = f.hits.find(h => h.source === d);
  near(h.hpLoss, d.s.atk); assert.equal(h.type, 'arts'); assert.equal(h.target, t);
  assert.equal(d.mem.regularFormVisual.clip, 'Attack');
  near(d.mem.necrassServantClock.phase.releaseAt - d.mem.necrassServantClock.phase.startedAt, .7870370315180883);
});

test('dragon automatic skill recovers naturally and only its selected ground area receives fixed-interval Arts', () => {
  const f = make(); pinOwner(f); const d = f.servants.create(5, 6);
  const a = enemy(f, { col: 7 }), z = enemy(f, { col: 6 }), air = enemy(f, { col: 7, fly: true });
  until(f, () => d.skill.active, 17); assert.equal(d.skill.spTotal, 0);
  assert.equal(d.skill.spCost, 15); assert.equal(d.skill.duration, 8);
  until(f, () => flameHits(f).length > 0);
  assert.equal(flameHits(f).some(h => h.target === air), false);
  assert.ok(flameHits(f).every(h => h.target === a || h.target === z));
  for (const h of flameHits(f)) near(h.hpLoss, d.s.atk * 1.2);
  const first = flameHits(f).find(h => h.target === a);
  until(f, () => flameHits(f).filter(h => h.target === a).length === 2);
  near(flameHits(f).filter(h => h.target === a)[1].time - first.time, 1, f.b.dt);
  until(f, () => !d.skill.active, 10); assert.equal(d.mem.necrassServantClock.flames, null);
});

test('ordinary S3 servants cannot borrow the dragon skill, while its min-zero trigger can fire in empty range', () => {
  const f = make(); pinOwner(f); const d = f.servants.create(5, 6), n = f.servants.create(5, 7);
  n.skill.setSpTotal(15); assert.equal(n.skill.activate('manual'), false);
  until(f, () => d.skill.active, 17); advance(f.b, 1); assert.equal(flameHits(f).length, 0);
  assert.equal(n.skill.active, false);
});

test('retired owner clears delayed upgrades and all special/ordinary generations', () => {
  const f = make(); pinOwner(f); const d = f.servants.create(5, 6); f.servants.create(5, 7);
  f.servants.upgradeOrHeal(); f.servants.sacrifice(); assert.equal(f.servants.delayed.length, 1);
  f.b.retreat(f.u, { permanent: true }); advance(f.b, 1);
  assert.equal(d.alive, false); assert.equal(f.servants.delayed.length, 0); assert.equal(f.servants.dragon, null);
  assert.equal(f.servants.all().length, 0); assert.equal(f.skills.phase, null);
});

test('a new dragon generation cannot inherit its predecessor\'s stat stacks', () => {
  const f = make(); pinOwner(f); const d = f.servants.create(5, 6); f.servants.upgradeDragon();
  f.b.kill(d); const next = f.servants.create(5, 6);
  assert.equal(f.servants.units.get(next).upgrades, 0); near(next.s.atk, 924);
});

test('source factory cap and unique dragon reservation survive reentrant deployment callbacks', () => {
  const f = make(); pinOwner(f); let spawned = false;
  f.b.on('deploy', ({ unit }) => {
    if (unit.defId === TOKEN && !spawned) { spawned = true; f.servants.create(5, 7); f.servants.create(6, 6); f.servants.create(4, 6); }
  });
  f.servants.create(5, 6);
  assert.equal(f.servants.all().length, 3); assert.equal(f.servants.all().filter(t => f.servants.units.get(t).special).length, 1);
  assert.equal(f.servants.creating, 0);
});

test('before-attack control interrupts an S3 strike without consuming an ordinary servant', () => {
  const f = make(); pinOwner(f); f.servants.create(5, 6); const n = f.servants.create(5, 7);
  enemy(f); charge(f);
  f.b.on('beforeAttack', ({ attacker }) => {
    if (attacker === f.u) f.b.applyStatus(f.u, 'stun', { duration: .01 });
  });
  f.u.skill.activate('manual'); until(f, () => f.skills.phase.count === 1);
  assert.equal(volleyHits(f).length, 0); assert.equal(n.alive, true);
});

test('interrupting a pending S3 release pauses the volley instead of committing a ghost strike', () => {
  const f = make(); pinOwner(f); enemy(f); charge(f); f.u.skill.activate('manual');
  until(f, () => f.skills.phase.release != null);
  const at = f.skills.phase.release;
  f.b.applyStatus(f.u, 'stun', { duration: .01 });
  while (f.b.time <= at + .05) advance(f.b, f.b.dt);
  assert.equal(volleyHits(f).length, 0);
  until(f, () => !f.u.skill.active);
  assert.equal(volleyHits(f).length, 3);
});

test('flame strikes use one accepted shared attack receipt for all their targets', () => {
  const f = make(); pinOwner(f); const d = f.servants.create(5, 6);
  enemy(f, { col: 6 }); enemy(f, { col: 7 }); d.skill.setSpTotal(15);
  until(f, () => flameHits(f).length === 2);
  const [a, z] = flameHits(f); assert.ok(a.dmg.attackId > 0); assert.equal(a.dmg.attackId, z.dmg.attackId);
  assert.equal(f.attacks.filter(v => v.attacker === d && v.isSkill).length, 1);
});

test('ending flames inside a damage callback keeps its original end clip and cancels remaining targets', () => {
  const f = make(); pinOwner(f); const d = f.servants.create(5, 6);
  enemy(f, { col: 6 }); enemy(f, { col: 7 }); d.skill.setSpTotal(15);
  f.b.on('damaged', ({ source, dmg }) => {
    if (source === d && dmg.tags.includes('necrass:dragon-flame')) d.skill.end('fixture:end');
  });
  until(f, () => flameHits(f).length === 1);
  assert.equal(d.skill.active, false); assert.equal(d.mem.regularFormVisual.clip, 'Skill_End');
});

test('an upgrade healing callback that retires the owner cannot leave a sacrifice or delayed upgrade behind', () => {
  const f = make(); pinOwner(f); const d = f.servants.create(5, 6), n = f.servants.create(5, 7);
  f.servants.upgradeOrHeal(); d.hp = 100;
  f.b.on('heal', ({ target }) => { if (target === d) f.b.retreat(f.u, { permanent: true }); });
  assert.equal(f.servants.sacrifice(), null);
  assert.equal(n.alive, false); assert.equal(d.alive, false); assert.equal(f.servants.delayed.length, 0);
});

