// SPDX-License-Identifier: GPL-3.0-or-later
// Burning Breath (dragon_fire): true damage each second, rising linearly from `base` to `base + add` over `ramp` s,
// for `duration` s cut by the target's resistance (the tick interval and the ramp stay fixed). PRTS (Talulah, the
// Black Snake, the Energy Aggregate): a re-application refreshes the duration without stacking or resetting the ramp;
// the ramp resets only when the burn ends. Talulah's selectors never re-apply it (they exclude burning targets).
export const BURNING_BREATH = 'dragon_fire';

/** Apply (or, with `refresh`, refresh) Burning Breath from `source` on `target`. `s` = {duration, base, add, ramp}.
 * `tag` names the damage for logs and tests; the buff keeps its first source on a refresh. */
export function applyBurningBreath(b, source, target, s, { refresh = false, tag = 'burningBreath' } = {}) {
  if (!target?.alive) return false;
  const duration = s.duration * (1 - (b.resistOf?.(target) ?? 0));
  const current = target.findBuff(BURNING_BREATH);
  if (current) {
    if (!refresh) return false;
    // The same buff instance keeps ticking (its source and ramp); only the time left restarts.
    current.timeLeft = duration;
    return true;
  }
  const t0 = b.time;
  b.addBuff(target, { key: BURNING_BREATH, source, duration, visible: true, interval: 1, onTick: ({ battle }) => {
    if (!target.alive) return;
    const amount = s.base + s.add * Math.min(1, (battle.time - t0) / s.ramp);
    battle.dealDamage(source, target, { amount, type: 'true', canDodge: false, noSp: true, applyWay: 'none', tags: ['periodic', tag] });
  } });
  return true;
}
