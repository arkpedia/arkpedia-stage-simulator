// SPDX-License-Identifier: GPL-3.0-or-later
// Multicellular and Allotropic Heralds (enemy_1438_dspred[_2]). Every number arrives in `p` from the reviewed contract
// (shared/arkpedia/enemy-herald-features.js).
import { ALLY_COLLIDER_RADIUS } from '../constants.js';

const pos = v => Number.isFinite(v) && v > 0;

export function heraldDevour(p) {
  if (!pos(p?.radius) || !pos(p.cast?.dur) || !pos(p.cast.hit) || !(p.hpPct >= 0) || !(p.atkPct >= 0) || typeof p.carapace !== 'string')
    throw Error('Invalid Herald parameters');
  const CAST = 'dspred_tr_1[cast]', MARK = 'dspred_tr_1[mark]';
  const isCarapace = u => u.defId === p.carapace;
  const finish = (b, e, a) => {
    a.cast = null; e.profile.noAttack = false; e.skillAnimUntil = b.time; b.removeBuff(e, CAST);
    if (e.mem.regularFormVisual?.clip === 'Skill') e.mem.regularFormVisual = null;
    if (!a.ate || !e.alive) return;
    // dspred_tr_1[switch_mode_2]: mode 1 (the B_ clips), MAX_HP and ATK MULTIPLIER, and the mark.
    b.addBuff(e, { key: 'dspred_tr_1[attribute]', persist: true, mods: { hpPct: p.hpPct, atkPct: p.atkPct } });
    b.addBuff(e, { key: MARK, persist: true });
    e.mem.heraldMode = 1;
  };
  return {
    spawn(b, e, a) { e.def = { ...e.def, attackAnim: p.attackAnim }; a.used = false; a.cast = null; a.ate = false; },
    tick(b, e, a, dt) {
      if (!e.alive) return;
      if (a.cast) {
        a.cast.elapsed += dt * e.s.slowDownRate;
        if (!a.cast.released && a.cast.elapsed + 1e-9 >= p.cast.hit) {
          a.cast.released = true;
          // dspred_tr_1[kill]: only an Excrescent Carapace is eaten.
          const t = a.cast.target;
          if (t?.alive && isCarapace(t)) { a.ate = true; b.kill(t); }
        }
        if (a.cast.elapsed + 1e-9 >= p.cast.dur) finish(b, e, a);
        return;
      }
      if (a.used || !e.canAct) return;
      // Skill "0": once, the first opposing unit (target-free ones included) within range_radius.
      const target = b.allies(null, { includeTargetableDevices: true })
        .filter(u => u.alive && u.deployed !== false && !u.hidden && Math.hypot(u.x - e.x, u.y - e.y) <= p.radius + ALLY_COLLIDER_RADIUS + 1e-9)
        .sort((x, y) => Math.hypot(x.x - e.x, x.y - e.y) - Math.hypot(y.x - e.x, y.y - e.y))[0];
      if (!target) return;
      a.used = true;
      if (e.findBuff(MARK)) return;
      // dspred_tr_1 -> [blockee] -> skill "1" on that unit, interrupting the current action.
      a.cast = { target, elapsed: 0, released: false };
      e.attackControlEpoch = (e.attackControlEpoch ?? 0) + 1;
      e.profile.noAttack = true; e.skillAnimUntil = b.time + p.cast.dur;
      e.mem.regularFormVisual = { clip: 'Skill', loop: false, speed: 1, playId: `herald:${e.id}` };
      b.addBuff(e, { key: CAST, persist: true, flags: { noMove: true } });
    },
  };
}
