// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import review from '../data/arkpedia-jcinta-runtime-review.json' with { type: 'json' };
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild, recordFor } from '../shared/arkpedia/loadout.js';
import { selectedJcintaBuild } from '../server/sim/content/arkpedia-jcinta-source.js';
import { skillHud } from '../shared/arkpedia/skill-hud.js';
import { advance, until, near, enemy } from './helpers/jcinta-fixture.js';
const ID = 'char_4237_jcinta';
function make({ skill = 1, rank = 10, elite = 2, potential = 1, trust = 0, support = false } = {}) {
  const d = structuredClone(data); d.stage.geometry.waves[0].spawns = []; d.stage.battle.dp_per_second = 0;
  const build = { ...defaultBuild(d.operators[ID]), skillId: skill === 1 ? 'skcom_assist_cost[3]' : 'skchr_jcinta_2', skillRank: rank,
    elite, level: d.operators[ID].phases[elite].maxLevel, potential, trust };
  const b = new StandardBattle(d, support ? { operators: [defaultBuild(d.operators.char_208_melan)], support: build } : { operators: [build] });
  b.autoFinish = false; b.recordEvents = true; b.setViewport('fullscreen-workspace'); b.getPlayer('arkpedia').dp = 99;
  b.grid.tiles = b.grid.tiles.map(t => ({ ...t, height: 'LOW', build: 'ALL', pass: 'ALL' }));
  const before = b.dp, cost = b.cost(ID), u = b.deployOperator(ID, 3, 3, 'RIGHT'); near(before - b.dp, cost);
  b.getPlayer('arkpedia').dp = 0;
  const hits = [], attacks = [];
  b.on('damaged', ctx => { if (ctx.source === u) hits.push({ ...ctx }); });
  b.on('attack', ctx => { if (ctx.attacker === u) attacks.push({ ...ctx }); });
  return { b, u, controller: u.mem.jcinta, build: b.bench[ID].build, hits, attacks };
}
test('public Jacinta binds original CN source, explicit override, reviewed artwork and selected skill text', async () => {
  const op = data.operators[ID]; assert.equal(op.name, 'Jacinta'); assert.equal(op.sourceName, '嘉辛塔');
  assert.equal(op.sourceChannel, 'cn'); assert.equal(data.operatorSourceChannels[ID], 'cn');
  assert.equal(data.sources['Kengxxiao/ArknightsGameData_YoStar'], '57010cb5b2afea112cae57daa756b58676ba6850');
  assert.deepEqual(op.skills.map(s => s.levels[0].name), ['支援号令·γ型', '伞下乘荫']);
  assert.deepEqual(op.skills.map(s => s.assetIcon), ['skill-icons/Jacinta - Support γ.webp', "skill-icons/Jacinta - Parasol's Shade.webp"]);
  assert.equal(createHash('sha256').update(await readFile(new URL('../data/arkpedia-native-operators/char_4237_jcinta.json', import.meta.url))).digest('hex'), review.sourceFoundationSha256);
  for (const [key, model] of Object.entries(review.originalArtwork)) assert.deepEqual(data.sd.models[key], model);
  assert.equal(review.interfaceAssets.length, 4);
  for (const flag of ['frameParity', 'moduleSupport', 'nativeParticleSupport', 'nativePixelParity']) assert.equal(review[flag], false);
});
for (const skill of [1, 2]) for (let rank = 1; rank <= 10; rank++) test(`public S${skill}/rank ${rank} naturally charges, channels its exact DP and restores block count`, () => {
  const f = make({ skill, rank }), initial = f.u.skill.initSp;
  assert.ok(f.controller); near(f.u.skill.spTotal, initial); until(f, () => skillHud(f.u.skill).canActivate, 90);
  assert.equal(f.b.activateOperator(ID), true); const start = f.b.time; near(f.u.s.blockCnt, 0);
  until(f, () => !f.u.skill.active, 35); near(f.b.time - start, skill === 1 ? 8 : 30, f.b.dt);
  near(f.b.dp, skill === 1 ? 18 : 27); near(f.u.s.blockCnt, 1); assert.equal(f.attacks.length, 0);
  const before = f.b.time, dp = f.b.dp, refund = Math.floor(f.controller.record.stats.cost / 2);
  f.b.retreatOperator(ID); assert.equal(f.controller.stopped, true); near(f.b.dp, dp + refund);
  near(f.b.bench[ID].readyAt - before, f.controller.record.stats.respawnTime);
  advance(f.b, 1); assert.equal(f.b.deployedSlots(), 0); assert.deepEqual(f.b.errors, []);
});
for (const elite of [0, 1, 2]) for (const potential of [1, 6]) test(`public E${elite}/P${potential} keeps source stats, trust, potential and support selection`, () => {
  const f = make({ elite, potential, trust: 200, rank: [4, 7, 10][elite], support: potential === 6 }), r = selectedJcintaBuild(f.build);
  assert.deepEqual(recordFor(f.build, data).stats, r.stats); near(f.u.s.maxHp, r.stats.maxHp); near(f.u.s.atk, r.stats.atk);
  assert.deepEqual(f.u.def.tags, r.tags); assert.deepEqual(f.controller.record.talentBb, r.talentBb);
});
test('public retreat and redeployment install a fresh controller and recover source cooldown/initial SP', () => {
  const f = make({ skill: 2, potential: 6 }); until(f, () => skillHud(f.u.skill).canActivate, 90); f.b.activateOperator(ID);
  const before = f.b.time; f.b.retreatOperator(ID); near(f.b.bench[ID].readyAt - before, f.controller.record.stats.respawnTime);
  until(f, () => f.b.bench[ID].readyAt <= f.b.time, 80); f.b.getPlayer('arkpedia').dp = 99;
  const next = f.b.deployOperator(ID, 3, 3, 'RIGHT'); assert.notEqual(next.mem.jcinta, f.controller);
  near(next.skill.spTotal, next.skill.initSp); assert.equal(next.skill.active, false); near(next.s.blockCnt, 1);
});
for (const skill of [1, 2]) test(`public S${skill} retains original 0-1 waves, natural DP, terrain and completion`, () => {
  const build = { ...defaultBuild(data.operators[ID]), skillId: skill === 1 ? 'skcom_assist_cost[3]' : 'skchr_jcinta_2' };
  const b = new StandardBattle(data, { operators: [build] }); b.setViewport('fullscreen-workspace');
  const tiles = structuredClone(b.grid.tiles); let deployed = false;
  for (let n = 0; n < 9001 && !b.finished; n++) {
    if (!deployed && b.dp >= b.cost(ID)) { b.deployOperator(ID, 3, 6, 'LEFT'); deployed = true; }
    const u = b.bench[ID].unit; if (u?.alive && skillHud(u.skill).canActivate) b.activateOperator(ID); b.step();
  }
  const result = b.result(); assert.equal(result.reason, 'cleared'); assert.equal(result.total, 11);
  const leaked = result.perPlayer.arkpedia.leaked.filter(x => x.counted).length;
  assert.equal(result.killed + leaked, 11); assert.equal(b.life, data.stage.battle.max_life - leaked);
  assert.deepEqual(b.grid.tiles, tiles); assert.deepEqual(b.errors, []); assert.equal(b.bench[ID].unit.mem.jcinta.stopped, true);
});
