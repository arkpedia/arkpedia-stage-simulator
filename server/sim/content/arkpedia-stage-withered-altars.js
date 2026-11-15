// SPDX-License-Identifier: GPL-3.0-or-later
import { configureStageSupply } from './arkpedia-stage-supply-account.js';
/** Player-placed enemy character: shares occupancy and the supply-card account. */
export function spawnWitheredAltar(b, spec, row, col) {
  const unit = b.spawnEnemy(spec.unitId, { pos: [row, col], countInTotal: false,
    def: { key: spec.unitId, name: spec.name, applyWay: 'NONE', dmgType: 'none',
      stats: { maxHp: spec.hp, atk: 0, def: spec.def ?? 0, res: 0, moveSpeed: 0, bat: 1, rangeRadius: 0, lpr: 0 } } });
  if (!unit) return null;
  configureStageSupply(unit, spec); unit.mem.noLeak = true; unit.kind = 'device'; unit.obstacle = false;
  unit.profile.noAttack = true; unit.blockWeight = 0;
  unit.def.immune = new Set(['stun', 'cold', 'frozen', 'levitate', 'silence', 'sleep']);
  unit.route = { legs: [{ t: 'wait', time: Infinity }], legIdx: 0, pts: null, ptIdx: 0, suffix: null, version: -1, waitLeft: null };
  b._occ[row * b.grid.cols + col] = unit;
  b.on('death', ({ unit: dead, reason }) => {
    if (dead !== unit || unit.mem.beaconReleased || reason !== 'killed') return;
    unit.mem.beaconReleased = true;
    const beacon = b.spawnEnemy(spec.child, { pos: [unit.y, unit.x], countInTotal: false });
    if (!beacon) return;
    beacon.lpr = 0;
    beacon.route = { legs: [{ t: 'wait', time: spec.wait }], legIdx: 0, pts: null, ptIdx: 0, suffix: null, version: -1, waitLeft: null };
  }, { owner: unit });
  return unit;
}
