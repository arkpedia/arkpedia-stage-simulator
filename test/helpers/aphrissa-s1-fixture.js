// SPDX-License-Identifier: GPL-3.0-or-later
import assert from 'node:assert/strict';
import data from '../../data/arkpedia-mvp.json' with {type: 'json'};
import evidence from '../../data/arkpedia-native-operators/char_4229_aphris.json' with {type: 'json'};
import {StandardBattle} from '../../server/sim/arkpedia.js';
import {normalizeChess} from '../../server/sim/simdata.js';
import {defaultBuild} from '../../shared/arkpedia/loadout.js';
import {APHRISSA_ID as ID, selectedAphrissaBuild} from '../../server/sim/content/arkpedia-aphrissa-source.js';
import {prepareAphrissaS1, APHRISSA_S1_CONTRACT} from '../../server/sim/content/arkpedia-aphrissa-s1.js';
export {near, advance} from './mon3tr-fixture.js';
import {advance} from './mon3tr-fixture.js';

export function make({elite = 2, potential = 1, trust = 0, rank = [4, 7, 10][elite],
  dir = 'RIGHT', defer = false, contract = APHRISSA_S1_CONTRACT, mutate} = {}) {
  const d = structuredClone(data);
  d.stage.geometry.waves[0].spawns = []; d.stage.battle.dp_per_second = 0;
  d.stage.geometry.rows = 19; d.stage.geometry.cols = 21;
  d.stage.geometry.tileGrid = Array.from({length: 19}, () => Array(21).fill(2));
  const b = new StandardBattle(d, {operators: [defaultBuild(d.operators.char_122_beagle)]});
  b.autoFinish = false; b.recordEvents = true; b.setViewport('fullscreen-workspace');
  b.grid.tiles = b.grid.tiles.map(t => ({...t, height: 'LOW', build: 'ALL', pass: 'ALL'}));
  const c = evidence.tables.character, build = {elite, potential, trust, level: c.phases[elite].maxLevel,
    skillId: 'skchr_aphris_1', skillRank: rank, module: 'none'};
  const selected = selectedAphrissaBuild(build);
  const def = normalizeChess({chessId: ID, charId: ID, name: c.appellation, profession: c.profession,
    position: c.position, stats: selected.stats, rangeGrid: selected.rangeGrid, tags: selected.tags, talents: selected.talents,
    skill: {...selected.source, ...selected.source.spData, skillId: build.skillId, rangeGrid: selected.skillRangeGrid}, arkpedia: build});
  mutate?.(def);
  const u = b._makeAlly(b.getPlayer('arkpedia'), def, 'op', 5, 5, {dir});
  const prepared = prepareAphrissaS1(b, u, {contract});
  b._setupUnit(u, prepared.kit); prepared.controller.install();
  const hits = [], receipts = [], starts = [], ends = [];
  b.on('damaged', event => { if (event.source === u) hits.push({id: event.target.id, at: b.time,
    amount: event.amount, attackId: event.dmg.attackId, isSkill: event.dmg.isSkill}); });
  b.on('attack', event => { if (event.attacker === u) receipts.push({at: b.time,
    ids: event.targets.map(t => t.id), isSkill: event.isSkill}); });
  b.on('skillStart', event => { if (event.unit === u) starts.push({at: b.time, activation: event.activation}); });
  b.on('skillEnd', event => { if (event.unit === u) ends.push({at: b.time, activation: event.activation}); });
  const deploy = () => { u.player.dp = 99; assert.ok(b._deploy(u, {initial: false})); };
  if (!defer) deploy();
  return {b, u, build, selected, ...prepared, deploy, hits, receipts, starts, ends};
}
export function until(f, predicate, seconds = 5) {
  const end = f.b.time + seconds;
  while (!predicate() && f.b.time < end) advance(f.b, f.b.dt);
  assert.ok(predicate(), 'Expected controlled Aphrissa S1 phase');
}
export function ready(f) { f.u.skill.setSpTotal(f.u.skill.spCost); until(f, () => f.controller.mode === 's1'); }
export function enemy(f, {row = 5, col = 6, res = 0, fly = false, hp = 100000} = {}) {
  const t = f.b.spawnEnemy('enemy_1007_slime', {pos: [row, col]});
  Object.assign(t.base, {maxHp: hp, res, def: 9999, moveSpeed: 0}); t.markDirty(); void t.s; t.hp = hp;
  if (fly) t.motion = 'FLY';
  f.b.addBuff(t, {key: 'fixture:pin', flags: {noMove: true, disarm: true}}); f.b._buildEnemyIndex(); return t;
}
