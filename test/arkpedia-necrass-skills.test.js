// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import publicData from '../data/arkpedia-mvp.json' with { type: 'json' };
import e from '../data/arkpedia-necrass-prefabs.json' with { type: 'json' };
import { StandardBattle } from '../server/sim/arkpedia.js';
import { normalizeChess } from '../server/sim/simdata.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { NECRASS_ID as ID, selectedNecrassBuild } from '../server/sim/content/arkpedia-necrass-source.js';
import { NECRASS_ACTIVE_SKILLS_CONTRACT as ACTIVE, prepareNecrassActiveSkills }
  from '../server/sim/content/arkpedia-necrass-skills.js';
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
function make({ skill = 1, rank = 10, elite = 2, level = e.tables.character.phases[elite].maxLevel,
  potential = 1, trust = 0, dir = 'RIGHT', defer = false,
  contract = ACTIVE, mutate } = {}) {
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
  const prepared = prepareNecrassActiveSkills(b, u, { contract });
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

const linkHits = f => f.hits.filter(h => h.dmg.tags.includes('necrass:s2-link'));
const charge = f => f.u.skill.setSpTotal(f.u.skill.spCost);

test('active contract rejects altered consent and S3 before registering an incomplete skill', () => {
  assert.throws(() => make({ contract: { ...ACTIVE } }), /reviewed active/);
  assert.throws(() => make({ skill: 3 }), /S3 remains held/);
  assert.ok(publicData.operators[ID]);
  const f = make({ defer: true });
  assert.throws(() => f.skills.install(), /twice/);
  f.controller.stop(); assert.throws(() => f.skills.install(), /retirement/);
});

for (let rank = 1; rank <= 10; rank++) {
  test(`S1 rank ${rank} empty manual cast creates one servant through the original factory`, () => {
    const f = make({ rank }); pinOwner(f); charge(f);
    assert.ok(f.u.skill.activate('manual')); assert.equal(f.u.skill.spTotal, 0);
    assert.equal(f.u.s.flags.noSp, true); assert.equal(f.servants.all().length, 0);
    assert.equal(f.u.mem.regularFormVisual.clip, 'Skill_1');
    advance(f.b, .45); assert.equal(f.servants.all().length, 0);
    until(f, () => f.servants.all().length === 1);
    assert.ok(f.b.time >= .5 + f.servants.delay - f.b.dt);
    until(f, () => !f.u.skill.active);
    assert.equal(f.servants.all().length, 1); assert.equal(f.u.s.flags.noSp, undefined);
    assert.equal(f.skills.phase, null); assert.equal(f.u.mem.regularFormVisual.clip, 'Idle');
    assert.equal(f.u.skill.activations, 1);
  });
  test(`S2 rank ${rank} uses the native predelay and retained two-target Sleep damage`, () => {
    const f = make({ skill: 2, rank }); pinOwner(f); const a = enemy(f), z = enemy(f, { col: 7 });
    charge(f); assert.ok(f.u.skill.activate('manual'));
    near(f.skills.phase.releaseAt - f.skills.phase.startedAt, .6299999952316284);
    advance(f.b, .6); assert.equal(linkHits(f).length, 0); assert.equal(a.s.flags.sleep, undefined);
    until(f, () => linkHits(f).length === 2);
    assert.ok(linkHits(f).every(h => h.time < .6666666865348816 + f.b.dt + 1e-8));
    for (const t of [a, z]) {
      assert.equal(t.s.flags.sleep, true); assert.ok(f.skills.links.has(t));
      near(linkHits(f).find(h => h.target === t).hpLoss, f.u.s.atk * (.6 + .1 * rank));
    }
    until(f, () => linkHits(f).length === 4);
    near(linkHits(f)[2].time - linkHits(f)[0].time, .5, f.b.dt);
    assert.equal(ordinary(f).length, 0); assert.equal(f.u.skill.spTotal, 0);
    assert.equal(f.u.s.flags.noSp, true);
  });
}

test('S1 withdraws captured lives; upgraded servants become two factory attempts instead of copied actors', () => {
  const f = make(); pinOwner(f);
  const a = f.servants.create(5, 6), z = f.servants.create(5, 7); f.servants.upgradeOrHeal();
  assert.equal(f.servants.units.get(a).upgraded, true); charge(f);
  assert.ok(f.u.skill.activate('manual')); advance(f.b, .45);
  assert.equal(a.alive, true); assert.equal(z.alive, true);
  until(f, () => !a.alive && !z.alive);
  assert.equal(a.removeReason, 'necrass-s1-resummon'); assert.equal(f.servants.pending.length, 3);
  until(f, () => f.servants.all().length === 3);
  assert.ok(f.servants.all().every(t => t !== a && t !== z && !f.servants.units.get(t).upgraded));
  assert.equal(a.mem.necrassServantClock.stopped, true);
});

test('S1 at a full upgraded cap rebuilds and upgrades without exceeding stock or consuming DP/slots', () => {
  const f = make(); pinOwner(f);
  for (const p of [[5, 6], [5, 7], [6, 6]]) f.servants.create(...p);
  for (let n = 0; n < 3; n++) f.servants.upgradeOrHeal();
  const old = [...f.servants.all()], dp = f.u.player.dp, slots = f.b.deployedSlots();
  charge(f); f.u.skill.activate('manual');
  until(f, () => old.every(t => !t.alive)); assert.equal(f.servants.pending.length, 6);
  until(f, () => f.servants.all().length === 3 && f.servants.all().every(t => f.servants.units.get(t).upgraded));
  assert.equal(f.u.player.dp, dp); assert.equal(f.b.deployedSlots(), slots);
  assert.ok(f.servants.all().every(t => !old.includes(t)));
});

test('S1 cast-start capture does not withdraw a servant born later in its windup', () => {
  const f = make(); pinOwner(f); charge(f); f.u.skill.activate('manual');
  const t = f.servants.create(5, 6); advance(f.b, 2);
  assert.equal(t.alive, true); assert.equal(f.servants.all().length, 1);
});

test('natural SP recovery, cast SP hold and post-cast recovery use the selected source costs', () => {
  const f = make(); pinOwner(f);
  assert.equal(f.u.skill.spTotal, 8); assert.equal(f.u.skill.activate('manual'), false);
  until(f, () => f.u.skill.ready, 8); assert.ok(f.u.skill.activate('manual'));
  advance(f.b, .8); assert.equal(f.u.skill.spTotal, 0);
  until(f, () => !f.u.skill.active); advance(f.b, 1); assert.ok(f.u.skill.spTotal >= .99);
});

test('manual S1 can cast during Born, replacing the old ordinary clock without a ghost release', () => {
  const f = make(); charge(f); const t = enemy(f);
  assert.equal(f.controller.clock.phase.kind, 'born'); assert.ok(f.u.skill.activate('manual'));
  advance(f.b, .55); assert.equal(ordinary(f).length, 0); assert.equal(t.alive, true);
  until(f, () => !f.u.skill.active); until(f, () => ordinary(f).length === 1);
});

test('a brief control interruption spends S1 SP but does not withdraw actors before its event', () => {
  const f = make(); const t = f.servants.create(5, 6); charge(f); f.u.skill.activate('manual');
  f.b.applyStatus(f.u, 'stun', { duration: .01 }); advance(f.b, .6);
  assert.equal(f.u.skill.active, false); assert.equal(f.u.skill.spTotal < 1, true);
  assert.equal(t.alive, true); assert.equal(f.servants.pending.length, 0);
});

test('S2 no-target gating preserves ready SP and later entrants are not added to a retained volley', () => {
  const f = make({ skill: 2 }); pinOwner(f); charge(f);
  assert.equal(f.u.skill.activate('manual'), false); assert.equal(f.u.skill.ready, true);
  const a = enemy(f); assert.ok(f.u.skill.activate('manual')); const z = enemy(f, { col: 7 });
  until(f, () => linkHits(f).length >= 2);
  assert.ok(linkHits(f).every(h => h.target === a)); assert.equal(z.s.flags.sleep, undefined);
});

test('S2 retains targets beyond range, uses live ATK/RES and permits its own Sleep damage only', () => {
  const f = make({ skill: 2 }); pinOwner(f); const t = enemy(f, { res: 50 });
  charge(f); f.u.skill.activate('manual'); until(f, () => linkHits(f).length === 1);
  t.x = 15; t.y = 15; f.b.addBuff(f.u, { key: 'fixture:atk', mods: { atkPct: 1 } });
  until(f, () => linkHits(f).length === 2);
  near(linkHits(f)[1].hpLoss, f.u.s.atk * 1.6 * .5);
  const token = f.servants.create(5, 6);
  assert.equal(f.b.dealDamage(token, t, { amount: 100, type: 'arts' }), 0);
  near(f.b.dealDamage(f.u, t, { amount: 100, type: 'arts' }), 50);
});

test('S2 Sleep immunity and resistance do not shorten the retained projectile lifetime', () => {
  for (const immune of [false, true]) {
    const f = make({ skill: 2 }); pinOwner(f); const t = enemy(f);
    if (immune) t.def.immune.add('sleep');
    f.b.applyStatus(t, 'resist', { duration: 30, value: .5 }); charge(f); f.u.skill.activate('manual');
    until(f, () => linkHits(f).length === 1);
    assert.equal(!!t.s.flags.sleep, !immune); assert.equal(f.skills.links.get(t).buff.timeLeft, Infinity);
    advance(f.b, 7); assert.equal(f.u.skill.active, true); assert.equal(f.skills.links.size, 1);
    until(f, () => !f.u.skill.active, 8);
    assert.equal(t.s.flags.sleep, undefined); assert.equal(t.findBuff('necras_s_2'), null);
    assert.equal(f.skills.links.size, 0); assert.equal(f.skills.flights.size, 0);
    assert.equal(linkHits(f).length, 24);
  }
});

test('S2 linked kill grants extra attempts as well as ordinary in-range death dispatch', () => {
  const f = make({ skill: 2 }); pinOwner(f); const t = enemy(f);
  charge(f); f.u.skill.activate('manual'); until(f, () => linkHits(f).length === 1);
  f.b.kill(t); assert.equal(f.servants.pending.length, 3);
  until(f, () => f.servants.all().length === 3); assert.equal(f.skills.links.size, 0);
});

test('a linked enemy killed outside the host range still grants only its two extra attempts', () => {
  const f = make({ skill: 2 }); pinOwner(f); const t = enemy(f);
  charge(f); f.u.skill.activate('manual'); until(f, () => linkHits(f).length === 1);
  t.x = 15; t.y = 15; f.b.kill(t); assert.equal(f.servants.pending.length, 2);
  until(f, () => f.servants.all().length === 2);
});

test('leaks, dispelled composites and stale target lives never grant extra servants', () => {
  for (const kind of ['leak', 'dispel', 'new-life']) {
    const f = make({ skill: 2 }); pinOwner(f); const t = enemy(f);
    charge(f); f.u.skill.activate('manual'); until(f, () => linkHits(f).length === 1);
    if (kind === 'leak') f.b._remove(t, 'leak');
    if (kind === 'dispel') { f.b.removeBuff(t, f.skills.links.get(t).buff); f.b.kill(t); }
    if (kind === 'new-life') { t.deploySeq++; f.b.kill(t); }
    assert.equal(f.servants.pending.length, kind === 'leak' ? 0 : 1);
    advance(f.b, .2); assert.equal(f.skills.links.size, 0);
  }
});

test('target death during predelay spends the cast but never admits a stale link or an extra bonus', () => {
  const f = make({ skill: 2 }); pinOwner(f); const t = enemy(f);
  charge(f); f.u.skill.activate('manual'); f.b.kill(t);
  until(f, () => !f.u.skill.active); assert.equal(linkHits(f).length, 0);
  assert.equal(f.servants.all().length, 1); assert.equal(f.skills.flights.size, 0);
});

test('owner retreat and brief stun remove owned Sleep links without erasing unrelated Sleep', () => {
  for (const kind of ['retreat', 'stun']) {
    const f = make({ skill: 2 }); pinOwner(f); const t = enemy(f);
    charge(f); f.u.skill.activate('manual'); until(f, () => linkHits(f).length === 1);
    f.b.applyStatus(t, 'sleep', { key: 'fixture:other-sleep', duration: 20 });
    if (kind === 'retreat') f.b.retreat(f.u, { permanent: true });
    else f.b.applyStatus(f.u, 'stun', { duration: .01 });
    advance(f.b, 1); assert.equal(linkHits(f).length, 1); assert.equal(t.s.flags.sleep, true);
    assert.equal(t.findBuff('necras_s_2'), null); assert.equal(f.skills.links.size, 0);
  }
});

test('S2 source silence closes admitted links while ordinary skill eligibility remains unsilenceable', () => {
  const f = make({ skill: 2 }); pinOwner(f); const t = enemy(f); charge(f);
  f.u.skill.activate('manual'); until(f, () => linkHits(f).length === 1);
  f.b.applyStatus(f.u, 'silence', { duration: 20 }); advance(f.b, .1);
  assert.equal(f.skills.links.size, 0); assert.equal(t.s.flags.sleep, undefined);
  until(f, () => !f.u.skill.active); charge(f);
  assert.equal(f.u.skill.silenceBlocked, false); assert.ok(f.u.skill.activate('manual'));
});

test('battle end clears active casts, Sleep composites, flights and hooks', () => {
  const f = make({ skill: 2 }); pinOwner(f); const t = enemy(f); charge(f);
  f.u.skill.activate('manual'); until(f, () => linkHits(f).length === 1);
  f.b.forceEnd('timeout'); assert.equal(t.s.flags.sleep, undefined);
  assert.equal(f.skills.links.size, 0); assert.equal(f.skills.flights.size, 0);
  assert.equal(f.skills.handles.length, 0); assert.equal(f.u.skill.active, false);
});

test('S2 all four facings and flying recipients use the same fixed native release clock', () => {
  for (const [dir, row, col, face] of [
    ['RIGHT', 5, 6, 'Front'], ['UP', 6, 5, 'Back'], ['LEFT', 5, 4, 'Back'], ['DOWN', 4, 5, 'Front']]) {
    const f = make({ skill: 2, dir }); pinOwner(f); const t = enemy(f, { row, col, fly: true });
    charge(f); f.u.skill.activate('manual'); until(f, () => linkHits(f).length === 1);
    assert.equal(linkHits(f)[0].target, t); assert.equal(f.controller.clock.model(), e.models[ID][face]);
    near(f.skills.phase.releaseAt - f.skills.phase.startedAt, .6299999952316284);
    assert.equal(t.s.flags.sleep, true);
  }
});

test('S2 beam damage gets the low-HP talent once and invulnerability delays contact effects', () => {
  const f = make({ skill: 2, potential: 3 }); pinOwner(f); const t = enemy(f); t.hp *= .4;
  charge(f); f.u.skill.activate('manual');
  f.b.addBuff(t, { key: 'fixture:invul', flags: { invulnerable: true } });
  advance(f.b, 1); assert.equal(linkHits(f).length, 0); assert.equal(t.s.flags.sleep, undefined);
  f.b.removeBuff(t, 'fixture:invul'); until(f, () => linkHits(f).length === 1);
  near(linkHits(f)[0].hpLoss, f.u.s.atk * 1.6 * 1.45);
});

test('output Sleep permission also reaches an already-born ordinary projectile during S2', () => {
  const f = make({ skill: 2 }), a = enemy(f); const z = enemy(f, { col: 7 });
  until(f, () => f.b.projectiles.list.some(p => p.target === a));
  f.b.applyStatus(a, 'sleep', { key: 'fixture:sleep', duration: 20 }); charge(f);
  assert.ok(f.u.skill.activate('manual')); assert.equal(f.skills.phase.targets[0].t, z);
  until(f, () => ordinary(f).length === 1);
  assert.equal(ordinary(f)[0].target, a); assert.equal(ordinary(f)[0].dmg.ignoreSleep, true);
});

test('old-cast cleanup cannot overwrite a newer cast started by a removal callback', () => {
  const f = make({ skill: 2 }); pinOwner(f); const t = enemy(f); charge(f);
  f.u.skill.activate('manual'); until(f, () => linkHits(f).length === 1);
  const old = f.skills.phase, buff = f.skills.links.get(t).buff, previous = buff.onRemove;
  let accepted = false;
  buff.onRemove = ctx => { previous(ctx); charge(f); accepted = f.u.skill.activate('manual'); };
  f.u.skill.end('fixture:restart');
  assert.equal(accepted, true); assert.notEqual(f.skills.phase, old);
  assert.equal(f.skills.phase.stage, 'begin'); assert.equal(f.u.mem.regularFormVisual.clip, 'Skill_2_Begin');
  until(f, () => linkHits(f).length === 2);
});

test('owner removal during Sleep admission leaves no orphan composite or damage', () => {
  const f = make({ skill: 2 }); pinOwner(f); const t = enemy(f); charge(f);
  f.b.on('statusApplied', ({ source, status }) => {
    if (source === f.u && status === 'sleep') f.b.retreat(f.u, { permanent: true });
  });
  f.u.skill.activate('manual'); advance(f.b, 1);
  assert.equal(linkHits(f).length, 0); assert.equal(t.s.flags.sleep, undefined);
  assert.equal(t.findBuff('necras_s_2'), null); assert.equal(f.skills.links.size, 0);
});

test('overlapping S2 producers share a single owned composite and resume when the first producer ends', () => {
  const f = make({ skill: 2 }); pinOwner(f); const t = enemy(f);
  const def = normalizeChess(structuredClone(f.u.def.raw));
  const u = f.b._makeAlly(f.u.player, def, 'op', 5, 4, { dir: 'RIGHT' });
  const other = prepareNecrassActiveSkills(f.b, u, { contract: ACTIVE });
  f.b._setupUnit(u, other.kit); other.controller.install();
  u.player.dp = 99; assert.ok(f.b._deploy(u, { initial: false }));
  f.b.addBuff(u, { key: 'fixture:pin-second', flags: { disarm: true } });
  charge(f); u.skill.setSpTotal(u.skill.spCost);
  f.u.skill.activate('manual'); u.skill.activate('manual');
  until(f, () => linkHits(f).length === 2);
  assert.ok(linkHits(f).every(h => h.source === f.u));
  assert.equal(other.skills.links.get(t).buff, null);
  f.u.skill.end('fixture:first-ended');
  until(f, () => linkHits(f).some(h => h.source === u));
  assert.equal(t.findBuff('necras_s_2').source, u);
});

test('S1 queues non-derived attempts before withdrawal and stops processing an old cast after callbacks restart it', () => {
  const f = make(); pinOwner(f); const a = f.servants.create(5, 6), z = f.servants.create(5, 7);
  let restarted = false;
  f.b.on('death', ({ unit }) => {
    if (unit !== a) return;
    f.u.skill.end('fixture:restart'); charge(f); restarted = f.u.skill.activate('manual');
  });
  charge(f); f.u.skill.activate('manual'); advance(f.b, .55);
  assert.equal(restarted, true); assert.equal(a.alive, false); assert.equal(z.alive, true);
  assert.equal(f.servants.pending.length, 1);
  assert.ok(f.skills.phase.startedAt >= .5 - f.b.dt);
});
