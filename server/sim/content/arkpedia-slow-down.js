// SPDX-License-Identifier: GPL-3.0-or-later
// Native slow_down is distinct from the catalogue's movement-only Slow.
export const NATIVE_SLOW_DOWN_CONTRACT = Object.freeze({
  scope: 'Source-owned stacking slow_down parents and strongest-source movement, ASPD and eligible elapsed clocks',
  mapping: 'Same-source applications stack and refresh their source lifetime; the largest live strength across sources applies once. Resistable duration clocks use the current slow-down multiplier, while periodic trigger frequency stays on world time. Ability clocks opt in only through an explicit affectedBySlowDown flag.',
  limits: 'Buff-stack/override aliases, existing application-time Resist normalization and fixed-tick ordering are local mappings. Source AUTOMATIC resistance eligibility uses the existing catalogue for named controls; other buff producers must supply explicit eligibility. Missing enemy native ability flags, animation/channel controllers and compiled frame parity are not inferred.',
  frameParity: false,
});
export function sourceAbilityDelta(unit, dt, affectedBySlowDown = false) {
  if (!Number.isFinite(dt) || dt < 0) throw Error('Invalid source ability elapsed time');
  return dt * (affectedBySlowDown === true ? unit.s.slowDownRate : 1);
}
export function applySourceSlowDown(b, source, target, { key, increment, duration, maxStacks, maxStrength,
  contract } = {}) {
  if (contract !== NATIVE_SLOW_DOWN_CONTRACT || !source?.id || typeof key !== 'string' || !key
    || !Number.isFinite(increment) || increment <= 0 || !Number.isFinite(duration) || duration <= 0
    || !Number.isInteger(maxStacks) || maxStacks < 1 || !Number.isFinite(maxStrength) || maxStrength <= 0 || maxStrength >= 1)
    throw Error('slow_down requires a reviewed source stack/lifetime contract');
  // Original VertifyTarget checks ENEMY unit type, not merely enemy side.
  if (!target?.alive || !target.deployed || target.side !== 'enemy' || target.kind !== 'enemy') return null;
  const ownedKey = `native:slow-down:${key}:${source.id}`, old = target.findBuff(ownedKey);
  const seq = target.deploySeq;
  const stacks = Math.min(maxStacks, (old?.stacks ?? 0) + 1);
  const buff = b.addBuff(target, { key: ownedKey, source, duration: duration * (1 - b.resistOf(target)), stacks, maxStacks,
    sourceStatusResistable: true, data: { nativeSlowDown: { increment, maxStrength } } });
  if (buff && (!target.alive || !target.deployed || target.deploySeq !== seq)) {
    if (target.findBuff(ownedKey) === buff) b.removeBuff(target, buff);
    return null;
  }
  return buff;
}
