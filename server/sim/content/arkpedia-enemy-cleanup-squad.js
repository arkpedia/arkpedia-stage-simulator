// SPDX-License-Identifier: GPL-3.0-or-later
// Armorless Union Cleanup Squads (enemy_1183_mlasrt[_2|_3]). Every number arrives in `p` from the reviewed contract
// (shared/arkpedia/enemy-cleanup-squad-features.js).
import { projectileSingleAttack, chargedAttacks } from './arkpedia-enemy-projectiles.js';
import { elem } from './arkpedia-enemy-effects.js';

const anim = x => x?.dur > 0 && x.hit > 0 && x.hit <= x.dur;

export function cleanupSquad(p) {
  if (!anim(p?.attackAnim) || !anim(p.skillAnim) || !(p.scale > 0) || !(p.cost > 0) || !(p.speed > 0) || !(p.lifetime > 0) || !(p.corrosion >= 0))
    throw Error('Invalid Cleanup Squad parameters');
  const normal = projectileSingleAttack({ speed: p.speed, lifetime: p.lifetime, type: 'phys' });
  const power = projectileSingleAttack({ speed: p.speed, lifetime: p.lifetime, type: 'phys', damageScale: p.scale });
  const attacks = chargedAttacks(normal, power, { initialSp: p.initialSp, cost: p.cost, increment: p.increment, maxSp: p.maxSp });
  // The next attack's clip: the Skill clip when PowerAttack can spend, else Attack (its wind-up and rest).
  const clip = (e, a) => { e.def = { ...e.def, attackAnim: a.charge >= p.cost && !e.s.flags.silence ? p.skillAnim : p.attackAnim }; };
  return {
    ...attacks,
    spawn(b, e, a) { attacks.spawn(b, e, a); clip(e, a); },
    attack(c, b, e, a) { attacks.attack(c, b, e, a); clip(e, a); },
    tick(_b, e, a) { clip(e, a); },
    // EpDamage: every attack hit adds ATK x attack@ep_damage_ratio Corrosion.
    dealt(c, b, e) { if (c.dmg?.isAttack && c.target && p.corrosion > 0) elem(b, e, c.target, 'erosion', e.s.atk * p.corrosion); },
  };
}
