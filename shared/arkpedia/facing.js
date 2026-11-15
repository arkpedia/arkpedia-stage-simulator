// SPDX-License-Identifier: GPL-3.0-or-later
// Enemy deploy direction is not its walking direction. Keep visual facing through
// waits/vertical legs, then turn when it moves horizontally or attacks a blocker.
export function spriteFacing(unit, previous = {}) {
  if (unit.mem?.nativeFacing === -1 || unit.mem?.nativeFacing === 1) return unit.mem.nativeFacing;
  if (unit.mem?.regularModelFacing) return unit.dir === 'LEFT' ? -1 : 1;
  if (unit.side !== "enemy") return (unit.mem?.regularVisualDirection ?? unit.dir) === "LEFT" ? -1 : 1;
  const blocker = unit.blockedBy;
  if (blocker?.alive && Math.abs(blocker.x - unit.x) > 0.01)
    return blocker.x < unit.x ? -1 : 1;
  if (Number.isFinite(previous.x) && Math.abs(unit.x - previous.x) > 0.0001)
    return unit.x < previous.x ? -1 : 1;
  if (previous.facing === -1 || previous.facing === 1) return previous.facing;
  // Face the first horizontal route segment before the initial movement tick.
  const next = unit.route?.legs
    ?.slice(unit.route.legIdx ?? 0)
    .find((leg) => leg.t === "move" && Math.abs(leg.c - unit.x) > 0.01);
  return next && next.c < unit.x ? -1 : 1;
}

// Reviewed native device facings must not be inferred from combat targeting side.
export function enemyModelKey(id, record) {
  return `enemy/${record?.assetPrefabKey ?? record?.prefabKey ?? id}/default/default`;
}
export const deviceModelKey = id => `device/${id}/default/default`;
export const stageDeviceModelKeys = stage => (stage?.devices ?? []).map(d => deviceModelKey(d.key));
export function regularModelKey(unit) {
  const facing = unit.mem?.regularModelFacing;
  if (['front', 'back', 'down'].includes(facing)) return `operator/${unit.defId}/default/${facing}`;
  if (unit.kind === 'device') return deviceModelKey(unit.defId);
  const back = unit.side === 'ally' && (unit.mem?.regularVisualDirection ?? unit.dir) === 'UP'
    && unit.mem?.regularAttackFacing !== 'Front' && !unit.mem?.regularFormVisual?.forceFront;
  return unit.side === 'ally' ? `operator/${unit.defId}/default/${back ? 'back' : 'front'}`
    : enemyModelKey(unit.defId, unit.def?.raw);
}
