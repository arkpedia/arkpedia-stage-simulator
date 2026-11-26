// SPDX-License-Identifier: GPL-3.0-or-later
// 14-10: Charles Lynch (shared/arkpedia/stage-charles-lynch.js, server/sim/content/arkpedia-stage-charles-lynch.js), Light of
// Glory's storm talent, the deck-card rune, successor actors (`#2`) and WITHDRAW_PREDEFINED.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import mvp from '../data/arkpedia-mvp.json' with { type: 'json' };
import deviceNative from '../data/arkpedia-device-native-source.json' with { type: 'json' };
import deviceTables from '../data/arkpedia-device-source.json' with { type: 'json' };
import { charlesLynchNativeReviewed } from '../shared/arkpedia/stage-charles-lynch.js';
import { lightOfGloryNativeReviewed } from '../shared/arkpedia/stage-light-of-glory.js';
import { createStageLibraryLoader } from '../shared/arkpedia/stage-library.js';
import { StandardBattle } from '../server/sim/arkpedia.js';

const manifest = JSON.parse(await readFile(new URL('../data/arkpedia-library.json', import.meta.url)));
const loader = createStageLibraryLoader(async url => new Response(await readFile(new URL(`..${url}`, import.meta.url))));
const load = id => { const entry = manifest.stages.find(s => s.id === id); assert.equal(entry?.availability, 'available', id); return loader.load(entry); };
const clone = v => JSON.parse(JSON.stringify(v));
const until = (b, pred, limit) => { while (!b.finished && b.time < limit && !pred()) b.step(); return pred(); };
const battle = stage => {
  const b = new StandardBattle({ ...mvp, stage, enemies: { ...mvp.enemies, ...stage.enemies } }, { operators: [] }, { seed: 1 });
  b.life = 999; return b;
};
/** The real stage with every wave enemy removed as it appears (the wave clock and its actions stay as compiled). */
const quiet = async () => {
  const b = battle(await load('14-10'));
  b.autoFinish = false; // the storm does not hold the battle open
  b.on('enemySpawn', ({ enemy }) => { if (!enemy.mem.test) b.after(0, () => enemy.alive && !enemy.mem.test && b._remove(enemy, 'withdraw', null, true)); });
  b.step();
  return b;
};

test('Charles Lynch and the storm talent are reviewed; changes are refused', () => {
  assert.equal(charlesLynchNativeReviewed(), true);
  const t = clone(deviceTables);
  t.skills.sktok_lrsteam.levels[0].blackboard[0].value = 3;
  assert.equal(charlesLynchNativeReviewed(deviceNative, t), false, 'a stronger shell');
  const n = clone(deviceNative);
  n.prefabs.sktok_lrsteam.components.find(c => c.data.m_Size).data.m_Size = { x: 5, y: 5 };
  assert.equal(charlesLynchNativeReviewed(n), false, 'a wider area');
  const n2 = clone(deviceNative);
  n2.prefabs.sktok_lrsteam.components.find(c => c.data._projectileKey).data._additionalTimes = 4;
  assert.equal(charlesLynchNativeReviewed(n2), false, 'more volleys');
  assert.equal(lightOfGloryNativeReviewed(), true);
  const t2 = clone(deviceTables);
  t2.devices.trap_164_lrsiege.talents[0].candidates[0].blackboard.find(x => x.key === 'predelay').value = 1;
  assert.equal(lightOfGloryNativeReviewed(deviceNative, t2), false, 'an earlier storm shrink');
});

test('14-10 compiles a fixed squad of deck-card actors, five successors and one scripted withdrawal', async () => {
  const stage = await load('14-10'), pre = stage.waveProgram.predefined;
  assert.equal(pre.squadMode, 'fixed');
  assert.ok(pre.entries.every(e => e.kind === 'actor' && e.deckCard === true));
  const successors = Object.fromEntries(pre.entries.filter(e => e.successorOf).map(e => [e.key, e.successorOf]));
  assert.deepEqual(successors, { 'char_112_siege#2': 'char_112_siege#1', 'char_154_morgan#2': 'char_154_morgan#1',
    'char_157_dagda#2': 'char_157_dagda#1', 'char_155_tiger#2': 'char_155_tiger#1', 'char_222_bpipe#2': 'char_222_bpipe#1' });
  assert.equal(pre.entries.some(e => e.key === 'char_112_siege#3'), false, 'never activated: left out');
  const bp = k => pre.entries.find(e => e.key === k).build;
  assert.deepEqual([bp('char_222_bpipe#1').level, bp('char_222_bpipe#2').level], [30, 80]);
  assert.deepEqual([bp('char_154_morgan#1').skillRank, bp('char_154_morgan#2').skillRank], [7, 10]);
  const acts = stage.waveProgram.waves.flatMap(w => w.fragments.flatMap(f => f.activations ?? []));
  assert.deepEqual(acts.filter(a => a.withdraw).map(a => a.key), ['char_112_siege#1']);
  assert.ok(acts.some(a => a.key === 'trap_158_lrsteam#1') && acts.some(a => a.key === 'trap_164_lrsiege#1'));
});

test('a successor replaces a living predecessor on its own tile with its own build; the scripted withdrawal retreats Siege', async () => {
  const b = await quiet(), card = b.bench.char_154_morgan, first = card.unit;
  assert.ok(first?.alive);
  assert.equal(first.def.skill?.level ?? card.build.skillRank, 7);
  b.activateStagePredefined('char_154_morgan#2');
  assert.equal(first.alive, false);
  assert.ok(card.unit !== first && card.unit.alive);
  assert.deepEqual([card.unit.tileR, card.unit.tileC], [3, 4]);
  assert.equal(card.build.skillRank, 10);
  const dp = b.dp;
  b.withdrawStagePredefined('char_112_siege#1');
  assert.equal(b.bench.char_112_siege.unit.alive, false, 'withdrawn');
  assert.equal(b.dp, dp, 'no refund');
  b.activateStagePredefined('char_112_siege#2');
  assert.deepEqual([b.bench.char_112_siege.unit.tileR, b.bench.char_112_siege.unit.tileC], [5, 8]);
});

test('deck cards: a knocked-out preset operator can be redeployed for DP once its redeploy time has passed', async () => {
  const b = await quiet(); b.setViewport('fullscreen-workspace'); b.autoFinish = false;
  const card = b.bench.char_157_dagda;
  b.kill(card.unit);
  assert.ok(Number.isFinite(card.readyAt) && card.readyAt > b.time);
  assert.throws(() => b.deployOperator('char_157_dagda', 4, 3, 'LEFT'), /redeploying/);
  until(b, () => b.time >= card.readyAt, card.readyAt + 1);
  b.getPlayer('arkpedia').dp = 99;
  const u = b.deployOperator('char_157_dagda', 4, 3, 'LEFT');
  assert.ok(u.alive);
  assert.ok(b.dp < 99, 'it costs DP');
});

test('Charles Lynch: deployed by its wave action, casts 4 s later, three volleys at up to five enemies in the 3x3 two tiles ahead', async () => {
  const b = await quiet(), C = b.stageCharlesLynch;
  // Originium pollution lowers his SP recovery like any unit's (0.2/s on a polluted tile); in the stage the storm has
  // eaten the tiles around him by then. Clear them here to time the charge.
  b.mvpStagePollution.clear();
  assert.ok(until(b, () => C.units.length > 0, 120));
  const u = C.units[0], m = u.mem.charlesLynch, t0 = b.time;
  assert.deepEqual([u.tileR, u.tileC], [4, 7]);
  assert.ok(u.def.immune.has('stun') && u.def.immune.has('silence') && u.def.immune.has('frozen'));
  // Facing LEFT from (4,7): the box is rows 3-5, cols 4-6. Seven enemies inside, one outside.
  const tiles = [[3, 4], [3, 5], [3, 6], [4, 4], [4, 5], [5, 5], [5, 6]];
  const foes = tiles.map(([r, c]) => { const e = b.spawnEnemy('enemy_1422_lrsldr', { pos: [r, c] }); e.mem.test = true;
    b.addBuff(e, { key: 'test:hold', persist: true, flags: { noMove: true, disarm: true } }); return e; });
  const out = b.spawnEnemy('enemy_1422_lrsldr', { pos: [4, 2] }); out.mem.test = true;
  b.addBuff(out, { key: 'test:hold', persist: true, flags: { noMove: true, disarm: true } });
  for (const e of [...foes, out]) e.hp = e.s.maxHp = 1e9;
  const hits = [];
  b.on('hit', ctx => { if (ctx.source === u && ctx.dmg?.tags?.includes('charlesLynch:shell')) hits.push([b.time, ctx.target]); });
  assert.ok(until(b, () => m.casts === 1, t0 + 6));
  const cast = b.time;
  assert.ok(Math.abs(cast - t0 - 4) < .1, `cast ${cast - t0}`);
  assert.ok(until(b, () => m.volleys === 3 && b.time > cast + 2.83 + .6 + .35, cast + 6));
  assert.equal(hits.length, 15, 'three volleys of five');
  assert.equal(hits.some(([, e]) => e === out), false);
  const times = [...new Set(hits.map(([t]) => Math.round((t - cast) * 10) / 10))];
  assert.deepEqual(times, [3.1, 3.4, 3.7].map(x => Math.round(x * 10) / 10));
});

test('Light of Glory: 7 s after it switches on, the Active Originium Storm shrinks every 0.03 s and dies at radius 0.5', async () => {
  const b = await quiet(), L = b.stageLightOfGlory, a = [...L.entries.values()][0];
  const storm = b.spawnEnemy('enemy_1420_lrmm', { pos: [2, 9] }); storm.mem.test = true;
  b.step();
  storm.mem.storm.r = storm.mem.storm.targetR = 3;
  assert.ok(until(b, () => a.active, 200));
  const t0 = a.activatedAt;
  assert.ok(until(b, () => !!storm.findBuff('trap_lrsiege[eliminate_storm][core]'), t0 + 8));
  assert.ok(Math.abs(b.time - t0 - 7) < .15, `${b.time - t0}`);
  const r0 = storm.mem.storm.r;
  // The reviewed shrink: steps -0.0102, -0.012, -0.012, ...; it dies once radius - 0.0082 < 0.5.
  let r = r0, step = -.0082, n = 0;
  while (true) { step = Math.max(step - .002, -.012); if (r - .0082 < .5) break; r += step; n++; }
  const dies = b.time + (n + 1) * .03;
  assert.ok(until(b, () => !storm.alive, dies + .5));
  assert.ok(Math.abs(b.time - dies) < .1, `${b.time} vs ${dies}`);
});

test('headless 14-10 on the real clock: group ① falls, the successors take over, the storm vanishes and the stage clears', async () => {
  const b = battle(await load('14-10'));
  const deployed = [];
  b.on('deploy', ({ unit }) => { if (unit.side === 'ally' && unit.kind === 'op') deployed.push([b.time, unit.defId, unit.tileR, unit.tileC]); });
  while (!b.finished && b.time < 400) b.step();
  assert.equal(b.reason, 'cleared');
  const later = deployed.filter(([t]) => t > 1).map(([, id, r, c]) => `${id}@${r},${c}`);
  for (const x of ['char_112_siege@5,8', 'char_157_dagda@4,6', 'char_155_tiger@5,4', 'char_154_morgan@3,4', 'char_222_bpipe@4,5'])
    assert.ok(later.includes(x), x);
  assert.equal(b.enemies.some(e => e.alive && e.mem.storm), false);
  assert.ok(b.stageCharlesLynch.units[0].mem.charlesLynch.volleys >= 3);
});
