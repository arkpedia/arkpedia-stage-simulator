// SPDX-License-Identifier: GPL-3.0-or-later
// Spawn any Global enemy, at any database level and with any stage override,
// on the synthetic flat stage, without a real stage (data/arkpedia-enemy-records.json).
//   const h = spawnAny('enemy_1007_slime', {seconds: 10});
import records from '../../data/arkpedia-enemy-records.json' with { type: 'json' };
import { makeBattle, chessRec } from './battleHarness.js';
import { installEnemyFeatures } from '../../server/sim/content/arkpedia-enemy-features.js';

export const ENEMY_RECORDS = records;
export function enemyRecord(key, level = 0) {
  const e = records.enemies[key];
  if (!e) throw Error(`Unknown enemy: ${key}`);
  const r = e.levels[level];
  if (!r) throw Error(`Unknown enemy level: ${key}@${level}`);
  return r;
}
/**
 * opts: level (0), stats (plain stat overrides merged into the record), route (0 = walk low; 2 = fly low),
 * units (battleHarness unit specs; default one guard in the lane), seconds (run time; 0 = do not run), content ('none').
 */
export function spawnAny(key, opts = {}) {
  const base = enemyRecord(key, opts.level ?? 0);
  const record = opts.stats ? { ...base, stats: { ...base.stats, ...opts.stats } } : base;
  const guard = chessRec({ id: 'test_enemy_harness_guard', profession: 'WARRIOR', stats: { atk: 400, maxHp: 1e6, def: 300 }, skill: null });
  const route = opts.route ?? (record.stats.motion === 'FLY' ? 2 : 0);
  const h = makeBattle({
    defs: { enemies: { [key]: record }, chess: { [guard.chessId]: guard } },
    units: opts.units ?? [{ chessId: guard.chessId, row: 9, col: 6 }],
    enemies: [{ key, time: 0, route }],
    content: opts.content ?? 'none', timeLimit: opts.timeLimit ?? 600, seed: opts.seed ?? 1,
    setup: b => installEnemyFeatures(b),
  });
  if (opts.seconds) h.run(opts.seconds);
  return h;
}
