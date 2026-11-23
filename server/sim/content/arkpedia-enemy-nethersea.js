// SPDX-License-Identifier: GPL-3.0-or-later
// Nethersea Spewers and Predators (enemy_1233_dsshtr[_2], enemy_1231_dsrunr[_2]). Every number arrives in `p` from the
// reviewed contract (shared/arkpedia/enemy-nethersea-features.js). Nethersea Brand: a tile_creep / tile_creepf tile.
import { animatedProjectileAttack } from './arkpedia-enemy-projectiles.js';
import { elem } from './arkpedia-enemy-effects.js';
import { ALLY_COLLIDER_RADIUS } from '../constants.js';

const onBrand = (b, u, keys) => keys.includes(b.grid.tile(Math.round(u.y), Math.round(u.x))?.key);
// trap_creep_ep_damage: every damage the unit outputs adds Nervous Impairment of ATK x ratio to its target.
const neuralOnOutput = ratio => (c, b, e) => {
  if (!(ratio > 0) || !c.target?.alive || c.target.side === e.side || c.dmg?.type === 'element') return;
  elem(b, e, c.target, 'neural', e.s.atk * ratio);
};

export function netherseaSpewer(p) {
  const { radius, maxTargets, neural, brand, ...transport } = p ?? {};
  if (!(radius > 0) || !(maxTargets >= 1) || !(neural >= 0) || !Array.isArray(brand)) throw Error('Invalid Spewer parameters');
  const shot = animatedProjectileAttack(transport);
  return {
    ...shot,
    spawn(b, e, a) {
      shot.spawn(b, e, a);
      e.profile.maxTargets = maxTargets;
      // One selector: inside the 1.0 collider, or on Nethersea Brand anywhere (globalRange lifts the radius check).
      e.profile.globalRange = true;
      e.profile.canTarget = u => e.blockedBy ? u === e.blockedBy
        : Math.hypot(u.x - e.x, u.y - e.y) <= radius + ALLY_COLLIDER_RADIUS + 1e-9 || onBrand(b, u, brand);
      e.markDirty();
    },
    dealt: neuralOnOutput(neural),
  };
}

export function netherseaPredator(p) {
  const { prob, neural, brand, poll, attackAnim } = p ?? {};
  if (!(prob > 0 && prob <= 1) || !(neural >= 0) || !Array.isArray(brand) || !(poll > 0) || !(attackAnim?.dur > 0)) throw Error('Invalid Predator parameters');
  const DODGE = 'dsrunr_evade', FREE = 'dsrunr_blockfree';
  return {
    spawn(b, e, a) { e.def = { ...e.def, attackAnim }; a.poll = 0; },
    tick(b, e, a, dt) {
      if (!e.alive) return;
      // Evade: Physical and Arts dodge, off while stunned/frozen/asleep/levitated, silenced or unmovable.
      const disabled = e.s.flags.stun || e.s.flags.silence || e.s.flags.noMove;
      if (disabled && e.findBuff(DODGE)) b.removeBuff(e, DODGE);
      else if (!disabled && !e.findBuff(DODGE)) b.addBuff(e, { key: DODGE, persist: true, mods: { dodgePhys: prob, dodgeArts: prob } });
      // BlockFree: every 0.2 s, block-free on Brand.
      a.poll += dt;
      if (a.poll + 1e-9 < poll) return;
      a.poll -= poll;
      const on = onBrand(b, e, brand);
      if (on && !e.findBuff(FREE)) { b.addBuff(e, { key: FREE, persist: true, flags: { unblockable: true } }); if (e.blockedBy) b._unblock(e); }
      else if (!on && e.findBuff(FREE)) b.removeBuff(e, FREE);
    },
    dealt: neuralOnOutput(neural),
  };
}
