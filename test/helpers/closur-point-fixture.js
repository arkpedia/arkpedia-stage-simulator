// SPDX-License-Identifier: GPL-3.0-or-later
import assert from 'node:assert/strict';
import data from '../../data/arkpedia-mvp.json' with { type: 'json' };
import e from '../../data/arkpedia-native-operators/char_4228_closur.json' with { type: 'json' };
import { StandardBattle } from '../../server/sim/arkpedia.js';
import { normalizeChess } from '../../server/sim/simdata.js';
import { defaultBuild } from '../../shared/arkpedia/loadout.js';
import { CLOSUR_ID as ID, selectedClosurBuild } from '../../server/sim/content/arkpedia-closur-source.js';
import { prepareClosurPoint, CLOSUR_POINT_CONTRACT as CONTRACT } from '../../server/sim/content/arkpedia-closur-point.js';
export { near, advance, until } from './mon3tr-fixture.js';
export function addOwner(b, build, { row = 5, col = 5, dir = 'RIGHT', contract = CONTRACT, mutate } = {}) {
  const r = selectedClosurBuild(build), c = e.tables.character;
  const def = normalizeChess({ chessId: ID, charId: ID, name: c.name, profession: c.profession, position: c.position,
    subProfessionId: c.subProfessionId, stats: r.stats, rangeGrid: r.rangeGrid, tags: r.tags, talents: r.talents,
    skill: { ...r.source, ...r.source.spData, skillId: build.skillId, rangeGrid: r.skillRangeGrid, trigger: { rule: 'NEVER' } }, arkpedia: build });
  mutate?.(def);
  const u = b._makeAlly(b.getPlayer('arkpedia'), def, 'op', row, col, { dir });
  const prepared = prepareClosurPoint(b, u, { contract });
  // This fixture intentionally supplies no owner combat or source-skill actions.
  b._setupUnit(u, { talents: [], trait: { noAttack: true, install: null }, skill: { kind: 'passive', trigger: { rule: 'NEVER' } } });
  prepared.controller.install(); return { u, ...prepared };
}
export function make({ skill = 2, elite = 2, level = [50, 80, 90][elite], rank = [4, 7, 10][elite],
  potential = 1, trust = 0, dir = 'RIGHT', defer = false, contract = CONTRACT, mutate } = {}) {
  const d = structuredClone(data); d.stage.geometry.waves[0].spawns = []; d.stage.battle.dp_per_second = 0;
  d.stage.geometry.rows = 19; d.stage.geometry.cols = 21;
  d.stage.geometry.tileGrid = Array.from({ length: 19 }, () => Array(21).fill(2));
  const b = new StandardBattle(d, { operators: [defaultBuild(d.operators.char_289_gyuki)] });
  b.autoFinish = false; b.recordEvents = true; b.setViewport('fullscreen-workspace');
  b.grid.tiles = b.grid.tiles.map(t => ({ ...t, height: 'LOW', build: 'ALL', pass: 'ALL' }));
  const build = { elite, level, skillRank: rank, potential, trust, skillId: `skchr_closur_${skill}`, module: 'none' };
  const p = addOwner(b, build, { dir, contract, mutate });
  if (!defer) assert.ok(b._deploy(p.u)); return { b, build, ...p };
}
export function ally(f, { row = 5, col = 7, kind = 'op', flags = {}, hp = 1000 } = {}) {
  const def = normalizeChess({ chessId: `fixture:${row}:${col}:${f.b.allyUnits.length}`, name: 'Diagnostic ally', profession: 'DEFENDER',
    position: 'MELEE', stats: { maxHp: hp, atk: 0, def: 0, blockCnt: 1 }, rangeGrid: [[0, 0], [0, 1]], tags: [] });
  const u = f.b._makeAlly(f.u.player, def, kind, row, col, { dir: 'RIGHT' });
  f.b._setupUnit(u, { talents: [], trait: { noAttack: true }, skill: null });
  assert.ok(f.b._deploy(u)); f.b.addBuff(u, { key: 'fixture:flags', flags }); return u;
}
export function attacker(f) {
  const t = f.b.spawnEnemy('enemy_1007_slime', { pos: [7, 6] });
  f.b.addBuff(t, { key: 'fixture:pin', flags: { noMove: true, disarm: true } }); return t;
}
