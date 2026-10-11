// SPDX-License-Identifier: GPL-3.0-or-later
// Unregistered impact links. The future controller owns Wanted, ammunition,
// aiming and managed bombardment clocks; accepted births are supplied here.
import evidence from '../../../data/arkpedia-lemuen-prefabs.json' with { type: 'json' };
import { canTargetEnemy } from '../targeting.js';
import { bodyDist } from '../body.js';

export const LEMUEN_ID = 'char_4193_lemuen';
const live = u => u?.alive && u.deployed && !u.hidden && !u._removing;
const plain = Object.freeze({ canHitFly: true, dmgType: 'phys', attack: 'ranged' });
const splash = Object.freeze({ ...plain, ignoreCamouflage: true });
const flat = rows => Object.fromEntries(rows.map(r => [r.key, r.value]));

export function selectedLemuenBlackboard(skill, rank) {
  const source = evidence.tables.skills[`skchr_lemuen_${skill}`];
  if (!Number.isInteger(skill) || !Number.isInteger(rank) || !source || rank < 1 || rank > source.levels.length)
    throw Error('Invalid Lemuen source skill/rank');
  return Object.freeze(flat(source.levels[rank - 1].blackboard));
}

/** Damage kernels have no default flight or bombardment scheduling. Normal/S1
 * projectiles sample ATK on impact. S2 uses the native current_value snapshot;
 * S3 receives the native cached_atk taken by the end-of-skill controller. */
export class LemuenCombatLinks {
  constructor(battle, unit) {
    if (unit.def.charId !== LEMUEN_ID) throw Error('Lemuen links require Lemuen source data');
    this.b = battle; this.u = unit;
  }
  physical(target, amount, tag, attackId, { dodge = true, area = false } = {}) {
    if (!live(target) || !canTargetEnemy(this.u, target, area ? splash : plain)) return false;
    this.b.dealDamage(this.u, target, { amount, type: 'phys', applyWay: 'ranged',
      canDodge: dodge, isAttack: true, isSkill: tag !== 'normal', isSplash: area,
      attackId, tags: [`lemuen:${tag}`] });
    return true;
  }
  normalImpact(target, attackId) {
    return this.physical(target, this.u.s.atk, 'normal', attackId);
  }
  s1Impact(target, attackId, selected) {
    return this.physical(target, this.u.s.atk * selected['attack@atk_scale'], 's1', attackId);
  }
  snapshotS2(scale) {
    if (!(Number.isFinite(scale) && scale > 0)) throw Error('Invalid Lemuen aimed scale');
    return this.u.s.atk * scale;
  }
  s2Impact(target, attackId, currentValue) {
    if (!(Number.isFinite(currentValue) && currentValue > 0)) throw Error('Missing Lemuen aimed ATK snapshot');
    // Native FixedValueDamage ignores MISS, not invulnerability or shields.
    return this.physical(target, currentValue, 's2', attackId, { dodge: false });
  }
  launch(target, attackId, mode, { selected, currentValue } = {}) {
    if (!live(this.u) || !live(target) || !canTargetEnemy(this.u, target, plain)
      || (target.s.flags.camou && !target.blockedBy)) return false;
    if (![0, 1, 2].includes(mode)) throw Error('Invalid Lemuen projectile mode');
    if (mode === 1 && !Number.isFinite(selected?.['attack@atk_scale'])) throw Error('Missing Lemuen S1 source scale');
    if (mode === 2 && !(Number.isFinite(currentValue) && currentValue > 0)) throw Error('Missing Lemuen aimed ATK snapshot');
    const name = mode ? `projectile_chr_lemuen_s${mode}` : 'projectile_chr_lemuen';
    const components = evidence.projectiles[name].flatMap(r => r.components.map(c => c.data));
    const speed = components.find(c => c._speed != null)._speed;
    const life = components.find(c => c._lifeTime != null)._lifeTime;
    if (speed !== 12 || life !== 5) throw Error('Unreviewed Lemuen flight source');
    return this.b.addProjectile({ from: this.u, target, source: this.u, speed, maxAge: life,
      expireInPlace: true, visual: 'arrow', data: { arkpediaTrackedVisual: true },
      onHit: ({ target: victim }) => {
        if (mode === 0) this.normalImpact(victim, attackId);
        else if (mode === 1) this.s1Impact(victim, attackId, selected);
        else this.s2Impact(victim, attackId, currentValue);
      } });
  }
  s3Impact(x, y, cachedAtk, attackId, selected) {
    if (![x, y, cachedAtk].every(Number.isFinite) || !(cachedAtk > 0)) throw Error('Missing Lemuen bombardment snapshot');
    const targets = this.b.enemiesInRadius(x, y, selected['attack@dist_2'])
      .filter(e => canTargetEnemy(this.u, e, splash));
    for (const target of targets) {
      const scale = bodyDist(target, x, y) <= selected['attack@dist_1'] + 1e-9
        ? selected['attack@proj_atk_scale_1'] : selected['attack@proj_atk_scale_2'];
      this.physical(target, cachedAtk * scale, 's3', attackId, { area: true });
    }
    return targets;
  }
}
