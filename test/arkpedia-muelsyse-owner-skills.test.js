// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import e from '../data/arkpedia-muelsyse-prefabs.json' with { type: 'json' };
import { StandardBattle } from '../server/sim/arkpedia.js';
import { normalizeChess } from '../server/sim/simdata.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { MUELSYSE_ID as ID, selectedMuelsyseBuild } from '../server/sim/content/arkpedia-muelsyse.js';
import { MUELSYSE_OWNER_SKILL_CONTRACT as CONTRACT, prepareMuelsyseOwnerSkills } from '../server/sim/content/arkpedia-muelsyse-owner-skills.js';

const TOKEN = 'token_10030_mlyss_wtrman';
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
  const prepared = prepareMuelsyseOwnerSkills(b, u, { contract });
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

function copy(f, t, id = 'char_208_melan', dir = 'RIGHT') {
  until(f, () => t.skill.ready, 110);
  assert.equal(f.deck.beginCopy(t), true);
  assert.equal(f.deck.copyFrom(t, id, dir), true);
  until(f, () => [2, 3].includes(t.mem.muelsyseMode));
  return f.deck.tokens.get(t);
}

function cast(f) {
  until(f, () => f.u.skill.ready, 60);
  assert.equal(f.u.skill.activate('manual'), true);
  return f.b.time;
}
const ownerHits = f => f.hits.filter(h => h.source === f.u && h.dmg.tags?.includes(`muelsyse:s${f.record.index + 1}`));

test('owner diagnostic requires its exact contract and retains its original limits', () => {
  assert.throws(() => make({ contract: { ...CONTRACT } }), /reviewed owner skill contract/);
  assert.equal(CONTRACT.frameParity, false);
  assert.match(CONTRACT.limits, /incomplete skill support/);
  assert.match(CONTRACT.limits, /late\/recovered/);
});

test('all thirty owner ranks use natural source SP, selected buffs and exact-duration DP clipping', () => {
  for (let skill = 1; skill <= 3; skill++) for (let rank = 1; rank <= 10; rank++) {
    const f = make({ skill, rank }), { u, record: r } = f, baseAtk = u.s.atk, baseInterval = u.s.interval;
    near(u.skill.sp, r.source.spData.initSp);
    assert.equal(u.skill.activate('manual'), false);
    const at = cast(f); assert.ok(at + f.b.dt >= r.source.spData.spCost - r.source.spData.initSp);
    near(u.s.atk, baseAtk * (1 + r.bb.atk));
    near(u.s.interval, baseInterval * 100 / (100 + (skill === 1 ? r.bb.attack_speed : 0)));
    assert.equal(u.skill.duration, 15); assert.equal(u.skill.charges, 0);
    f.u.player.dp = 0; f.skills.pulses = 0;
    // Immediate DP is tested separately; count only duration pulses here.
    advance(f, 15);
    assert.equal(u.skill.active, false);
    const expected = skill === 1 ? Math.floor((15 + 1e-9) / r.bb['mlyss_s_1[cost].interval']) : 0;
    near(f.b.dp, expected); assert.equal(f.skills.pulses, expected);
    near(u.s.atk, baseAtk); near(u.s.interval, baseInterval);
    assert.ok(u.skill.sp <= f.b.dt + 1e-6);
    advance(f, 1); near(f.b.dp, expected);
  }
});

test('S1 waits the original interval and does not substitute the display DP value', () => {
  for (const rank of [1, 4, 7, 10]) {
    const f = make({ rank }); cast(f); f.u.player.dp = 0;
    const interval = f.record.bb['mlyss_s_1[cost].interval'];
    advance(f, interval - 2 * f.b.dt); near(f.b.dp, 0);
    until(f, () => f.b.dp === 1, 2 * f.b.dt);
    assert.ok(f.skills.clock + 1e-9 >= interval);
    until(f, () => !f.u.skill.active, 16);
    near(f.b.dp, Math.floor((15 + 1e-9) / interval));
    if (rank !== 7) assert.ok(f.b.dp < f.record.bb.fake_cost);
  }
});

test('S2/S3 immediate DP depends on rank and neither requires a token nor a target', () => {
  for (const skill of [2, 3]) for (let rank = 1; rank <= 10; rank++) {
    const f = make({ skill, rank }); until(f, () => f.u.skill.ready, 60); f.u.player.dp = 0;
    assert.equal(f.u.skill.activate('manual'), true); near(f.b.dp, f.record.bb.cost);
    advance(f, 15); near(f.b.dp, f.record.bb.cost);
    assert.equal(f.deck.tokens.size, 0);
  }
});

test('original skill mode aliases retain one projectile target in all four facings', () => {
  for (const skill of [1, 2, 3]) for (const dir of ['RIGHT', 'UP', 'LEFT', 'DOWN']) {
    const f = make({ skill, dir }); cast(f);
    const delta = { RIGHT: [0, 1], UP: [1, 0], LEFT: [0, -1], DOWN: [-1, 0] }[dir];
    const target = enemy(f, { row: 5 + delta[0], col: 5 + delta[1], def: 0, fly: true });
    const second = enemy(f, { row: 5 + delta[0], col: 5 + delta[1], def: 0 });
    until(f, () => f.controller.phase?.kind === 'muelsyse:active', 2);
    const p = f.controller.phase, clip = ['Skill_1', 'Skill_2_Loop', 'Skill_3_loop'][skill - 1];
    assert.equal(f.u.mem.regularFormVisual.clip, clip);
    const event = f.controller.model().eventPayloads[clip].find(v => v.name === 'OnAttack').time;
    near(p.releaseAt - p.startedAt, event);
    while (f.b.time + f.b.dt < p.releaseAt - 1e-9) advance(f, f.b.dt);
    assert.equal(f.b.projectiles.list.length, 0);
    until(f, () => ownerHits(f).length === 1, 3);
    const h = ownerHits(f)[0]; assert.ok([target, second].includes(h.target));
    assert.equal(h.dmg.type, 'phys'); assert.equal(h.dmg.isSkill, true);
    near(h.dmg.amount, f.u.s.atk); assert.equal(ownerHits(f).length, 1);
    assert.ok(h.time + 1e-9 >= p.releaseAt + .1);
  }
});

test('native S2 event is earlier than ordinary/S1/S3 and capped ASPD cannot accelerate clip', () => {
  for (const skill of [1, 2, 3]) {
    const f = make({ skill }); cast(f);
    f.b.addBuff(f.u, { key: 'fixture:speed', mods: { aspd: 300 } }); enemy(f, { def: 0 });
    until(f, () => f.controller.phase?.kind === 'muelsyse:active'); const p = f.controller.phase;
    near(p.releaseAt - p.startedAt, skill === 2 ? .36666667461395264 : .4000000059604645);
    near(p.readyAt - p.startedAt, 1); near(f.u.mem.regularFormVisual.speed, 1);
    f.u.skill.end('manual'); advance(f, 1);
    assert.equal(ownerHits(f).length, 0);
  }
});

test('attack slow-down scales the original event and keeps one accepted receipt', () => {
  const f = make({ skill: 2 }); cast(f);
  f.b.addBuff(f.u, { key: 'fixture:slow', mods: { aspd: -50 } }); enemy(f, { def: 0 });
  until(f, () => f.controller.phase?.kind === 'muelsyse:active'); const p = f.controller.phase;
  near(f.u.mem.regularFormVisual.speed, .5); near(p.releaseAt - p.startedAt, 2 * .36666667461395264);
  until(f, () => ownerHits(f).length === 1); advance(f, .3); assert.equal(ownerHits(f).length, 1);
});

test('existing copied/default points share selected ATK/ASPD and cancel copying without charging another skill', () => {
  for (const skill of [1, 2, 3]) for (const donor of [null, 'char_208_melan', 'char_103_angel']) {
    const f = make({ skill }), t = point(f); if (donor) copy(f, t, donor);
    until(f, () => t.skill.ready, 110);
    assert.equal(f.deck.beginCopy(t), true); const base = t.s.atk, interval = t.s.interval;
    cast(f); assert.equal(t.skill.active, false); assert.equal(f.deck.copying, null);
    assert.equal(t.skill.charges, 0); assert.equal(f.skills.canCopy(f.deck.tokens.get(t)), false);
    near(t.s.atk, base * (1 + f.record.bb.atk));
    near(t.s.interval, interval * 100 / (100 + (skill === 1 ? f.record.bb.attack_speed : 0)));
    t.skill.setSpTotal(100); assert.equal(f.deck.beginCopy(t), false);
    advance(f, 15); near(t.s.atk, base); near(t.s.interval, interval);
    assert.equal(f.skills.parents.size, 0); assert.equal(f.deck.beginCopy(t), true);
  }
});

test('resting, warming, late and recovering points do not invent an owner relay attachment', () => {
  const f = make({ skill: 2 }); until(f, () => f.u.skill.ready, 60);
  const t = f.deck.place(5, 6); assert.equal(t.mem.muelsyseMode, 'warming');
  assert.equal(f.u.skill.activate('manual'), true); assert.equal(f.skills.parents.size, 0);
  until(f, () => t.mem.muelsyseMode === 1); near(t.s.atk, t.base.atk);
  f.u.skill.end('manual'); advance(f, 1); cast(f); assert.equal(f.skills.parents.size, 1);
  f.deck.retreat(t); assert.equal(f.skills.parents.size, 0); near(t.s.atk, t.base.atk);
  until(f, () => t.mem.muelsyseMode === 1, 30); near(t.s.atk, t.base.atk);
  const late = make({ skill: 3 }); cast(late); const p = point(late);
  near(p.s.atk, p.base.atk); assert.equal(late.skills.parents.size, 0);
});

test('shared token modifiers do not double-scale stolen final attributes', () => {
  const f = make(), t = point(f), s = copy(f, t); enemy(f, { col: 7, def: 0 });
  until(f, () => s.stolenAtk > 0, 5);
  // Remove the target to hold the acquired final addition stable.
  for (const target of f.b.enemies.slice()) f.b._remove(target, 'fixture', null, true);
  const stolen = s.stolenAtk; cast(f);
  near(t.s.atk, t.base.atk * (1 + f.record.bb.atk) + stolen);
  f.u.skill.end('manual'); near(t.s.atk, t.base.atk + stolen);
});

test('rest, clone retirement and owner retirement remove shared attributes and locks', () => {
  for (const operation of ['rest', 'point-remove', 'owner-remove', 'battle-end']) {
    const f = make({ skill: 3 }), t = point(f), s = copy(f, t, 'char_103_angel');
    f.deck.split(s); until(f, () => f.deck.tokens.size === 2 && [...f.deck.tokens.values()].every(v => v.mode === 3), 3);
    cast(f); assert.equal(f.skills.parents.size, 2);
    if (operation === 'rest') f.deck.retreat(t);
    if (operation === 'point-remove') f.b._remove(t, 'fixture', null, true);
    if (operation === 'owner-remove') f.b._remove(f.u, 'fixture', null, true);
    if (operation === 'battle-end') { f.b.finished = true; f.b.emit('battleEnd', {}); }
    assert.equal(f.skills.parents.has(s), false);
    assert.equal(t.findBuff('muelsyse:owner-skill:1'), null);
    if (operation.includes('owner') || operation === 'battle-end') {
      assert.equal(f.skills.parents.size, 0); assert.equal(f.u.skill.active, false); assert.equal(f.deck.tokens.size, 0);
    } else { advance(f, 15); assert.equal(f.skills.parents.size, 0); }
  }
});

test('modifier callbacks cannot leave an orphan attachment after point or owner removal', () => {
  for (const whom of ['owner', 'point']) {
    const f = make({ skill: 2 }), t = point(f);
    f.b.on('beforeBuff', ctx => {
      if (ctx.unit === t && ctx.buff.key.startsWith('muelsyse:owner-skill:'))
        f.b._remove(whom === 'owner' ? f.u : t, 'fixture', null, true);
    });
    cast(f); assert.equal(f.skills.parents.size, 0);
    assert.equal(t.findBuff('muelsyse:owner-skill:1'), null); assert.deepEqual(f.b.errors, []);
  }
});

test('stun/disarm prevents casting, silence permits it, and control changes cancel unreleased attacks', () => {
  for (const flag of ['stun', 'disarm', 'silence']) {
    const f = make({ skill: 2 }); until(f, () => f.u.skill.ready, 60);
    f.b.addBuff(f.u, { key: 'fixture:control', flags: { [flag]: true } });
    assert.equal(f.u.skill.activate('manual'), flag === 'silence');
    f.b.removeBuff(f.u, 'fixture:control'); if (flag !== 'silence') assert.equal(f.u.skill.activate('manual'), true);
    enemy(f, { def: 0 }); until(f, () => f.controller.phase?.kind === 'muelsyse:active');
    f.b.addBuff(f.u, { key: 'fixture:stop', flags: { disarm: true } }); advance(f, 1);
    assert.equal(ownerHits(f).length, 0);
    f.b.removeBuff(f.u, 'fixture:stop'); until(f, () => ownerHits(f).length === 1);
  }
});

test('DP stops on interruption and death without a synthetic final pulse', () => {
  for (const operation of ['manual', 'death', 'battle-end']) {
    const f = make(); cast(f); f.u.player.dp = 0; advance(f, 2.5); const dp = f.b.dp;
    if (operation === 'manual') f.u.skill.end('manual');
    if (operation === 'death') f.b._remove(f.u, 'fixture', null, true);
    if (operation === 'battle-end') { f.b.finished = true; f.b.emit('battleEnd', {}); }
    advance(f, 15); near(f.b.dp, dp); assert.equal(f.u.skill.active, false);
  }
});

test('born skill projectiles use current same-life impact stats and final buffed retirement snapshots', () => {
  for (const retired of [false, true]) {
    const f = make({ skill: 2 }); cast(f); const t = enemy(f, { col: 7, def: 0 });
    until(f, () => f.b.projectiles.list.length === 1); const buffed = f.u.s.atk;
    if (retired) f.b._remove(f.u, 'fixture', null, true);
    else f.u.skill.end('manual');
    until(f, () => ownerHits(f).length === 1);
    assert.equal(ownerHits(f)[0].target, t); near(ownerHits(f)[0].dmg.amount, retired ? buffed : f.u.s.atk);
  }
});

test('unsolicited and stale target-life receipts cannot bypass the source event', () => {
  const f = make({ skill: 3 }); cast(f); const t = enemy(f, { def: 0 });
  assert.equal(f.controller.release(t, {}), false);
  f.b.forceAttack(f.u, [t]); assert.equal(f.b.projectiles.list.length, 0);
  until(f, () => f.controller.phase?.kind === 'muelsyse:active'); t.deploySeq++;
  advance(f, .7); assert.equal(ownerHits(f).length, 0);
});

test('source holders permit casting during Born while ordinary attacks are still warming', () => {
  for (const skill of [1, 2, 3]) {
    const f = make({ skill }); assert.equal(f.controller.phase.kind, 'born');
    assert.equal(f.u.skill.activate('manual', { free: true }), true);
    enemy(f, { def: 0 }); until(f, () => ownerHits(f).length === 1, 3);
    assert.equal(f.u.skill.active, true);
  }
});

test('sleep, camouflage and stealth do not become new skill inputs', () => {
  const f = make({ skill: 3 }); cast(f);
  enemy(f, { flags: { stealth: true } }); enemy(f, { flags: { camou: true } });
  const sleeping = enemy(f); f.b.applyStatus(sleeping, 'sleep', { duration: 99 });
  advance(f, 3); assert.equal(ownerHits(f).length, 0);
});

test('all owner skill projectiles retain the own-point blocking trait predicate', () => {
  for (const skill of [1, 2, 3]) for (const own of [false, true]) {
    const f = make({ skill }), t = point(f); cast(f); const a = enemy(f, { def: 0 });
    until(f, () => f.b.projectiles.list.some(p => p.source === f.u));
    if (!own) t.ownerUnit = f.b.allyUnits.find(v => v !== f.u && v !== t);
    a.blockedBy = t;
    until(f, () => ownerHits(f).length === 1);
    near(ownerHits(f)[0].dmg.amount, f.u.s.atk * (own ? 1.5 : 1));
  }
});

test('cancelled/recovering shared attachments cannot leave a copy lock or owner-source modifier', () => {
  for (const operation of ['cancel', 'recover', 'skill-end']) {
    const f = make({ skill: 2 }), t = point(f), s = f.deck.tokens.get(t);
    until(f, () => f.u.skill.ready, 60); t.skill.setSpTotal(100);
    f.b.on('beforeBuff', ctx => {
      if (ctx.unit !== t || !ctx.buff.key.startsWith('muelsyse:owner-skill:')) return;
      if (operation === 'cancel') ctx.cancel = true;
      if (operation === 'recover') f.deck.retreat(t);
      if (operation === 'skill-end') f.u.skill.end('manual');
    });
    assert.equal(f.u.skill.activate('manual'), true);
    assert.equal(f.skills.parents.size, 0); assert.equal(f.skills.canCopy(s), true);
    assert.equal(t.findBuff('muelsyse:owner-skill:1'), null); near(t.s.atk, t.base.atk);
    assert.deepEqual(f.b.errors, []);
  }
});

test('fizzled target projectiles expire their source records without a second hit', () => {
  const f = make({ skill: 2 }); cast(f); const t = enemy(f, { col: 7, def: 0 });
  until(f, () => f.b.projectiles.list.length === 1);
  f.b._remove(t, 'fixture', null, true); advance(f, 11);
  assert.equal(ownerHits(f).length, 0); assert.equal(f.controller.flights.size, 0);
});
