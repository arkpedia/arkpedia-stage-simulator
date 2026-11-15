// SPDX-License-Identifier: GPL-3.0-or-later
import {ordinaryEnemyAttackSequence} from './arkpedia-enemy-attack-sequence.js';
import { ALLY_COLLIDER_RADIUS } from '../constants.js';
import { areaSelectable } from '../targeting.js';
import { makeDamageInfo } from '../damage.js';

export function inProjectileBox(unit, x, y, width, height) {
  const dx = Math.max(0, Math.abs(unit.x - x) - width / 2);
  const dy = Math.max(0, Math.abs(unit.y - y) - height / 2);
  return Math.hypot(dx, dy) <= ALLY_COLLIDER_RADIUS + 1e-9;
}

/** A fixed destination and cached damage, independent of the source's later state. */
export function delayedAreaAttack({ delay, radius, type, priorityBuff = null, staticBody = false }) {
  return {
    spawn(b, e) {
      e.profile.deferHit = true; e.profile.shot = 'mortar';
      if (staticBody) b.addBuff(e, { key: 'ab:shellBody', persist: true, flags: { noDisplace: true } });
      if (priorityBuff) e.profile.sameTauntPriority = (a, b) => Number(!!b.findBuff(priorityBuff)) - Number(!!a.findBuff(priorityBuff));
    },
    attack(c, b, e) {
      const amount = e.s.atk * (e.profile.atkScale ?? 1);
      for (const target of c.targets) {
        const { x, y } = target;
        b.fx('bombardShell', { x, y, id: e.id, r: radius, t: delay });
        b.after(delay, () => {
          b.fx('bombard', { x, y, r: radius, kind: 'emppnt' });
          for (const unit of b.allies(null, { includeTargetableDevices: true })) {
            if (!areaSelectable(e, unit) || Math.hypot(unit.x - x, unit.y - y) > radius + 1e-9) continue;
            b.dealDamage(null, unit, { amount, type, sourceless: true, isAttack: false, isSkill: false,
              canDodge: false, tags: ['shell'] });
          }
        });
      }
    },
  };
}

/** Shared projectile transport and area targeting; enemy records supply stats
 * and native predicates own admission. No per-enemy switch or duplicate asset. */
export function projectileBoxAttack(params) { return projectileAreaAttack({ ...params, type: 'phys', visual: 'mortar' }); }
export function projectileCircleAttack(params) { return projectileAreaAttack(params); }
export function projectileSingleAttack(params) { return projectileAreaAttack({ ...params, singleTarget: true }); }
/** Native animation markers share one ordinary cast sequence. Every captured
 * deployment receives one projectile per release; released shots then belong
 * to the ordinary projectile lifecycle and survive source death. */
export function animatedProjectileAttack({animation,...transport}){
  validateProjectileAnimation({animation});
  const shot=projectileSingleAttack(transport);
  return ordinaryEnemyAttackSequence(()=>animation,(b,e,target,cast)=>
    shot.attack({targets:[target],attackId:cast.attackId},b,e));
}
function validateProjectileAnimation({animation}){
  if(!animation||typeof animation.clip!=='string'||!animation.clip||!Number.isFinite(animation.duration)||animation.duration<=0
    ||!Array.isArray(animation.releases)||!animation.releases.length||animation.releases.length>64
    ||animation.releases.some((t,i)=>!Number.isFinite(t)||t<0||t>animation.duration||i>0&&t<=animation.releases[i-1]))
    throw Error('Invalid projectile attack animation');
}
animatedProjectileAttack.validate=validateProjectileAnimation;
/** One blocking target receives melee damage; unblocked targets share the
 * ordinary projectile transport. A shot retains its ranged scale if the
 * shooter becomes blocked before impact. */
export function blockedMeleeProjectileAttack({ maxTargets, rangedScale, meleeScale = 1,
  attackAnim, meleeClip = 'Attack_2', rangedClip = 'Attack', ...transport }) {
  const shot = projectileSingleAttack({ ...transport, damageScale: rangedScale, noAir: true });
  return {
    spawn(b, e) {
      shot.spawn(b, e); e.def = { ...e.def, attackAnim }; e.profile.maxTargets = maxTargets;
      e.profile.canTarget = unit => e.blockedBy ? unit === e.blockedBy : !unit.isFlying;
    },
    before(_c, _b, e) { e.profile.attackVisual = e.blockedBy ? meleeClip : rangedClip; },
    attack(c, b, e) {
      if (!e.blockedBy) return shot.attack(c, b, e);
      const target = c.targets.find(unit => unit === e.blockedBy);
      if (target) b.dealDamage(e, target, { amount: e.s.atk * meleeScale, type: transport.type,
        isAttack: true, attackId: b._attackSeq, applyWay: 'melee' });
    },
  };
}
export function taggedArtsBonus({ tag, damage }) {
  return (b, e, unit) => {
    if (unit.tags.has(tag)) b.dealDamage(e, unit, { amount: damage, type: 'arts', canDodge: false,
      noSp: true, isAttack: true, applyWay: 'ranged', tags: ['enemyTrapBonus'] });
  };
}
export function taggedProjectileAttack({ priorityTag, bonus, ...params }) {
  return projectileBurstAttack({ ...params, count: 1, spacing: 0, priorityTag, onImpact: taggedArtsBonus(bonus) });
}
/** A native multi-projectile attack retains its original targets and attack ID.
 * Later launches can be interrupted; projectiles already released remain live. */
export function projectileBurstAttack({ count, spacing, priorityTag = null, priorityBuff = null, maxTargets = null, ...params }) {
  const shot = projectileSingleAttack(params);
  return {
    spawn(b, e) {
      shot.spawn(b, e);
      if (priorityTag) { e.profile.targetPriority = 'tag'; e.profile.priorityTag = priorityTag; }
      if (priorityBuff) { e.profile.targetPriority = 'withBuff'; e.profile.priorityBuff = priorityBuff; }
      if (maxTargets != null) e.profile.maxTargets = maxTargets;
    },
    attack(c, b, e) {
      const volley = { ...c, targets: [...c.targets], attackId: b._attackSeq };
      shot.attack(volley, b, e);
      const life = e.deploySeq;
      for (let i = 1; i < count; i++) b.after(spacing * i, () => {
        if (e.alive && e.deployed && e.deploySeq === life && e.canAct) shot.attack(volley, b, e);
      });
    },
  };
}
function projectileAreaAttack({ speed, lifetime, width, height, radius, type, noAir = false, visual = 'enemyArea', singleTarget = false, meleeWhenBlocked = false, onImpact = null, onAcceptedImpact = null, onTileImpact = null, resolveHit = null, damageScale = 1, element = null }) {
  return {
    spawn(_b, e) {
      e.profile.deferHit = true; e.profile.shot = visual;
      if (noAir) e.profile.canTarget = unit => !unit.isFlying;
    },
    attack(c, b, e) {
      const snapshot = e.s.atk * (e.profile.atkScale ?? 1) * damageScale, attackId = c.attackId ?? b._attackSeq;
      for (const target of c.targets) {
        if (meleeWhenBlocked && target === e.blockedBy) {
          b.dealDamage(e, target, { amount: snapshot, type, isAttack: true, attackId, applyWay: 'melee' });
          continue;
        }
        b.addProjectile({ from: e, target, speed, maxAge: lifetime,
        visual: 'lob', source: e, hitDead: true,
        onHit({ target: locked, x, y }) {
          const targets = new Set();
          for (const unit of singleTarget ? [] : b.allies(null, { includeTargetableDevices: true })) {
            if (!areaSelectable(e, unit) || noAir && unit.isFlying) continue;
            if (radius != null) {
              if (Math.hypot(unit.x - x, unit.y - y) <= radius + 1e-9) targets.add(unit);
              continue;
            }
            if (inProjectileBox(unit, x, y, width, height)) targets.add(unit);
          }
          if (locked?.alive && locked.deployed && !locked.hidden && !(noAir && locked.isFlying)) targets.add(locked);
          const amount = e.alive ? e.s.atk * (e.profile.atkScale ?? 1) * damageScale : snapshot;
          if (!singleTarget) b.fx('explode', { x, y, r: radius ?? Math.max(width, height) / 2, kind: visual });
          for (const unit of targets) {
            // Some native payloads choose between resource manipulation and
            // damage. They share transport without producing a placeholder hit.
            if (resolveHit) { resolveHit(b, e, unit, { amount, attackId }); continue; }
            const life = unit.deploySeq;
            const packet = makeDamageInfo({ amount, type,
              isAttack: true, attackId, applyWay: 'ranged', tags: [singleTarget ? 'enemyProjectile' : 'enemyProjectileArea'] });
            let accepted = false;
            const off = element || onAcceptedImpact ? b.on('calculatedDamage', receipt => { if (receipt.dmg === packet) accepted = true; }) : null;
            try { b.dealDamage(e, unit, packet); } finally { if (off) b.off(off); }
            // Native elemental attack payload follows an accepted HP hit,
            // including shield absorption, and has its own gauge mitigation.
            if (element && accepted && unit.alive && unit.deployed && unit.deploySeq === life)
              b.dealDamage(e, unit, { type: 'element', element: element.type, amount: amount / damageScale * element.ratio,
                isAttack: true, attackId, applyWay: 'ranged', tags: ['enemyProjectileElement'] });
            if (accepted && unit.alive && unit.deployed && !unit.hidden && unit.deploySeq === life) onAcceptedImpact?.(b, e, unit);
            // Native additive buffs have their own missability; a missed damage
            // action does not cancel an independently unmissable payload.
            if (unit.alive && unit.deployed && !unit.hidden && unit.deploySeq === life) onImpact?.(b, e, unit, { amount, attackId });
          }
          onTileImpact?.(b, e, { x, y, target: locked, attackId });
        },
      });
      }
    },
  };
}

/** Shared attack-recovery charge selection. Silence delays spending but does
 * not stop ordinary attacks from charging up to the source's actual capacity. */
export function chargedAttacks(ordinary, charged, { initialSp, cost, increment, maxSp = cost,
  silenceBlocksSpend = true, respectNoSp = false }) {
  return {
    spawn(b, e, a) { ordinary.spawn(b, e); a.charge = initialSp; },
    attack(c, b, e, a) {
      const release = a.charge >= cost && !(silenceBlocksSpend && e.s.flags.silence);
      a.charge = release ? a.charge - cost : respectNoSp && e.s.flags.noSp ? a.charge : Math.min(maxSp, a.charge + increment);
      (release ? charged : ordinary).attack(c, b, e);
    },
  };
}
