// SPDX-License-Identifier: GPL-3.0-or-later
import assert from 'node:assert/strict';
import { make as fixture } from './closur-point-fixture.js';
import { prepareClosurCombat, CLOSUR_COMBAT_CONTRACT as CONTRACT } from '../../server/sim/content/arkpedia-closur-combat.js';
import { normalizeChess } from '../../server/sim/simdata.js';
export { near, advance, until } from './mon3tr-fixture.js';
export function make(options = {}) {
  const f = fixture({ ...options, prepare: prepareClosurCombat, contract: options.contract ?? CONTRACT });
  const shots = [], hits = [], attacks = [], grants = [];
  const add = f.b.addProjectile.bind(f.b); f.b.addProjectile = p => {
    if (p.source === f.u) shots.push({ time: f.b.time, ...p }); return add(p);
  };
  const dp = f.b.addDp.bind(f.b); f.b.addDp = (id, n) => { grants.push({ id, n, time: f.b.time }); return dp(id, n); };
  f.b.on('damaged', ctx => { if (ctx.source === f.u) hits.push({ ...ctx, time: f.b.time }); });
  f.b.on('attack', ctx => { if (ctx.attacker === f.u) attacks.push({ ...ctx, time: f.b.time }); });
  return { ...f, shots, hits, attacks, grants };
}
export function enemy(f, { row = 5, col = 7, hp = 1e7, def = 0, fly = false, blockedBy = null, flags = {} } = {}) {
  const t = f.b.spawnEnemy('enemy_1007_slime', { pos: [row, col] });
  Object.assign(t.base, { maxHp: hp, atk: 0, def, res: 0, moveSpeed: 1 }); t.markDirty(); void t.s; t.hp = hp;
  if (fly) t.motion = 'FLY';
  f.b.addBuff(t, { key: 'fixture:pin', flags: { noMove: true, disarm: true, unblockable: !blockedBy, ...flags } });
  if (blockedBy) { t.blockedBy = blockedBy; blockedBy.blocking.push(t); }
  f.b._buildEnemyIndex(); return t;
}
export function ally(f, { row = 5, col = 7, cost = 13, def = 100, block = 1, kind = 'op', flags = {}, moveLikeRespawn = false,
  sourceId = 'char_122_beagle' } = {}) {
  const d = normalizeChess({ chessId: sourceId, charId: sourceId, name: 'Controlled ally', profession: 'DEFENDER', position: 'MELEE',
    stats: { maxHp: 10000, atk: 0, def, cost, blockCnt: block }, rangeGrid: [[0, 0], [0, 1]], tags: [] });
  const u = f.b._makeAlly(f.u.player, d, kind, row, col, { dir: 'RIGHT' });
  f.b._setupUnit(u, { talents: [], trait: { noAttack: true, install: null }, skill: null });
  if (Object.keys(flags).length) f.b.addBuff(u, { key: 'fixture:flags', flags, allowDead: true, persist: true });
  assert.ok(f.b._deploy(u, { moveLikeRespawn })); return u;
}
export const cast = f => { f.u.skill.setSpTotal(f.u.skill.spCost); assert.ok(f.u.skill.activate()); };
