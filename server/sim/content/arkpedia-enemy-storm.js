// SPDX-License-Identifier: GPL-3.0-or-later
import { registerOriginiumPollution } from './arkpedia-originium-pollution.js';

/** Storm growth consumes pollution, not elapsed time. The original radius
 * controller approaches its new target by 0.0083 tiles every 0.03 seconds. */
export function stormAura({ damage, damageStep, maxDamage, radius, radiusStep, maxRadius, spRatio }) {
  const grow = (a, count) => {
    a.targetR = Math.min(maxRadius, a.targetR + count * radiusStep);
    a.d = Math.min(maxDamage, a.d + count * damageStep);
  };
  return {
    storm: true,
    spawn(b, e, a) {
      e.profile.noAttack = true; e.profile.cannotExit = true; e.profile.holdsBattle = false; e.mem.noLeak = true;
      e.def = { ...e.def, immune: new Set([...e.def.immune, 'cold', 'disarm']) };
      b.addBuff(e, { key: 'enemy_bigstorm[passive]', persist: true, flags: { invulnerable: true, healFree: true, unblockable: true } });
      b.addBuff(e, { key: 'immune_shu_blink', persist: true });
      a.traceClock = 0; e.mem.storm = a;
      a.t = 0; a.radiusClock = 0; a.r = radius; a.targetR = radius; a.d = damage;
      a.removeAura = registerOriginiumPollution(b, { id: e, owner: e, kind: 'storm', interval: 1, spRatio,
        get damage() { return a.d; },
        contains: u => u !== e && u.kind !== 'device' && (u.def?.profession ?? u.def?.raw?.profession) !== 'TRAP'
          && Math.hypot(u.x - e.x, u.y - e.y) <= a.r + 1e-9,
        onEnter(u) {
          if (!['enemy_1424_lrboom', 'enemy_1424_lrboom_2'].includes(u.defId)) return;
          grow(a, 1); u.mem.suppressOriginiumTile = true;
          b.kill(u, e);
        } });
    },
    death(_c, _b, _e, a) { a.removeAura?.(); },
    tick(b, e, a, dt) {
      a.traceClock += dt;
      if (a.traceClock + 1e-9 >= 2) {
        a.traceClock -= 2;
        // Native post-filter 34 chooses the most recently spawned Beacon.
        // Force-trace snapshots its tile; the ordinary ground route planner
        // handles terrain, obstacles and the unit's current movement speed.
        const target = b.enemies.filter(u => u.alive && u.deployed && !u.hidden && u.findBuff('enemy_stormcoord[passive]'))
          .sort((x, y) => y.spawnSeq - x.spawnSeq)[0];
        if (target) {
          a.target = target.id;
          e.route = { legs: [{ t: 'move', r: Math.round(target.y), c: Math.round(target.x), final: false },
            { t: 'wait', time: Infinity }], legIdx: 0, pts: null, ptIdx: 0, suffix: null, version: -1, waitLeft: null };
        }
      }
      // The siege device's retained core buff suspends consumption and growth.
      if (e.findBuff('trap_lrsiege[eliminate_storm][core]')) return;
      a.t += dt; a.radiusClock += dt;
      while (a.radiusClock + 1e-9 >= .03) {
        a.radiusClock -= .03; a.r = Math.min(a.targetR, a.r + Math.fround(.0083));
      }
      if (a.t + 1e-9 < 1) return;
      a.t -= 1;
      let count = 0;
      for (const tile of b.mvpStagePollution ?? []) {
        const [row, col] = tile.split(',').map(Number);
        if (Math.hypot(col - e.x, row - e.y) > a.r + 1e-9) continue;
        b.mvpStagePollution.delete(tile); count++;
      }
      if (count) grow(a, count);
    },
  };
}
