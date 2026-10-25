// SPDX-License-Identifier: GPL-3.0-or-later
// Candidate chapter 16/17 controllers. Parameters come from canonical enemy
// records; native actions are retained in arkpedia-ch16-action-source.json.
import { COLS } from '../constants.js';
import { chapter16Shadow } from './chapter16-shadow.js';

const living = u => u?.alive && u.deployed && !u.hidden;
const bb = (r, group, key) => r.talents.bb[`${group}.${key}`];
const flag = (b, e, key, flags, duration) => b.addBuff(e, { key, flags, duration, persist: duration == null, refresh: 'replace' });
const damage = (b, source, target, amount, type = 'true') => b.dealDamage(source, target, { amount, type, canDodge: false, tags: ['chapter16'] });
const operators = b => b.allyUnits.filter(u => living(u) && u.kind === 'op');

import { reverseDamage, deadSummon, chargeRift, warCaster, leakSource } from './chapter17.js';
export { chapter17Environment as chapter16Environment, reverseDamage, deadSummon, chargeRift, warCaster, leakSource, pollute, beamIntersection } from './chapter17.js';

export function miner(r) {
  return {
    spawn(b, e, a) {
      e.profile.friendly = true; e.profile.neutral = true; e.profile.noAttack = true;
      e.mem.ch16Miner = true;
      b.addBuff(e, { key: 'enemy_mcreep_self_mark', persist: true });
      b.addBuff(e, { key: 'mark_neutral[effect]', persist: true });
      e.profile.meleeTarget = () => {
        return b.enemies.filter(u => u !== e && living(u) && !u.profile?.neutral && !u.profile?.friendly
          && !u.s.flags.sleep && !u.s.flags.stealth && !u.s.flags.camou
          // Native selector ignores TARGET_FREE, including the Rock Wall's
          // passive. Other invisibility states still prevent acquisition.
          && Math.hypot(u.x - e.x, u.y - e.y) <= r.stats.rawRangeRadius + (u.mem.ch16BodyRadius ?? .1) + 1e-9)
          .sort((a, z) => (z.s.taunt ?? 0) - (a.s.taunt ?? 0)
            || Math.hypot(a.x - e.x, a.y - e.y) - Math.hypot(z.x - e.x, z.y - e.y) || a.id - z.id)[0] ?? null;
      };
      b.addBuff(e, { key: 'ch16:neutral-taunt', persist: true, mods: { taunt: -1 } });
      b.on('elementHit', c => { if (c.target === e) c.cancel = true; }, { owner: e });
      flag(b, e, 'ch16:neutral', { unblockable: true });
      a.heal = 0; a.scan = 0; a.fear = null;
    },
    tick(b, e, a, dt) {
      const row = Math.round(e.y), col = Math.round(e.x);
      a.heal += dt; a.scan += dt;
      if (a.heal >= 1 - 1e-9) {
        a.heal -= 1;
        for (const medic of operators(b)) {
          if (medic.def.profession !== 'MEDIC') continue;
          if (medic.rangeChanged) b._refreshRange(medic);
          if (medic.rangeKeys?.includes(row * COLS + col))
            b.heal(medic, e, medic.s.atk * bb(r, 'GetHeal', 'heal_scale'));
        }
      }
      if (a.scan >= 0.3 - 1e-9) {
        a.scan -= 0.3;
        if (e.s.flags.fear) { if (a.fear == null) a.fear = 0; }
        else a.fear = null;
        if (!e.s.flags.fear && !e.findBuff('gyegrd_a[exist]')) {
          const env = chapter16Shadow(b);
          for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
            env.suppressShadow(row + dr, col + dc, bb(r, 'TileEscapeShadowManager', 'times'));
          }
        }
      }
      if (a.fear != null) {
        a.fear += dt;
        if (a.fear >= 1 - 1e-9) {
          a.fear -= 1;
          if (e.hp < e.s.maxHp) damage(b, e, e, bb(r, 'FearLoseBlood', 'value'));
        }
      }
    },
  };
}

export const chapter16Abilities = { ch16Miner: miner, ch16ReverseDamage: reverseDamage, ch16DeadSummon: deadSummon,
  ch16ChargeRift: chargeRift, ch16WarCaster: warCaster, ch16LeakSource: leakSource };
