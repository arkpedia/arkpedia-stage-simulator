// SPDX-License-Identifier: GPL-3.0-or-later
import { segmentCircleEntry } from '../projectile-collision.js';
import { ALLY_COLLIDER_RADIUS } from '../constants.js';

/** Shared straight, finite, wall-independent swept collider. Content owns
 * target eligibility and payload; each deployment is hit at most once. */
export function addPiercingWave(b, { source, dx, dy, speed, lifetime, radius, candidates, hit, data = {} }) {
  const length = Math.hypot(dx, dy);
  if (!(length > 0) || ![length, speed, lifetime, radius].every(Number.isFinite)
    || speed <= 0 || lifetime <= 0 || radius < 0) throw Error('Invalid piercing-wave contract');
  const seen = new Set();
  return b.addProjectile({ source, from: source, to: { x: source.x + dx / length * speed * lifetime,
    y: source.y + dy / length * speed * lifetime }, speed, maxAge: lifetime, expireInPlace: true,
    visual: 'arrow', data,
    onMove({ projectile, previous, x, y }) {
      const contacts = candidates().flatMap(unit => {
        const key = `${unit.id}:${unit.deploySeq}`;
        if (seen.has(key)) return [];
        const time = segmentCircleEntry(previous, { x, y }, unit, radius + ALLY_COLLIDER_RADIUS);
        return time == null ? [] : [{ unit, time, key }];
      }).sort((a, z) => a.time - z.time || a.unit.deploySeq - z.unit.deploySeq);
      for (const { unit, key } of contacts) {
        if (projectile.removed) break;
        seen.add(key); hit(unit);
      }
    } });
}
