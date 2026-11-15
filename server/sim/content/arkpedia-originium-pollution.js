// SPDX-License-Identifier: GPL-3.0-or-later
const KEY = { tile: 'device:pollution', chimera: 'ab:originium', storm: 'ab:storm' };
const active = source => !source.owner || source.owner.alive && source.owner.deployed && !source.owner.hidden;

/** Original pollution families share one SP modifier, but keep their own pulse
 * clocks. Native templates compare damage values, with explicit tie priority. */
export function pollutionDamageAllowed(kind, damage, values) {
  if (kind === 'chimera') return damage >= (values.storm ?? values.tile ?? -Infinity);
  if (kind === 'tile') return damage > (values.storm ?? values.chimera ?? -Infinity);
  return values.tile != null ? damage >= values.tile : damage > (values.chimera ?? -Infinity);
}
export function registerOriginiumPollution(b, source) {
  if (!b._originiumPollution) {
    b._originiumPollution = new Map();
    b.on('tick', () => syncOriginiumPollution(b), { priority: 40 });
  }
  b._originiumPollution.set(source.id, source);
  syncOriginiumPollution(b);
  return () => { b._originiumPollution.delete(source.id); syncOriginiumPollution(b); };
}
function exposures(b, unit) {
  const kinds = {};
  for (const source of b._originiumPollution.values()) {
    if (!active(source) || !source.contains(unit)) continue;
    const old = kinds[source.kind];
    if (!old || source.damage > old.damage) kinds[source.kind] = source;
  }
  return kinds;
}
export function syncOriginiumPollution(b) {
  if (!b._originiumPollution) return;
  for (const [id, source] of b._originiumPollution) if (!active(source)) b._originiumPollution.delete(id);
  for (const u of b.units) {
    if (!u.alive || !u.deployed || u.hidden) continue;
    const kinds = exposures(b, u), selected = Object.values(kinds);
    for (const [kind, key] of Object.entries(KEY)) {
      const source = kinds[kind];
      if (!source) { b.removeBuff(u, key); continue; }
      const old = u.findBuff(key);
      if (old) { old.data.damage = source.damage; continue; }
      b.addBuff(u, { key, visible: true, interval: source.interval, data: { damage: source.damage },
        onTick({ battle, unit }) {
          const live = exposures(battle, unit), current = live[kind];
          if (!current || !pollutionDamageAllowed(kind, current.damage,
            Object.fromEntries(Object.entries(live).map(([k, s]) => [k, s.damage])))) return;
          battle.dealDamage(null, unit, { amount: current.damage, type: 'true', sourceless: true,
            noSp: true, isEnvironment: true, ignoreSelect: true, canDodge: false,
            tags: ['dot', 'periodic', 'pollution', `pollution:${kind}`] });
        } });
      source.onEnter?.(u);
    }
    if (!selected.length) b.removeBuff(u, 'ab:originiumSp');
    else {
      const spRecoveryFlat = Math.min(...selected.map(s => s.spRatio));
      if (u.findBuff('ab:originiumSp')?.mods?.spRecoveryFlat !== spRecoveryFlat)
        b.addBuff(u, { key: 'ab:originiumSp', mods: { spRecoveryFlat } });
    }
  }
}
