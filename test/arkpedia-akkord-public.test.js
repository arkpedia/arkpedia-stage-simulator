// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import review from '../data/arkpedia-akkord-runtime-review.json' with { type: 'json' };
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild, recordFor } from '../shared/arkpedia/loadout.js';
import { selectedAkkordBuild } from '../server/sim/content/arkpedia-akkord-source.js';
import { skillHud } from '../shared/arkpedia/skill-hud.js';
import { advance, until, near, enemy, ally } from './helpers/akkord-fixture.js';
const ID = 'char_4051_akkord';
function make({ skill = 1, rank = 10, elite = 2, potential = 1, trust = 0, support = false } = {}) {
  const d = structuredClone(data); d.stage.geometry.waves[0].spawns = []; d.stage.battle.dp_per_second = 0;
  const build = { ...defaultBuild(d.operators[ID]), skillId: `skchr_akkord_${skill}`, skillRank: rank,
    elite, level: d.operators[ID].phases[elite].maxLevel, potential, trust };
  const b = new StandardBattle(d, support ? { operators: [defaultBuild(d.operators.char_208_melan)], support: build } : { operators: [build] });
  b.autoFinish = false; b.recordEvents = true; b.setViewport('fullscreen-workspace'); b.getPlayer('arkpedia').dp = 99;
  b.grid.tiles = b.grid.tiles.map(t => ({ ...t, height: 'LOW', build: 'ALL', pass: 'ALL' }));
  const before = b.dp, cost = b.cost(ID), u = b.deployOperator(ID, 3, 3, 'RIGHT'); near(before - b.dp, cost);
  const hits = [], attacks = [];
  b.on('damaged', ctx => { if (ctx.source === u) hits.push({ ...ctx }); });
  b.on('attack', ctx => { if (ctx.attacker === u) attacks.push({ ...ctx }); });
  return { b, u, controller: u.mem.akkord, build: b.bench[ID].build, hits, attacks };
}
test('public Akkord uses original CN tables/name and reviewed assets without silently updating Global records', async () => {
  const op = data.operators[ID]; assert.equal(op.name, 'Akkord'); assert.equal(op.sourceName, '协律');
  assert.equal(op.sourceChannel, 'cn'); assert.equal(data.operatorSourceChannels[ID], 'cn');
  assert.equal(data.sources['Kengxxiao/ArknightsGameData'], 'a550f5e048bb94e7cdefc6eb97a4091f0c4c7add');
  assert.equal(data.sources['Kengxxiao/ArknightsGameData_YoStar'], '57010cb5b2afea112cae57daa756b58676ba6850');
  assert.deepEqual(op.skills.map(s => s.levels[0].name), ['反拍重音', '震爆调谐']);
  assert.deepEqual(op.skills.map(s => s.assetIcon), ['skill-icons/Akkord - Backbeat Stress.webp', 'skill-icons/Akkord - Explosive Tuning.webp']);
  assert.equal(createHash('sha256').update(await readFile(new URL('../data/arkpedia-akkord-prefabs.json', import.meta.url))).digest('hex'), review.sourceFoundationSha256);
  for (const [key, model] of Object.entries(review.originalArtwork)) assert.deepEqual(data.sd.models[key], model);
  assert.equal(review.interfaceAssets.length, 4);
  for (const flag of ['frameParity', 'moduleSupport', 'nativeParticleSupport', 'nativePixelParity']) assert.equal(review[flag], false);
});
for (const skill of [1, 2]) for (let rank = 1; rank <= 10; rank++) test(`public S${skill}/rank ${rank} uses natural time SP and source combat rather than a fallback kit`, () => {
  const f = make({ skill, rank }); enemy(f, { row: 3, col: 4 }); ally(f, { row: 3, col: 5 });
  assert.ok(f.controller); assert.equal(f.controller.record.index, skill - 1); near(f.u.skill.spTotal, f.u.skill.initSp);
  if (skill === 2) { until(f, () => skillHud(f.u.skill).canActivate, 90); assert.equal(f.b.activateOperator(ID), true); }
  const before = f.hits.length;
  until(f, () => skill === 1 ? f.hits.some(h => h.dmg.isSkill) : f.hits.length > before && f.hits.some(h => h.dmg.isSkill), 60);
  assert.ok(f.attacks.length > 0); assert.ok(f.u.skill.activations > 0); assert.deepEqual(f.b.errors, []);
  const slots = f.b.deployedSlots();
  f.b.retreatOperator(ID); assert.equal(f.controller.stopped, true); advance(f.b, 1); assert.equal(f.b.deployedSlots(), slots - 1);
});
for (const elite of [0, 1, 2]) for (const potential of [1, 6]) test(`public E${elite}/P${potential} preserves source stats/trust and support selection`, () => {
  const f = make({ elite, potential, trust: 200, rank: [4, 7, 10][elite], support: potential === 6 });
  const r = selectedAkkordBuild(f.build); assert.deepEqual(recordFor(f.build, data).stats, r.stats);
  near(f.u.s.atk, r.stats.atk); assert.deepEqual(f.u.def.tags, r.tags); assert.deepEqual(f.controller.record.talentBb, r.talentBb);
});
for (const skill of [1, 2]) test(`public S${skill} preserves original stage 0-1 waves, terrain, natural DP and end cleanup`, () => {
  const build = { ...defaultBuild(data.operators[ID]), skillId: `skchr_akkord_${skill}` };
  const b = new StandardBattle(data, { operators: [build] }); b.setViewport('fullscreen-workspace');
  const tiles = structuredClone(b.grid.tiles); let deployed = false;
  for (let n = 0; n < 9001 && !b.finished; n++) {
    if (!deployed && b.dp >= b.cost(ID)) { b.deployOperator(ID, 4, 6, 'DOWN'); deployed = true; }
    const u = b.bench[ID].unit; if (skill === 2 && u?.alive && skillHud(u.skill).canActivate) b.activateOperator(ID);
    b.step();
  }
  const result = b.result(); assert.equal(result.reason, 'cleared'); assert.equal(result.total, 11);
  const leaked = result.perPlayer.arkpedia.leaked.filter(x => x.counted).length;
  assert.equal(result.killed + leaked, 11); assert.equal(b.life, data.stage.battle.max_life - leaked);
  assert.deepEqual(b.grid.tiles, tiles); assert.deepEqual(b.errors, []); assert.equal(b.bench[ID].unit.mem.akkord.stopped, true);
});
