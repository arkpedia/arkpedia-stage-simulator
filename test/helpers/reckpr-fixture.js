// SPDX-License-Identifier: GPL-3.0-or-later
import assert from 'node:assert/strict';
import data from '../../data/arkpedia-mvp.json' with { type: 'json' };
import e from '../../data/arkpedia-native-operators/char_4196_reckpr.json' with { type: 'json' };
import { StandardBattle } from '../../server/sim/arkpedia.js';
import { normalizeChess } from '../../server/sim/simdata.js';
import { defaultBuild } from '../../shared/arkpedia/loadout.js';
import { RECKPR_ID as ID, selectedReckprBuild } from '../../server/sim/content/arkpedia-reckpr-source.js';
import { prepareReckpr, RECKPR_CONTRACT } from '../../server/sim/content/arkpedia-reckpr.js';
export { near, advance, until } from './mon3tr-fixture.js';
export function make({ skill = 1, elite = 2, rank = [4, 7, 10][elite], potential = 1, trust = 0,
  dir = 'RIGHT', defer = false, contract = RECKPR_CONTRACT, mutate } = {}) {
  const d = structuredClone(data); d.stage.geometry.waves[0].spawns = []; d.stage.battle.dp_per_second = 0;
  const b = new StandardBattle(d, { operators: [defaultBuild(d.operators.char_122_beagle)] });
  b.autoFinish = false; b.setViewport('fullscreen-workspace'); b.recordEvents = true;
  b.grid.tiles = b.grid.tiles.map(t => ({ ...t, height: 'LOW', build: 'ALL', pass: 'ALL' }));
  const build = { elite, level: e.tables.character.phases[elite].maxLevel, skillId: `skchr_reckpr_${skill}`,
    skillRank: rank, potential, trust, module: 'none' }, r = selectedReckprBuild(build), c = e.tables.character;
  const def = normalizeChess({ chessId: ID, charId: ID, name: c.appellation, profession: c.profession, position: c.position,
    subProfessionId: c.subProfessionId, stats: r.stats, rangeGrid: r.rangeGrid, tags: r.tags, talents: r.talents,
    skill: { ...r.source, ...r.source.spData, skillId: build.skillId, rangeGrid: r.skillRangeGrid, trigger: { rule: 'NEVER' } }, arkpedia: build });
  mutate?.(def);
  const u = b._makeAlly(b.getPlayer('arkpedia'), def, 'op', 3, 3, { dir });
  const prepared = prepareReckpr(b, u, { contract }); b._setupUnit(u, prepared.kit); prepared.controller.install();
  const shots = [], heals = [], attacks = [];
  const add = b.addProjectile.bind(b); b.addProjectile = p => { if (p.source === u) shots.push({ ...p, time: b.time }); return add(p); };
  b.on('calculatedHeal', ctx => { if (ctx.source === u) heals.push({ ...ctx, time: b.time }); });
  b.on('attack', ctx => { if (ctx.attacker === u) attacks.push({ ...ctx, time: b.time }); });
  if (!defer) assert.ok(b._deploy(u));
  return { b, u, build, ...prepared, shots, heals, attacks };
}
export function ally(f, { row = 3, col = 4, hp = 1000, maxHp = 10000, kind = 'op', flags = {} } = {}) {
  const id = `fixture:${row}:${col}:${f.b.allyUnits.length}`;
  const def = normalizeChess({ chessId: id, name: 'Diagnostic ally', profession: 'DEFENDER', position: 'MELEE',
    stats: { maxHp, atk: 0, def: 0, blockCnt: 1 }, rangeGrid: [[0, 0]] });
  const u = f.b._makeAlly(f.u.player, def, kind, row, col, { dir: 'RIGHT' });
  f.b._setupUnit(u, { talents: [], trait: { noAttack: true }, skill: null }); assert.ok(f.b._deploy(u)); u.hp = hp;
  if (Object.keys(flags).length) f.b.addBuff(u, { key: 'fixture:flags', flags });
  return u;
}
export function damage(f, target, amount = 100) {
  const source = f.b.spawnEnemy('enemy_1007_slime', { pos: [3, 7] });
  f.b.addBuff(source, { key: 'fixture:pin', flags: { noMove: true, disarm: true, unblockable: true } });
  return f.b.dealDamage(source, target, { amount, type: 'true', isAttack: true });
}
export function cast(f) { f.u.skill.setSpTotal(f.u.skill.spCost); assert.equal(f.u.skill.activate(), true); }
