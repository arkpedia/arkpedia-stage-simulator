// SPDX-License-Identifier: GPL-3.0-or-later
// Regular-stage borrowing is explicit; upstream mode battles retain a zero floor.
export function regularDpMinimum(battle, ownerId) {
  return battle.regularDpFloors?.get(ownerId) ?? 0;
}
export function canSpendDp(battle, ownerId, cost, { considerNegative = true } = {}) {
  const player = battle.getPlayer(ownerId);
  return !!player && Number.isFinite(cost) && cost >= 0
    && player.dp >= cost + (considerNegative ? battle.dpMinimumFor?.(ownerId) ?? 0 : 0);
}
export function spendDp(battle, ownerId, cost, options) {
  if (!canSpendDp(battle, ownerId, cost, options)) return false;
  battle.addDp(ownerId, -cost); return true;
}
export function regularDpRecoveryForStep(battle, ownerId, dt) {
  const player = battle.getPlayer(ownerId), rate = battle.dpRecoveryRateFor(ownerId);
  if (!player || !(dt > 0) || !Number.isFinite(dt)) return 0;
  if (player.dp >= 0 || !(rate > 0)) return rate * dt;
  // Split the tick at zero: only the time spent in debt has halved recovery.
  const belowZero = Math.min(dt, -player.dp / (rate * .5));
  return rate * (.5 * belowZero + dt - belowZero);
}
