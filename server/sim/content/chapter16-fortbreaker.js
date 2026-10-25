// SPDX-License-Identifier: GPL-3.0-or-later
// Candidate only. Native volley and static delayed impacts have separate lives.
import { areaSelectable, canTargetAlly, sortAllyTargets } from '../targeting.js';
import { blockMcreep } from './chapter16-engagement.js';
import review from '../../../data/candidates/arkpedia-ch16-reviewed-fortbreaker.json' with { type: 'json' };
const live = u => u?.alive && u.deployed && !u.hidden;
const controlled = e => e.s.flags.stun || e.s.flags.sleep || e.s.flags.freeze || e.s.flags.levitate;
const ground = u => !u.isFlying && !u.s.flags.liftoff;
const opponents = b => [...b.allyUnits, ...b.enemies.filter(u => u.profile?.neutral)];
const within = (u, x, y, radius) => Math.hypot(u.x - x, u.y - y) <= radius + (u.profile?.neutral ? (u.mem.ch16BodyRadius ?? .1) : .25) + 1e-9;
const d = review.defaults;
export function fortbreaker(r) {
  if (!Object.hasOwn(review.enemies, r.key) || r.prefabKey !== r.key) throw Error('Unreviewed Fortbreaker identity');
  const skill = r.skills.find(s => s.prefabKey === 'SkyProjectile');
  if (!skill || skill.cooldown !== 10 || skill.initCooldown !== 5 || skill.bb.atk_scale !== .7) throw Error('Unreviewed Fortbreaker skill');
  const engagement = blockMcreep({ cnt: 3, range: .9, rangeAdd: .1, markArmy: true, dualWeapon: true });
  return {
    spawn(b, e, a) {
      engagement.spawn(b, e, a);
      const life = e.deploySeq;
      e.blockWeight = d.blockVolume; e.profile.melee = false; delete e.profile.meleeTarget;
      e.profile.deferHit = true; e.profile.canTarget = ground;
      e.profile.attackMode = () => { e.profile.melee = !!e.blockedBy; return e.blockedBy ? 'combat' : 'attack'; };
      a.cooldown = skill.initCooldown; a.pending = null; a.active = true; a.impacts = new Set(); a.visualTime = 0;
      a.finish = p => {
        if (a.pending !== p) return;
        for (const task of p.tasks) task.cancel();
        a.pending = null; b.removeBuff(e, p.hold); a.cooldown = skill.cooldown;
      };
      a.targets = () => {
        const units = opponents(b).filter(u => live(u) && ground(u) && canTargetAlly(e, u, true) && within(u, e.x, e.y, d.skillRadius));
        sortAllyTargets(e, units); return units;
      };
      a.cast = () => {
        if (!a.active || !live(e) || e.deploySeq !== life || a.pending || controlled(e) || e.s.flags.disarm || !a.targets().length) return;
        const p = { epoch: e.actionControlEpoch, seen: new Map(), tasks: [],
          count: e.findBuff('enemy_uacomd_extra_power') ? d.orderedCount : d.normalCount };
        a.pending = p; e.atkStandUntil = -Infinity;
        p.hold = b.addBuff(e, { key: 'ch16:fortbreaker-cast', persist: true, flags: { noMove: true, disarm: true } });
        const current = () => a.active && live(e) && e.deploySeq === life && a.pending === p && !controlled(e) && e.actionControlEpoch === p.epoch;
        for (let i = 0; i < p.count; i++) p.tasks.push(b.after(d.skillHit + i * d.burstInterval, () => {
          if (!current()) { a.finish(p); return; }
          const units = a.targets(), target = units.find(u => p.seen.get(u) !== u.deploySeq) ?? units[0];
          if (!target) return;
          p.seen.set(target, target.deploySeq);
          const { x, y } = target, targetLife = target.deploySeq;
          // _followTarget=0 and stop-on-target/source-invalid=0: retain the
          // launch position and allow already-born impacts after either dies.
          const task = b.after(d.impactDelay, () => {
            a.impacts.delete(task);
            if (!a.active) return;
            const victims = new Set(opponents(b).filter(u => live(u) && ground(u) && areaSelectable(e, u) && within(u, x, y, d.blastRadius)));
            // Native final trace inclusion is independent of the static area.
            // Never transfer this receipt to a redeployment of the same unit.
            if (target.deploySeq === targetLife && live(target) && ground(target) && areaSelectable(e, target)) victims.add(target);
            for (const u of victims) b.dealDamage(e, u, { amount: e.s.atk * skill.bb.atk_scale, type: 'phys', isAttack: false,
                canDodge: true, applyWay: 'ranged', tags: ['chapter16', 'fortbreaker-volley'] });
          });
          a.impacts.add(task);
          b.emit('ch16FortbreakerLaunch', { source: e, target, x, y, index: i, count: p.count });
        }, { owner: e }));
        p.tasks.push(b.after(d.skillDuration, () => a.finish(p), { owner: e }));
      };
      b.on('battleEnd', () => {
        a.active = false; if (a.pending) a.finish(a.pending);
        for (const task of a.impacts) task.cancel(); a.impacts.clear();
        b.removeBuff(e, 'uacomd_a[power_effect]');
      });
    },
    tick(b, e, a, dt) {
      engagement.tick(b, e, a, dt);
      if (a.pending && (controlled(e) || a.pending.epoch !== e.actionControlEpoch)) a.finish(a.pending);
      else if (!a.pending) { a.cooldown = Math.max(0, a.cooldown - dt); if (!a.cooldown) a.cast(); }
      a.visualTime += dt;
      while (a.visualTime >= .1 - 1e-9) {
        a.visualTime -= .1;
        if (e.findBuff('enemy_uacomd_extra_power')) {
          if (!e.findBuff('uacomd_a[power_effect]')) b.addBuff(e, { key: 'uacomd_a[power_effect]', persist: true });
        } else b.removeBuff(e, 'uacomd_a[power_effect]');
      }
    },
    attack(c, b, e) {
      for (const target of c.targets) {
        const hit = (u, applyWay) => b.dealDamage(e, u, { amount: e.s.atk, type: 'phys', isAttack: true,
          canDodge: true, applyWay, tags: ['chapter16'] });
        if (target === e.blockedBy) hit(target, 'melee');
        else b.addProjectile({ from: e, target, source: e, speed: d.normalProjectileSpeed, maxAge: d.normalProjectileLife,
          onHit: c => { if (c.target) hit(c.target, 'ranged'); } });
      }
    },
    death(c, b, e, a) { if (a.pending) a.finish(a.pending); b.removeBuff(e, 'uacomd_a[power_effect]'); },
  };
}
