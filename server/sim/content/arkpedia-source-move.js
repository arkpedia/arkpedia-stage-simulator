// SPDX-License-Identifier: GPL-3.0-or-later
// Opt-in bridge for source RespawnCharacter, not ordinary relocate/moveRedeploy.
// Ulpianus explicitly carries HP ratio, skill progress and selected self stacks.
// The adapter supplies its resident-buff carry/rebuild policy; no blanket native
// retention or cleanup rule is inferred. Old scripts must use deployment epochs.
const live = u => u?.side === 'ally' && u.alive && u.deployed && !u._removing;
export const SOURCE_MOVE_REASON = 'MOVE_LIKE_RESPAWN_SELF';

/**
 * Refusal is preflight-only and leaves state untouched. Once committed, normal
 * buff callbacks may kill/retreat the unit: the accepted move must never revive
 * it. Dedicated finish/born hooks do not impersonate real death, player retreat
 * or ordinary deployment. Native C# callback ordering remains unverified.
 *
 * carryBuffKeys is required: omission is not implicit "keep every buff".
 * Kept buffs retain identity/deadline; rebuildBuffs use ordinary buff acceptance.
 * The running SkillRuntime retains its selected build, activation and deadline.
 */
export function sourceMoveRespawn(b, u, row, col, policy) {
  if (!live(u) || !policy || !Array.isArray(policy.carryBuffKeys)
    || policy.carryBuffKeys.some(k => typeof k !== 'string')
    || !Array.isArray(policy.rebuildBuffs) || policy.rebuildBuffs.some(x => !x || typeof x.key !== 'string')
    || !Number.isInteger(row) || !Number.isInteger(col) || !b.grid.inRect(row, col)) return false;
  const inPlace = row === u.tileR && col === u.tileC;
  if (inPlace && !policy.allowInPlace) return false;
  const tile = b.grid.tile(row, col), reservation = b.tileReservation(row, col);
  if (policy.checkBuild && tile.build !== 'ALL' && tile.build !== u.def.position) return false;
  if ((reservation && reservation.owner !== u) || b.downOn(row, col)
    || b.allyUnits.some(a => a !== u && a.alive && a.deployed && a.tileR === row && a.tileC === col)) return false;
  if (policy.reserveOrigin && (typeof policy.reservationKey !== 'string' || !policy.reservationKey)) return false;
  // Reject ambiguous duplicate reconstruction before touching any state.
  const keep = new Set(policy.carryBuffKeys), replacements = new Set();
  for (const buff of policy.rebuildBuffs) {
    if (keep.has(buff.key) || replacements.has(buff.key)) return false;
    replacements.add(buff.key);
  }
  const origin = [u.tileR, u.tileC], ratio = u.hpRatio, oldSeq = u.deploySeq;
  if (!b.relocate(u, row, col)) return false;
  u.deploySeq = ++b._deploySeq;
  u.aggroSeq = u.deploySeq;
  u.deployedAt = b.time;
  u.attackControlEpoch = (u.attackControlEpoch ?? 0) + 1;
  u.atkCd = 0; u.lastAttackAt = -Infinity;
  u.skill.pending = false;
  if (policy.clearSp) { u.skill.sp = 0; u.skill.charges = 0; }
  if (policy.reserveOrigin && !inPlace) b.reserveTile(u, ...origin, policy.reservationKey);
  const ctx = { unit: u, reason: SOURCE_MOVE_REASON, origin, destination: [row, col],
    inPlace, oldSeq, newSeq: u.deploySeq };
  b.emit('sourceMoveFinish', ctx);
  if (!live(u)) return true;
  for (const buff of u.buffs.slice()) if (!keep.has(buff.key)) {
    b.removeBuff(u, buff);
    if (!live(u)) return true;
  }
  for (const buff of policy.rebuildBuffs) {
    b.addBuff(u, buff);
    if (!live(u)) return true;
  }
  u.markDirty();
  u.hp = u.s.maxHp * ratio; // source ratio assignment: neither healing nor damage
  b._refreshRange(u);
  b.emit('sourceMoveBorn', ctx);
  return true;
}
