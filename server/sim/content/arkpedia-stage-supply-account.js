// SPDX-License-Identifier: GPL-3.0-or-later
/** Common identity, inspector and retreat account for a stage-supplied body. */
export function configureStageSupply(unit, spec) {
  unit.def.profession = 'TRAP';
  unit.rangeKeys ??= [];
  unit.deploymentSlotCost = 0;
  unit.mem.stageSupplyToken = spec.unitId;
  unit.mem.stageSupplyId = `stage-supply:${unit.id}`;
  unit.mem.stageSupplyRefund = Math.floor((spec.cost ?? 0) * (spec.refundRatio ?? 0));
  unit.mem.stageSupplyDefinition = spec;
  return unit;
}
