// SPDX-License-Identifier: GPL-3.0-or-later
// Read the combat clock and resources, never a separate UI timer.
export function battleHud(battle, paused) {
  const dp = Math.max(0, Math.min(battle.flags.dpMax, battle.dp));
  const capped = dp >= battle.flags.dpMax;
  const rate = battle.flags.dpPerSec;
  const deployed = battle.allyUnits.filter(unit => unit.alive).length;
  const usedSlots = typeof battle.deployedSlots === 'function' ? battle.deployedSlots() : deployed;
  return {
    enemies: `${battle.killed + battle.leakedCount}/${battle.total}`,
    life: battle.life,
    dp: Math.floor(dp),
    recoveryFraction: capped ? 1 : rate > 0 ? dp - Math.floor(dp) : 0,
    recoveryText: capped ? "MAX" : battle.finished ? "Ended" : paused ? "Paused" : rate > 0 ? `+${rate} DP/s` : "No recovery",
    slots: Math.max(0, battle.unitLimit - usedSlots),
    deployed,
    time: `${Math.floor(battle.time / 60)}:${String(Math.floor(battle.time % 60)).padStart(2, "0")}`,
  };
}
