// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import e from '../data/arkpedia-muelsyse-prefabs.json' with { type: 'json' };
import { StandardBattle } from '../server/sim/arkpedia.js';
import { normalizeChess } from '../server/sim/simdata.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { MUELSYSE_ID as ID, selectedMuelsyseBuild } from '../server/sim/content/arkpedia-muelsyse.js';
import { MUELSYSE_FORM_SKILL_CONTRACT as CONTRACT, prepareMuelsyseFormSkills } from '../server/sim/content/arkpedia-muelsyse-form-skills.js';

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
  const prepared = prepareMuelsyseFormSkills(b, u, { contract });
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

test('copied-form diagnostic requires its exact contract and makes no frame-parity claim', () => {
  assert.throws(() => make({ contract: { ...CONTRACT } }), /reviewed copied-form skill contract/);
  assert.equal(CONTRACT.frameParity, false);
});

test('all S2 ranks give melee-only regeneration/resistance and retain the selected shared ATK', () => {
  for (let rank = 1; rank <= 10; rank++) {
    const f = make({ skill: 2, rank }), t = point(f), s = copy(f, t);
    t.hp = t.s.maxHp / 2; const hp = t.hp; cast(f);
    assert.equal(s.mode, 2); near(t.hp, hp);
    near(t.s.atk, t.base.atk * (1 + f.record.bb.atk));
    near(t.s.hpRegen / t.s.maxHp, f.record.bb.hp_recovery_per_sec_by_max_hp_ratio);
    advance(f, 1); near(t.hp, hp + t.s.maxHp * f.record.bb.hp_recovery_per_sec_by_max_hp_ratio, .01);
    const a = enemy(f, { row: 10, col: 10, def: 0 });
    for (const type of ['phys', 'arts', 'true']) {
      t.hp = t.s.maxHp; f.b.dealDamage(a, t, { amount: 1000, type });
      const hit = f.hits.at(-1); assert.equal(hit.target, t);
      near(hit.hpLoss, type === 'true' ? 1000 : (type === 'phys' ? 1000 - t.s.def : 1000 * (1 - t.s.res / 100))
        * (1 - f.record.bb.damage_resistance));
    }
    f.u.skill.end('manual'); near(t.s.hpRegen / t.s.maxHp, 0); assert.equal(f.skills.forms.size, 0);
  }
});

test('S2 default and ranged forms do not gain melee regeneration or resistance', () => {
  for (const donor of [null, 'char_103_angel']) {
    const f = make({ skill: 2 }), t = point(f); if (donor) copy(f, t, donor);
    t.hp /= 2; const hp = t.hp; cast(f); advance(f, 1);
    near(t.hp, hp); near(t.s.hpRegen / t.s.maxHp, 0);
    assert.equal(t.buffs.some(b => b.status === 'sanctuary'), false);
    assert.equal(t.mem.muelsyseMode, donor ? 4 : 1);
  }
});

test('S2 repeats at the two native events and reselects after the first target dies', () => {
  const f = make({ skill: 2 }), t = point(f), s = copy(f, t, 'char_103_angel'); cast(f);
  const a = enemy(f, { col: 7, hp: 1, def: 0 }), z = enemy(f, { col: 7, def: 0 });
  const pick = f.b.rng.pick.bind(f.b.rng); f.b.rng.pick = rows => rows.includes(a) ? a : pick(rows);
  until(f, () => s.phase?.kind === 'muelsyse:s2-repeat'); const p = s.phase;
  near(p.events[1].at - p.events[0].at, .3333333432674408 - .30000001192092896);
  while (f.b.time + f.b.dt < p.events[0].at - 1e-9) advance(f, f.b.dt);
  assert.equal(f.hits.filter(h => h.source === t).length, 0);
  until(f, () => f.hits.filter(h => h.source === t).length === 2);
  const hits = f.hits.filter(h => h.source === t); assert.deepEqual(hits.map(h => h.target), [a, z]);
  assert.ok(hits.every(h => h.dmg.tags.includes('muelsyse:s2-shape') && h.dmg.isSkill && !h.dmg.isSplash));
  assert.equal(s.casts, 2); assert.equal(t.mem.regularFormVisual.clip, 'B_Attack_2');
});

test('S2 reselects random single ground/flying inputs without resetting the split counter per cycle', () => {
  const f = make({ skill: 2 }), t = point(f), s = copy(f, t, 'char_103_angel'); cast(f);
  enemy(f, { col: 7, def: 0, fly: true }); until(f, () => f.deck.tokens.size > 1, 10);
  assert.ok(f.hits.filter(h => h.source === t).length >= 10); assert.equal(s.casts, 0);
  const clone = [...f.deck.tokens.values()].find(v => v.clone);
  until(f, () => clone.mode === 4, 2);
  near(clone.unit.s.atk, t.base.atk * (1 + f.record.bb.atk));
  assert.equal(clone.unit.skill.active, false); assert.equal(f.deck.beginCopy(clone.unit), false);
});

test('S2 control interruption or parent finish cancels the second repeat event', () => {
  for (const operation of ['finish', 'stun', 'retreat', 'kill-owner']) {
    const f = make({ skill: 2 }), t = point(f), s = copy(f, t, 'char_103_angel'); cast(f);
    enemy(f, { col: 7, def: 0 }); until(f, () => s.phase?.kind === 'muelsyse:s2-repeat');
    // Invoke a source callback during the first accepted receipt, before the
    // following event even when both events fall in one simulator tick.
    f.b.on('damaged', ctx => {
      if (ctx.source !== t || !ctx.dmg.tags.includes('muelsyse:s2-shape')) return;
      if (operation === 'finish') f.u.skill.end('manual');
      if (operation === 'stun') f.b.applyStatus(t, 'stun', { duration: 1 });
      if (operation === 'retreat') f.deck.retreat(t);
      if (operation === 'kill-owner') f.b._remove(f.u, 'fixture', null, true);
    });
    until(f, () => f.hits.some(h => h.source === t)); advance(f, .3);
    assert.equal(f.hits.filter(h => h.source === t && h.dmg.tags.includes('muelsyse:s2-shape')).length, 1);
    assert.deepEqual(f.b.errors, []);
  }
});

test('S3 original ranged point refreshes the five-tile cross and clones do not recursively burst', () => {
  const f = make({ skill: 3 }), t = point(f, 5, 7), s = copy(f, t, 'char_103_angel'); t.hp /= 2; cast(f);
  assert.equal(f.deck.tokens.size, 5); near(t.hp, t.s.maxHp);
  const expected = new Set(['5,7', '5,6', '5,8', '4,7', '6,7']);
  for (const unit of f.deck.tokens.keys()) assert.ok(expected.has(`${unit.tileR},${unit.tileC}`));
  until(f, () => [...f.deck.tokens.values()].every(v => v.mode === 3), 3);
  advance(f, 1); assert.equal(f.deck.tokens.size, 5);
  for (const state of f.deck.tokens.values()) near(state.unit.s.atk, t.base.atk * (1 + f.record.bb.atk));
  assert.equal(f.skills.forms.size, 5); assert.equal(s.mode, 3);
});

test('S3 burst rejects occupied, reserved and nondeployable tiles', () => {
  const f = make({ skill: 3 }), t = point(f); copy(f, t, 'char_103_angel');
  f.b.reserveTile(f.u, 4, 6, 'fixture'); f.b.grid.tile(6, 6).build = 'NONE'; cast(f);
  assert.equal(f.deck.tokens.size, 2);
  assert.equal(f.b.unitAt(4, 6), null); assert.equal(f.b.unitAt(6, 6), null);
  assert.equal(f.b.unitAt(5, 5), f.u);
});

test('S3 ranged binding applies before damage and keeps its own duration after parent finish', () => {
  for (let rank = 1; rank <= 10; rank++) {
    const f = make({ skill: 3, rank }), t = point(f); copy(f, t, 'char_103_angel'); cast(f);
    const a = enemy(f, { col: 7, def: 0, fly: true }); let boundAtHit = false;
    f.b.on('damaged', ctx => { if (ctx.source === t) boundAtHit = !!a.s.flags.bind; });
    until(f, () => f.hits.some(h => h.source === t)); assert.equal(boundAtHit, true);
    f.u.skill.end('manual'); assert.equal(a.s.flags.bind, true);
    advance(f, f.record.bb['mlyss_s_3[unmoveable].duration'] + f.b.dt);
    assert.equal(a.s.flags.bind, undefined);
  }
});

test('S3 melee stun belongs to the current blocker and ends immediately on release/parent finish', () => {
  const f = make({ skill: 3 }), t = point(f), s = copy(f, t); const a = enemy(f, { def: 0 });
  advance(f, f.b.dt); assert.equal(a.blockedBy, t); cast(f);
  assert.equal(s.mode, 5); assert.equal(a.s.flags.stun, true); const p = f.skills.forms.get(s);
  assert.equal(p.stuns.size, 1); f.b.releaseBlocked(t); a.x = 9; a.y = 9;
  advance(f, f.b.dt); assert.equal(!!a.s.flags.stun, false); assert.equal(p.stuns.size, 0);
  const z = enemy(f, { def: 0 }); advance(f, 2 * f.b.dt); assert.equal(z.s.flags.stun, true);
  f.u.skill.end('manual'); assert.equal(!!z.s.flags.stun, false); assert.equal(s.mode, 2);
});

test('S3 pull waits two seconds and uses source force zero over a half-second movement clock', () => {
  const f = make({ skill: 3 }), t = point(f), s = copy(f, t); cast(f);
  const a = enemy(f, { row: 6, col: 7, def: 0, flags: { unblockable: true } }); a.base.massLevel = 0; a.markDirty(); const x = a.x, y = a.y;
  advance(f, 1.9); near(a.x, x); near(a.y, y);
  until(f, () => f.skills.forms.get(s).pulls.size === 1, .3);
  advance(f, .2); assert.ok(a.x < x && a.y < y); assert.ok(Math.hypot(a.x - t.x, a.y - t.y) > .5);
  advance(f, .3); near(Math.hypot(a.x - t.x, a.y - t.y), .5, .03);
  assert.equal(f.skills.forms.get(s).pulls.size, 0);
});

test('heavy, displaced-immune and own-blocked enemies do not get a weightless or duplicate pull', () => {
  const f = make({ skill: 3 }), t = point(f), s = copy(f, t); const blocked = enemy(f, { def: 0 });
  const heavy = enemy(f, { row: 6, col: 7 }), immune = enemy(f, { row: 4, col: 7, flags: { noDisplace: true } });
  heavy.base.massLevel = 5; heavy.markDirty(); advance(f, f.b.dt); cast(f); advance(f, 2.7);
  near(heavy.x, 7); near(heavy.y, 6); near(immune.x, 7); near(immune.y, 4);
  assert.equal(blocked.blockedBy, t); assert.equal(f.skills.forms.get(s).pulls.has(blocked), false);
});

test('late and recovering forms use active host effects while an ended host grants nothing', () => {
  for (const skill of [1, 2, 3]) {
    const f = make({ skill }); cast(f); const t = point(f);
    near(t.s.atk, t.base.atk * (1 + f.record.bb.atk));
    f.u.skill.end('manual'); advance(f, 1); near(t.s.atk, t.base.atk);
  }
  const f = make({ skill: 2 }), t = point(f), s = copy(f, t, 'char_103_angel');
  f.deck.retreat(t); advance(f, 15); cast(f);
  until(f, () => s.mode === 4, 15); assert.equal(f.u.skill.active, true);
  near(t.s.atk, t.base.atk * (1 + f.record.bb.atk));
  f.u.skill.end('manual'); assert.equal(s.mode, 3);
});

test('clone refresh resets its source expiry and parent finish clears every form attachment', () => {
  const f = make({ skill: 3 }), t = point(f); copy(f, t, 'char_103_angel'); cast(f);
  const clone = [...f.deck.tokens.values()].find(v => v.clone);
  advance(f, 2); const old = clone.expiresAt; f.skills.tokenRefreshed(clone);
  assert.ok(clone.expiresAt > old); f.u.skill.end('manual'); assert.equal(f.skills.forms.size, 0);
  for (const s of f.deck.tokens.values()) assert.equal(s.unit.buffs.some(v => v.key.startsWith('muelsyse:owner-skill:')), false);
});

test('removal during regeneration or block-stun attachment cannot orphan an effect', () => {
  for (const kind of ['regen', 'stun']) {
    const f = make({ skill: kind === 'regen' ? 2 : 3 }), t = point(f); copy(f, t);
    const a = enemy(f, { def: 0 }); advance(f, f.b.dt);
    f.b.on('beforeBuff', ctx => {
      if (ctx.buff.key.startsWith(kind === 'regen' ? 'muelsyse:s2:regen:' : 'muelsyse:s3:block:'))
        f.b._remove(f.u, 'fixture', null, true);
    });
    cast(f); assert.equal(f.skills.forms.size, 0); assert.equal(f.skills.parents.size, 0);
    assert.equal(a.buffs.some(v => v.key.startsWith('muelsyse:s3:block:')), false);
    assert.equal(t.buffs.some(v => v.key.startsWith('muelsyse:s2:')), false); assert.deepEqual(f.b.errors, []);
  }
});

test('source stun/bind immunities retain damage and unrelated status ownership', () => {
  const f = make({ skill: 3 }), t = point(f); copy(f, t, 'char_103_angel'); cast(f);
  const a = enemy(f, { col: 7, def: 0 }); a.def = { ...a.def, immune: new Set(['unmovable']) };
  until(f, () => f.hits.some(h => h.source === t)); assert.equal(!!a.s.flags.bind, false);
  const melee = make({ skill: 3 }), pointUnit = point(melee); copy(melee, pointUnit);
  const immune = enemy(melee, { def: 0 }); immune.def = { ...immune.def, immune: new Set(['stun']) };
  advance(melee, melee.b.dt); cast(melee); assert.equal(!!immune.s.flags.stun, false);
  immune.def.immune.clear(); advance(melee, melee.b.dt); assert.equal(immune.s.flags.stun, true);
  melee.b.applyStatus(immune, 'stun', { key: 'fixture:foreign-stun', duration: 10 });
  melee.u.skill.end('manual'); assert.equal(immune.s.flags.stun, true);
  assert.ok(immune.findBuff('fixture:foreign-stun'));
});

test('a transient sub-tick control invalidates both unreleased S2 events', () => {
  const f = make({ skill: 2 }), t = point(f), s = copy(f, t, 'char_103_angel'); cast(f);
  enemy(f, { col: 7, def: 0 }); until(f, () => s.phase?.kind === 'muelsyse:s2-repeat');
  f.b.addBuff(t, { key: 'fixture:transient', flags: { disarm: true } }); f.b.removeBuff(t, 'fixture:transient');
  advance(f, .4); assert.equal(f.hits.filter(h => h.source === t).length, 0);
  until(f, () => f.hits.filter(h => h.source === t).length === 2, 3);
});

test('all active S2/S3 form records retire on battle end, including ongoing pulls and clones', () => {
  for (const skill of [2, 3]) for (const donor of ['char_208_melan', 'char_103_angel']) {
    const f = make({ skill }), t = point(f); copy(f, t, donor); cast(f); enemy(f, { row: 6, col: 7 });
    advance(f, 2.1); f.b.finished = true; f.b.emit('battleEnd', {});
    assert.equal(f.skills.forms.size, 0); assert.equal(f.skills.parents.size, 0); assert.equal(f.deck.tokens.size, 0);
    assert.equal(f.u.skill.active, false);
    assert.equal(f.b.enemies.some(e => e.buffs.some(v => v.key.startsWith('muelsyse:s3:block:'))), false);
  }
});
