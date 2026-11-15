// SPDX-License-Identifier: GPL-3.0-or-later
import { areaSelectable } from '../targeting.js';

/** Friendly death reward: bypass enemy damage targeting, include operators/tokens,
 * and extend one buff's time across sources without stacking its stat modifiers. */
export function deathAreaBuff({ radius, duration, mods, key }) {
  return {
    sil: true,
    spawn(b, e) { b.addBuff(e, { key: `${key}:body`, persist: true, flags: { noDisplace: true } }); },
    death(c, b, e) {
      if (c.reason !== 'killed') return;
      b.fx('explode', { x: e.x, y: e.y, r: radius, kind: key, id: e.id });
      for (const unit of b.allies()) {
        if (unit.hidden || unit.def?.profession === 'TRAP' || Math.hypot(unit.x - e.x, unit.y - e.y) > radius + 1e-9) continue;
        b.addBuff(unit, { key, source: e, duration, refresh: 'addTime', mods, visible: true });
      }
    },
  };
}

/** One death pulse, with an independent, resistance-aware debuff per source.
 * Spawn-on-death remains a separate feature and is not suppressed by silence. */
export function deathAreaDebuff({ radius, scale = 1, type = 'arts', duration, aspd, key = 'teaBoom' }) {
  return {
    sil: true,
    death(c, b, e) {
      if (c.reason !== 'killed') return;
      const { x, y } = e, amount = e.s.atk * scale;
      b.fx('explode', { x, y, r: radius, kind: key, id: e.id });
      for (const u of b.allies()) {
        if (!areaSelectable(e, u) || u.isFlying || Math.hypot(u.x - x, u.y - y) > radius + 1e-9) continue;
        b.dealDamage(e, u, { amount, type, isSkill: true, canDodge: false, applyWay: 'none', tags: [key] });
        if (u.alive && duration > 0 && aspd) b.addBuff(u, { key: `ab:${key}:${e.id}`, source: e,
          duration: duration * (1 - b.resistOf(u)), sourceStatusResistable: true,
          refresh: 'replace', mods: { aspd }, visible: true });
      }
    },
  };
}
