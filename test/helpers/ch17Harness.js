// SPDX-License-Identifier: GPL-3.0-or-later
import { readFileSync } from 'node:fs';
import { makeBattle, chessRec } from './battleHarness.js';
import { installEnemyFeatures } from '../../server/sim/content/arkpedia-enemy-features.js';
const records = JSON.parse(readFileSync(new URL('../../data/candidates/arkpedia-enemy-records.canonical.json', import.meta.url))).enemies;
export const keys = ['enemy_3010_mcreep', 'enemy_10203_mumag', 'enemy_10206_muveg', 'enemy_10208_mucow', 'enemy_10210_muwiz', 'enemy_10211_murad'];
export function battle(key, units = []) {
  const defs = Object.fromEntries(keys.map(k => [k, records[k].levels[0]]));
  const chess = Object.fromEntries(units.map((u, i) => [`op${i}`, chessRec({ id: `op${i}`, ...u })]));
  const h = makeBattle({ content: 'generic', autoFinish: false, timeLimit: 150,
    defs: { enemies: defs, chess }, kits: Object.fromEntries(Object.keys(chess).map(k => [k, () => ({ trait: { noAttack: true }, skill: { kind: 'instant', trigger: 'NEVER' } })])), units: units.map((u, i) => ({ chessId: `op${i}`, row: 10, col: 5 + i, ...u.pos })),
    setup: installEnemyFeatures });
  h.run(1 / 30);
  const e = h.spawn(key, { pos: [10, 6] });
  e.base.moveSpeed = 0; e.markDirty();
  return { h, b: h.b, e, a: e.mem.ab.list[0] };
}

