// SPDX-License-Identifier: GPL-3.0-or-later
import assert from 'node:assert/strict';
import data from '../../data/arkpedia-mvp.json' with { type: 'json' };
import e from '../../data/arkpedia-native-operators/char_4208_wintim.json' with { type: 'json' };
import { StandardBattle } from '../../server/sim/arkpedia.js';
import { normalizeChess } from '../../server/sim/simdata.js';
import { defaultBuild } from '../../shared/arkpedia/loadout.js';
import { selectedWintimBuild, WINTIM_ID as ID } from '../../server/sim/content/arkpedia-wintim-source.js';
import { prepareWintim, WINTIM_CONTRACT as CONTRACT } from '../../server/sim/content/arkpedia-wintim.js';
export { near, advance, until } from './mon3tr-fixture.js';
export function addOwner(b, build, { row = 5, col = 5, dir = 'RIGHT', contract = CONTRACT, mutate } = {}) {
  const r = selectedWintimBuild(build), c = e.tables.character;
  const def = normalizeChess({ chessId: ID, charId: ID, name: c.name, profession: c.profession,
    position: c.position, subProfessionId: c.subProfessionId, stats: r.stats, rangeGrid: r.rangeGrid,
    tags: r.tags, talents: r.talents, skill: { ...r.source, ...r.source.spData, skillId: build.skillId,
      rangeGrid: r.skillRangeGrid, trigger: { rule: 'NEVER' } }, arkpedia: build });
  mutate?.(def);
  const u = b._makeAlly(b.getPlayer('arkpedia'), def, 'op', row, col, { dir });
  const p = prepareWintim(b, u, { contract }); b._setupUnit(u, p.kit); p.controller.install();
  return { u, ...p };
}
export function make({ skill = 1, elite = 2, rank = [4, 7, 10][elite], potential = 1, trust = 0,
  dir = 'RIGHT', contract = CONTRACT, mutate } = {}) {
  const d = structuredClone(data); d.stage.geometry.waves[0].spawns = []; d.stage.battle.dp_per_second = 0;
  d.stage.geometry.rows = 19; d.stage.geometry.cols = 21;
  d.stage.geometry.tileGrid = Array.from({ length: 19 }, () => Array(21).fill(2));
  const b = new StandardBattle(d, { operators: [defaultBuild(d.operators.char_289_gyuki)] });
  b.autoFinish = false; b.recordEvents = true; b.setViewport('fullscreen-workspace');
  b.grid.tiles = b.grid.tiles.map(t => ({ ...t, height: 'LOW', build: 'ALL', pass: 'ALL' }));
  const build = { elite, level: e.tables.character.phases[elite].maxLevel, potential, trust,
    skillId: `skchr_wintim_${skill}`, skillRank: rank, module: 'none' };
  const p = addOwner(b, build, { dir, contract, mutate }), { u } = p;
  const hits = [], attacks = [], grants = [];
  b.on('damaged', ctx => { if (ctx.source === u) hits.push({ ...ctx, time: b.time }); });
  b.on('attack', ctx => { if (ctx.attacker === u) attacks.push({ ...ctx, time: b.time }); });
  const add = b.addDp.bind(b); b.addDp = (id, value) => { if (id === u.ownerId) grants.push({ time: b.time, value }); return add(id, value); };
  u.player.dp = 99; assert.ok(b._deploy(u, { initial: false })); u.player.dp = 0;
  return { b, u, build, hits, attacks, grants, ...p };
}
export function enemy(f, { row = 5, col = 6, hp = 1e7, def = 0, fly = false, flags = {} } = {}) {
  const t = f.b.spawnEnemy('enemy_1007_slime', { pos: [row, col] });
  Object.assign(t.base, { maxHp: hp, atk: 0, def, res: 0, moveSpeed: 1 });
  t.markDirty(); void t.s; t.hp = hp; if (fly) t.motion = 'FLY';
  f.b.addBuff(t, { key: 'fixture:pin', flags: { noMove: true, disarm: true, unblockable: true, ...flags } });
  f.b._buildEnemyIndex(); return t;
}
export function blocked(f, t) {
  f.b.removeBuff(t, 'fixture:pin'); f.b.addBuff(t, { key: 'fixture:block', flags: { noMove: true, disarm: true } });
  t.x = f.u.x; t.y = f.u.y; t.blockedBy = f.u; f.u.blocking.push(t); f.b._buildEnemyIndex();
}
export const charge = f => f.u.skill.setSpTotal(f.u.skill.spCost);
export const cast = f => { charge(f); assert.ok(f.u.skill.activate()); };
