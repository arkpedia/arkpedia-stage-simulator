// SPDX-License-Identifier: GPL-3.0-or-later
// Leafcarpet (enemy_8013_mcnrsh). Every number arrives in `p` from the reviewed contract
// (shared/arkpedia/enemy-leafcarpet-features.js).
import { areaSelectable } from '../targeting.js';
import { ALLY_COLLIDER_RADIUS } from '../constants.js';

// enemy_mcnrsh_trigger_1/_2 check STUNNED, LEVITATE, FROZEN, UNMOVABLE and FEARED on the owner.
const controlled = e => { const f = e.s.flags; return !!(f.stun || f.freeze || f.levitate || f.noMove || f.fear); };

/** The rush: every 0.1 s (first check after one interval) a free, unblocked Leafcarpet starts mcnrsh_t[trigger] with a
 * fresh predelay; its trigger fires every `interval` up to `limit` times, and each firing after the predelay adds one
 * additive Movement Speed stack. If a control status lands while the rush runs (predelay included), the rush ends and
 * Leafcarpet takes weak[limit] (Fragile: `fragile` extra damage for `fragileDuration`). The crash: each ally whose
 * collider it touches (ground units only) takes `crashScale` x its current Movement Speed as Physical damage (no SP) and a `crashStun` stun,
 * once per contact, moving or not. */
export function leafcarpetRush(p) {
  validate(p);
  const stop = (b, e, a) => { a.active = false; a.stacks = 0; a.elapsed = 0; a.triggers = 0; b.removeBuff(e, 'ab:mcnrshRush'); };
  return {
    iv: .1,
    spawn(_b, _e, a) { a.active = false; a.stacks = 0; a.elapsed = 0; a.triggers = 0; a.check = p.check; a.contacts = new Map(); },
    tick(b, e, a, dt) {
      if (!e.alive) return;
      if (a.active && controlled(e)) {
        stop(b, e, a);
        b.applyStatus(e, 'fragile', { key: 'weak[limit]', source: e, duration: p.fragileDuration, value: p.fragile });
      } else if (a.active) {
        a.elapsed += dt;
        while (a.elapsed + 1e-9 >= p.interval && a.triggers < p.limit) {
          a.elapsed -= p.interval; a.triggers++;
          if (b.time - a.elapsed <= a.readyAt + 1e-9) continue;
          a.stacks++; b.addBuff(e, { key: 'ab:mcnrshRush', mods: { movePct: p.increase * a.stacks }, persist: true });
        }
      } else {
        a.check -= dt;
        if (a.check <= 1e-9) {
          a.check += p.check;
          if (!e.blockedBy && !controlled(e)) { a.active = true; a.elapsed = 0; a.triggers = 0; a.readyAt = b.time + p.predelay; }
        }
      }
      const near = b.alliesInRadius(e.x, e.y, p.crashRadius + ALLY_COLLIDER_RADIUS).filter(u => !u.isFlying && areaSelectable(e, u));
      const present = new Set(near); for (const u of a.contacts.keys()) if (!present.has(u)) a.contacts.delete(u);
      for (const u of near) {
        if (a.contacts.get(u) === u.deploySeq) continue; a.contacts.set(u, u.deploySeq);
        const amount = e.s.moveSpeed * p.crashScale;
        if (amount > 0) b.dealDamage(e, u, { amount, type: 'phys', isAttack: true, applyWay: 'melee', noSp: true, tags: ['leafcarpetCrash'] });
        if (u.alive) b.applyStatus(u, 'stun', { duration: p.crashStun, source: e });
        if (!e.alive) return;
      }
    },
  };
}
function validate(p) {
  const pos = v => Number.isFinite(v) && v > 0, nn = v => Number.isFinite(v) && v >= 0;
  if (!p || !pos(p.increase) || !pos(p.interval) || !Number.isSafeInteger(p.limit) || p.limit < 1 || !nn(p.predelay) || !pos(p.check)
    || !pos(p.crashScale) || !pos(p.crashRadius) || !pos(p.crashStun) || !pos(p.fragile) || !pos(p.fragileDuration)) throw Error('Invalid Leafcarpet rush');
}
leafcarpetRush.validate = validate;
