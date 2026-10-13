// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import evidence from '../data/arkpedia-rmixer-prefabs.json' with { type: 'json' };
import review from '../data/arkpedia-rmixer-runtime-review.json' with { type: 'json' };
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild, catalogueFor, recordFor } from '../shared/arkpedia/loadout.js';
import { RMIXER_ID as ID, selectedRmixerBuild } from '../server/sim/content/arkpedia-rmixer-source.js';
import { RMIXER_RUNTIME_CONTRACT } from '../server/sim/content/arkpedia-rmixer-skills.js';
import { skillHud } from '../shared/arkpedia/skill-hud.js';
const near = (a, z) => assert.ok(Math.abs(a - z) < 1e-5, `${a} != ${z}`);
function advance(b, s) { for (let n = 0; n < Math.ceil(s / b.dt - 1e-9); n++) b.step(); assert.deepEqual(b.errors, []); }
function until(b, p, s = 90) { const end = b.time + s; while (!p() && b.time < end) b.step(); assert.ok(p(), `Expected condition at ${b.time}`); assert.deepEqual(b.errors, []); }
function make({ skill = 1, rank = 10, elite = 2, potential = 1, trust = 0, level, support = false, allies = [] } = {}) {
  const d = structuredClone(data); d.stage.geometry.waves[0].spawns = []; d.stage.battle.dp_per_second = 0;
  d.stage.geometry.rows = 19; d.stage.geometry.cols = 21; d.stage.geometry.tileGrid = Array.from({ length: 19 }, () => Array(21).fill(2));
  const build = { ...defaultBuild(d.operators[ID]), elite, level: level ?? d.operators[ID].phases[elite].maxLevel,
    potential, trust, skillId: `skchr_rmixer_${skill}`, skillRank: rank };
  const b = new StandardBattle(d, support ? { operators: [defaultBuild(d.operators.char_208_melan)], support: build } : { operators: [build, ...allies] });
  b.autoFinish = false; b.recordEvents = true; b.rng = () => .99; b.setViewport('fullscreen-workspace'); b.getPlayer('arkpedia').dp = 999;
  b.grid.tiles = b.grid.tiles.map(t => ({ ...t, height: 'LOW', build: 'ALL', pass: 'ALL' })); return { b, build: b.bench[ID].build };
}
function enemy(b, row = 5, col = 6) {
  const t = b.spawnEnemy('enemy_1007_slime', { pos: [row, col] });
  Object.assign(t.base, { maxHp: 1e7, atk: 0, def: 0, res: 0, moveSpeed: 0 }); t.markDirty(); void t.s; t.hp = 1e7;
  b.addBuff(t, { key: 'fixture:pin', flags: { noMove: true, disarm: true, unblockable: true } }); b._buildEnemyIndex(); return t;
}
function input(b, t, u, amount = 1) { return b.dealDamage(t, u, { amount, type: 'true', isAttack: true, canDodge: false }); }

test('public Sankta review binds immutable native evidence and exposes only reviewed skills', async () => {
  const bytes = await readFile(new URL('../data/arkpedia-rmixer-prefabs.json', import.meta.url));
  assert.equal(review.sourceFoundationSha256, createHash('sha256').update(bytes).digest('hex'));
  assert.deepEqual(review.enabledOperators, [ID]); assert.deepEqual(evidence.enabledOperators, []); assert.deepEqual(evidence.heldOperators, [ID]);
  assert.equal(evidence.source.commit, data.sources[evidence.source.repository]); assert.equal(review.frameParity, false); assert.equal(review.moduleSupport, false);
  const c = catalogueFor(data)[ID]; assert.deepEqual(c.skills.map(s => s.id), [1, 2, 3].map(n => `skchr_rmixer_${n}`));
  assert.deepEqual(c.skills.map(s => s.unlockElite), [0, 1, 2]); assert.deepEqual(c.modules, []);
  for (const change of [{ elite: 0, level: 1, skillId: 'skchr_rmixer_2', skillRank: 1 },
    { elite: 1, level: 1, skillId: 'skchr_rmixer_3', skillRank: 1 }, { module: 'HAM-X' }])
    assert.throws(() => recordFor({ ...defaultBuild(data.operators[ID]), ...change }, data));
});
for (let skill = 1; skill <= 3; skill++) for (let rank = 1; rank <= 10; rank++)
  test(`public Sankta S${skill} rank ${rank}: selected source, natural SP, output and removal`, () => {
    const { b, build } = make({ skill, rank }), r = selectedRmixerBuild(build); advance(b, 2);
    const dp = b.dp, cost = b.cost(ID), u = b.deployOperator(ID, 5, 5, 'RIGHT'), c = u.mem.rmixerAttacks;
    near(b.dp, dp - cost); near(u.base.atk, r.stats.atk); near(u.skill.sp, r.source.spData.initSp);
    assert.equal(c.contract, RMIXER_RUNTIME_CONTRACT); assert.equal(c.record.index, skill - 1);
    const t = enemy(b), hits = []; b.on('damaged', ctx => { if (ctx.source === u) hits.push(ctx); });
    assert.equal(b.activateOperator(ID), false);
    if (skill === 1) {
      for (let n = u.skill.sp; n < u.skill.spCost; n++) input(b, t, u);
      until(b, () => hits.filter(h => h.dmg.tags.includes('rmixer:s1')).length === 3);
      assert.equal(skillHud(u.skill).text, 'Skill active · Three-shot attack');
      assert.equal(skillHud(u.skill).ready, false);
      assert.equal(u.skill.activations, 1); until(b, () => !u.skill.active); assert.ok(u.findBuff('rmixer:damage-stacks'));
    } else {
      until(b, () => u.skill.ready); assert.equal(b.activateOperator(ID), true);
      if (skill === 2) until(b, () => hits.some(h => h.dmg.tags.includes('rmixer:s2')));
      else { until(b, () => c.phase == null); input(b, t, u); assert.ok(hits.some(h => h.dmg.tags.includes('rmixer:s3'))); }
      assert.ok(u.skill.ammoLeft < r.bb['attack@trigger_time']);
      assert.equal(b.activateOperator(ID), true); assert.equal(u.skill.active, false); advance(b, 1);
    }
    assert.equal(c.valid(), true); b.retreatOperator(ID); assert.equal(c.stopped, true); assert.equal(c.handles.length, 0);
    assert.equal(c.resources.hooks.length, 0); assert.equal(u.findBuff('rmixer:damage-stacks'), null); assert.equal(u.skill.active, false);
    b._finish('victory'); assert.deepEqual(b.errors, []);
  });
for (const dir of ['RIGHT', 'DOWN', 'LEFT', 'UP']) test(`public Sankta ${dir}: late deployment, source facing and fresh redeployment`, () => {
  const { b } = make({ skill: 3 }); advance(b, 5); const u = b.deployOperator(ID, 5, 5, dir), old = u.mem.rmixerAttacks;
  advance(b, 2); assert.equal(u.mem.regularVisualDirection, ['UP', 'LEFT'].includes(dir) ? 'UP' : 'RIGHT');
  until(b, () => u.skill.ready); assert.equal(b.activateOperator(ID), true); b.retreatOperator(ID);
  advance(b, 85); b.getPlayer('arkpedia').dp = 999; const v = b.deployOperator(ID, 5, 5, dir), next = v.mem.rmixerAttacks;
  assert.notEqual(v, u); assert.notEqual(next, old); assert.equal(old.stopped, true); assert.equal(next.valid(), true);
  assert.equal(v.skill.active, false); assert.equal(next.resources.completed.size, 0); assert.equal(v.findBuff('rmixer:damage-stacks'), null);
  advance(b, 9); assert.ok(next.resources.barrier); b._finish('victory'); assert.equal(next.stopped, true); assert.equal(next.resources.barrier, null);
});
for (const elite of [0, 1, 2]) for (const level of [1, data.operators[ID].phases[elite].maxLevel])
  test(`public Sankta E${elite} Lv${level}: trust, potentials and talents do not become unconditional bonuses`, () => {
    const { b, build } = make({ elite, level, rank: 1, potential: 6, trust: 200 }), r = selectedRmixerBuild(build), u = b.deployOperator(ID, 5, 5, 'RIGHT');
    for (const k of ['atk', 'maxHp', 'def', 'cost', 'respawnTime']) near(u.base[k], r.stats[k]); near(u.s.def, r.stats.def);
    assert.equal(!!u.mem.rmixerResources.t2, elite === 2); b._finish('victory');
  });
test('S2 public fatal guard spends ammo and retains its complete HP set', () => {
  const { b } = make({ skill: 2 }), u = b.deployOperator(ID, 5, 5, 'RIGHT');
  until(b, () => u.skill.ready); assert.ok(b.activateOperator(ID)); const ammo = u.skill.ammoLeft, hp = u.hp;
  input(b, null, u, u.s.maxHp * 100); assert.equal(u.alive, true); near(u.hp, hp);
  assert.equal(u.skill.ammoLeft, ammo - u.mem.rmixerAttacks.record.bb.ammo_cost); b.retreatOperator(ID); assert.equal(u.skill.active, false);
});
test('public S1 and S3 replenish a real Lemuen build and preserve her private ammo mirror', () => {
  for (const skill of [1, 3]) {
    const ally = { ...defaultBuild(data.operators.char_4193_lemuen), skillId: 'skchr_lemuen_3' };
    const { b } = make({ skill, allies: [ally] }), u = b.deployOperator(ID, 5, 5, 'RIGHT'), a = b.deployOperator(ally.id, 6, 5, 'RIGHT');
    enemy(b, 6, 6); until(b, () => a.skill.ready && (skill === 1 || u.skill.ready)); assert.ok(b.activateOperator(ally.id)); const max = a.skill.ammoLeft;
    // Spend through the real recipient controller against its own target.
    until(b, () => a.skill.ammoLeft < max); const before = a.skill.ammoLeft;
    const t = enemy(b);
    if (skill === 1) { for (let n = u.skill.sp; n < u.skill.spCost; n++) input(b, t, u); until(b, () => a.skill.ammoReplenished === 1); }
    else { until(b, () => u.skill.ready); assert.ok(b.activateOperator(ID)); }
    const granted = skill === 1 ? 1 : u.mem.rmixerAttacks.record.bb.ammo;
    assert.equal(a.skill.ammoReplenished, granted); assert.equal(a.skill.ammoLeft, a.mem.lemuenController.ammo.current);
    assert.ok(a.skill.ammoLeft >= before + granted - 1); b._finish('victory');
  }
});
test('maxed support Sankta and rejected commands preserve DP/SP', () => {
  const { b, build } = make({ skill: 3, support: true }), r = selectedRmixerBuild(build), dp = b.dp;
  b.setViewport('preview'); assert.throws(() => b.deployOperator(ID, 5, 5, 'RIGHT')); near(b.dp, dp);
  b.setViewport('fullscreen-workspace'); assert.throws(() => b.deployOperator(ID, 5, 5, 'INVALID')); near(b.dp, dp);
  const u = b.deployOperator(ID, 5, 5, 'RIGHT'); near(u.base.atk, r.stats.atk); const sp = u.skill.sp;
  assert.equal(b.activateOperator(ID), false); near(u.skill.sp, sp); b._finish('victory');
});

for (const skill of [1, 2, 3]) test(`public Sankta S${skill} clears the unmodified 0-1 waves with Kroos and natural DP/SP`, () => {
  const build = { ...defaultBuild(data.operators[ID]), skillId: `skchr_rmixer_${skill}` };
  const b = new StandardBattle(data, { operators: [build, defaultBuild(data.operators.char_124_kroos)], seed: 1 });
  b.setViewport('fullscreen-workspace'); let deployed = false, kroos = false;
  const hits = []; b.on('damaged', ctx => { if (ctx.source?.defId === ID) hits.push(ctx); });
  for (let n = 0; n < 9001 && !b.finished; n++) {
    if (!deployed && b.dp >= b.cost(ID)) { b.deployOperator(ID, 3, 5, 'LEFT'); deployed = true; }
    if (deployed && !kroos && b.dp >= b.cost('char_124_kroos')) { b.deployOperator('char_124_kroos', 2, 4, 'UP'); kroos = true; }
    const u = b.bench[ID].unit;
    if (skill > 1 && u?.skill.ready && !u.skill.active) b.activateOperator(ID);
    b.step();
  }
  assert.equal(b.finished, true); assert.equal(b.result().reason, 'cleared');
  assert.equal(b.result().total, 11); assert.equal(b.result().killed, 10); assert.equal(b.life, 19);
  assert.ok(hits.some(h => h.dmg.tags.includes(`rmixer:s${skill}`))); assert.deepEqual(b.errors, []);
  assert.equal(b.bench[ID].unit.mem.rmixerAttacks.stopped, true);
});
