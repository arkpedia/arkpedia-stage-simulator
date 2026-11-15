// SPDX-License-Identifier: GPL-3.0-or-later
const KEY = 'ab:corruption';
const eligible = u => u.alive && u.deployed && !u.hidden && u.kind !== 'device' && u.def?.profession !== 'TRAP';
const contains = (b, zone, u) => b.time < zone.until && (zone.eligible ?? eligible)(u)
  && (zone.contains ? zone.contains(u) : Math.hypot(u.x - zone.x, u.y - zone.y) <= zone.r + 1e-9);

/** One shared pollution buff per exposed unit, with an exposure clock rather
 * than a projectile-wide damage clock. Dead sources retain damage attribution. */
export function corruptionZone(b, src, x, y, r, life, low, high) {
  if (!(life > 0)) return;
  addCorruptionField(b, src, { x, y, r, until: b.time + life, low, high });
  b.fx('zone', { x, y, r, dur: life, kind: 'pollution' });
}

/** Persistent devices and transient death zones share one nonstacking contact
 * clock. Each caller owns its footprint and recipient contract. */
export function addCorruptionField(b, src, parameters) {
  if (!b._corruptionZones) {
    b._corruptionZones = new Set();
    b.on('tick', () => sync(b), { priority: 40 });
    b.on('deploy', () => sync(b), { priority: 40 });
  }
  const zone = { src, until: Infinity, ...parameters };
  b._corruptionZones.add(zone);
  sync(b);
  return () => { b._corruptionZones.delete(zone); sync(b); };
}
function selected(b, u) {
  if (!u.alive || !u.deployed) return null;
  const held = u.findBuff(KEY)?.data.zone;
  if (held && b._corruptionZones.has(held) && contains(b, held, u)) return held;
  return [...b._corruptionZones].find(z => contains(b, z, u)) ?? null;
}
function sync(b) {
  for (const zone of b._corruptionZones) if (b.time >= zone.until) b._corruptionZones.delete(zone);
  for (const u of b.allyUnits) {
    const z = selected(b, u), old = u.findBuff(KEY);
    if (!z) { if (old) b.removeBuff(u, KEY); continue; }
    if (old) { old.data.zone = z; continue; }
    b.addBuff(u, { key: KEY, source: z.src, visible: true, interval: 1, data: { zone: z },
      onTick({ battle, unit }) {
        const current = selected(battle, unit); if (!current) return;
        // Native root-tile height includes airborne allies over low ground.
        const amount = battle.grid.isLow(unit.tileR, unit.tileC) ? current.low : current.high;
        battle.dealDamage(current.src, unit, { amount, type: 'true', isAttack: false, noSp: true,
          canDodge: false, ignoreSelect: true, tags: ['dot', 'periodic', 'pollution', 'corruption'] });
      } });
  }
}

export function withererCorruption({ life, low, high }) {
  return { sil: true, death(c, b, e) {
    if (c.reason === 'killed') corruptionZone(b, e, e.x, e.y, 1.7, life, low, high);
  } };
}
