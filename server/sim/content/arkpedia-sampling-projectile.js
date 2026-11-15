// SPDX-License-Identifier: GPL-3.0-or-later
/** A fixed destination samples one recipient per period. Accepted selections
 * own delayed receipts independently of the carrier's later removal. */
export function addSamplingProjectile(b, { source, x, y, lifetime, interval, maxHits, delay,
  select, hit, valid = () => source.alive && source.deployed, data = {} }) {
  if (![x, y, lifetime, interval, delay].every(Number.isFinite) || lifetime <= 0 || interval <= 0 || delay < 0
    || !Number.isSafeInteger(maxHits) || maxHits < 1 || typeof select !== 'function' || typeof hit !== 'function')
    throw Error('Invalid sampling projectile contract');
  let clock = 0, hits = 0;
  return b.addProjectile({ source, from: { x, y }, to: { x, y }, maxAge: lifetime, visual: 'arts', data,
    advanceMotion: ({ projectile, dt, expires }) => {
      if (!valid() || expires) { projectile.removed = true; return { x, y, reached: false }; }
      clock += dt;
      while (clock + 1e-9 >= interval && hits < maxHits) {
        clock -= interval; const target = select({ x, y, projectile });
        if (!target) continue;
        hits++; const life = target.deploySeq;
        b.after(delay, () => {
          if (target.alive && target.deployed && target.deploySeq === life) hit(target);
        });
      }
      if (hits >= maxHits) projectile.removed = true;
      return { x, y, reached: false };
    } });
}
