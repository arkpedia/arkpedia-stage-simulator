// SPDX-License-Identifier: GPL-3.0-or-later
import { huskAbility, elem } from './enemies.js';

/** Reuse the shared hit-count/rebirth lifecycle. All transition presentation is
 * local to this deployment and follows the original prefab's animation roles. */
export function emberRebirth({ hits, delay, attackAnim, startDuration, reviveDuration }) {
  let sequence = 0;
  const play = (b, e, clip, duration) => {
    const id = `ember:${e.deploySeq}:${++sequence}`;
    e.mem.regularFormVisual = { clip, loop: false, speed: 1, playId: id,
      die: e.form === 'husk' ? 'Die_2' : 'Die', replace: true };
    e.mem.emberVisualUntil = b.time + duration;
  };
  const lifecycle = huskAbility({ hits, delay,
    onHusk: (b, e) => play(b, e, 'Start', startDuration),
    onRevive: (b, e) => play(b, e, 'Revive', reviveDuration),
  });
  return {
    ...lifecycle,
    spawn(_b, e) { e.def = { ...e.def, attackAnim }; },
    killed(c, b, e, a) {
      const wasHusk = a.state === 'husk', result = lifecycle.killed(c, b, e, a);
      if (result && !wasHusk) play(b, e, 'Die', a.rebornUntil - b.time);
      return result;
    },
    tick(b, e) {
      if (b.time + 1e-9 < (e.mem.emberVisualUntil ?? 0)) return;
      e.mem.regularFormVisual = e.form === 'husk'
        ? { clip: 'Idle_2', move: 'Move_2', attack: 'Idle_2', die: 'Die_2', loop: true, speed: 1 }
        : null;
    },
  };
}

/** A terrain predicate shared by ordinary attacks; no per-stage or tile copies. */
export function burningReedsAttack({ radius, ratio, protection = 0 }) {
  const active = (b, e) => e.form !== 'husk' && b.stageReeds?.hasBurningNear(e.x, e.y, radius);
  const refresh = (b, e) => {
    const key = 'ab:burningReedsProtection';
    if (protection > 0 && active(b, e)) {
      if (!e.findBuff(key)) b.addBuff(e, { key, status: 'sanctuary', mods: { physTakenMul: 1 - protection, artsTakenMul: 1 - protection } });
    } else b.removeBuff(e, key);
  };
  return {
    tick: refresh,
    // Refresh before mitigation as movement/ignition can change within a tick.
    hitIn(_c, b, e) { refresh(b, e); },
    dealt(c, b, e) {
      if (!active(b, e)) return;
      elem(b, e, c.target, 'burn', e.s.atk * ratio);
    },
  };
}
