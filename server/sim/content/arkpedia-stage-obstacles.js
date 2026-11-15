// SPDX-License-Identifier: GPL-3.0-or-later
import { configureStageSupply } from './arkpedia-stage-supply-account.js';
/** Shared body/account for original obstacle-category devices, including ruins. */
export function configureStageObstacle(b, unit, spec) {
  configureStageSupply(unit, spec); unit.base.tauntLevel = spec.taunt ?? 0;
  unit.def.immune = new Set(spec.immune ?? []);
  if (spec.blockRadiusSquare > 0) unit.profile.blockRadiusSquare = spec.blockRadiusSquare;
  unit.markDirty();
  if (spec.environmentImmune) b.on('hit', ctx => {
    if (ctx.target === unit && ctx.dmg.isEnvironment) ctx.cancel = true;
  }, { owner: unit });
  return unit;
}
export function spawnStageObstacle(b, row, col, spec) {
  const u = b.spawnDevice(spec.unitId, row, col, { hp: spec.hp, def: spec.def, res: spec.res, blockCnt: spec.block,
    blockRadiusSquare: spec.blockRadiusSquare, obstacle: true, obstacleKind: 'crate', name: spec.name });
  return u && configureStageObstacle(b, u, spec);
}
