// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import e from '../data/arkpedia-tragodia-prefabs.json' with { type: 'json' };
import { StandardBattle } from '../server/sim/arkpedia.js';
import { normalizeChess } from '../server/sim/simdata.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { TRAGODIA_OWNER_SKILLS_CONTRACT as CONTRACT, prepareTragodiaOwnerSkills as prepareTragodiaCore } from '../server/sim/content/arkpedia-tragodia-owner-skills.js';

import { TRAGODIA_ID as ID, selectedTragodiaBuild } from '../server/sim/content/arkpedia-tragodia-source.js';

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
  const build = { elite, level, potential, trust, skillRank: Math.min(rank, [4, 7, 10][elite]), skillId: `skchr_phatm2_${skill}` };
  const r = selectedTragodiaBuild(build), c = e.tables.character;
  const def = normalizeChess({ chessId: ID, charId: ID, name: c.name, profession: c.profession, position: c.position,
    subProfessionId: c.subProfessionId, stats: r.stats, rangeGrid: r.rangeGrid, tags: r.tags, talents: r.talents,
    skill: { ...r.source, ...r.source.spData, skillId: build.skillId,
      rangeGrid: r.source.rangeId ? e.tables.ranges[r.source.rangeId].grids.map(g => [g.row, g.col]) : [],
      trigger: { rule: 'NEVER' } }, arkpedia: build });
  mutate?.(def);
  const u = b._makeAlly(b.getPlayer('arkpedia'), def, 'op', 5, 5, { dir });
  const prepared = prepareTragodiaCore(b, u, { contract });
  b._setupUnit(u, prepared.kit); prepared.controller.install();
  const hits = [], attacks = [];
  b.on('damaged', ctx => { if (ctx.source === u) hits.push({ ...ctx, time: b.time }); });
  b.on('attack', ctx => { if (ctx.attacker === u) attacks.push({ ...ctx, time: b.time }); });
  const deploy = () => { u.player.dp = 99; assert.ok(b._deploy(u, { initial: false })); };
  if (!defer) deploy();
  return { b, u, d, build, deploy, hits, attacks, ...prepared };
}
function enemy(f, { row = 5, col = 6, hp = 1e7, def = 0, res = 0, fly = false, flags = {} } = {}) {
  const t = f.b.spawnEnemy('enemy_1007_slime', { pos: [row, col] });
  Object.assign(t.base, { maxHp: hp, atk: 0, def, res, moveSpeed: 0 });
  t.markDirty(); void t.s; t.hp = hp; if (fly) t.motion = 'FLY';
  f.b.addBuff(t, { key: 'fixture:pin', flags: { noMove: true, disarm: true, unblockable: true, ...flags } });
  f.b._buildEnemyIndex(); return t;
}
const arts = f => f.hits.filter(h => h.type === 'arts');
const injury = (f, tag) => f.hits.filter(h => h.type === 'element' && (!tag || h.dmg.tags.includes(`tragodia:${tag}`)));
const disarmOwner = f => f.b.addBuff(f.u, { key: 'fixture:owner-pin', flags: { disarm: true } });
function attackContext(f, t, change = {}) {
  f.b.removeBuff(t, 'fixture:pin');
  f.b.addBuff(t, { key: 'fixture:pin', flags: { noMove: true, unblockable: true } });
  return { attacker: t, targets: [f.u], isSkill: false, profile: {}, ...change };
}

const refill = f => f.u.skill.setSpTotal(f.u.skill.spCost);
const cast = f => { refill(f); assert.ok(f.u.skill.activate('manual')); };
const skillArts = (f, n = f.skills.index) => arts(f).filter(h => h.dmg.tags.includes(`tragodia:s${n}`));

test('owner skills require their own contract and remain absent from public selection', () => {
  assert.throws(() => make({ contract: { ...CONTRACT } }), /owner skills contract/);
  assert.equal(data.operators[ID], undefined);
  const f = make(); assert.equal(f.u.skill.activate(), false);
  assert.equal(f.b.regularSummons?.has(`summon:${ID}`) ?? false, false);
});
for (let skill = 1; skill <= 3; skill++) for (let rank = 1; rank <= 10; rank++) {
  test(`S${skill} rank ${rank} uses selected owner skill values and clocks`, () => {
    const f = make({ skill, rank }), bb = f.record.bb, originalAtk = f.u.s.atk, originalSp = f.u.skill.sp;
    const t = enemy(f);
    if (skill === 1) {
      refill(f); until(f, () => skillArts(f).length === 2);
      const hits = skillArts(f);
      near(hits[0].hpLoss, originalAtk * bb.atk_scale);
      near(hits[1].hpLoss, originalAtk * bb.atk_scale);
      near(hits[1].time - hits[0].time, .4, f.b.dt + 1e-6);
      assert.equal(hits[0].dmg.attackId, hits[1].dmg.attackId);
      assert.equal(f.attacks.length, 1); assert.equal(f.u.skill.activations, 1);
      assert.equal(f.u.skill.sp, 0); assert.equal(f.u.skill.active, false);
      near(t.elem.neural, originalAtk * .3 * bb.ep_damage_scale * 2);
      assert.ok(t.s.flags.bind); near(t.findBuff(`tragodia:${f.u.id}:s1-bind`).timeLeft, bb.unmove - .4, f.b.dt + 1e-6);
    } else {
      cast(f); assert.equal(f.u.skill.activations, 1);
      if (skill === 2) {
        near(f.u.s.atk, originalAtk); near(f.u.s.aspd - 100, bb.attack_speed);
        assert.equal(f.u.skill.timeLeft, Infinity);
        assert.equal(f.controller.phase.kind, 'born');
      } else {
        near(f.u.s.atk, originalAtk * (1 + bb.atk));
        assert.deepEqual(f.u.skill.targetingOverride().rangeGrid, f.record.skillRangeGrid);
      }
      until(f, () => skillArts(f).length === 1);
      near(skillArts(f)[0].hpLoss, f.u.s.atk);
      assert.equal(f.u.skill.sp, 0);
      assert.equal(f.u.skill.gainSp(100, 'external'), 0);
      assert.ok(originalSp >= 0);
      f.u.skill.end(); near(f.u.s.atk, originalAtk);
      assert.equal(f.skills.mode, 0); assert.equal(f.skills.dots.size, 0);
    }
  });
}

test('S1 naturally charges from ordinary attacks and does not add SP for either skill hit', () => {
  const f = make({ skill: 1, rank: 1 }); enemy(f);
  until(f, () => skillArts(f).length === 2, 20);
  assert.equal(arts(f).filter(h => h.dmg.tags.includes('tragodia:ordinary')).length, f.record.source.spData.spCost);
  assert.equal(f.u.skill.sp, 0); assert.equal(f.u.skill.activations, 1);
  const at = f.b.time; until(f, () => arts(f).at(-1).dmg.tags.includes('tragodia:ordinary'));
  assert.ok(f.b.time > at); assert.equal(f.u.skill.sp, 1);
});

test('S1 prioritizes non-burst input and retains it for both hits', () => {
  const f = make(), burst = enemy(f), other = enemy(f, { col: 6.1 });
  f.b.addBuff(burst, { key: 'fixture:burst', flags: { burstLock: true } });
  until(f, () => skillArts(f).length === 2);
  assert.deepEqual(skillArts(f).map(h => h.target), [other, other]);
});

test('S1 Bind is non-damage-missable and amplifies only Nervous from any source', () => {
  const f = make(), t = enemy(f);
  f.b.addBuff(t, { key: 'fixture:dodge', mods: { dodgeArts: 1 } });
  until(f, () => f.u.skill.activations === 1 && !f.u.skill.active);
  assert.equal(skillArts(f).length, 0); assert.ok(t.s.flags.bind); near(t.elem.neural, 0);
  f.b.dealDamage(null, t, { type: 'element', element: 'neural', amount: 10, canDodge: false });
  near(t.elem.neural, 18);
  f.b.dealDamage(null, t, { type: 'element', element: 'burn', amount: 10, canDodge: false });
  near(t.elem.burn, 10);
});

test('S1 accepted Bind lifetime follows resistance and preserves unrelated Bind after caster retirement', () => {
  const f = make(), t = enemy(f); f.b.applyStatus(t, 'resist', { duration: 20 });
  until(f, () => skillArts(f).length === 2);
  const buff = t.findBuff(`tragodia:${f.u.id}:s1-bind`); near(buff.duration, 1.5);
  f.b.applyStatus(t, 'bind', { key: 'fixture:foreign-bind', duration: 20 });
  f.controller.stop(); const before = t.elem.neural;
  f.b.dealDamage(null, t, { type: 'element', element: 'neural', amount: 10 }); near(t.elem.neural - before, 18);
  advance(f.b, 1.6); assert.ok(t.s.flags.bind); assert.equal(t.findBuff(buff.key), null);
  const after = t.elem.neural;
  f.b.dealDamage(null, t, { type: 'element', element: 'neural', amount: 10 }); near(t.elem.neural - after, 10);
});

test('S1 status rejection adds no Nervous amplification and does not erase foreign Bind', () => {
  const f = make(), t = enemy(f);
  f.b.applyStatus(t, 'bind', { key: 'fixture:foreign-bind', duration: 20 });
  f.b.on('beforeStatus', c => { if (c.source === f.u && c.status === 'bind') c.cancel = true; });
  until(f, () => skillArts(f).length === 2);
  near(t.elem.neural, f.u.s.atk * .3 * 2);
  assert.ok(t.findBuff('fixture:foreign-bind'));
});

test('S1 source interruption cancels the remaining hit and unlocks SP', () => {
  const f = make(), t = enemy(f);
  until(f, () => skillArts(f).length === 1);
  f.b.applyStatus(f.u, 'stun', { duration: .5 });
  advance(f.b, .5);
  assert.equal(skillArts(f).length, 1); assert.equal(f.u.skill.active, false);
  assert.equal(f.u.s.flags.noSp, undefined); assert.ok(f.u.skill.gainSp(1, 'external') > 0);
  assert.ok(t.s.flags.bind);
});

test('S1 target death after first hit cancels the second without retargeting', () => {
  const f = make(), t = enemy(f), z = enemy(f, { col: 6.1 });
  until(f, () => skillArts(f).length === 1); f.b.kill(t);
  advance(f.b, .5); assert.equal(skillArts(f).length, 1); near(z.elem.neural, f.u.s.atk * .2);
  assert.equal(f.u.skill.active, false);
});

test('S1 blocks external SP while pending and accepts it after the volley', () => {
  const f = make(); enemy(f); until(f, () => f.skills.mode === 1);
  assert.equal(f.u.skill.gainSp(100, 'external'), 0);
  until(f, () => !f.u.skill.active); assert.ok(f.u.skill.gainSp(1, 'external') > 0);
});

test('S2 automatically switches at full time SP even with no enemy', () => {
  const f = make({ skill: 2 });
  advance(f.b, f.u.skill.spCost + 1);
  assert.equal(f.u.skill.activations, 1); assert.equal(f.u.skill.active, true);
  assert.equal(f.u.skill.timeLeft, Infinity); assert.equal(f.skills.mode, 2);
  advance(f.b, 40); assert.equal(f.u.skill.activations, 1);
});

test('S2 expands only centre-circle splash and does not apply lure damage scale to owner strikes', () => {
  const f = make({ skill: 2 }), a = enemy(f), z = enemy(f, { col: 7.4 });
  cast(f); until(f, () => skillArts(f).length === 1);
  assert.equal(skillArts(f)[0].target, a); near(a.elem.neural, f.u.s.atk * .3);
  near(z.elem.neural, f.u.s.atk * .2); near(skillArts(f)[0].hpLoss, f.u.s.atk);
  assert.equal(f.b.regularSummons?.size ?? 0, 0);
});

test('S2 original begin/release timings and all four facing aliases are retained', () => {
  for (const dir of ['UP', 'LEFT', 'DOWN', 'RIGHT']) {
    const f = make({ skill: 2, dir });
    const pos = { UP: [4, 5], LEFT: [5, 4], DOWN: [6, 5], RIGHT: [5, 6] }[dir];
    enemy(f, { row: pos[0], col: pos[1] }); cast(f);
    const begin = f.b.time, duration = f.controller.model().durations.Skill_2_Begin;
    until(f, () => f.controller.phase?.kind === 'attack'); const p = f.controller.phase;
    assert.ok(p.startedAt - begin >= duration - 1e-8);
    near(p.releaseAt - p.startedAt, .8999999761581421);
    until(f, () => skillArts(f).length === 1);
    assert.equal(f.u.mem.regularVisualDirection, ['UP', 'LEFT'].includes(dir) ? 'UP' : 'RIGHT');
  }
});

test('S3 prioritizes a non-burst enemy on expanded source range and uses native predelay', () => {
  const f = make({ skill: 3 }), t = enemy(f), z = enemy(f, { col: 7 });
  f.b.addBuff(t, { key: 'fixture:burst', flags: { burstLock: true } }); cast(f);
  until(f, () => f.controller.phase?.kind === 'attack');
  const p = f.controller.phase; assert.equal(p.target, z);
  near(p.releaseAt - p.startedAt, .20000000298023224);
  until(f, () => skillArts(f).length === 1); assert.equal(skillArts(f)[0].target, z);
});

test('S3 first continuing injury is at 0.1 seconds, then selected interval without attack refresh', () => {
  const f = make({ skill: 3 }), t = enemy(f); cast(f);
  f.b.dealDamage(f.u, t, { type: 'element', element: 'neural', amount: 1 });
  const at = f.b.time, entry = f.skills.dots.get(t); disarmOwner(f);
  near(entry.next - at, .10000000149011612);
  advance(f.b, .1 + f.b.dt); const hits = injury(f, 's3-continuing-injury');
  assert.equal(hits.length, 1); near(hits[0].amount, f.u.s.atk * f.record.bb.ep_damage_ratio);
  f.b.dealDamage(f.u, t, { type: 'element', element: 'neural', amount: 1 });
  near(entry.next - at, 1.1000000014901161);
  advance(f.b, 1); assert.equal(injury(f, 's3-continuing-injury').length, 2);
});

test('S3 continuing injury requires positive owner Nervous receipts, not foreign or another element', () => {
  const f = make({ skill: 3 }), t = enemy(f); cast(f); disarmOwner(f);
  f.b.dealDamage(null, t, { type: 'element', element: 'neural', amount: 10 });
  f.b.dealDamage(f.u, t, { type: 'element', element: 'burn', amount: 10 });
  f.b.dealDamage(f.u, t, { type: 'element', element: 'neural', amount: 0 });
  assert.equal(f.skills.dots.size, 0);
  const h = f.b.on('elementHit', c => { c.dmg.cancel = true; });
  f.b.dealDamage(f.u, t, { type: 'element', element: 'neural', amount: 10 });
  assert.equal(f.skills.dots.size, 0); f.b.off(h);
  f.b.dealDamage(f.u, t, { type: 'element', element: 'neural', amount: 10 });
  assert.equal(f.skills.dots.size, 1);
});

test('S3 continuing injury follows live ATK outside range and survives owner stun', () => {
  const f = make({ skill: 3 }), t = enemy(f); cast(f); disarmOwner(f);
  f.b.dealDamage(f.u, t, { type: 'element', element: 'neural', amount: 1 });
  t.x += 20; f.b._buildEnemyIndex(); f.b.applyStatus(f.u, 'stun', { duration: 5 });
  f.b.addBuff(f.u, { key: 'fixture:atk', mods: { atkPct: .5 } });
  advance(f.b, .1 + f.b.dt); near(injury(f, 's3-continuing-injury')[0].amount, f.u.s.atk * .1);
  assert.equal(f.skills.dots.size, 1);
});

test('S3 any burst, target lifecycle change or skill end removes the derived injury', () => {
  for (const event of ['neural', 'burn', 'life', 'end', 'retire']) {
    const f = make({ skill: 3 }), t = enemy(f); cast(f); disarmOwner(f);
    f.b.dealDamage(f.u, t, { type: 'element', element: 'neural', amount: 1 });
    if (event === 'neural' || event === 'burn') f.b.dealDamage(null, t, { type: 'element', element: event, amount: t.gaugeMax });
    if (event === 'life') t.deploySeq++;
    if (event === 'end') f.u.skill.end();
    if (event === 'retire') f.controller.stop();
    advance(f.b, .2); assert.equal(f.skills.dots.size, 0);
    assert.equal(t.findBuff(`tragodia:${f.u.id}:s3-injury`), null);
    assert.equal(injury(f, 's3-continuing-injury').length, 0);
  }
});

test('S3 accelerates existing in-range Nervous burst on aura enable, with no effect outside range', () => {
  const f = make({ skill: 3 }), t = enemy(f), out = enemy(f, { col: 15 });
  for (const e of [t, out]) f.b.dealDamage(null, e, { type: 'element', element: 'neural', amount: e.gaugeMax });
  cast(f); disarmOwner(f); advance(f.b, 2);
  near(t.findBuff('neuralBurst').timeLeft, 7, f.b.dt * 1.5);
  near(out.findBuff('neuralBurst').timeLeft, 8, f.b.dt);
  assert.equal(f.skills.cooldowns.size, 1);
  f.u.skill.end(); advance(f.b, 1); near(t.findBuff('neuralBurst').timeLeft, 6, f.b.dt * 1.5);
  assert.equal(f.skills.cooldowns.size, 0);
});

test('S3 cooldown acceleration detaches when an enemy leaves range and never changes another burst type', () => {
  const f = make({ skill: 3 }), t = enemy(f), burn = enemy(f, { col: 6.2 }); cast(f); disarmOwner(f);
  f.b.dealDamage(null, t, { type: 'element', element: 'neural', amount: t.gaugeMax });
  f.b.dealDamage(null, burn, { type: 'element', element: 'burn', amount: burn.gaugeMax });
  advance(f.b, .2); assert.equal(f.skills.cooldowns.size, 1);
  const time = t.findBuff('neuralBurst').timeLeft; t.x += 20;
  advance(f.b, 1); near(t.findBuff('neuralBurst').timeLeft, time - 1, f.b.dt);
  assert.equal(f.skills.cooldowns.size, 0);
  assert.equal(burn.findBuff(`tragodia:${f.u.id}:s3-cooldown`), null);
});

test('S3 accelerated cooldown expires once, resets every gauge and removes global ASPD rider', () => {
  const f = make({ skill: 3 }), t = enemy(f); cast(f); disarmOwner(f);
  f.b.dealDamage(null, t, { type: 'element', element: 'neural', amount: t.gaugeMax });
  advance(f.b, 7);
  assert.equal(t.findBuff('neuralBurst'), null); near(t.elem.neural, 0);
  assert.equal(f.skills.cooldowns.size, 0); assert.equal(f.controller.auraEntries.size, 0);
  near(t.s.aspd, 100);
});

test('native non-silenceable skills can cast while silenced; abnormal control still blocks casting', () => {
  for (const skill of [2, 3]) {
    const f = make({ skill }); f.b.applyStatus(f.u, 'silence', { duration: 20 }); cast(f);
    assert.equal(f.u.skill.active, true); f.u.skill.end();
    f.b.applyStatus(f.u, 'stun', { duration: 1 }); refill(f); assert.equal(f.u.skill.activate(), false);
  }
});

test('derived buff rejection and reentrant source retirement leave no later injury or cooldown modifier', () => {
  for (const kind of ['reject', 'retire']) {
    const f = make({ skill: 3 }), t = enemy(f); cast(f); disarmOwner(f);
    f.b.on('beforeBuff', c => {
      if (!c.buff.key?.startsWith(`tragodia:${f.u.id}:s3-`)) return;
      if (kind === 'reject') c.cancel = true; else f.controller.stop();
    });
    f.b.dealDamage(f.u, t, { type: 'element', element: 'neural', amount: 1 });
    advance(f.b, .2); assert.equal(f.skills.dots.size, 0); assert.equal(f.skills.cooldowns.size, 0);
    assert.equal(injury(f, 's3-continuing-injury').length, 0);
  }
});

test('ending S1 externally cancels its delayed second hit', () => {
  const f = make(); enemy(f); until(f, () => skillArts(f).length === 1);
  f.u.skill.end('cancel'); advance(f.b, .5); assert.equal(skillArts(f).length, 1);
});

test('S1 status callbacks cannot strike after control interruption or target life replacement', () => {
  for (const kind of ['control', 'life', 'retire', 'end']) {
    const f = make(), t = enemy(f);
    f.b.on('beforeStatus', c => {
      if (c.source !== f.u || c.status !== 'bind') return;
      if (kind === 'control') f.b.applyStatus(f.u, 'stun', { duration: 10 });
      if (kind === 'life') t.deploySeq++;
      if (kind === 'retire') f.controller.stop();
      if (kind === 'end') f.u.skill.end('callback');
    });
    advance(f.b, 2); assert.equal(skillArts(f).length, 0);
    assert.equal(t.findBuff(`tragodia:${f.u.id}:s1-bind`), null);
  }
});

test('S1 a fatal first hit retains committed splash without inflicting injury on a corpse', () => {
  const f = make(), t = enemy(f, { hp: 1 }), z = enemy(f, { col: 6.2 });
  until(f, () => f.u.skill.activations === 1 && !f.u.skill.active);
  assert.equal(t.alive, false); assert.equal(skillArts(f).length, 1);
  near(t.elem.neural, 0); near(z.elem.neural, f.u.s.atk * .2);
});

test('S1 shielded Arts still commit Nervous and next attacks respect the cadence at high ASPD', () => {
  const f = make(), t = enemy(f);
  f.b.addBuff(t, { key: 'fixture:shield', shield: 1e6 });
  f.b.addBuff(f.u, { key: 'fixture:speed', mods: { aspd: 1000 } });
  until(f, () => skillArts(f).length === 2);
  for (const h of skillArts(f)) assert.equal(h.hpLoss, 0);
  near(t.elem.neural, f.u.s.atk * .3 * f.record.bb.ep_damage_scale * 2);
  const first = f.attacks[0].time; until(f, () => f.attacks.length === 2);
  assert.ok(f.attacks[1].time - first >= .9 - f.b.dt);
});

test('S3 source retirement or enemy replacement during derived buff admission removes the actual accepted buff', () => {
  for (const suffix of ['s3-injury', 's3-cooldown']) for (const retire of [true, false]) {
    const f = make({ skill: 3 }), t = enemy(f); cast(f); disarmOwner(f);
    f.b.on('beforeBuff', c => {
      if (c.buff.key !== `tragodia:${f.u.id}:${suffix}`) return;
      if (retire) f.controller.stop(); else t.deploySeq++;
    });
    f.b.dealDamage(f.u, t, { type: 'element', element: 'neural', amount: suffix === 's3-injury' ? 1 : t.gaugeMax });
    advance(f.b, .2);
    assert.equal(f.skills.dots.size, 0); assert.equal(f.skills.cooldowns.size, 0);
    assert.equal(t.findBuff(`tragodia:${f.u.id}:${suffix}`), null);
  }
});

test('S3 expires at selected duration, restores stats/range and recharges for the next manual cast', () => {
  const f = make({ skill: 3 }), atk = f.u.s.atk; cast(f); disarmOwner(f);
  advance(f.b, 30 + f.b.dt);
  assert.equal(f.u.skill.active, false); near(f.u.s.atk, atk);
  assert.equal(f.u.skill.targetingOverride(), null); assert.equal(f.skills.mode, 0);
  advance(f.b, f.u.skill.spCost); assert.ok(f.u.skill.ready);
  assert.equal(f.u.skill.activations, 1); // No automatic S3 activation.
});

test('permanent and duration modes keep their original idle loops while waiting for a target', () => {
  for (const skill of [2, 3]) {
    const f = make({ skill }); cast(f); advance(f.b, 1);
    assert.equal(f.u.mem.regularFormVisual.clip, skill === 2 ? 'Skill_2_Idle' : 'Skill_3_Loop');
    assert.equal(f.u.mem.regularFormVisual.loop, true);
  }
});

test('skill expiry removes only owned effects and leaves foreign modifiers intact', () => {
  const f = make({ skill: 3 }), t = enemy(f); cast(f); disarmOwner(f);
  f.b.addBuff(t, { key: 'fixture:foreign-aspd', mods: { aspd: 25 } });
  f.b.dealDamage(null, t, { type: 'element', element: 'neural', amount: t.gaugeMax });
  advance(f.b, .2); near(t.s.aspd, 113);
  f.u.skill.end(); assert.ok(t.findBuff('fixture:foreign-aspd'));
  advance(f.b, 11); near(t.s.aspd, 125);
  assert.equal(f.skills.cooldowns.size, 0);
});

test('battle end disposes derived clocks and prevents further owner damage', () => {
  const f = make({ skill: 3 }), t = enemy(f); cast(f);
  f.b.dealDamage(f.u, t, { type: 'element', element: 'neural', amount: 1 });
  f.b.emit('battleEnd', {}); const hits = f.hits.length;
  advance(f.b, 2); assert.equal(f.hits.length, hits);
  assert.equal(f.skills.dots.size, 0); assert.equal(f.skills.cooldowns.size, 0);
  assert.equal(f.skills.handles.length, 0); assert.equal(f.controller.stopped, true);
});

function duplicateOwner(f) {
  const u = f.b._makeAlly(f.u.player, f.u.def, 'op', 5, 4, { dir: 'RIGHT' });
  const p = prepareTragodiaCore(f.b, u, { contract: CONTRACT });
  f.b._setupUnit(u, p.kit); p.controller.install();
  u.player.dp = 99; assert.ok(f.b._deploy(u, { initial: false }));
  u.skill.setSpTotal(u.skill.spCost);
  return { ...f, ...p, u };
}

test('overlapping S1 Bind amplifications use the highest factor instead of multiplying sources', () => {
  const f = make(), t = enemy(f), other = duplicateOwner(f);
  until(f, () => t.findBuff(`tragodia:${f.u.id}:s1-bind`) && t.findBuff(`tragodia:${other.u.id}:s1-bind`));
  const before = t.elem.neural;
  f.b.dealDamage(null, t, { type: 'element', element: 'neural', amount: 10 });
  near(t.elem.neural - before, 18);
  f.b.removeBuff(t, `tragodia:${f.u.id}:s1-bind`);
  const after = t.elem.neural;
  f.b.dealDamage(null, t, { type: 'element', element: 'neural', amount: 10 });
  near(t.elem.neural - after, 18);
});

test('overlapping S3 recovery sources advance one cooldown at the maximum speed and survive source handoff', () => {
  const f = make({ skill: 3 }), t = enemy(f), other = duplicateOwner(f);
  cast(f); assert.ok(other.u.skill.activate()); disarmOwner(f); disarmOwner(other);
  f.b.dealDamage(null, t, { type: 'element', element: 'neural', amount: t.gaugeMax });
  advance(f.b, 2);
  near(t.findBuff('neuralBurst').timeLeft, 7, f.b.dt * 2);
  f.controller.stop(); advance(f.b, 2);
  near(t.findBuff('neuralBurst').timeLeft, 4, f.b.dt * 2);
  assert.equal(other.skills.cooldowns.size, 1);
});

test('S3 continuing injury occupies one world buff slot rather than stacking independent producers', () => {
  const f = make({ skill: 3 }), t = enemy(f), other = duplicateOwner(f);
  cast(f); assert.ok(other.u.skill.activate()); disarmOwner(f); disarmOwner(other);
  f.b.dealDamage(f.u, t, { type: 'element', element: 'neural', amount: 1 });
  f.b.dealDamage(other.u, t, { type: 'element', element: 'neural', amount: 1 });
  assert.equal(f.skills.dots.size, 1); assert.equal(other.skills.dots.size, 0);
  advance(f.b, .1 + f.b.dt);
  assert.equal(injury(f, 's3-continuing-injury').length, 1);
  f.controller.stop();
  f.b.dealDamage(other.u, t, { type: 'element', element: 'neural', amount: 1 });
  assert.equal(other.skills.dots.size, 1);
  assert.equal(t.findBuff(`tragodia:${f.u.id}:s3-injury`), null);
});

test('S3 reentrant injury output during buff admission cannot create a second world clock', () => {
  const f = make({ skill: 3 }), t = enemy(f), other = duplicateOwner(f);
  cast(f); assert.ok(other.u.skill.activate()); disarmOwner(f); disarmOwner(other);
  f.b.on('beforeBuff', c => {
    if (c.buff.key === `tragodia:${f.u.id}:s3-injury`)
      f.b.dealDamage(other.u, t, { type: 'element', element: 'neural', amount: 1 });
  });
  f.b.dealDamage(f.u, t, { type: 'element', element: 'neural', amount: 1 });
  assert.equal(f.skills.dots.size, 1); assert.equal(other.skills.dots.size, 0);
  assert.equal(t.findBuff(`tragodia:${other.u.id}:s3-injury`), null);
});
