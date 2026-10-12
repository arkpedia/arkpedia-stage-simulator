// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import e from '../data/arkpedia-mitm-prefabs.json' with { type: 'json' };
import { StandardBattle } from '../server/sim/arkpedia.js';
import { normalizeChess } from '../server/sim/simdata.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { MITM_ID as ID, selectedMitmBuild } from '../server/sim/content/arkpedia-mitm.js';
import { MITM_SKILL_CONTRACT as CONTRACT, prepareMitmSkills } from '../server/sim/content/arkpedia-mitm-skills.js';
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
function make({ skill = 1, rank = 10, elite = 2, dir = 'RIGHT', potential = 1, trust = 0,
  contract = CONTRACT, mutate } = {}) {
  const d = structuredClone(data); d.stage.geometry.waves[0].spawns = []; d.stage.battle.dp_per_second = 0;
  d.stage.geometry.rows = 19; d.stage.geometry.cols = 21;
  d.stage.geometry.tileGrid = Array.from({ length: 19 }, () => Array(21).fill(2));
  const b = new StandardBattle(d, { operators: [defaultBuild(d.operators.char_289_gyuki)] });
  b.autoFinish = false; b.recordEvents = true; b.setViewport('fullscreen-workspace');
  b.grid.tiles = b.grid.tiles.map(t => ({ ...t, height: 'LOW', build: 'ALL', pass: 'ALL' }));
  const build = { elite, level: e.tables.character.phases[elite].maxLevel, potential, trust,
    skillRank: Math.min(rank, [4, 7, 10][elite]), skillId: `skchr_mitm_${skill}` };
  const r = selectedMitmBuild(build), c = e.tables.character;
  const def = normalizeChess({ chessId: ID, charId: ID, name: c.name, profession: c.profession,
    position: c.position, subProfessionId: c.subProfessionId, stats: r.stats, rangeGrid: r.rangeGrid,
    tags: r.tags, talents: r.talents, skill: { ...r.source, ...r.source.spData, skillId: build.skillId,
      rangeGrid: r.source.rangeId ? e.tables.ranges[r.source.rangeId].grids.map(g => [g.row, g.col]) : [],
      trigger: { rule: 'NEVER' } }, arkpedia: build });
  mutate?.(def);
  const u = b._makeAlly(b.getPlayer('arkpedia'), def, 'op', 5, 5, { dir });
  const prepared = prepareMitmSkills(b, u, { contract });
  b._setupUnit(u, prepared.kit); prepared.controller.install();
  u.player.dp = 99; assert.ok(b._deploy(u, { initial: false }));
  const hits = [];
  b.on('damaged', ctx => { if (ctx.source === u) hits.push({ ...ctx, time: b.time }); });
  return { b, u, d, build, hits, ...prepared };
}
function enemy(f, { row = 5, col = 6, hp = 1e7, def = 0, fly = false, flags = {} } = {}) {
  const t = f.b.spawnEnemy('enemy_1007_slime', { pos: [row, col] });
  Object.assign(t.base, { maxHp: hp, atk: 0, def, res: 0, moveSpeed: 0 });
  t.markDirty(); void t.s; t.hp = hp; if (fly) t.motion = 'FLY';
  f.b.addBuff(t, { key: 'fixture:pin', flags: { noMove: true, disarm: true, unblockable: true, ...flags } });
  f.b._buildEnemyIndex(); return t;
}
const activate = f => assert.equal(f.u.skill.activate('manual', { free: true }), true);
const skillHits = (f, skill) => f.hits.filter(h => h.dmg.tags?.includes(`mitm:s${skill}`));
function point(f, row = 5, col = 6) {
  const t = f.deck.place(row, col); until(f, () => t.mem.mitmMode === 1); return t;
}
function defeat(f, t) {
  f.b.dealDamage(enemy(f, { row: 10, col: 10 }), t, { amount: t.hp + 1e5, type: 'true' });
}

test('selected skill contract rejects changed identity, SP, duration and blackboards', () => {
  assert.throws(() => make({ contract: { ...CONTRACT } }), /reviewed skill contract/);
  for (const mutate of [d => d.skill.spCost++, d => d.skill.duration++, d => d.skill.bb.cost = 999])
    assert.throws(() => make({ mutate }), /Incomplete Mitm/);
});

test('all twenty ranks retain natural SP, manual operation and selected owner modifiers', () => {
  for (let skill = 1; skill <= 2; skill++) for (let rank = 1; rank <= 10; rank++) {
    const f = make({ skill, rank }), source = f.record.source, base = f.u.s.atk;
    near(f.u.skill.sp, source.spData.initSp); assert.equal(f.u.skill.activate('manual'), false);
    advance(f, source.spData.spCost - source.spData.initSp + .1);
    near(f.u.skill.sp, source.spData.spCost); assert.equal(f.u.skill.activations, 0);
    f.u.player.dp = 10; assert.equal(f.u.skill.activate('manual'), true); near(f.u.skill.sp, 0);
    if (skill === 1) {
      near(f.b.dp, 16); near(f.u.s.atk, base); assert.equal(f.u.skill.active, false);
      advance(f, .5); near(f.u.skill.sp, 0);
      until(f, () => !f.skills.command); advance(f, .1); assert.ok(f.u.skill.sp > 0);
    } else {
      near(f.b.dp, 10); near(f.u.s.atk, base * (1 + f.record.bb.atk));
      advance(f, source.duration + .2); assert.equal(f.u.skill.active, false);
      near(f.b.dp, 22); near(f.u.s.atk, base); assert.equal(f.skills.pulses, 12);
    }
  }
});

test('all ten S1 ranks give immediate DP but wait for the original event to explode and withdraw', () => {
  for (let rank = 1; rank <= 10; rank++) {
    const f = make({ rank }), t = point(f), a = enemy(f, { def: 100 }); f.u.player.dp = 0;
    activate(f); near(f.b.dp, 6); assert.equal(t.mem.mitmMode, 1);
    assert.equal(f.u.mem.regularFormVisual.clip, 'Skill_1');
    near(f.skills.command.releaseAt - f.b.time, .36666667461395264);
    advance(f, .3); assert.equal(skillHits(f, 1).length, 0);
    f.b.addBuff(f.u, { key: 'fixture:atk', mods: { atkPct: .5 } });
    until(f, () => skillHits(f, 1).length > 0);
    const hit = skillHits(f, 1)[0]; assert.equal(hit.target, a);
    near(hit.hpLoss, f.u.s.atk * f.record.bb.aoe_damage_scale - a.s.def);
    assert.equal(hit.dmg.applyWay, 'none'); assert.equal(hit.dmg.isAttack, false);
    assert.equal(hit.dmg.isSkill, true); assert.equal(hit.dmg.isSplash, true);
    assert.equal(t.mem.mitmMode, 0); assert.equal(f.deck.tokens.size, 1);
    advance(f, .5); assert.equal(skillHits(f, 1).length, 1); near(f.b.dp, 6);
  }
});

test('S1 cross includes its centre, excludes diagonals and uses source ground/target filters', () => {
  const f = make(), t = point(f);
  const eligible = [[5, 6], [4, 6], [6, 6], [5, 7], [5, 5]].map(([row, col]) => enemy(f, { row, col }));
  enemy(f, { row: 4, col: 7 }); enemy(f, { fly: true });
  enemy(f, { flags: { stealth: true } }); enemy(f, { flags: { camou: true } });
  enemy(f, { flags: { untargetable: true } });
  const sleeping = enemy(f); f.b.applyStatus(sleeping, 'sleep', { duration: 99 });
  activate(f); until(f, () => t.mem.mitmMode === 0);
  assert.deepEqual(skillHits(f, 1).map(h => h.target), eligible);
});

test('S1 own-token blocking trait applies before withdrawal, without multiplying other targets', () => {
  const f = make(), t = point(f), a = enemy(f, { flags: { unblockable: false } }), z = enemy(f, { col: 7 });
  advance(f, .1); assert.equal(a.blockedBy, t);
  activate(f); until(f, () => t.mem.mitmMode === 0);
  const hits = skillHits(f, 1);
  near(hits.find(h => h.target === a).hpLoss, f.u.s.atk * f.record.bb.aoe_damage_scale * 1.5);
  near(hits.find(h => h.target === z).hpLoss, f.u.s.atk * f.record.bb.aoe_damage_scale);
  assert.equal(a.blockedBy, null);
});

test('S1 can grant DP without a buggy and cannot explode late, recovering or wreckage modes', () => {
  for (const mode of ['absent', 'late', 'recovering', 'warming']) {
    const f = make(); let t;
    if (mode === 'recovering') { t = point(f); defeat(f, t); }
    if (mode === 'warming') t = f.deck.place(5, 6);
    f.u.player.dp = 0; activate(f); near(f.b.dp, 6);
    if (mode === 'late') t = f.deck.place(5, 6);
    enemy(f); advance(f, 1.2); assert.equal(skillHits(f, 1).length, 0);
    if (mode === 'recovering') {
      assert.equal(t.mem.mitmMode, 0); assert.ok([...f.deck.tokens.values()].some(s => s.mode === 2));
    }
  }
});

test('S1 original Front/Back clips and event survive all four owner facings', () => {
  for (const [dir, row, col] of [['RIGHT', 5, 6], ['UP', 6, 5], ['LEFT', 5, 4], ['DOWN', 4, 5]]) {
    const f = make({ dir }), t = point(f, row, col), a = enemy(f, { row, col }); activate(f);
    near(f.skills.command.releaseAt - f.b.time, .36666667461395264);
    until(f, () => t.mem.mitmMode === 0); assert.equal(skillHits(f, 1)[0].target, a);
  }
});

test('S1 pending command cancels on transient control, disarm, hiding and removal without refunding DP', () => {
  for (const cause of ['stun', 'disarm', 'hidden', 'retreat']) {
    const f = make(), t = point(f); enemy(f); f.u.player.dp = 0; activate(f);
    if (cause === 'stun') { f.b.applyStatus(f.u, 'stun', { duration: .1 }); advance(f, .15); }
    if (cause === 'disarm') f.b.addBuff(f.u, { key: 'fixture:disarm', flags: { disarm: true } });
    if (cause === 'hidden') f.u.hidden = true;
    if (cause === 'retreat') f.b.retreat(f.u);
    advance(f, 1.2); assert.equal(skillHits(f, 1).length, 0); assert.equal(f.skills.command, null);
    near(f.b.dp, 6);
    assert.equal(f.u.findBuff('mitm:command-no-sp'), null);
    if (cause !== 'retreat') assert.equal(t.mem.mitmMode, 1);
  }
});

test('S1 retirement during an explosion receipt prevents later receipts and leaves no orphan tokens', () => {
  const f = make(), t = point(f); enemy(f); enemy(f, { col: 7 });
  f.b.on('damaged', ctx => { if (ctx.dmg.tags?.includes('mitm:s1')) f.b.retreat(f.u); });
  activate(f); advance(f, .6); assert.equal(skillHits(f, 1).length, 1);
  assert.equal(t.alive, false); assert.equal(f.deck.tokens.size, 0); assert.equal(f.skills.command, null);
});

test('an unfinished S1 command cannot grant a second free cast or duplicate its explosion', () => {
  const f = make(), t = point(f); enemy(f); f.u.player.dp = 0; activate(f);
  assert.equal(f.u.skill.activate('manual', { free: true }), false); near(f.b.dp, 6);
  until(f, () => t.mem.mitmMode === 0);
  assert.equal(f.u.skill.activate('manual', { free: true }), false);
  until(f, () => !f.skills.command); assert.equal(skillHits(f, 1).length, 1);
});

test('all ten S2 ranks replace normal block with two, increase DEF and never use the unused HP blackboard', () => {
  for (let rank = 1; rank <= 10; rank++) {
    const f = make({ skill: 2, rank }), t = point(f), baseDef = t.s.def;
    t.hp -= 500; const hp = t.hp; activate(f);
    assert.equal(t.mem.mitmMode, 3); assert.equal(t.s.blockCnt, 2);
    near(t.s.def, baseDef * (1 + f.record.bb['mitm_s_2[to_token].def'])); near(t.hp, hp);
    assert.equal(t.mem.regularFormVisual.clip, 'Skill_Begin');
    advance(f, .3); assert.equal(t.mem.regularFormVisual.clip, 'Skill_Loop');
    assert.equal(t.mem.regularFormVisual.loop, true);
    const enemies = [enemy(f, { flags: { unblockable: false } }), enemy(f, { flags: { unblockable: false } }),
      enemy(f, { flags: { unblockable: false } })];
    advance(f, .1); assert.equal(enemies.filter(e => e.blockedBy === t).length, 2);
    advance(f, 2); assert.equal(t.stats.attacks, 0); near(t.hp, hp);
    f.u.skill.end('cancel'); assert.equal(t.mem.mitmMode, 0);
    near(t.s.def, baseDef); assert.equal(t.s.blockCnt, 0); assert.equal(f.deck.tokens.size, 1);
  }
});

test('all S2 ranks attack one retained ground or flying input at the original loop event', () => {
  for (let rank = 1; rank <= 10; rank++) for (const fly of [false, true]) {
    const f = make({ skill: 2, rank }); advance(f, 1.1);
    const a = enemy(f, { col: 6.9, fly, def: 100 }), z = enemy(f, { col: 6.8, fly }); activate(f);
    assert.equal(f.u.mem.regularFormVisual.clip, 'Skill_2_Begin');
    until(f, () => f.controller.phase?.kind === 'mitm:active'); const p = f.controller.phase;
    near(p.releaseAt - p.startedAt, .4000000059604645);
    until(f, () => f.b.projectiles.list.length === 1);
    const proj = f.b.projectiles.list[0]; assert.equal(proj.speed, 10); assert.equal(proj.maxAge, 10);
    assert.equal(proj.data.projectileKey, 'projectile_chr_mitm_s2');
    f.b.addBuff(f.u, { key: 'fixture:atk', mods: { atkPct: .5 } });
    until(f, () => skillHits(f, 2).length === 1);
    const hit = skillHits(f, 2)[0]; near(hit.hpLoss, f.u.s.atk - hit.target.s.def);
    assert.equal(hit.target, p.target); assert.equal(hit.dmg.isSkill, true);
    assert.equal(hit.dmg.isSplash, false); assert.ok([a, z].includes(hit.target));
    assert.equal(skillHits(f, 2).some(h => h.target === (p.target === a ? z : a)), false);
  }
});

test('S2 preserves original facings and capped or slowed loop attack clocks', () => {
  for (const [dir, row, col] of [['RIGHT', 5, 6], ['UP', 6, 5], ['LEFT', 5, 4], ['DOWN', 4, 5]]) {
    for (const aspd of [200, -50]) {
      const f = make({ skill: 2, dir }); advance(f, 1.1); enemy(f, { row, col });
      f.b.addBuff(f.u, { key: 'fixture:speed', mods: { aspd } }); activate(f);
      until(f, () => f.controller.phase?.kind === 'mitm:active'); const p = f.controller.phase;
      const speed = aspd > 0 ? 1 : .5; near(f.u.mem.regularFormVisual.speed, speed);
      near(p.releaseAt - p.startedAt, .4000000059604645 / speed);
      assert.ok(p.readyAt - p.startedAt >= 1 / speed - 1e-9);
      until(f, () => skillHits(f, 2).length === 1);
    }
  }
});

test('S2 current actual token blocking applies the same owner trait at impact', () => {
  const f = make({ skill: 2 }), t = point(f), a = enemy(f, { flags: { unblockable: false } });
  activate(f); until(f, () => skillHits(f, 2).length === 1);
  assert.equal(a.blockedBy, t); near(skillHits(f, 2)[0].hpLoss, f.u.s.atk * 1.5);
});

test('S2 gives no upfront DP and exactly twelve interval pulses through normal expiry', () => {
  const f = make({ skill: 2 }); advance(f, 1.1); f.u.player.dp = 0; activate(f);
  assert.equal(f.b.dp, 0); advance(f, 1.2); assert.equal(f.b.dp, 0);
  advance(f, .1); assert.equal(f.b.dp, 1);
  until(f, () => !f.u.skill.active); assert.equal(f.b.dp, 12); assert.equal(f.skills.pulses, 12);
  advance(f, 5); assert.equal(f.b.dp, 12); assert.ok(f.u.skill.sp > 0);
});

test('S2 interruption stops DP immediately; controls inhibit attacks while timed DP continues', () => {
  const f = make({ skill: 2 }); advance(f, 1.1); f.u.player.dp = 0; activate(f);
  f.b.applyStatus(f.u, 'stun', { duration: 99 }); advance(f, 2.6); near(f.b.dp, 2);
  f.u.skill.end('cancel'); advance(f, 20); near(f.b.dp, 2);
  assert.equal(f.skills.parents.length, 0);
});

test('S2 finish withdraws a point that was already recovering at cast but became normal before expiry', () => {
  const f = make({ skill: 2 }), t = point(f); defeat(f, t); advance(f, 13);
  const wastes = [...f.deck.tokens.values()].filter(s => s.mode === 2).map(s => s.unit);
  activate(f); assert.equal(t.mem.mitmMode, 0); assert.equal(f.skills.parents.length, 4);
  until(f, () => t.mem.mitmMode === 1); assert.equal(t.s.blockCnt, 1);
  until(f, () => !f.u.skill.active); assert.equal(t.mem.mitmMode, 0);
  assert.ok(wastes.every(w => w.alive)); assert.equal(f.deck.tokens.size, 4);
});

test('a late point does not inherit S2, its token modifiers or finish withdrawal', () => {
  const f = make({ skill: 2 }); advance(f, 1.1); activate(f);
  const t = point(f); assert.equal(t.mem.mitmMode, 1); assert.equal(t.s.blockCnt, 1);
  near(t.s.def, f.record.token.stats.def); assert.equal(f.skills.parents.length, 0);
  until(f, () => !f.u.skill.active); assert.equal(t.mem.mitmMode, 1);
});

test('S2 fatal defeat keeps its own recovery deadline and does not let skill finish kill wreckage', () => {
  const f = make({ skill: 2 }), t = point(f); activate(f); advance(f, 1);
  defeat(f, t); const readyAt = f.deck.point.readyAt, generation = f.deck.point.generation;
  assert.equal(t.mem.mitmMode, 0); assert.equal(t.s.blockCnt, 0);
  const wastes = [...f.deck.tokens.values()].filter(s => s.mode === 2).map(s => s.unit);
  until(f, () => !f.u.skill.active);
  assert.equal(t.mem.mitmMode, 0); near(f.deck.point.readyAt, readyAt);
  assert.equal(f.deck.point.generation, generation); assert.ok(wastes.every(w => w.alive));
  near(t.s.def, f.record.token.stats.def);
  until(f, () => t.mem.mitmMode === 1); assert.equal(t.s.blockCnt, 1);
});

test('pending S2 attacks cannot redirect stale victims or survive controls and mode finish', () => {
  for (const cause of ['life', 'stun', 'end']) {
    const f = make({ skill: 2 }); advance(f, 1.1); enemy(f); activate(f);
    until(f, () => f.controller.phase?.kind === 'mitm:active'); const p = f.controller.phase;
    if (cause === 'life') p.target.deploySeq++;
    if (cause === 'stun') f.b.applyStatus(f.u, 'stun', { duration: 2 });
    if (cause === 'end') f.u.skill.end('cancel');
    advance(f, .6); assert.equal(skillHits(f, 2).length, 0);
  }
});

test('S2 mode change starts a fresh clock and transient or reentrant control invalidates its retained input', () => {
  const f = make({ skill: 2 }); advance(f, 1.1); const a = enemy(f);
  until(f, () => f.controller.phase?.kind === 'attack'); const old = f.controller.phase;
  assert.ok(f.u.atkCd > .5); activate(f);
  until(f, () => f.controller.phase?.kind === 'mitm:active');
  assert.ok(f.controller.phase.startedAt < old.readyAt); assert.equal(f.controller.phase.target, a);
  const p = f.controller.phase;
  f.b.applyStatus(f.u, 'stun', { duration: .05 }); advance(f, .1);
  assert.notEqual(f.controller.phase, p); advance(f, .4); assert.equal(skillHits(f, 2).length, 0);
  until(f, () => skillHits(f, 2).length === 1);
  const z = make({ skill: 2 }); advance(z, 1.1); enemy(z); activate(z);
  z.b.on('beforeAttack', ctx => { if (ctx.attacker === z.u) z.u.skill.end('cancel'); });
  advance(z, 1); assert.equal(skillHits(z, 2).length, 0);
});

test('released S2 projectiles outlive skill expiry and owner retirement but cannot hit replacement lives', () => {
  for (const cause of ['end', 'retreat', 'life']) {
    const f = make({ skill: 2 }); advance(f, 1.1); const a = enemy(f, { col: 7.9 }); activate(f);
    until(f, () => f.b.projectiles.list.length === 1);
    const flight = [...f.controller.flights][0]; assert.ok(flight);
    if (cause === 'end') f.u.skill.end('cancel');
    if (cause === 'retreat') f.b.retreat(f.u);
    if (cause === 'life') a.deploySeq++;
    const atk = cause === 'retreat' ? flight.atk : f.u.s.atk;
    if (cause === 'retreat') {
      assert.equal(flight.retired, true); f.u.deploySeq++; f.u.base.atk *= 10; f.u.markDirty();
    }
    f.b.addBuff(f.u, { key: 'fixture:stop', flags: { disarm: true } });
    advance(f, .6); const hits = skillHits(f, 2);
    if (cause === 'life') assert.equal(hits.length, 0);
    else { assert.equal(hits.length, 1); near(hits[0].hpLoss, atk); }
  }
});

test('native silence permission is retained; abnormal or hidden owners cannot cast even with free SP', () => {
  for (const skill of [1, 2]) {
    const f = make({ skill }); f.b.addBuff(f.u, { key: 'fixture:silence', flags: { silence: true } });
    activate(f);
    for (const flag of ['stun', 'disarm', 'hidden']) {
      const z = make({ skill });
      if (flag === 'stun') z.b.applyStatus(z.u, 'stun', { duration: 10 });
      if (flag === 'disarm') z.b.addBuff(z.u, { key: 'fixture:disarm', flags: { disarm: true } });
      if (flag === 'hidden') z.u.hidden = true;
      assert.equal(z.u.skill.activate('manual', { free: true }), false);
    }
  }
});

test('reentrant skill-start retirement and battle end clear commands, parents, DP and all generations', () => {
  for (const skill of [1, 2]) for (const reason of ['start-retreat', 'kill', 'end']) {
    const f = make({ skill }), t = point(f); f.u.player.dp = 0;
    if (reason === 'start-retreat') f.b.on('skillStart', () => f.b.retreat(f.u));
    activate(f);
    if (reason === 'kill') f.b.kill(f.u);
    if (reason === 'end') { f.b.finished = true; f.b.emit('battleEnd', {}); }
    const dp = f.b.dp; advance(f, 20);
    assert.equal(f.controller.stopped, true); assert.equal(f.skills.parents.length, 0);
    assert.equal(f.skills.command, null); assert.equal(f.deck.tokens.size, 0);
    assert.equal(t.alive, false); near(f.b.dp, dp); assert.deepEqual(f.b.errors, []);
  }
});
