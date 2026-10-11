// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import e from '../data/arkpedia-ling-prefabs.json' with { type: 'json' };
import { StandardBattle } from '../server/sim/arkpedia.js';
import { normalizeChess } from '../server/sim/simdata.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { deployRegularSummon, retreatRegularSummon, regularSummonCards } from '../server/sim/content/arkpedia-summons.js';
import { LING_ID as ID, LING_CORE_CONTRACT as CONTRACT, selectedLingBuild, prepareLingCore } from '../server/sim/content/arkpedia-ling.js';
import { LING_SKILL_CONTRACT, prepareLingSkills } from '../server/sim/content/arkpedia-ling-skills.js';

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
function make({ skill = 1, elite = 2, rank = 10, level = e.tables.character.phases[elite].maxLevel,
  potential = 1, trust = 0, dir = 'RIGHT', defer = false, contract = CONTRACT, mutate, skills = false } = {}) {
  const d = structuredClone(data); d.stage.geometry.waves[0].spawns = []; d.stage.battle.dp_per_second = 0;
  d.stage.geometry.rows = 19; d.stage.geometry.cols = 21;
  d.stage.geometry.tileGrid = Array.from({ length: 19 }, () => Array(21).fill(2));
  const b = new StandardBattle(d, { operators: [defaultBuild(d.operators.char_289_gyuki)] });
  b.autoFinish = false; b.recordEvents = true; b.setViewport('fullscreen-workspace');
  b.grid.tiles = b.grid.tiles.map(t => ({ ...t, height: 'LOW', build: 'ALL', pass: 'ALL' }));
  const build = { elite, level, potential, trust, skillRank: Math.min(rank, [4, 7, 10][elite]), skillId: `skchr_ling_${skill}` };
  const r = selectedLingBuild(build), c = e.tables.character;
  const def = normalizeChess({ chessId: ID, charId: ID, name: c.name, profession: c.profession, position: c.position,
    subProfessionId: c.subProfessionId, stats: r.stats, rangeGrid: r.rangeGrid, tags: r.tags, talents: r.talents,
    skill: { ...r.source, ...r.source.spData, skillId: build.skillId,
      rangeGrid: r.source.rangeId ? e.tables.ranges[r.source.rangeId].grids.map(g => [g.row, g.col]) : [],
      trigger: { rule: 'NEVER' } }, arkpedia: build });
  mutate?.(def);
  const u = b._makeAlly(b.getPlayer('arkpedia'), def, 'op', 5, 5, { dir });
  const prepared = skills ? prepareLingSkills(b, u, { contract: LING_SKILL_CONTRACT }) : prepareLingCore(b, u, { contract });
  b._setupUnit(u, prepared.kit); prepared.controller.install();
  const hits = [], births = [], attacks = [];
  b.on('damaged', ctx => { if (ctx.source === u || ctx.source?.ownerUnit === u) hits.push({ ...ctx, time: b.time }); });
  b.on('lingProjectileBirth', ctx => { if (ctx.owner === u) births.push({ ...ctx, time: b.time }); });
  b.on('attack', ctx => { if (ctx.attacker === u || ctx.attacker?.ownerUnit === u) attacks.push({ ...ctx, time: b.time }); });
  const deploy = () => { u.player.dp = 99; assert.ok(b._deploy(u, { initial: false })); u.player.dp = 99; };
  if (!defer) deploy();
  return { b, u, build, deploy, hits, births, attacks, ...prepared, deck: prepared.controller.deck, state: prepared.controller.deck.state };
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
const cast = f => { f.u.skill.addCharge(1); assert.equal(f.u.skill.activate(), true); };

test('Ling skill bridge retains source SP, ranks, stock timing and additive modifiers', () => {
  for (const skill of [1, 2, 3]) for (let rank = 1; rank <= 10; rank++) {
    const f = make({ skill, rank, skills: true }), t = place(f), stock = f.deck.stock;
    assert.equal(f.u.skill.maxCharges, f.record.source.spData.maxChargeTime);
    until(f, () => f.u.skill.ready, 50);
    const atk = f.u.s.atk, tokenAtk = t.s.atk;
    assert.equal(f.u.skill.activate(), true); assert.equal(f.u.skill.active, true);
    assert.equal(f.deck.stock, stock + (skill === 1 ? 1 : 0));
    if (skill !== 2) {
      near(f.u.s.atk, atk * (1 + f.record.bb.atk)); near(t.s.atk, tokenAtk * (1 + f.record.bb.atk));
      if (skill === 1) near(t.s.aspd, 100 + f.record.bb.attack_speed);
      if (skill === 3) near(t.s.def, t.base.def * (1 + f.record.bb.def));
    }
    const sp = f.u.skill.spTotal;
    advance(f.b, .2); near(f.u.skill.spTotal, sp);
    until(f, () => !f.u.skill.active, 40);
    assert.equal(t.alive, true); assert.equal(f.deck.stock, stock + (skill === 1 || skill === 3 ? 1 : 0));
    near(t.s.atk, tokenAtk); assert.equal(data.operators[ID], undefined);
  }
});

test('Ling S1 changes direct dragon damage to Arts and caps original attack animation speed', () => {
  const f = make({ skills: true }), t = place(f), e = enemy(f, { row: 12, col: 11, def: 100, res: 0 });
  until(f, () => hits(f, t).length > 0);
  near(hits(f, t)[0].amount, t.base.atk - 100);
  cast(f); const before = hits(f, t).length;
  until(f, () => hits(f, t).length > before);
  near(hits(f, t).at(-1).amount, t.s.atk);
  near(t.mem.regularFormVisual.speed, 1);
  f.u.skill.end('manual'); const ended = hits(f, t).length;
  until(f, () => hits(f, t).length > ended);
  near(hits(f, t).at(-1).amount, t.base.atk - 100);
  assert.ok(e.alive);
});

test('Ling S2 independently selects two targets and Binds only at projectile arrival', () => {
  const f = make({ skill: 2, skills: true }), t = place(f);
  for (const row of [5, 12]) for (const col of row === 5 ? [6, 7, 8] : [11, 12, 13]) enemy(f, { row, col });
  advance(f.b, 1.1); f.hits.length = 0; f.births.length = 0;
  cast(f); advance(f.b, .49);
  assert.equal(f.births.filter(v => v.skill).length, 0);
  advance(f.b, .07);
  const births = f.births.filter(v => v.skill);
  assert.equal(births.filter(v => v.unit === f.u).length, 2);
  assert.equal(births.filter(v => v.unit === t).length, 2);
  for (const v of births) assert.equal(!!v.target.s.flags.bind, false);
  until(f, () => f.hits.filter(h => h.dmg.tags.includes('ling:s2')).length === 4);
  for (const h of f.hits.filter(h => h.dmg.tags.includes('ling:s2'))) {
    near(h.amount, h.source.s.atk * 4.5); assert.equal(h.target.s.flags.bind, true);
  }
});

test('Ling S2 targetless casting retrieves only living dragons strictly below half HP after native delay', () => {
  const f = make({ skill: 2, skills: true }), low = place(f);
  advance(f.b, 10); const half = place(f, 12, 12);
  low.hp = low.s.maxHp * .49; half.hp = half.s.maxHp * .5;
  const stock = f.deck.stock, dp = f.b.dp, time = f.b.time;
  cast(f); assert.equal(f.u.skill.activate(), false);
  advance(f.b, 1.2); assert.equal(low.alive, true); assert.equal(f.deck.stock, stock);
  until(f, () => !f.u.skill.active, .1);
  assert.ok(f.b.time - time >= 1.2000000476837158);
  assert.equal(low.alive, false); assert.equal(half.alive, true); assert.equal(f.deck.stock, stock + 1);
  near(f.b.dp, dp); assert.equal(f.controller.departures, 1);
  assert.equal(f.births.filter(v => v.skill).length, 0);
  advance(f.b, .15); assert.ok(f.u.skill.spTotal >= 3);
});

test('Ling S2 cancelled or controlled pre-hit casts never create phantom projectiles', () => {
  const f = make({ skill: 2, skills: true }), t = place(f), target = enemy(f);
  enemy(f, { row: 12, col: 11 }); advance(f.b, 1.1); f.births.length = 0;
  cast(f); f.b.applyStatus(f.u, 'stun', { source: target, duration: 1 });
  f.b.retreat(t, { permanent: true }); advance(f.b, 1.4);
  assert.equal(f.births.filter(v => v.skill).length, 0); assert.equal(f.u.skill.active, false);
});

test('Ling S3 fusion gives both slots to the existing forward dragon and restores HP', () => {
  for (const [dir, dr, dc] of [['RIGHT', 0, 1], ['LEFT', 0, -1], ['UP', 1, 0], ['DOWN', -1, 0]]) {
    const f = make({ skill: 3, skills: true }), survivor = place(f, 12 + dr, 10 + dc, dir);
    advance(f.b, 20); survivor.hp = 1;
    const stock = f.deck.stock, consumed = place(f, 12, 10, dir), slots = f.b.deployedSlots();
    assert.equal(survivor.s.maxHp, survivor.base.maxHp); advance(f.b, .1);
    assert.equal(consumed.alive, true); advance(f.b, .04);
    assert.equal(consumed.alive, false); assert.equal(f.skills.tokens.get(survivor).higher, true);
    near(survivor.s.maxHp, survivor.base.maxHp * 2); near(survivor.hp, survivor.s.maxHp);
    near(survivor.s.atk, survivor.base.atk * 1.8); near(survivor.s.def, survivor.base.def * 1.8);
    near(survivor.s.res, survivor.base.res * 2); near(survivor.s.bat, survivor.base.bat + .8);
    assert.equal(survivor.s.blockCnt, 4); assert.equal(survivor.deploymentSlotCost, 2);
    assert.equal(f.b.deployedSlots(), slots); assert.equal(f.deck.stock, stock - 1);
    assert.equal(f.controller.departures, 1); assert.equal(survivor.mem.regularFormVisual.clip, 'Idle_02');
    retreatRegularSummon(f.b, `token:${survivor.id}`); assert.equal(f.b.deployedSlots(), slots - 2);
  }
});

test('Ling S3 inverse fusion chooses latest facing material and forward path takes priority', () => {
  const f = make({ skill: 3, skills: true }), first = place(f, 12, 9, 'RIGHT');
  advance(f.b, 20); const last = place(f, 13, 10, 'DOWN');
  advance(f.b, 20); const survivor = place(f, 12, 10, 'RIGHT');
  advance(f.b, .15);
  assert.equal(first.alive, true); assert.equal(last.alive, false); assert.equal(survivor.alive, true);
  assert.equal(f.skills.tokens.get(survivor).higher, true);
  const g = make({ skill: 3, skills: true }), forward = place(g, 12, 11, 'RIGHT');
  advance(g.b, 20); const behind = place(g, 12, 9, 'RIGHT');
  advance(g.b, 20); const middle = place(g, 12, 10, 'RIGHT'); advance(g.b, .15);
  assert.equal(middle.alive, false); assert.equal(behind.alive, true); assert.equal(forward.deploymentSlotCost, 2);
});

test('Ling S3 uses original higher Arts hit clip and adds skill percentages to base stats', () => {
  const f = make({ skill: 3, skills: true }), t = place(f, 12, 11);
  advance(f.b, 20); place(f, 12, 10); advance(f.b, .15);
  enemy(f, { row: 12, col: 12, def: 1000 });
  until(f, () => hits(f, t).length > 0);
  near(hits(f, t)[0].amount, t.base.atk * 1.8);
  assert.equal(t.mem.regularFormVisual.clip, 'Attack_02'); near(t.mem.regularFormVisual.speed, 1);
  cast(f); near(t.s.atk, t.base.atk * 2.8); near(t.s.def, t.base.def * 2.8);
  assert.equal(f.u.mem.regularFormVisual.clip, 'Skill_03_Idle');
  f.u.skill.end('manual'); near(t.s.atk, t.base.atk * 1.8);
  assert.equal(f.skills.tokens.get(t).activeMode, true); advance(f.b, .04);
  assert.equal(f.skills.tokens.get(t).activeMode, false);
});

test('Ling S3 aura is delayed, cross-shaped, ground-only, camouflage-tolerant and owned by Ling', () => {
  const f = make({ skill: 3, skills: true }), t = place(f);
  const center = enemy(f, { row: 12, col: 10 }), camou = enemy(f, { row: 12, col: 9, flags: { camou: true } });
  const fly = enemy(f, { row: 13, col: 10, fly: true }), diagonal = enemy(f, { row: 13, col: 11 });
  const stealth = enemy(f, { row: 11, col: 10, flags: { stealth: true } });
  cast(f); advance(f.b, .5); assert.equal(f.hits.filter(h => h.dmg.tags.includes('ling:s3:aura')).length, 0);
  advance(f.b, .04);
  const aura = f.hits.filter(h => h.dmg.tags.includes('ling:s3:aura'));
  assert.equal(aura.length, 2); assert.deepEqual(new Set(aura.map(h => h.target)), new Set([center, camou]));
  for (const h of aura) { assert.equal(h.source, f.u); near(h.amount, f.u.s.atk * .2); }
  assert.ok(fly.alive && diagonal.alive && stealth.alive && t.alive);
  f.u.skill.end('manual'); const count = aura.length; advance(f.b, 1);
  assert.equal(f.hits.filter(h => h.dmg.tags.includes('ling:s3:aura')).length, count);
});

test('Ling S3 active propagation includes new dragons; removal never rewards stock or leaves effects', () => {
  for (const skill of [1, 2, 3]) {
    const f = make({ skill, skills: true }), t = place(f);
    cast(f); advance(f.b, f.record.token.stats.respawnTime);
    if (skill !== 2) { const late = place(f, 14, 10); near(late.s.atk, late.base.atk * (1 + f.record.bb.atk)); }
    f.b.retreat(f.u, { permanent: true }); advance(f.b, 2);
    assert.equal(t.alive, false); assert.equal(f.deck.stock, 0); assert.equal(f.skills.tokens.size, 0);
    assert.equal(f.controller.spAwards.size, 0); assert.equal(f.controller.stopped, true);
  }
});

test('Ling S2 damage and Bind use each selected rank and independent owner/token blackboards', () => {
  for (let rank = 1; rank <= 10; rank++) {
    const f = make({ skill: 2, rank, skills: true }), t = place(f);
    const ownerTarget = enemy(f), tokenTarget = enemy(f, { row: 12, col: 11, fly: true });
    const statuses = [];
    f.b.on('statusApplied', ctx => { if (ctx.status === 'bind') statuses.push(ctx); });
    advance(f.b, 1.1); f.hits.length = 0;
    cast(f); until(f, () => f.hits.filter(h => h.dmg.tags.includes('ling:s2')).length === 2);
    const ownerHit = f.hits.find(h => h.dmg.tags.includes('ling:s2') && h.source === f.u);
    const tokenHit = f.hits.find(h => h.dmg.tags.includes('ling:s2') && h.source === t);
    near(ownerHit.amount, f.u.s.atk * f.record.bb.atk_scale);
    near(tokenHit.amount, t.s.atk * f.skills.tokenBB['2.atk_scale']);
    assert.equal(ownerHit.target, ownerTarget); assert.equal(tokenHit.target, tokenTarget);
    near(statuses.find(s => s.source === f.u).duration, f.record.bb['ling_s2_unmovable.duration']);
    near(statuses.find(s => s.source === t).duration, f.skills.tokenBB['2.duration']);
  }
});

test('Ling S2 recycle checks current HP at finish; killed dragons do not regain stock', () => {
  const f = make({ skill: 2, skills: true }), recovered = place(f);
  advance(f.b, 10); const wounded = place(f, 14, 10);
  advance(f.b, 10); const dead = place(f, 16, 10), stock = f.deck.stock;
  recovered.hp = recovered.s.maxHp * .4; wounded.hp = wounded.s.maxHp;
  cast(f); advance(f.b, .6);
  recovered.hp = recovered.s.maxHp * .8; wounded.hp = wounded.s.maxHp * .4;
  f.b.retreat(dead, { permanent: true }); until(f, () => !f.u.skill.active, 1);
  assert.equal(recovered.alive, true); assert.equal(wounded.alive, false); assert.equal(dead.alive, false);
  assert.equal(f.deck.stock, stock + 1); assert.equal(f.controller.departures, 2);
});

test('Ling S3 higher mode switch releases weighted overflow before restoring block capacity', () => {
  const f = make({ skill: 3, skills: true }), t = place(f, 12, 11);
  advance(f.b, 20); place(f, 12, 10); advance(f.b, .15);
  const old = enemy(f, { row: 12, col: 11 }), last = enemy(f, { row: 12, col: 11 });
  old.blockWeight = 2; last.blockWeight = 2;
  t.blocking = [old, last]; old.blockedBy = t; last.blockedBy = t;
  const unblocked = []; f.b.on('unblocked', ({ enemy }) => unblocked.push(enemy));
  cast(f);
  assert.equal(t.s.blockCnt, 4); assert.deepEqual(t.blocking, [old]);
  assert.equal(old.blockedBy, t); assert.equal(last.blockedBy, null); assert.deepEqual(unblocked, [last]);
  // Repeat the check on the delayed active-to-ordinary mode change.
  t.blocking.push(last); last.blockedBy = t;
  f.u.skill.end('manual'); assert.equal(last.blockedBy, t);
  advance(f.b, .04); assert.ok(unblocked.length >= 2);
  assert.equal(t.s.blockCnt, 4); near(t.hp, t.s.maxHp);
});

test('Ling S3 limits fusion to lower same-owner dragons and preserves actual-unit versus slot limits', () => {
  const f = make({ skill: 3, skills: true }), higher = place(f, 12, 11);
  advance(f.b, 20); place(f, 12, 10); advance(f.b, 20);
  const low1 = place(f, 12, 12, 'LEFT'); advance(f.b, 20);
  assert.equal(low1.alive, true); assert.equal(higher.deploymentSlotCost, 2);
  const low2 = place(f, 16, 10); advance(f.b, 20);
  assert.equal(f.deck.own().length, 3); assert.equal(f.b.deployedSlots(), 5);
  assert.throws(() => place(f, 14, 10), /Dragon deployment limit/);
  assert.equal(low2.alive, true);
});

test('Ling S3 owner loop uses original hit event while higher token fusion excludes Born alias', () => {
  const f = make({ skill: 3, skills: true }); enemy(f); advance(f.b, 1.1);
  f.births.length = 0; cast(f); advance(f.b, .46);
  assert.equal(f.births.length, 0); advance(f.b, .07);
  assert.equal(f.births[0].projectile.data.sourceKey, 'projectile_chr_ling_s3');
  assert.equal(f.u.mem.regularFormVisual.clip, 'Skill_03_Loop');
  const t = place(f, 12, 11); advance(f.b, 20); place(f, 12, 10); advance(f.b, .15);
  assert.equal(t.mem.regularFormVisual.clip, 'Idle_02');
  assert.notEqual(t.mem.regularFormVisual.clip, 'Start_02');
});

test('Ling skill casts honor control/disarm but remain unsilenceable; exact contract is required', () => {
  const f = make({ skills: true }), target = enemy(f); f.u.skill.addCharge(1);
  f.b.applyStatus(f.u, 'silence', { source: target, duration: 1 });
  assert.equal(f.u.skill.activate(), true); f.u.skill.end('manual'); f.u.skill.addCharge(1);
  f.b.applyStatus(f.u, 'stun', { source: target, duration: 1 }); assert.equal(f.u.skill.activate(), false);
  advance(f.b, 1.1); f.b.addBuff(f.u, { key: 'fixture:disarm', flags: { disarm: true } });
  assert.equal(f.u.skill.activate(), false);
  const g = make({ defer: true });
  assert.throws(() => prepareLingSkills(g.b, g.u, { contract: { ...LING_SKILL_CONTRACT } }), /contract/);
});

test('Ling diagnostic requires an exact complete original source build and holds public activation', () => {
  assert.equal(data.operators[ID], undefined); assert.equal(CONTRACT.frameParity, false);
  assert.throws(() => make({ contract: { ...CONTRACT } }), /contract/);
  const valid = make().build;
  for (const change of [{ elite: 3 }, { level: 0 }, { level: 91 }, { potential: 0 }, { potential: 7 },
    { trust: 201 }, { trust: -1 }, { skillRank: 11 }, { skillRank: 0 }, { module: 'mod-x' },
    { elite: 0, skillId: 'skchr_ling_2' }, { elite: 1, skillId: 'skchr_ling_3' }])
    assert.throws(() => selectedLingBuild({ ...valid, ...change }));
  for (const mutate of [d => d.stats.atk++, d => d.skill.spCost++, d => d.skill.bb.atk = 99,
    d => d.rangeGrid.pop(), d => d.tags.push('wrong'), d => d.talents[0].bb.cnt = 99])
    assert.throws(() => make({ mutate }), /Incomplete/);
  const f = make({ defer: true }); assert.throws(() => prepareLingCore(f.b, f.u, { contract: CONTRACT }), /fresh/);
  for (const skill of [1, 2, 3]) for (let rank = 1; rank <= 10; rank++) {
    const f = make({ skill, rank }); near(f.u.skill.spTotal, f.record.source.spData.initSp);
    f.u.skill.addCharge(1); assert.equal(f.u.skill.activate(), false);
    assert.equal(f.deck.record.id, `token_10020_ling_soul${skill}`);
  }
});

test('selected owner trust/potential and token promotion remain independent', () => {
  for (const elite of [0, 1, 2]) for (const skill of [1, 2, 3].filter(n => n <= elite + 1)) {
    const f = make({ elite, skill }), p = make({ elite, skill, potential: 6, trust: 200 });
    near(p.u.base.atk, f.u.base.atk + 24 + 35); near(p.u.base.maxHp, f.u.base.maxHp + 350);
    near(p.u.base.cost, f.u.base.cost - 2); near(p.u.base.respawnTime, f.u.base.respawnTime - 4);
    assert.deepEqual(p.record.token.stats, f.record.token.stats);
    assert.equal(f.deck.stock, [3, 4, 5][elite]); assert.equal(f.record.token.stats.maxDeployCount, 3);
    assert.equal(f.record.departure.sp, elite === 0 ? undefined : elite === 1 ? 2 : 3);
    assert.equal(p.record.departure.sp, elite === 0 ? undefined : elite === 1 ? 3 : 4);
  }
  const f = make({ elite: 1, skill: 2, level: 40 }), frames = e.tables.tokens.token_10020_ling_soul2.phases[1].attributesKeyFrames;
  const t = (40 - frames[0].level) / (frames.at(-1).level - frames[0].level);
  near(f.record.token.stats.atk, Math.round(frames[0].data.atk + (frames.at(-1).data.atk - frames[0].data.atk) * t));
});

test('all dragon cards require fullscreen, matching terrain, stock, DP, slot and facing', () => {
  for (const skill of [1, 2, 3]) {
    const f = make({ skill }), cost = f.deck.record.stats.cost, tile = f.b.grid.tile(12, 10);
    assert.equal(regularSummonCards(f.b).find(c => c.key === KEY).stock, 5);
    f.b.setViewport('inline'); assert.throws(() => place(f), /fullscreen/); f.b.setViewport('fullscreen-workspace');
    f.u.player.dp = cost - 1; assert.throws(() => place(f), /DP/); f.u.player.dp = 99;
    tile.build = skill === 2 ? 'MELEE' : 'RANGED'; assert.throws(() => place(f), /tile/); tile.build = 'ALL';
    for (const [r, c] of [[-1, 1], [2.5, 10], [1, 21]]) assert.throws(() => place(f, r, c), /tile/);
    assert.ok(f.b.reserveTile(f.u, 12, 10, 'fixture:return')); assert.throws(() => place(f), /reserved/);
    f.b.releaseTileReservations(f.u, 'fixture:return');
    assert.throws(() => place(f, 12, 10, 'bad'), /direction/);
    f.b.unitLimit = 1; assert.throws(() => place(f), /Deployment limit/); f.b.unitLimit = 8;
    const dp = f.b.dp, slots = f.b.deployedSlots(), t = place(f, 12, 10, 'UP');
    near(dp - f.b.dp, cost); assert.equal(f.b.deployedSlots(), slots + 1); assert.equal(t.dir, 'UP');
    assert.equal(t.s.flags.healFree, true); assert.equal(f.deck.stock, 4);
    near(f.deck.readyAt, skill === 3 ? 20 : 10); assert.throws(() => place(f, 12, 11), /redeploying/);
    advance(f.b, f.record.token.stats.respawnTime); assert.throws(() => place(f), /occupied/);
    place(f, 12, 11); advance(f.b, f.record.token.stats.respawnTime);
    place(f, 12, 12); advance(f.b, f.record.token.stats.respawnTime);
    assert.throws(() => place(f, 12, 13), /Dragon deployment limit/);
  }
});

test('owner projectile waits for native birth/hit event and damages a single target with arrival ATK', () => {
  const f = make(), t = enemy(f, { col: 8, res: 20 });
  advance(f.b, 1.59); assert.equal(f.births.length, 0); assert.equal(f.hits.length, 0);
  until(f, () => f.births.length === 1);
  near(f.births[0].time, 1 + .6, f.b.dt * 2);
  f.b.addBuff(f.u, { key: 'fixture:arrival-atk', mods: { atkPct: 1 } });
  until(f, () => f.hits.length === 1); assert.equal(f.hits[0].target, t);
  near(f.hits[0].amount, f.u.s.atk * .8); assert.ok(f.hits[0].time > f.births[0].time);
});

test('all owner facings select the rotated source range and native Front/Back attack', () => {
  for (const [dir, row, col] of [['RIGHT', 5, 6], ['LEFT', 5, 4], ['UP', 6, 5], ['DOWN', 4, 5]]) {
    const f = make({ dir }), t = enemy(f, { row, col });
    until(f, () => f.hits.length); assert.equal(f.hits[0].target, t);
    assert.equal(f.u.mem.regularVisualDirection, ['LEFT', 'UP'].includes(dir) ? 'UP' : 'RIGHT');
  }
});

test('ordinary melee dragons hit only ground targets, with S3 target count limited by block', () => {
  for (const skill of [1, 3]) {
    const f = make({ skill }), u = place(f), ts = [enemy(f, { row: 12, col: 11 }), enemy(f, { row: 12, col: 11 }), enemy(f, { row: 12, col: 11 })];
    const flying = enemy(f, { row: 12, col: 11, fly: true });
    advance(f.b, 1.35); assert.equal(hits(f, u).length, 0);
    until(f, () => hits(f, u).length); const first = hits(f, u);
    assert.equal(first.length, skill === 1 ? 1 : 2); assert.ok(first.every(h => ts.includes(h.target) && h.target !== flying));
    first.forEach(h => near(h.amount, u.s.atk));
    near(first[0].time, 1 + 11 / 30, f.b.dt * 2); assert.equal(f.births.filter(h => h.unit === u).length, 0);
  }
});

test('ordinary S2 dragon uses delayed Arts projectiles and can target flight', () => {
  const f = make({ skill: 2 }), u = place(f), t = enemy(f, { row: 12, col: 12, fly: true, res: 25 });
  until(f, () => f.births.some(p => p.unit === u)); assert.equal(hits(f, u).length, 0);
  until(f, () => hits(f, u).length); const h = hits(f, u)[0];
  assert.equal(h.target, t); near(h.amount, u.s.atk * .75);
});

test('summon departure adds bounded ATK stacks and delayed SP without replacing the card', () => {
  for (const [elite, potential, sp] of [[0, 1, 0], [1, 1, 2], [2, 1, 3], [2, 5, 4]]) {
    const f = make({ elite, potential }), atk = f.u.s.atk;
    const t = place(f), stock = f.deck.stock, before = f.u.skill.spTotal;
    retreatRegularSummon(f.b, `token:${t.id}`);
    assert.equal(f.deck.stock, stock); near(f.u.skill.spTotal, before);
    near(f.u.s.atk, atk * (elite === 0 ? 1 : elite === 1 ? 1.02 : 1.03));
    advance(f.b, .2); near(f.u.skill.spTotal, before + sp + f.b.time);
    f.deck.removed(t); near(f.u.s.atk, atk * (elite === 0 ? 1 : elite === 1 ? 1.02 : 1.03));
  }
  const f = make(), atk = f.u.s.atk;
  for (let n = 0; n < 7; n++) {
    if (n) { advance(f.b, 10); f.deck.stock = 1; }
    const t = place(f); f.b.kill(t); // use actual death hooks for each distinct life
  }
  near(f.u.s.atk, atk * 1.15); assert.equal(f.controller.departures, 5);
});

test('owner removal clears dragons/stock and prevents delayed departure credit into another life', () => {
  const f = make(), t = place(f); retreatRegularSummon(f.b, `token:${t.id}`);
  const before = f.u.skill.spTotal; f.b.retreat(f.u, { permanent: true });
  advance(f.b, .2); near(f.u.skill.spTotal, before);
  assert.equal(f.deck.stock, 0); assert.equal(f.controller.stopped, true);
  assert.equal(f.controller.spAwards.size, 0); assert.equal(f.controller.handles.length, 0);
  assert.equal(f.deck.own().length, 0); assert.throws(() => place(f), /Ling first/);
  const g = make(), dragon = place(g); g.b.retreat(g.u, { permanent: true });
  assert.equal(dragon.alive, false); assert.equal(g.controller.departures, 0);
  advance(g.b, 1); assert.equal(g.b.errors.length, 0);
});

test('all dragon facings rotate their own range and preserve source hit clips', () => {
  for (const skill of [1, 2, 3]) for (const [dir, row, col] of [['RIGHT', 12, 11], ['LEFT', 12, 9], ['UP', 13, 10], ['DOWN', 11, 10]]) {
    const f = make({ skill }), t = place(f, 12, 10, dir), victim = enemy(f, { row, col });
    until(f, () => hits(f, t).length); assert.equal(hits(f, t)[0].target, victim); assert.equal(t.dir, dir);
    assert.equal(t.mem.regularFormVisual.clip, 'Attack');
  }
});

test('all ordinary attack clocks cap native visual speed even with bonus ASPD', () => {
  for (const skill of [1, 2, 3]) {
    const f = make({ skill }), t = place(f); enemy(f, { row: 12, col: 11 });
    f.b.addBuff(t, { key: 'fixture:aspd', mods: { aspd: 300 } });
    until(f, () => f.deck.attacks.get(t).phase?.kind === 'attack');
    const p = f.deck.attacks.get(t).phase;
    near(t.mem.regularFormVisual.speed, 1); near(p.readyAt - p.releaseAt, 1 - 11 / 30);
    advance(f.b, .35); assert.equal(hits(f, t).length, 0);
    until(f, () => hits(f, t).length); near(hits(f, t)[0].amount, t.s.atk);
  }
});

test('unaccepted forced attacks cannot bypass native windup or duplicate an accepted strike', () => {
  const f = make(), t = enemy(f), health = t.hp;
  f.b.forceAttack(f.u, [t]); near(t.hp, health); assert.equal(f.births.length, 0);
  assert.equal(f.attacks.length, 0);
  until(f, () => f.births.length === 1);
  f.b.forceAttack(f.u, [t]); assert.equal(f.births.length, 1);
  until(f, () => f.hits.length === 1); assert.equal(f.attacks.length, 1);
});

test('stun cancels an unreleased attack and stale/dead targets receive no projectile damage', () => {
  const f = make(), t = enemy(f);
  until(f, () => f.controller.attack.phase?.kind === 'attack');
  f.b.applyStatus(f.u, 'stun', { duration: 2 }); advance(f.b, 1);
  assert.equal(f.births.length, 0); assert.equal(f.hits.length, 0);
  until(f, () => f.births.length);
  f.b.kill(t); advance(f.b, 1); assert.equal(f.hits.length, 0);
  const g = make({ skill: 2 }), dragon = place(g), victim = enemy(g, { row: 12, col: 13 });
  until(g, () => g.births.some(p => p.unit === dragon));
  victim.deploySeq++; advance(g.b, .4); assert.equal(hits(g, dragon).length, 0);
});

test('departure SP respects no-SP flags and awards each simultaneous death once', () => {
  const f = make({ skill: 2 }), t = place(f); advance(f.b, 10); const q = place(f, 12, 11);
  const initial = f.u.skill.spTotal, atk = f.u.s.atk;
  f.b.addBuff(f.u, { key: 'fixture:no-sp', flags: { noSp: true } });
  f.b.kill(t); f.b.kill(q); assert.equal(f.controller.spAwards.size, 2);
  near(f.u.s.atk, atk * 1.06); advance(f.b, .2); near(f.u.skill.spTotal, initial);
  assert.equal(f.controller.spAwards.size, 0);
  const g = make({ skill: 2 }); const a = place(g); advance(g.b, 10); const z = place(g, 12, 11);
  const before = g.u.skill.spTotal;
  g.b.kill(a); g.b.kill(z); advance(g.b, .2);
  near(g.u.skill.spTotal, before + 6 + .2); assert.equal(g.controller.departures, 2);
});

test('battle end cancels dragon attacks, projectiles, delayed SP and owned hooks', () => {
  const f = make({ skill: 2 }), t = place(f); enemy(f, { row: 12, col: 13 });
  until(f, () => f.births.some(p => p.unit === t));
  f.b.finished = true; f.b.emit('battleEnd', {});
  assert.equal(t.alive, false); assert.equal(f.deck.stock, 0); assert.equal(f.deck.attacks.size, 0);
  assert.equal(f.controller.handles.length, 0); assert.equal(f.controller.spAwards.size, 0);
  assert.equal(f.b.projectiles.list.filter(p => p.data?.lingCore === f.controller).length, 0);
});

test('accepted ranged projectile can outlive its source but never the battle', () => {
  const f = make(), t = enemy(f, { col: 8 }); until(f, () => f.births.length === 1);
  f.b.retreat(f.u, { permanent: true }); assert.equal(f.controller.stopped, true);
  until(f, () => f.hits.length === 1); assert.equal(f.hits[0].target, t);
});
