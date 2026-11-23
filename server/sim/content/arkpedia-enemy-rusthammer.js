// SPDX-License-Identifier: GPL-3.0-or-later
// Rusthammer Warrior (enemy_2006_flsnip). Every number arrives in `p` from the reviewed contract
// (shared/arkpedia/enemy-rusthammer-features.js).
import { projectileSingleAttack } from './arkpedia-enemy-projectiles.js';

const pos = v => Number.isFinite(v) && v > 0;

export function rusthammerWarrior(p) {
  if (!pos(p?.invincible) || !pos(p.cooldown) || !(p.initial >= 0) || !pos(p.scale) || !pos(p.speed) || !pos(p.lifetime) || !pos(p.attackAnim?.dur))
    throw Error('Invalid Rusthammer Warrior parameters');
  const normal = projectileSingleAttack({ speed: p.speed, lifetime: p.lifetime, type: 'phys' });
  const critical = projectileSingleAttack({ speed: p.speed, lifetime: p.lifetime, type: 'arts', damageScale: p.scale });
  return {
    spawn(b, e, a) {
      normal.spawn(b, e); e.def = { ...e.def, attackAnim: p.attackAnim, immune: new Set([...e.def.immune, 'sleep']) };
      a.readyAt = b.time + p.initial; a.critical = false;
      // faust_c_blockfree (BLOCK_FREE, sleep-immune) for life; faust_t_invi (INVINCIBLE) for `invincible` s.
      b.addBuff(e, { key: 'faust_c_blockfree', persist: true, flags: { unblockable: true } });
      b.applyStatus(e, 'invulnerable', { key: 'faust_t_invi', source: e, duration: p.invincible });
    },
    tick(b, e) { if (e.s.flags.silence) b.removeBuff(e, 'faust_t_invi'); }, // faust_t_invi is silenceable
    before(_c, b, e, a) {
      a.critical = b.time + 1e-9 >= a.readyAt; // CriticalHit ignores silence
      e.profile.attackVisual = a.critical ? 'Skill_1' : 'Attack';
    },
    attack(c, b, e, a) {
      if (a.critical) { a.critical = false; a.readyAt = b.time + p.cooldown; critical.attack(c, b, e); }
      else normal.attack(c, b, e);
    },
  };
}
