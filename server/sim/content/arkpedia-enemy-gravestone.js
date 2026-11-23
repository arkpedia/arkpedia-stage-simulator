// SPDX-License-Identifier: GPL-3.0-or-later
// 'Gravestone' (enemy_2008_flking). Every number arrives in `p` from the reviewed contract
// (shared/arkpedia/enemy-gravestone-features.js).
import { projectileBoxAttack } from './arkpedia-enemy-projectiles.js';

const CAST = 'ab:flkingCast', SHIELD = 'flking_shield[core]';
const pos = v => Number.isFinite(v) && v > 0;

export function gravestone(p) {
  const s = p?.shield;
  if (!pos(p?.rangedScale) || !pos(p.rangedAnim?.dur) || !pos(p.meleeAnim?.dur) || !pos(s?.ratio) || !pos(s.cooldown) || !(s.initial >= 0) || !pos(s.cast?.dur))
    throw Error('Invalid Gravestone parameters');
  const shell = projectileBoxAttack({ speed: 5, lifetime: 10, width: 3, height: 3, damageScale: p.rangedScale });
  const clip = e => { e.def = { ...e.def, attackAnim: e.blockedBy ? p.meleeAnim : p.rangedAnim }; };
  const finish = (b, e, a) => {
    a.cast = null; e.profile.noAttack = false; e.skillAnimUntil = b.time; b.removeBuff(e, CAST);
    if (e.mem.regularFormVisual?.playId === `gravestone:${e.id}`) e.mem.regularFormVisual = null;
  };
  return {
    spawn(b, e, a) { shell.spawn(b, e); clip(e); a.cast = null; a.readyAt = b.time + s.initial; },
    before(_c, _b, e) { e.profile.attackVisual = e.blockedBy ? 'Attack_2' : 'Attack_1'; },
    attack(c, b, e) {
      const attackId = c.attackId ?? b._attackSeq;
      const blocker = c.targets.find(t => t === e.blockedBy);
      // Combat: the blocker alone, full ATK. Attack: the 0.4 x ATK splash shell.
      if (blocker) { if (blocker.alive) b.dealDamage(e, blocker, { amount: e.s.atk, type: 'phys', isAttack: true, attackId, applyWay: 'melee' }); return; }
      shell.attack(c, b, e);
    },
    tick(b, e, a, dt) {
      clip(e);
      if (!e.alive) return;
      if (a.cast) {
        if (!e.canAct) { finish(b, e, a); return; } // stun interrupts
        a.cast.elapsed += dt * e.s.slowDownRate;
        if (!a.cast.released && a.cast.elapsed + 1e-9 >= s.cast.hit) {
          a.cast.released = true;
          // enemy_flking_shiled: the previous barrier ends, a new hp_ratio x max HP one starts.
          b.removeBuff(e, SHIELD); b.addBuff(e, { key: SHIELD, source: e, shield: e.s.maxHp * s.ratio });
        }
        if (a.cast.elapsed + 1e-9 >= s.cast.dur) finish(b, e, a);
        return;
      }
      if (b.time + 1e-9 < a.readyAt || !e.canAct || e.s.flags.silence) return;
      a.readyAt = b.time + s.cooldown; a.cast = { elapsed: 0, released: false };
      e.attackControlEpoch = (e.attackControlEpoch ?? 0) + 1;
      e.profile.noAttack = true; e.skillAnimUntil = b.time + s.cast.dur;
      e.mem.regularFormVisual = { clip: 'Skill', loop: false, speed: 1, playId: `gravestone:${e.id}` };
      b.addBuff(e, { key: CAST, persist: true, flags: { noMove: true } });
    },
  };
}
