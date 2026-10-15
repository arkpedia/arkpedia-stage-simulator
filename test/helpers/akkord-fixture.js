// SPDX-License-Identifier: GPL-3.0-or-later
import assert from 'node:assert/strict';
import data from '../../data/arkpedia-mvp.json' with { type: 'json' };
import e from '../../data/arkpedia-akkord-prefabs.json' with { type: 'json' };
import { StandardBattle } from '../../server/sim/arkpedia.js';
import { normalizeChess } from '../../server/sim/simdata.js';
import { defaultBuild } from '../../shared/arkpedia/loadout.js';
import { selectedAkkordBuild, AKKORD_ID as ID } from '../../server/sim/content/arkpedia-akkord-source.js';
import { prepareAkkord, AKKORD_CONTRACT as CONTRACT } from '../../server/sim/content/arkpedia-akkord.js';
export { near, advance, until } from './mon3tr-fixture.js';
export function make({ skill = 1, elite = 2, rank = [4, 7, 10][elite], potential = 1, trust = 0,
  dir = 'RIGHT', contract = CONTRACT, mutate } = {}) {
  const d = structuredClone(data); d.stage.geometry.waves[0].spawns = []; d.stage.battle.dp_per_second = 0;
  d.stage.geometry.rows = 19; d.stage.geometry.cols = 21;
  d.stage.geometry.tileGrid = Array.from({ length: 19 }, () => Array(21).fill(2));
  const b = new StandardBattle(d, { operators: [defaultBuild(d.operators.char_289_gyuki)] });
  b.autoFinish = false; b.recordEvents = true; b.setViewport('fullscreen-workspace');
  b.grid.tiles = b.grid.tiles.map(t => ({ ...t, height: 'LOW', build: 'ALL', pass: 'ALL' }));
  const build = { elite, level: e.tables.character.phases[elite].maxLevel, potential, trust,
    skillId: `skchr_akkord_${skill}`, skillRank: rank, module: 'none' };
  const r = selectedAkkordBuild(build), c = e.tables.character;
  const def = normalizeChess({ chessId: ID, charId: ID, name: c.name, profession: c.profession,
    position: c.position, subProfessionId: c.subProfessionId, stats: r.stats, rangeGrid: r.rangeGrid,
    tags: r.tags, talents: r.talents, skill: { ...r.source, ...r.source.spData, skillId: build.skillId,
      rangeGrid: [], trigger: { rule: 'NEVER' } }, arkpedia: build });
  mutate?.(def);
  const u = b._makeAlly(b.getPlayer('arkpedia'), def, 'op', 5, 5, { dir });
  const prepared = prepareAkkord(b, u, { contract });
  b._setupUnit(u, prepared.kit); prepared.controller.install();
  const hits = [], attacks = [];
  b.on('damaged', ctx => { if (ctx.source === u) hits.push({ ...ctx, time: b.time }); });
  b.on('attack', ctx => { if (ctx.attacker === u) attacks.push({ ...ctx, time: b.time }); });
  u.player.dp = 99; assert.ok(b._deploy(u, { initial: false }));
  return { b, u, build, hits, attacks, ...prepared };
}
export function enemy(f, { row = 5, col = 6, hp = 1e7, res = 0, fly = false, flags = {} } = {}) {
  const t = f.b.spawnEnemy('enemy_1007_slime', { pos: [row, col] });
  Object.assign(t.base, { maxHp: hp, atk: 0, def: 99999, res, moveSpeed: 0 });
  t.markDirty(); void t.s; t.hp = hp; if (fly) t.motion = 'FLY';
  f.b.addBuff(t, { key: 'fixture:pin', flags: { noMove: true, disarm: true, unblockable: true, ...flags } });
  f.b._buildEnemyIndex(); return t;
}
export function ally(f, { row = 5, col = 7, profession = 'WARRIOR', flags = {} } = {}) {
  const t = f.b.spawnToken(f.u, 'diagnostic:akkord-ally', row, col, {
    def: { name: 'Diagnostic ally', profession, position: 'MELEE', stats: { maxHp: 10000, atk: 0, def: 0, blockCnt: 0, cost: 0 } },
    kit: { trait: { noAttack: true, noBlock: true }, talents: [], skill: { kind: 'passive' } },
  });
  assert.ok(t);
  f.b.addBuff(t, { key: 'fixture:flags', flags }); return t;
}
