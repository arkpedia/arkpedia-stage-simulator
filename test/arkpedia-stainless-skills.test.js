// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import e from '../data/arkpedia-stainless-prefabs.json' with { type: 'json' };
import { StandardBattle } from '../server/sim/arkpedia.js';
import { normalizeChess } from '../server/sim/simdata.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { STAINLESS_ID as ID, selectedStainlessBuild } from '../server/sim/content/arkpedia-stainless.js';

import { STAINLESS_SKILL_CONTRACT as CONTRACT, prepareStainlessSkills } from '../server/sim/content/arkpedia-stainless-skills.js';

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
function make({ skill = 1, elite = 2, rank = 10, level = e.tables.character.phases[elite].maxLevel,
  potential = 1, trust = 0, dir = 'RIGHT', defer = false, contract = CONTRACT, mutate } = {}) {
  const d = structuredClone(data); d.stage.geometry.waves[0].spawns = []; d.stage.battle.dp_per_second = 0;
  d.stage.geometry.rows = 19; d.stage.geometry.cols = 21;
  d.stage.geometry.tileGrid = Array.from({ length: 19 }, () => Array(21).fill(2));
  const b = new StandardBattle(d, { operators: [defaultBuild(d.operators.char_289_gyuki)] });
  b.autoFinish = false; b.recordEvents = true; b.setViewport('fullscreen-workspace');
  b.grid.tiles = b.grid.tiles.map(t => ({ ...t, height: 'LOW', build: 'ALL', pass: 'ALL' }));
  const build = { elite, level, potential, trust, skillRank: Math.min(rank, [4, 7, 10][elite]), skillId: `skchr_ironmn_${skill}` };
  const r = selectedStainlessBuild(build), c = e.tables.character;
  const def = normalizeChess({ chessId: ID, charId: ID, name: c.name, profession: c.profession, position: c.position,
    subProfessionId: c.subProfessionId, stats: r.stats, rangeGrid: r.rangeGrid, tags: r.tags, talents: r.talents,
    skill: { ...r.source, ...r.source.spData, skillId: build.skillId,
      rangeGrid: r.source.rangeId ? e.tables.ranges[r.source.rangeId].grids.map(g => [g.row, g.col]) : [],
      trigger: { rule: 'NEVER' } }, arkpedia: build });
  mutate?.(def);
  const u = b._makeAlly(b.getPlayer('arkpedia'), def, 'op', 5, 5, { dir });
  const prepared = prepareStainlessSkills(b, u, { contract });
  b._setupUnit(u, prepared.kit); prepared.controller.install();
  const hits = [], attacks = [];
  b.on('damaged', ctx => { if (ctx.source === u) hits.push({ ...ctx, time: b.time }); });
  b.on('attack', ctx => { if (ctx.attacker === u) attacks.push({ ...ctx, time: b.time }); });
  const deploy = () => { u.player.dp = 99; assert.ok(b._deploy(u, { initial: false })); };
  if (!defer) deploy();
  return { b, u, d, build, deploy, hits, attacks, ...prepared };
}
function enemy(f, { row = 5, col = 6, hp = 1e7, def = 0, fly = false, flags = {} } = {}) {
  const t = f.b.spawnEnemy('enemy_1007_slime', { pos: [row, col] });
  Object.assign(t.base, { maxHp: hp, atk: 0, def, res: 0, moveSpeed: 0 });
  t.markDirty(); void t.s; t.hp = hp; if (fly) t.motion = 'FLY';
  f.b.addBuff(t, { key: 'fixture:pin', flags: { noMove: true, disarm: true, unblockable: true, ...flags } });
  f.b._buildEnemyIndex(); return t;
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

const activate = f => assert.equal(f.u.skill.activate('manual', { free: true }), true);

test('skill bridge requires exact reviewed identity and selected metadata', () => {
  assert.throws(() => make({ contract: { ...CONTRACT } }), /reviewed skill contract/);
  for (const mutate of [d => d.skill.spCost++, d => d.skill.duration++, d => d.skill.bb.atk = 999])
    assert.throws(() => make({ mutate }), /Incomplete Stainless/);
});

test('all thirty ranks retain natural SP, source duration, manual operation and selected stat modifiers', () => {
  for (let skill = 1; skill <= 3; skill++) for (let rank = 1; rank <= 10; rank++) {
    const f = make({ skill, rank }), source = f.record.source, base = { ...f.u.s };
    assert.equal(f.u.skill.sp, source.spData.initSp);
    assert.equal(f.u.skill.activate('manual'), false);
    advance(f.b, source.spData.spCost - source.spData.initSp + .1);
    near(f.u.skill.sp, source.spData.spCost);
    assert.equal(f.u.skill.active, false); assert.equal(f.u.skill.activate('manual'), true);
    near(f.u.skill.timeLeft, source.duration); near(f.u.skill.sp, 0);
    near(f.u.s.atk, base.atk * (1 + (skill === 1 ? 0 : f.record.bb.atk)));
    near(f.u.s.def, base.def * (1 + (skill === 2 ? f.record.bb.def : 0)));
    near(f.u.s.interval, base.interval * 100 / (100 + (skill === 3 ? f.record.bb.attack_speed : 0)));
    advance(f.b, source.duration - .1); assert.equal(f.u.skill.active, true); near(f.u.skill.sp, 0);
    until(f, () => !f.u.skill.active, 1);
    near(f.u.s.atk, base.atk); near(f.u.s.def, base.def); near(f.u.s.interval, base.interval);
    const sp = f.u.skill.sp; advance(f.b, 1); near(f.u.skill.sp - sp, 1);
  }
});

test('S1 multiplies source attack damage at every rank without modifying owner ATK', () => {
  for (let rank = 1; rank <= 10; rank++) {
    const f = make({ rank }), t = enemy(f, { def: 50 }), atk = f.u.s.atk;
    activate(f); until(f, () => f.controller.phase?.kind === 'ironmn:active');
    f.b.addBuff(f.u, { key: 'fixture:changed-atk', mods: { atkPct: .5 } });
    until(f, () => f.hits.length > 0);
    near(f.hits[0].hpLoss, atk * 1.5 * f.record.bb['attack@atk_scale'] - 50);
    assert.equal(f.hits[0].target, t); assert.equal(f.hits[0].dmg.isSkill, true);
    assert.equal(f.hits[0].dmg.isSplash, false); assert.equal(f.hits[0].type, 'phys');
    assert.equal(f.controller.release(t, {}), false);
    f.b.forceAttack(f.u, [t]); assert.equal(f.hits.length, 1);
  }
});

test('S1/S2/S3 retain their own original hit event in every facing with capped and slowed animation', () => {
  for (const skill of [1, 2, 3]) for (const [dir, row, col, face] of [
    ['RIGHT', 5, 6, 'Front'], ['UP', 6, 5, 'Back'], ['LEFT', 5, 4, 'Back'], ['DOWN', 4, 5, 'Front'],
  ]) for (const aspd of [200, -70]) {
    const f = make({ skill, dir }), t = enemy(f, { row, col });
    f.b.addBuff(f.u, { key: 'fixture:animation-speed', mods: { aspd } }); activate(f);
    until(f, () => f.controller.phase?.kind === 'ironmn:active');
    const p = f.controller.phase, clip = `Skill_${skill}`, m = e.models[ID][face];
    const speed = Math.min(1, f.u.base.bat / f.u.s.interval);
    near(p.releaseAt - p.startedAt, m.eventPayloads[clip][0].time / speed);
    near(p.readyAt - p.startedAt, Math.max(f.u.s.interval, m.durations[clip] / speed));
    assert.equal(f.u.mem.regularFormVisual.clip, clip); near(f.u.mem.regularFormVisual.speed, speed);
    until(f, () => f.hits.length > 0); assert.equal(f.hits[0].target, t);
    assert.ok(f.hits[0].time + 1e-9 >= p.releaseAt); assert.ok(f.hits[0].time - p.releaseAt < f.b.dt + 1e-8);
  }
});

test('S2 caps free ground inputs by current block capacity, not the current blocked list', () => {
  const f = make({ skill: 2 }), targets = [enemy(f), enemy(f, { col: 5.8 }), enemy(f, { col: 5.6 })];
  const flying = enemy(f, { fly: true }); activate(f);
  assert.equal(f.u.blocking.length, 0); assert.equal(f.u.s.blockCnt, 2);
  until(f, () => f.hits.length > 0);
  assert.equal(f.hits.length, 2); assert.equal(new Set(f.hits.map(h => h.target)).size, 2);
  for (const h of f.hits) { assert.ok(targets.includes(h.target)); near(h.hpLoss, f.u.s.atk); }
  assert.equal(f.hits.some(h => h.target === flying), false);
  f.b.addBuff(f.u, { key: 'fixture:block-capacity', mods: { blockCnt: -2 } });
  advance(f.b, 2); assert.equal(f.hits.length, 2);
  f.b.removeBuff(f.u, 'fixture:block-capacity');
  f.b.addBuff(f.u, { key: 'fixture:more-blocks', mods: { blockCnt: 1 } });
  const count = f.hits.length; until(f, () => f.hits.length > count); assert.equal(f.hits.length - count, 3);
});

test('selected input policy excludes free flyers; S2 also excludes an existing self-blocked flyer', () => {
  for (const skill of [1, 2, 3]) {
    const f = make({ skill }), t = enemy(f, { fly: true });
    activate(f); advance(f.b, 2); assert.equal(f.hits.length, 0);
    // The normal battle never blocks these flyers. Check the existing native
    // self-block exception without claiming that they become blockable.
    t.blockedBy = f.u; f.u.blocking.push(t);
    assert.deepEqual(f.skills.targets(), skill === 2 ? [] : [t]);
  }
});

test('active modes exclude stealth, camouflage, sleep and untargetable free inputs', () => {
  for (const skill of [1, 2, 3]) {
    const f = make({ skill });
    enemy(f, { flags: { stealth: true } }); enemy(f, { flags: { camou: true } });
    enemy(f, { flags: { untargetable: true } }); const sleeping = enemy(f);
    f.b.applyStatus(sleeping, 'sleep', { duration: 99 }); activate(f);
    advance(f.b, 3); assert.equal(f.hits.length, 0);
  }
});

test('captured S2 inputs keep separate lives and never redirect stale or dead targets', () => {
  for (const remove of ['life', 'death']) {
    const f = make({ skill: 2 }); enemy(f); enemy(f, { col: 5.8 }); enemy(f, { col: 5.6 }); activate(f);
    until(f, () => f.controller.phase?.kind === 'ironmn:active');
    const p = f.controller.phase, [first, second] = p.inputs;
    if (remove === 'life') first.unit.deploySeq++; else f.b.kill(first.unit);
    while (f.b.time < p.releaseAt + .1) advance(f.b, f.b.dt);
    assert.equal(f.hits.length, 1); assert.equal(f.hits[0].target, second.unit);
    assert.equal(f.controller.release(second.unit, {}), false);
  }
});

test('S1 active platform scale follows every selected token skill rank and handles late devices', () => {
  for (let rank = 1; rank <= 10; rank++) {
    const f = make({ rank }), a = ally(f), t = f.deck.place(7, 7);
    near(a.s.atk, 112); activate(f);
    near(a.s.atk, 100 * (1 + f.deck.talent.atk * f.deck.skill.talent_scale));
    advance(f.b, f.record.token.stats.respawnTime);
    const late = f.deck.place(7, 9, 'LEFT');
    near(a.s.atk, 100 * (1 + 2 * f.deck.talent.atk * f.deck.skill.talent_scale));
    f.b.kill(t); near(a.s.atk, 100 * (1 + f.deck.talent.atk * f.deck.skill.talent_scale));
    f.u.skill.end('end'); assert.equal(late.alive, false); near(a.s.atk, 100);
  }
});

test('S1 activation gifts one bounded device and finish kills every current device, including hidden ones', () => {
  const f = make(), a = ally(f), first = f.deck.place(7, 7), dp = f.b.dp;
  assert.equal(f.deck.stock, 2); const cooldown = f.deck.readyAt; activate(f);
  assert.equal(f.deck.stock, 3); assert.equal(f.deck.readyAt, cooldown);
  advance(f.b, 10); const second = f.deck.place(7, 9, 'LEFT'); second.hidden = true;
  f.b.rng = () => 0; const stock = f.deck.stock;
  f.u.skill.end('end'); assert.equal(first.alive, false); assert.equal(second.alive, false);
  assert.equal(f.deck.devices.size, 0); assert.equal(f.deck.stock, stock);
  near(a.s.atk, 100); near(f.b.dp, dp - f.record.token.stats.cost);
});

test('S1 finish uses selected in-range recycling and never the manual retreat DP refund', () => {
  const f = make(), t = f.deck.place(5, 6); activate(f);
  f.deck.stock = 0; f.b.rng = () => 0; const dp = f.b.dp;
  f.u.skill.end('end'); assert.equal(t.alive, false); assert.equal(f.deck.stock, f.record.recycle.cnt);
  near(f.b.dp, dp); near(f.deck.readyAt, f.b.time + f.record.token.stats.respawnTime);
});

test('S2 activation replaces recipient clocks and doubles device self-drain using selected native values', () => {
  for (let rank = 1; rank <= 10; rank++) {
    const f = make({ skill: 2, rank }), a = ally(f, { spType: 'INCREASE_WHEN_ATTACK' }), t = f.deck.place(7, 7);
    advance(f.b, .8); const hp = t.hp; activate(f);
    const state = f.deck.devices.get(t), clock = state.recipients.get(a);
    near(clock.nextSp, f.b.time + f.deck.skill['s2.interval']); near(state.bleedAt, f.b.time + 1);
    advance(f.b, .9); near(t.hp, hp); near(a.skill.sp, 0);
    until(f, () => t.hp < hp); near(t.hp, hp - t.s.maxHp * f.deck.skill['s2.hp_ratio']);
    until(f, () => a.skill.sp > 0); near(a.skill.sp, 1); assert.equal(t.skill.sp, 0);
    f.u.skill.end('end'); const endHp = t.hp, sp = a.skill.sp;
    const reset = state.recipients.get(a); near(reset.nextSp, f.b.time + f.deck.talent['default.interval']);
    advance(f.b, .9); near(t.hp, endHp); near(a.skill.sp, sp);
    until(f, () => t.hp < endHp); near(t.hp, endHp - t.s.maxHp * f.deck.drain);
    until(f, () => a.skill.sp > sp); near(a.skill.sp, sp + 1);
  }
});

test('late S2 devices and recipients start their own active clocks and obey no-SP', () => {
  const f = make({ skill: 2 }); activate(f); const t = f.deck.place(7, 7);
  advance(f.b, .3); const a = ally(f, { spType: 'INCREASE_WHEN_ATTACK' }); advance(f.b, f.b.dt);
  const clock = f.deck.devices.get(t).recipients.get(a);
  assert.ok(clock.nextSp >= .3 + f.deck.skill['s2.interval']);
  f.b.addBuff(a, { key: 'fixture:no-sp', flags: { noSp: true } }); advance(f.b, 3); near(a.skill.sp, 0);
  f.b.removeBuff(a, 'fixture:no-sp'); until(f, () => a.skill.sp > 0); near(a.skill.sp, 1);
});

test('S2 device gift happens only on finish and remains bounded by the deck capacity', () => {
  const f = make({ skill: 2 }); f.deck.place(7, 7); const stock = f.deck.stock;
  const cooldown = f.deck.readyAt; activate(f); assert.equal(f.deck.stock, stock);
  f.u.skill.end('end'); assert.equal(f.deck.stock, stock + 1); assert.equal(f.deck.readyAt, cooldown);
  activate(f); f.u.skill.end('end'); assert.equal(f.deck.stock, f.record.token.stats.maxDeckStackCnt);
});

test('S3 buffs only its owner and retains ordinary turret stats, repair and charge inputs', () => {
  const f = make({ skill: 3 }), t = f.deck.place(5, 6), baseAtk = t.s.atk, baseInterval = t.s.interval;
  const real = enemy(f, { col: 7 }), hp = t.hp;
  f.deck.stock = 0; const cooldown = f.deck.readyAt; activate(f);
  assert.equal(f.deck.stock, 1); assert.equal(f.deck.readyAt, cooldown);
  near(t.s.atk, baseAtk); near(t.s.interval, baseInterval);
  until(f, () => f.deck.devices.get(t)?.phase != null, 10);
  assert.ok(t.hp >= hp - t.s.maxHp * f.deck.skill.hp_ratio);
  until(f, () => real.hp < real.s.maxHp, 2);
  near(real.s.maxHp - real.hp, baseAtk * f.deck.skill.atk_scale);
  assert.equal(f.hits.length, 0); // accepted owner-to-device inputs cancel HP damage
  f.u.skill.end('end'); assert.equal(t.alive, true);
  near(t.s.atk, baseAtk); near(t.s.interval, baseInterval); near(f.u.s.atk, f.u.base.atk);
});

test('target-independent skill permission ignores silence; local Born switch clears its pending phase', () => {
  for (const skill of [1, 2, 3]) {
    const f = make({ skill }); assert.equal(f.controller.phase.kind, 'born');
    f.b.applyStatus(f.u, 'silence', { duration: 99 }); activate(f);
    assert.equal(f.controller.phase, null); advance(f.b, .2); assert.equal(f.u.skill.active, true);
    assert.equal(f.hits.length, 0);
  }
});

test('stun and disarm reject activation and invalidate pending skill attacks without delayed ghosts', () => {
  for (const flag of ['stun', 'disarm']) for (const skill of [1, 2, 3]) {
    const f = make({ skill }); enemy(f);
    f.b.addBuff(f.u, { key: 'fixture:control', flags: { [flag]: true } });
    assert.equal(f.u.skill.activate('manual', { free: true }), false);
    f.b.removeBuff(f.u, 'fixture:control'); activate(f);
    until(f, () => f.controller.phase?.kind === 'ironmn:active'); const p = f.controller.phase;
    f.b.addBuff(f.u, { key: 'fixture:control', flags: { [flag]: true } });
    f.b.removeBuff(f.u, 'fixture:control');
    while (f.b.time < p.releaseAt + .1) advance(f.b, f.b.dt);
    assert.equal(f.hits.length, 0);
    until(f, () => f.hits.length > 0); assert.ok(f.hits[0].time > p.releaseAt);
  }
});

test('mode start and end clear only retained owner work and never release the previous mode attack', () => {
  for (const skill of [1, 2, 3]) {
    const f = make({ skill }); enemy(f);
    until(f, () => f.controller.phase?.kind === 'attack'); const ordinary = f.controller.phase;
    activate(f); assert.equal(f.controller.phase, null);
    while (f.b.time < ordinary.releaseAt + .1) advance(f.b, f.b.dt);
    assert.equal(f.hits.length, 0);
    until(f, () => f.controller.phase?.kind === 'ironmn:active'); const active = f.controller.phase;
    f.u.skill.end('end'); assert.equal(f.controller.phase, null);
    while (f.b.time < active.releaseAt + .1) advance(f.b, f.b.dt);
    assert.equal(f.hits.length, 0);
    until(f, () => f.hits.length > 0); assert.equal(f.hits[0].dmg.isSkill, false);
  }
});

test('owner hiding cancels pending skill work and hidden owner cannot activate', () => {
  const f = make({ skill: 2 }); enemy(f); activate(f);
  until(f, () => f.controller.phase?.kind === 'ironmn:active'); const p = f.controller.phase;
  f.u.hidden = true; while (f.b.time < p.releaseAt + .1) advance(f.b, f.b.dt);
  assert.equal(f.hits.length, 0); f.u.skill.end('end');
  assert.equal(f.u.skill.activate('manual', { free: true }), false);
  f.u.hidden = false; activate(f); until(f, () => f.hits.length > 0);
});

test('S2 hit callbacks ending the skill or killing the owner cannot release the other captured input', () => {
  for (const reason of ['skill-end', 'owner-death']) {
    const f = make({ skill: 2 }); enemy(f); enemy(f, { col: 5.8 }); activate(f);
    f.b.on('damaged', ({ source }) => {
      if (source !== f.u) return;
      if (reason === 'skill-end') f.u.skill.end('end'); else f.b.kill(f.u);
    });
    until(f, () => f.hits.length > 0); assert.equal(f.hits.length, 1);
    assert.equal(f.controller.phase, null); assert.equal(f.u.skill.active, false);
  }
});

test('natural S1 expiry destroys devices; natural S2 expiry gifts one; S3 leaves its turret deployed', () => {
  for (const skill of [1, 2, 3]) {
    const f = make({ skill }), t = f.deck.place(7, 7); activate(f);
    const stock = f.deck.stock; advance(f.b, f.record.source.duration + .1);
    assert.equal(f.u.skill.active, false); assert.equal(t.alive, skill !== 1);
    assert.equal(f.deck.stock, skill === 2 ? stock + 1 : stock);
  }
});

test('removal during platform mode replacement cannot resurrect device stock or aura attachments', () => {
  for (const skill of [1, 2]) {
    const f = make({ skill }), a = ally(f), t = f.deck.place(7, 7);
    if (skill === 2) {
      // SP support has recipient clocks rather than a stat buff. Its owner
      // can be removed while a source ability is being detached as well.
      const original = f.deck.syncAura.bind(f.deck);
      f.deck.syncAura = state => { f.b.kill(f.u); original(state); };
    } else a.findBuff(`ironmn:device-aura:${t.id}`).onRemove = () => f.b.kill(f.u);
    activate(f); assert.equal(f.controller.stopped, true); assert.equal(t.deployed, false);
    assert.equal(f.deck.stock, 0); assert.equal(f.deck.devices.size, 0); near(a.s.atk, 100);
    advance(f.b, 1); assert.equal(f.deck.stock, 0); assert.deepEqual(f.b.errors, []);
  }
});

test('death, withdrawal and battle end remove active devices and attachments without finish gifts or recycling', () => {
  for (const reason of ['death', 'withdrawal', 'battle-end']) for (const skill of [1, 2, 3]) {
    const f = make({ skill }), a = ally(f), t = f.deck.place(7, 7); activate(f);
    f.deck.stock = 0; let rolls = 0; f.b.rng = () => { rolls++; return 0; };
    if (reason === 'death') f.b.kill(f.u);
    else if (reason === 'withdrawal') f.b._remove(f.u, 'retreat', null, true);
    else f.b._finish('cleared');
    advance(f.b, 3); assert.equal(f.controller.stopped, true); assert.equal(f.controller.phase, null);
    assert.equal(f.deck.stock, 0); assert.equal(f.deck.devices.size, 0); assert.equal(t.deployed, false);
    assert.equal(f.deck.handles.length, 0); assert.equal(f.controller.handles.length, 0); assert.equal(rolls, 0);
    assert.equal(f.b.regularSummons.has(`summon:${ID}`), false); near(a.s.atk, 100);
  }
});
