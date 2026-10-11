// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import evidence from '../data/arkpedia-shu-prefabs.json' with { type: 'json' };
import review from '../data/arkpedia-shu-runtime-review.json' with { type: 'json' };
import { StandardBattle } from '../server/sim/arkpedia.js';
import { catalogueFor, defaultBuild, recordFor } from '../shared/arkpedia/loadout.js';
import { selectedShuBuild, SHU_ID as ID } from '../server/sim/content/arkpedia-shu.js';
const near = (a, z) => assert.ok(Math.abs(a - z) < 1e-5, `${a} != ${z}`);
function advance(b, seconds) {
  for (let i = 0; i < Math.ceil(seconds / b.dt - 1e-9); i++) b.step();
  assert.deepEqual(b.errors, []);
}
function until(b, condition, seconds = 80) {
  const end = b.time + seconds;
  while (!condition() && b.time < end) b.step();
  assert.ok(condition(), `Condition missing at ${b.time}`); assert.deepEqual(b.errors, []);
}
function make({ skill = 1, rank = 10, elite = 2, level = data.operators[ID].phases[elite].maxLevel,
  potential = 1, trust = 0, support = false, squad = [] } = {}) {
  const d = structuredClone(data); d.stage.geometry.waves[0].spawns = []; d.stage.battle.dp_per_second = 0;
  d.stage.geometry.rows = 19; d.stage.geometry.cols = 21;
  d.stage.geometry.tileGrid = Array.from({ length: 19 }, () => Array(21).fill(2));
  const build = { ...defaultBuild(d.operators[ID]), elite, level, potential, trust,
    skillId: `skchr_shu_${skill}`, skillRank: rank };
  const members = ['char_500_noirc', 'char_196_sunbr', ...squad].map(id => defaultBuild(d.operators[id]));
  const b = new StandardBattle(d, support ? { operators: members, support: build } : { operators: [build, ...members] });
  b.autoFinish = false; b.recordEvents = true; b.setViewport('fullscreen-workspace');
  b.getPlayer('arkpedia').dp = 99;
  b.grid.tiles = b.grid.tiles.map(t => ({ ...t, height: 'LOW', build: 'ALL', pass: 'ALL' }));
  return { b, build: b.bench[ID].build };
}
function injured(b, id, row, col) {
  const a = b.deployOperator(id, row, col, 'RIGHT');
  b.addBuff(a, { key: 'qa:regen', flags: { noHpRecovery: true } });
  a.base.maxHp = 1e7; a.markDirty(); void a.s; a.hp = 1e6; return a;
}
function enemy(b, row = 5, col = 6) {
  const e = b.spawnEnemy('enemy_1007_slime', { pos: [row, col] });
  Object.assign(e.base, { maxHp: 1e7, atk: 0, def: 0, res: 0, moveSpeed: 0 });
  e.markDirty(); void e.s; e.hp = e.s.maxHp;
  b.addBuff(e, { key: 'qa:pin', flags: { noMove: true, disarm: true } }); b._buildEnemyIndex(); return e;
}

test('public Shu retains the held native receipt and binds all skills and both original owner models', async () => {
  const bytes = await readFile(new URL('../data/arkpedia-shu-prefabs.json', import.meta.url));
  assert.equal(review.sourceFoundationSha256, createHash('sha256').update(bytes).digest('hex'));
  assert.deepEqual(review.enabledOperators, [ID]); assert.deepEqual(evidence.enabledOperators, []);
  assert.deepEqual(evidence.heldOperators, [ID]); assert.equal(review.frameParity, false);
  assert.equal(evidence.source.commit, data.sources[evidence.source.repository]);
  assert.deepEqual(catalogueFor(data)[ID].skills.map(s => s.id), [1, 2, 3].map(n => `skchr_shu_${n}`));
  assert.deepEqual(catalogueFor(data)[ID].modules, []);
  for (const change of [{ elite: 0, level: 1, skillId: 'skchr_shu_2', skillRank: 1 },
    { elite: 1, level: 1, skillId: 'skchr_shu_3', skillRank: 1 }, { module: 'mod-x' }])
    assert.throws(() => recordFor({ ...defaultBuild(data.operators[ID]), ...change }, data));
  for (const face of ['front', 'back']) {
    const m = data.sd.models[`operator/${ID}/default/${face}`], art = review.originalArtwork[face];
    assert.deepEqual([m.skeleton, m.atlas, ...m.textures], art.files);
    assert.equal(m.skeleton.sha256, evidence.officialSkeletonBindings[ID][face === 'front' ? 'Front' : 'Back'].sha256);
    assert.deepEqual(m.animations, art.animations); assert.equal(m.premultipliedAlpha, true);
    assert.equal(m.animationRoles.die, face === 'front' ? 'Die' : null);
  }
});
for (const skill of [1, 2, 3]) for (let rank = 1; rank <= 10; rank++)
  test(`public Shu S${skill} rank ${rank}: source build, natural SP, healing and clean retirement`, () => {
    const { b, build } = make({ skill, rank }), r = selectedShuBuild(build);
    const dp = b.dp, cost = b.cost(ID), u = b.deployOperator(ID, 5, 5, 'RIGHT'), c = u.mem.shuController;
    near(b.dp, dp - cost); near(u.base.atk, r.stats.atk); near(u.skill.sp, r.source.spData.initSp);
    assert.equal(c.record.index, skill - 1);
    const a = injured(b, 'char_500_noirc', 5, 6), z = injured(b, 'char_196_sunbr', 6, 5), heals = [], hits = [];
    b.on('calculatedHeal', h => { if (h.source === u) heals.push(h); });
    b.on('damaged', h => { if (h.source === u) hits.push({ ...h, atk: u.s.atk }); });
    if (skill === 1) {
      until(b, () => heals.length > 0);
      near(heals[0].amount, u.base.atk * r.bb.heal_scale); assert.equal(u.skill.active, false);
      assert.equal(u.s.flags.noSp, true);
    } else {
      until(b, () => u.skill.ready); assert.equal(b.activateOperator(ID), true);
      until(b, () => heals.length > 0);
      near(heals[0].amount, u.base.atk * (1 + r.bb.atk));
      if (skill === 2) {
        assert.equal(heals.length, 2); assert.deepEqual(new Set(heals.map(h => h.target)), new Set([a, z]));
        near(u.s.interval, (r.stats.baseAttackTime + r.bb.base_attack_time) * 100 / u.s.aspd);
        assert.equal(u.s.aspd, r.stats.attackSpeed + r.seasons.attack_speed); assert.equal(u.s.blockCnt, 4);
      } else {
        const e = enemy(b);
        until(b, () => hits.length > 0);
        near(hits[0].amount, hits[0].atk); assert.equal(hits[0].dmg.isSkill, true);
        assert.ok(c.skills.marks.has(e)); assert.equal(c.skills.inside.size, 1);
      }
      until(b, () => !u.skill.active); assert.equal(c.skills.marks.size, 0); assert.equal(c.skills.aura.size, 0);
    }
    assert.ok(c.tiles.size > 0); b.retreatOperator(ID);
    assert.equal(c.stopped, true); assert.equal(c.handles.length, 0); assert.equal(c.skills.handles.length, 0);
    assert.equal(c.tiles.size, 0); assert.equal(c.skills.marks.size, 0); b._finish('victory');
  });
for (const elite of [0, 1, 2]) test(`public Shu E${elite} trusts the selected promotion, level and potential`, () => {
  const { b, build } = make({ elite, rank: 1, level: 25, potential: 6, trust: 200 });
  const r = selectedShuBuild(build), u = b.deployOperator(ID, 5, 5, 'UP');
  near(u.base.atk, r.stats.atk); near(u.base.maxHp, r.stats.maxHp); near(u.base.def, r.stats.def);
  assert.equal(u.mem.regularVisualDirection, 'UP'); assert.equal(u.mem.regularDeathVisual, undefined);
  near(u.s.atk, u.base.atk); b._finish('victory');
});
for (const facing of ['RIGHT', 'LEFT', 'UP', 'DOWN']) test(`public Shu ${facing} selects its original facing clock and fresh deployment owner`, () => {
  const { b } = make({ skill: 3 });
  const u = b.deployOperator(ID, 5, 5, facing), c = u.mem.shuController;
  advance(b, 1.1); assert.equal(u.mem.regularVisualDirection, ['UP', 'LEFT'].includes(facing) ? 'UP' : 'RIGHT');
  b.retreatOperator(ID); advance(b, u.base.respawnTime * u.s.redeployMul + 1); b.getPlayer('arkpedia').dp = 99;
  const next = b.deployOperator(ID, 5, 5, facing);
  assert.notEqual(next, u); assert.notEqual(next.mem.shuController, c);
  assert.equal(c.stopped, true); assert.equal(next.mem.shuController.tiles.size, 0);
  b._finish('victory');
});
test('public Shu teleport observes displacement, restores its first tile and clears on skill end', () => {
  const { b } = make({ skill: 3 }), u = b.deployOperator(ID, 5, 5, 'RIGHT');
  injured(b, 'char_500_noirc', 5, 6); until(b, () => u.skill.ready);
  assert.equal(b.activateOperator(ID), true); until(b, () => u.mem.shuController.tiles.size > 0);
  const e = enemy(b), events = []; b.on('shuTeleport', event => events.push(event));
  advance(b, b.dt); assert.ok(u.mem.shuController.skills.marks.has(e));
  b.displace(e, { x: 1, y: 0 }, 2.2);
  assert.equal(events.length, 1); near(e.x, 6); near(e.y, 5);
  u.skill.end('manual'); assert.equal(u.mem.shuController.skills.marks.size, 0);
  b._finish('victory');
});
test('public Shu maxed support selects native values and rejects controlled activation', () => {
  const { b, build } = make({ skill: 3, potential: 6, trust: 200, support: true });
  const u = b.deployOperator(ID, 5, 5, 'RIGHT'), r = selectedShuBuild(build);
  assert.equal(build.elite, 2); assert.equal(build.level, 90); near(u.base.atk, r.stats.atk);
  until(b, () => u.skill.ready); b.applyStatus(u, 'stun', { duration: .5 });
  assert.equal(b.activateOperator(ID), false); advance(b, .6);
  b.addBuff(u, { key: 'qa:silence', flags: { silence: true } });
  assert.equal(b.activateOperator(ID), true); b._finish('victory');
});

test('public four-Sui squad talent starts before Shu deployment and keeps recipient SP clocks through retreat', () => {
  const { b } = make({ skill: 3, squad: ['char_2014_nian', 'char_2015_dusk', 'char_2023_ling'] });
  assert.equal(b.shuSquad.suiCount, 4); assert.equal(b.shuSquad.enabled, true);
  const a = b.deployOperator('char_196_sunbr', 5, 6, 'RIGHT');
  near(a.s.atk, a.base.atk * 1.12); const sp = a.skill.spTotal;
  advance(b, 4 + b.dt); near(a.skill.spTotal, sp + 5 + b.dt);
  const state = b.shuSquad, next = state.entries.get(a).nextSp;
  b.getPlayer('arkpedia').dp = 99; b.deployOperator(ID, 5, 5, 'RIGHT');
  assert.equal(b.shuSquad, state); near(state.entries.get(a).nextSp, next);
  b.retreatOperator(ID); near(a.s.atk, a.base.atk * 1.12);
  b._finish('victory'); assert.equal(state.stopped, true); assert.equal(a.findBuff('shu:seasons:squad'), null);
});

test('public three-Sui squad does not grant the four-member ATK or SP bonus', () => {
  const { b } = make({ skill: 3, squad: ['char_2014_nian', 'char_2015_dusk'] });
  assert.equal(b.shuSquad.suiCount, 3); assert.equal(b.shuSquad.enabled, false);
  const a = b.deployOperator('char_196_sunbr', 5, 6, 'RIGHT'), sp = a.skill.spTotal;
  near(a.s.atk, a.base.atk); advance(b, 4 + b.dt); near(a.skill.spTotal, sp + 4 + b.dt);
  b._finish('victory');
});
