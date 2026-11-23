// SPDX-License-Identifier: GPL-3.0-or-later
// Fieldmus and Hard-Snouted Fieldmus (enemy_1395_dhxts[_2]). Every number arrives in `p` from the reviewed contract
// (shared/arkpedia/enemy-fieldmus-features.js).
import { environmentCondition } from '../../../shared/arkpedia/environment-conditions.js';
import { ALLY_COLLIDER_RADIUS } from '../constants.js';

const pos = v => Number.isFinite(v) && v > 0;
const anim = x => pos(x?.dur) && pos(x.hit) && x.hit <= x.dur;
const live = u => u?.alive && u.deployed !== false && !u.removed;

export function fieldmus(p) {
  const v = p?.valve, s = p?.blight;
  if (!anim(p?.attackAnim) || typeof v?.tag !== 'string' || !pos(v.radius) || !pos(v.ratio) || !anim(v.anim)
    || !pos(s?.interval) || typeof s.key !== 'string') throw Error('Invalid Fieldmus parameters');
  const CAST = 'ab:fieldmusValveCast';
  // TL's trigger: a live unit tagged trap_dhtl (a Throttle Valve) within the 0.5 collider; one target, the nearest.
  const valve = (b, e) => b.units
    .filter(u => u !== e && live(u) && u.tags?.has?.(v.tag) && Math.hypot(u.x - e.x, u.y - e.y) <= v.radius + ALLY_COLLIDER_RADIUS)
    .sort((x, y) => Math.hypot(x.x - e.x, x.y - e.y) - Math.hypot(y.x - e.x, y.y - e.y))[0] ?? null;
  const finish = (b, e, a) => { a.cast = null; e.profile.noAttack = false; e.skillAnimUntil = b.time; b.removeBuff(e, CAST); };
  const hide = (b, e) => { if (!e.findBuff(s.key)) b.addBuff(e, { key: s.key, persist: true, flags: { stealth: true }, data: { stealthRestore: 0 } }); };
  return {
    spawn(b, e, a) {
      e.def = { ...e.def, attackAnim: p.attackAnim };
      a.cast = null; a.left = 0; // the Passive's first check is immediate (waitFirstTriggerInterval 0)
      // ON_OWNER_BLOCKEE_CHANGED + CheckBlocked: being blocked ends the derived invisibility at once.
      b.on('blocked', ({ enemy }) => { if (enemy === e) b.removeBuff(e, s.key); }, { owner: e });
    },
    tick(b, e, a, dt) {
      if (!e.alive) return;
      a.left -= dt;
      if (a.left <= 1e-9) {
        a.left += s.interval;
        if (!environmentCondition(b, e, 'act31SidePollute')) b.removeBuff(e, s.key);
        else if (!e.blockedBy) hide(b, e);
      }
      if (a.cast) {
        a.cast.elapsed += dt * e.s.slowDownRate;
        if (!a.cast.released && a.cast.elapsed + 1e-9 >= v.anim.hit) {
          a.cast.released = true;
          const t = a.cast.target;
          if (live(t)) b.dealDamage(e, t, { amount: t.s.maxHp * v.ratio, type: 'true', noSp: true, isSkill: true, tags: ['fieldmusValve'] });
        }
        if (a.cast.elapsed + 1e-9 >= v.anim.dur) finish(b, e, a);
        return;
      }
      if (!e.canAct) return;
      const t = valve(b, e);
      if (!t) return;
      a.cast = { target: t, elapsed: 0, released: false };
      e.profile.noAttack = true; e.skillAnimUntil = b.time + v.anim.dur;
      b.addBuff(e, { key: CAST, persist: true, flags: { noMove: true } });
    },
    death(_c, b, e, a) { if (a.cast) finish(b, e, a); },
  };
}
