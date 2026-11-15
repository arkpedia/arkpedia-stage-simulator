// SPDX-License-Identifier: GPL-3.0-or-later
import { timedEnemyCasts } from './arkpedia-enemy-timed-casts.js';

/** A global cast captures its eligible recipients at the original beginning
 * selection point. Refresh shares one buff identity across all casters. */
export function globalEnemyStatDebuff(p) {
  const selectable = u => u.alive && u.deployed && !u.hidden && !u.isFlying
    && (u.kind !== 'device' || u.profile.enemyTargetableDevice)
    && !u.s.flags.untargetable && !u.s.flags.targetFree && !u.s.flags.sleep && !u.s.flags.invulnerable;
  return timedEnemyCasts([{ initial: p.initial, cooldown: p.cooldown, clip: p.clip,
    duration: p.castDuration, release: p.release, slowDown: true, requiresTargets: false,
    select: b => b.allies(null, { includeTargetableDevices: true }).filter(selectable),
    fire(b, e, targets) {
      for (const target of targets) if (target.alive && target.deployed)
        b.addBuff(target, { key: p.key, source: e, duration: p.duration, refresh: 'extend', visible: true, mods: p.mods });
    },
  }]);
}
