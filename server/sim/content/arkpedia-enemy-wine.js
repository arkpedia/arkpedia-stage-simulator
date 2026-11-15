// SPDX-License-Identifier: GPL-3.0-or-later
import { scatterFragments } from './arkpedia-enemy-summons.js';
import { timedEnemyCasts } from './arkpedia-enemy-timed-casts.js';
import { bodyInRadius } from '../body.js';
import { projectileSingleAttack } from './arkpedia-enemy-projectiles.js';
import { attachRampingDot } from './arkpedia-enemy-ramping-dot.js';

export function porcelainCaster(p) {
  const normal = projectileSingleAttack({ speed: 10, lifetime: 10, type: 'arts', noAir: true });
  const power = projectileSingleAttack({ speed: 10, lifetime: 10, type: 'arts', noAir: true,
    onImpact: (b, _e, target, { amount }) => attachRampingDot(b, target, {
      key: 'ab:porcelainDot', amount, initial: p.initialScale, increment: p.increment, every: p.every, duration: p.duration,
    }) });
  return {
    spawn(b, e, a) {
      normal.spawn(b, e); a.sp = p.initialSp; a.readyAt = b.time; e.mem.porcelainCaster = a;
      e.def = { ...e.def, attackAnim: p.attackAnim };
    },
    attack(c, b, e, a) {
      const useSkill = a.sp >= p.cost && b.time + 1e-9 >= a.readyAt && !e.s.flags.silence;
      if (useSkill) {
        a.sp = 0; a.readyAt = b.time + p.cooldown;
        e.skillAnimUntil = b.time + p.attackAnim.dur - p.attackAnim.hit;
        power.attack(c, b, e);
      } else { normal.attack(c, b, e); a.sp = Math.min(p.cost, a.sp + 1); }
    },
  };
}

export function brokenBlades({ count, atk, child, duration, release }) {
  const finish = (b, e, a) => {
    a.recovery = null; b.removeBuff(e, 'ab:brokenBlades'); e.atkCd = 0;
  };
  return {
    spawn(b, e, a) {
      a.left = count; a.recovery = null; e.mem.brokenBlades = a;
      e.def = { ...e.def, attackAnim: { dur: duration, hit: release } };
      b.addBuff(e, { key: 'ab:brokenBlades', persist: true, visible: true, mods: { atkPct: atk } });
    },
    attack(_c, _b, e, a) {
      if (a.left <= 0) return;
      if (--a.left === 0) a.recovery = (duration - release) / Math.max(1, duration / e.s.interval);
    },
    tick(b, e, a, dt) {
      if (a.recovery == null) return;
      a.recovery -= dt * e.s.slowDownRate;
      if (!e.canAct || a.recovery <= 1e-9) finish(b, e, a);
    },
    death(c, b, e, a) { if (c.reason === 'killed' && !e.mem.deathByFall) scatterFragments(b, e, child, Math.max(1, a.left)); },
  };
}
export const fragmentDeath = ({ child, count }) => ({
  death(c, b, e) { if (c.reason === 'killed' && !e.mem.deathByFall) scatterFragments(b, e, child, count); },
});
export function lampBearer({ radius, auraDuration, ...timing }) {
  let activeUntil = -Infinity;
  const casts = timedEnemyCasts([{ ...timing, clip: 'Skill', slowDown: true,
    select: (_b, e) => [e], fire: b => { activeUntil = b.time + auraDuration; } }], { silenceable: false });
  const tracked = new Set();
  const clear = (b, e, u) => { b.removeBuff(u, `ab:lampVeil:${e.id}`); tracked.delete(u); };
  return { ...casts,
    tick(b, e, a, dt) {
      casts.tick(b, e, a, dt);
      const targets = new Set(b.time < activeUntil && !e.hidden ? b.enemies.filter(u => u !== e && u.kind === 'enemy'
        && u.alive && u.deployed && !u.hidden && bodyInRadius(u, e.x, e.y, radius)) : []);
      for (const u of tracked) if (!targets.has(u)) clear(b, e, u);
      for (const u of targets) if (!tracked.has(u)) {
        tracked.add(u); b.addBuff(u, { key: `ab:lampVeil:${e.id}`, source: e,
          flags: { stealth: true }, data: { stealthRestore: 0 } });
      }
    },
    death(c, b, e, a) { for (const u of tracked) clear(b, e, u); casts.death(c, b, e, a); },
  };
}
