// SPDX-License-Identifier: GPL-3.0-or-later
import { timedEnemyCasts } from './arkpedia-enemy-timed-casts.js';
import { addPiercingWave } from './arkpedia-piercing-wave.js';
const selectable = u => u.alive && u.deployed && !u.hidden
  && (u.kind !== 'device' || u.profile.characterLikeDevice)
  && !u.s.flags.untargetable && !u.s.flags.targetFree && !u.s.flags.sleep && !u.s.flags.stealth && !u.s.flags.camou;
export function theresis(p) {
  return [
    { spawn(b, e) {
      e.profile.noAttack = true;
      b.addBuff(e, { key: 'telex_t_invincible', persist: true,
        flags: { invulnerable: true, untargetable: true, unblockable: true } });
    } },
    timedEnemyCasts([{ initial: p.initial, cooldown: p.cooldown, clip: 'Attack', duration: p.duration,
      release: p.release, slowDown: true,
      select(b, e) {
        const target = b.allyUnits.find(u => selectable(u) && !u.isFlying && !u.s.flags.liftoff
          && [u.defId, u.def.baseId, u.def.raw?.charId].includes('char_003_kalts'));
        return target ? [{ dx: target.x - e.x, dy: target.y - e.y }] : [];
      },
      fire(b, e, [bearing]) {
        if (!Math.hypot(bearing.dx, bearing.dy)) return;
        addPiercingWave(b, { source: e, ...bearing, speed: 5, lifetime: 5, radius: .5,
          candidates: () => b.allyUnits.filter(selectable), hit: u => b.kill(u, e),
          data: { theresisSlash: true } });
      },
    }]),
  ];
}
