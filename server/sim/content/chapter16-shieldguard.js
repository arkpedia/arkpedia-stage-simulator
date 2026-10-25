// SPDX-License-Identifier: GPL-3.0-or-later
// Source-bound candidate; feature/stage review is separate from implementation.
import { blockMcreep } from './chapter16-engagement.js';
export function shieldguard(r) {
  const bb = r.talents.bb;
  const reduction = bb['ExtraPower.damage_resistance'];
  if (bb['BlockMcreep.block_mcreep_cnt'] !== 3 || !(reduction > 0 && reduction < 1)) throw Error('Unreviewed Shieldguard parameters');
  const engagement = blockMcreep({ cnt: 3, range: bb['BlockMcreep.range_radius'], rangeAdd: bb['BlockMcreep.range_radius_add'],
    attackRange: r.stats.rawRangeRadius, markArmy: true, dualWeapon: true });
  return {
    ...engagement,
    spawn(b, e, a) {
      engagement.spawn(b, e, a); a.powerScan = 0; a.fx = null;
      a.clearFx = () => { if (a.fx) b.removeBuff(e, a.fx); a.fx = null; };
      const life = e.deploySeq;
      a.damageModifier = (source, target, dmg) => target === e && e.alive && e.deploySeq === life
        && e.findBuff('enemy_uacomd_extra_power') && ['phys', 'arts'].includes(dmg.type) ? 1 - reduction : 1;
      b._takenMultipliers ??= new Map();
      b._takenMultipliers.set(e, a.damageModifier);
      a.clearModifier = () => { if (b._takenMultipliers.get(e) === a.damageModifier) b._takenMultipliers.delete(e); };
      b.on('battleEnd', () => { a.clearFx(); a.clearModifier(); }, { owner: e });
    },
    tick(b, e, a, dt) {
      engagement.tick(b, e, a, dt);
      a.powerScan += dt;
      while (a.powerScan >= .1 - 1e-9) {
        a.powerScan -= .1;
        if (e.findBuff('enemy_uacomd_extra_power')) {
          if (a.fx && !e.buffs.includes(a.fx)) a.fx = null;
          if (!e.findBuff('uashld_a[extra_effect_core]')) a.fx = b.addBuff(e, { key: 'uashld_a[extra_effect_core]', persist: true });
        } else { b.removeBuff(e, 'uashld_a[extra_effect_core]'); a.fx = null; }
      }
    },
    death(c, b, e, a) { a.clearFx(); a.clearModifier(); },
  };
}
