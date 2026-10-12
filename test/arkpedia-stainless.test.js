// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import e from '../data/arkpedia-stainless-prefabs.json' with { type: 'json' };
import { StandardBattle } from '../server/sim/arkpedia.js';
import { normalizeChess } from '../server/sim/simdata.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { STAINLESS_ID as ID, STAINLESS_CORE_CONTRACT as CONTRACT, selectedStainlessBuild, prepareStainlessCore } from '../server/sim/content/arkpedia-stainless.js';

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
  const prepared = prepareStainlessCore(b, u, { contract });
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
const validBuild = { elite: 2, level: 90, potential: 1, trust: 0, skillRank: 10, skillId: 'skchr_ironmn_1' };

test('selected owner stats preserve trust cap, promotion and independent device keyframes', () => {
  for (let elite = 0; elite <= 2; elite++) {
    const f = make({ elite, skill: elite + 1 });
    assert.equal(f.record.index, elite);
    assert.equal(f.record.token.id, `token_10027_ironmn_pile${elite + 1}`);
    const tc = e.tables.tokens[f.record.token.id], max = tc.phases[elite].attributesKeyFrames.at(-1).data;
    near(f.record.token.stats.maxHp, max.maxHp); near(f.record.token.stats.atk, max.atk);
    near(f.record.token.stats.def, max.def);
    assert.equal(f.record.token.stats.maxDeployCount, [1, 2, 2][elite]);
    assert.equal(f.record.token.stats.maxDeckStackCnt, [2, 2, 3][elite]);
    assert.equal(f.record.recharge.cnt, [2, 3, 3][elite]);
    assert.equal(f.record.token.native.deploymentSlotCost, 0);
  }
  const f = make({ level: 37 });
  const frames = e.tables.tokens[f.record.token.id].phases[2].attributesKeyFrames;
  const t = (37 - frames[0].level) / (frames.at(-1).level - frames[0].level);
  near(f.record.token.stats.atk, Math.round(frames[0].data.atk + (frames.at(-1).data.atk - frames[0].data.atk) * t));
});

test('trust and additive potentials change only the selected owner', () => {
  const a = make(), z = make({ trust: 100, potential: 6 }), zz = make({ trust: 200, potential: 6 });
  const trust = e.tables.character.favorKeyFrames.at(-1).data;
  near(z.u.base.maxHp - a.u.base.maxHp, trust.maxHp);
  near(z.u.base.atk - a.u.base.atk, trust.atk + 25);
  near(z.u.base.def - a.u.base.def, trust.def);
  near(z.u.base.cost - a.u.base.cost, -2);
  near(z.u.base.respawnTime - a.u.base.respawnTime, -6);
  assert.deepEqual(z.record.stats, zz.record.stats);
  assert.deepEqual(a.record.token.stats, z.record.token.stats);
  assert.equal(a.record.recycle.prob, .7); assert.equal(z.record.recycle.prob, .8);
});

test('build validation rejects locked skills, mastery, modules and malformed selections', () => {
  for (const change of [{ elite: -1 }, { elite: 3 }, { level: 0 }, { level: 91 }, { potential: 0 }, { potential: 7 },
    { trust: -1 }, { trust: 201 }, { trust: 2.5 }, { skillRank: 0 }, { skillRank: 11 }, { skillId: 'unknown' },
    { elite: 0, level: 50, skillRank: 5 }, { elite: 1, level: 80, skillRank: 8 },
    { elite: 0, level: 50, skillRank: 4, skillId: 'skchr_ironmn_2' }, { module: 'CRA-X' }])
    assert.throws(() => selectedStainlessBuild({ ...validBuild, ...change }), /Stainless/);
});

test('core requires exact reviewed contract and complete selected-source metadata', () => {
  assert.throws(() => make({ contract: { ...CONTRACT } }), /reviewed core contract/);
  for (const mutate of [d => d.stats.atk++, d => d.skill.bb.atk = 999, d => d.skill.spCost++,
    d => d.skill.initSp++, d => d.skill.duration++, d => d.skill.spType = 'hurt',
    d => d.tags.push('fictional'), d => d.rangeGrid = [[0, 99]], d => d.talents[0].bb.cnt = 99])
    assert.throws(() => make({ mutate }), /Incomplete Stainless/);
  const f = make({ defer: true });
  assert.throws(() => prepareStainlessCore(f.b, f.u, { contract: CONTRACT }), /fresh original owner/);
});

test('all thirty skill/rank selections preserve natural SP and keep unfinished modes disabled', () => {
  for (let skill = 1; skill <= 3; skill++) for (let rank = 1; rank <= 10; rank++) {
    const f = make({ skill, rank }), s = f.record.source.spData;
    assert.equal(f.u.skill.sp, s.initSp);
    advance(f.b, Math.max(0, s.spCost - s.initSp) + 1);
    near(f.u.skill.sp, s.spCost);
    assert.equal(f.u.skill.activate('manual'), false);
    assert.equal(f.u.skill.active, false);
    assert.equal(f.record.token.skill.prefabId, `sktok_ironmn_pile${skill}`);
    assert.equal(f.b.regularSummons?.has(`summon:${ID}`) ?? false, false);
  }
});

test('ordinary source attack hits one ground enemy once with current ATK at native event', () => {
  const f = make(), a = enemy(f, { def: 50 }), z = enemy(f, { col: 5.8 });
  until(f, () => f.controller.phase?.kind === 'attack');
  const p = f.controller.phase, target = p.target;
  near(p.releaseAt - p.startedAt, e.models[ID].Front.eventPayloads.Attack[0].time);
  assert.equal(f.u.mem.regularFormVisual.speed, 1);
  const before = f.u.s.atk;
  f.b.addBuff(f.u, { key: 'fixture:atk', mods: { atkPct: .5 } });
  near(f.u.s.atk, before * 1.5);
  until(f, () => f.hits.length === 1);
  assert.equal(f.hits[0].target, target);
  near(f.hits[0].hpLoss, f.u.s.atk - target.s.def);
  assert.equal(f.hits[0].dmg.isSkill, false); assert.equal(f.hits[0].dmg.isSplash, false);
  assert.equal(f.hits[0].type, 'phys');
  assert.equal(f.hits.some(h => h.target === (target === a ? z : a)), false);
  assert.equal(f.controller.release(target, {}), false);
  advance(f.b, .1); assert.equal(f.hits.length, 1);
});

test('normal owner attack has no generic S1 ATK or S2 DEF/target modifiers', () => {
  for (let skill = 1; skill <= 3; skill++) {
    const f = make({ skill }), t = enemy(f);
    until(f, () => f.hits.length === 1);
    near(f.u.s.atk, f.u.base.atk); near(f.u.s.def, f.u.base.def);
    near(f.hits[0].hpLoss, f.u.base.atk);
    assert.equal(f.hits[0].target, t);
  }
});

test('native visual speed cap and slowed attack timing both remain explicit', () => {
  for (const [aspd, speed] of [[200, 1], [-50, .5]]) {
    const f = make(); enemy(f);
    f.b.addBuff(f.u, { key: 'fixture:speed', mods: { aspd } });
    until(f, () => f.controller.phase?.kind === 'attack');
    const p = f.controller.phase;
    near(f.u.mem.regularFormVisual.speed, speed);
    near(p.releaseAt - p.startedAt, .4333333373069763 / speed);
    until(f, () => f.hits.length === 1);
    assert.ok(f.hits[0].time + 1e-9 >= p.releaseAt);
  }
});

test('four facings use original owner artwork and independent rotated range', () => {
  for (const [dir, row, col, face] of [['RIGHT', 5, 6, 'Front'], ['UP', 6, 5, 'Back'],
    ['LEFT', 5, 4, 'Back'], ['DOWN', 4, 5, 'Front']]) {
    const f = make({ dir }), t = enemy(f, { row, col });
    until(f, () => f.hits.length === 1);
    assert.equal(f.hits[0].target, t); assert.equal(f.controller.model(), e.models[ID][face]);
    assert.equal(f.u.mem.regularVisualDirection, face === 'Front' ? 'RIGHT' : 'UP');
    assert.equal(f.u.mem.regularDeathVisual?.clip, face === 'Front' ? 'Die' : undefined);
  }
});

test('sleep, stealth, camouflage and flight are excluded from ordinary free targets', () => {
  const f = make();
  enemy(f, { fly: true });
  enemy(f, { flags: { stealth: true } });
  enemy(f, { flags: { camou: true } });
  const sleeping = enemy(f); f.b.applyStatus(sleeping, 'sleep', { duration: 99 });
  advance(f.b, 4); assert.equal(f.hits.length, 0);
});

test('stale target life is never redirected to a neighbouring enemy', () => {
  const f = make(), t = enemy(f); until(f, () => f.controller.phase?.kind === 'attack');
  const p = f.controller.phase; t.deploySeq++;
  enemy(f, { col: 5.8 });
  while (f.b.time < p.releaseAt + .1) advance(f.b, f.b.dt);
  assert.equal(f.hits.length, 0);
});

test('transient stun invalidates the pending owner attack even after it ends', () => {
  const f = make(); enemy(f); until(f, () => f.controller.phase?.kind === 'attack');
  const p = f.controller.phase;
  f.b.applyStatus(f.u, 'stun', { duration: .05 }); advance(f.b, .1);
  assert.notEqual(f.controller.phase, p);
  assert.equal(f.hits.length, 0);
  until(f, () => f.hits.length === 1);
});

test('disarm and disappearance cannot release a pending attack', () => {
  for (const flag of ['disarm', 'hidden']) {
    const f = make(); enemy(f); until(f, () => f.controller.phase?.kind === 'attack');
    const p = f.controller.phase;
    if (flag === 'hidden') f.u.hidden = true;
    else f.b.addBuff(f.u, { key: 'fixture:disarm', flags: { disarm: true } });
    while (f.b.time < p.releaseAt + .1) advance(f.b, f.b.dt);
    assert.equal(f.hits.length, 0);
    assert.equal(f.controller.stopped, false);
    f.u.hidden = false; f.b.removeBuff(f.u, 'fixture:disarm');
    until(f, () => f.hits.length === 1);
  }
});

test('unsolicited force attacks and wrong target identities cannot produce damage', () => {
  const f = make(), t = enemy(f);
  f.b.forceAttack(f.u, [t]); assert.equal(f.hits.length, 0);
  until(f, () => f.controller.phase?.kind === 'attack');
  const z = enemy(f, { col: 5.8 }); f.b.forceAttack(f.u, [z]);
  assert.equal(f.hits.length, 0);
  until(f, () => f.hits.length === 1); assert.equal(f.hits[0].target, t);
});

test('owner removal and battle end retire clocks and hooks without future hits', () => {
  for (const end of ['retreat', 'death', 'battleEnd']) {
    const f = make(); enemy(f); until(f, () => f.controller.phase?.kind === 'attack');
    if (end === 'retreat') f.b.retreat(f.u);
    else if (end === 'death') f.b.kill(f.u);
    else f.b.emit('battleEnd', {});
    assert.equal(f.controller.stopped, true); assert.equal(f.controller.phase, null);
    assert.deepEqual(f.controller.handles, []); assert.equal(f.u.mem.regularFormVisual, null);
    advance(f.b, 3); assert.equal(f.hits.length, 0);
  }
});
