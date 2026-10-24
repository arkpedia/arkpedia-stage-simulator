// SPDX-License-Identifier: GPL-3.0-or-later
// Candidate chapter 16/17 controllers. Parameters come from canonical enemy
// records; native actions are retained in arkpedia-ch16-action-source.json.
import { COLS } from '../constants.js';

const living = u => u?.alive && u.deployed && !u.hidden;
const bb = (r, group, key) => r.talents.bb[`${group}.${key}`];
const flag = (b, e, key, flags, duration) => b.addBuff(e, { key, flags, duration, persist: duration == null, refresh: 'replace' });
const damage = (b, source, target, amount, type = 'true') => b.dealDamage(source, target, { amount, type, canDodge: false, tags: ['chapter16'] });
const operators = b => b.allyUnits.filter(u => living(u) && u.kind === 'op');

import { chapter17Environment as chapter16Environment, reverseDamage, deadSummon, chargeRift, warCaster, leakSource } from './chapter17.js';
export { chapter17Environment as chapter16Environment, reverseDamage, deadSummon, chargeRift, warCaster, leakSource, pollute, beamIntersection } from './chapter17.js';

export function miner(r) {
  return {
    spawn(b, e, a) {
      e.profile.friendly = true; e.profile.neutral = true; e.profile.noAttack = true;
      b.addBuff(e, { key: 'ch16:neutral-taunt', persist: true, mods: { taunt: -1 } });
      b.on('elementHit', c => { if (c.target === e) c.cancel = true; }, { owner: e });
      flag(b, e, 'ch16:neutral', { unblockable: true });
      a.heal = 0; a.scan = 0; a.fear = null;
    },
    tick(b, e, a, dt) {
      a.heal += dt; a.scan += dt;
      if (a.heal >= 1 - 1e-9) {
        a.heal -= 1;
        for (const medic of operators(b)) {
          if (medic.def.profession !== 'MEDIC') continue;
          if (medic.rangeChanged) b._refreshRange(medic);
          if (medic.rangeKeys?.includes(e.tileR * COLS + e.tileC))
            b.heal(medic, e, medic.s.atk * bb(r, 'GetHeal', 'heal_scale'));
        }
      }
      if (a.scan >= 0.3 - 1e-9) {
        a.scan -= 0.3;
        if (e.s.flags.fear) { if (a.fear == null) a.fear = 0; }
        else a.fear = null;
        if (!e.s.flags.fear && !e.findBuff('gyegrd_a[exist]')) {
          const env = chapter16Environment(b);
          for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
            const key = (e.tileR + dr) * COLS + e.tileC + dc;
            env.shadowSuppressedUntil.set(key, b.time + bb(r, 'TileEscapeShadowManager', 'times'));
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
