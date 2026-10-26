// SPDX-License-Identifier: GPL-3.0-or-later
// Candidate only. Native volley and static delayed impacts have separate lives.
import { areaSelectable, canTargetAlly, sortAllyTargets } from '../targeting.js';
import { blockMcreep } from './chapter16-engagement.js';
import { sourceAbilityDelta } from './arkpedia-slow-down.js';
import { captureEnemySource } from './enemy-source-view.js';
import review from '../../../data/candidates/arkpedia-ch16-reviewed-fortbreaker.json' with { type: 'json' };
import clockContract from '../../../data/candidates/arkpedia-ch16-fortbreaker-clock-contract.json' with { type: 'json' };
const live = u => u?.alive && u.deployed && !u.hidden;
const controlled = e => e.s.flags.stun || e.s.flags.sleep || e.s.flags.freeze || e.s.flags.levitate || e.s.flags.fear;
const attackControlled = e => controlled(e) || e.s.flags.disarm || e.s.flags.noCombat && !!e.blockedBy;
const ground = u => !u.isFlying && !u.s.flags.liftoff;
const opponents = b => [...b.allyUnits, ...b.enemies.filter(u => u.profile?.neutral)];
const within = (u, x, y, radius) => Math.hypot(u.x - x, u.y - y) <= radius + (u.profile?.neutral ? (u.mem.ch16BodyRadius ?? .1) : .25) + 1e-9;
const d = review.defaults;
export function fortbreaker(r) {
  if (!Object.hasOwn(review.enemies, r.key) || r.prefabKey !== r.key) throw Error('Unreviewed Fortbreaker identity');
  const skill = r.skills.find(s => s.prefabKey === 'SkyProjectile');
  if (!skill || skill.cooldown !== 10 || skill.initCooldown !== 5 || skill.bb.atk_scale !== .7) throw Error('Unreviewed Fortbreaker skill');
  const clocks = clockContract.enemies[r.key];
  if (!clocks || ['attack','combat','skill'].some(key => {
    const c = JSON.parse(clocks.casts[key].originalJson), timing = clocks.timings[key];
    return c._affectedBySlowDown !== 1 || c._maxAnimScale !== 1 || c._timeMode !== (key === 'skill' ? 1 : 0)
      || timing.hit !== (key === 'skill' ? d.skillHit : d.attackHit) || timing.duration !== (key === 'skill' ? d.skillDuration : d.attackDuration);
  })) throw Error('Unreviewed Fortbreaker cast clocks');
  const engagement = blockMcreep({ cnt: 3, range: .9, rangeAdd: .1, markArmy: true, dualWeapon: true });
  return {
    spawn(b, e, a) {
      engagement.spawn(b, e, a);
      const life = e.deploySeq;
      e.blockWeight = d.blockVolume; e.profile.melee = false; delete e.profile.meleeTarget;
      e.profile.deferHit = true; e.profile.canTarget = ground;
      e.profile.attackMode = () => { e.profile.melee = !!e.blockedBy; return e.blockedBy ? 'combat' : 'attack'; };
      e.profile.attackCooldownAffectedBySlowDown = true;
      a.cooldown = skill.initCooldown; a.pending = null; a.active = true; a.impacts = new Set(); a.visualTime = 0;
      const valid = () => a.active && !b.finished && !b._endReq && live(e) && e.deploySeq === life;
      const ordinary = { pending: null };
      ordinary.finish = p => { if (ordinary.pending !== p) return; ordinary.pending = null; b.removeBuff(e, p.hold); };
      ordinary.begin = targets => {
        if (!valid() || a.pending || ordinary.pending || attackControlled(e) || !targets.length || targets.some(t => !live(t))) return false;
        const mode = e.blockedBy ? 'combat' : 'attack';
        const p = { mode, targets: targets.map(unit => ({ unit, life: unit.deploySeq })), epoch: e.attackControlEpoch,
          age: 0, lastAt: b.time, rate: e.s.interval > 0 ? Math.min(1, e.base.bat / e.s.interval) : 1,
          released: false, attackId: ++b._attackSeq };
        ordinary.pending = p; e.lastAttackAt = b.time; e.stats.attacks++; e.atkCd = e.s.interval;
        p.hold = b.addBuff(e, { key: 'ch16:fortbreaker-ordinary', persist: true, flags: { noMove: true } });
        return true;
      };
      ordinary.advance = p => {
        const current = () => valid() && ordinary.pending === p && !attackControlled(e) && p.epoch === e.attackControlEpoch;
        if (!current()) { ordinary.finish(p); return; }
        p.age += sourceAbilityDelta(e, Math.max(0, b.time-p.lastAt), true) * p.rate; p.lastAt = b.time;
        if (!p.released && p.age + 1e-7 >= clocks.timings[p.mode].hit) {
          p.released = true;
          // F_Attack selects at release; F_Combat retains its input deployment.
          const targets = p.mode === 'attack' ? a.targets(e.base.rangeRadius).slice(0, Math.max(1, Math.floor(e.profile.maxTargets ?? 1) + Math.floor(e.s.maxTargets)))
            : p.targets.filter(t => live(t.unit) && t.unit.deploySeq === t.life).map(t => t.unit);
          for (const target of targets) b._ev(['atk', e.id, target.id, 'none']);
          if (current()) b.emit('attack', { attacker: e, targets, isSkill: false, profile: e.profile, attackId: p.attackId, fortbreakerMode: p.mode });
        }
        if (!current() || p.age + 1e-7 >= clocks.timings[p.mode].duration) ordinary.finish(p);
      };
      a.ordinary = ordinary; e.profile.sourceAttack = ordinary;
      a.finish = p => {
        if (a.pending !== p) return;
        a.pending = null; b.removeBuff(e, p.hold); a.cooldown = skill.cooldown;
      };
      a.targets = (radius = d.skillRadius) => {
        const units = opponents(b).filter(u => live(u) && ground(u) && canTargetAlly(e, u, true) && within(u, e.x, e.y, radius));
        sortAllyTargets(e, units); return units;
      };
      a.cast = () => {
        if (!valid() || a.pending || controlled(e) || e.s.flags.disarm || !a.targets().length) return;
        if (ordinary.pending) ordinary.finish(ordinary.pending);
        const p = { epoch: e.actionControlEpoch, seen: new Map(), age: 0, lastAt: b.time, next: 0,
          count: e.findBuff('enemy_uacomd_extra_power') ? d.orderedCount : d.normalCount };
        a.pending = p; e.atkStandUntil = -Infinity;
        p.hold = b.addBuff(e, { key: 'ch16:fortbreaker-cast', persist: true, flags: { noMove: true, disarm: true } });
      };
      a.advance = p => {
        const current = () => valid() && a.pending === p && !controlled(e) && e.actionControlEpoch === p.epoch;
        if (!current()) { a.finish(p); return; }
        // TimeMode1: fixed playback, eligible live slowdown; no ASPD scaling.
        p.age += sourceAbilityDelta(e, Math.max(0, b.time-p.lastAt), true); p.lastAt = b.time;
        while (p.next < p.count && p.age + 1e-7 >= d.skillHit + p.next * d.burstInterval) {
          const i = p.next++;
          const units = a.targets(), target = units.find(u => p.seen.get(u) !== u.deploySeq) ?? units[0];
          if (!target) continue;
          p.seen.set(target, target.deploySeq);
          const { x, y } = target, targetLife = target.deploySeq, sourceLife = e.deploySeq, sourceView = captureEnemySource(e);
          // _followTarget=0 and stop-on-target/source-invalid=0: retain the
          // launch position and allow already-born impacts after either dies.
          const task = b.after(d.impactDelay, () => {
            a.impacts.delete(task);
            if (!a.active) return;
            const source = e.deploySeq === sourceLife ? e : sourceView;
            const victims = new Set(opponents(b).filter(u => live(u) && ground(u) && areaSelectable(source, u) && within(u, x, y, d.blastRadius)));
            // Native final trace inclusion is independent of the static area.
            // Never transfer this receipt to a redeployment of the same unit.
            if (target.deploySeq === targetLife && live(target) && ground(target) && areaSelectable(source, target)) victims.add(target);
            const selected = [...victims].map(unit => ({ unit, life: unit.deploySeq }));
            for (const { unit, life } of selected) {
              if (!a.active) break;
              if (!live(unit) || unit.deploySeq !== life) continue;
              // Damage hooks may replace a body between area victims. Resolve
              // source identity again and never transfer a selected victim life.
              const credit = e.deploySeq === sourceLife ? e : sourceView;
              b.dealDamage(credit, unit, { amount: credit.s.atk * skill.bb.atk_scale, type: 'phys', isAttack: false,
                canDodge: true, applyWay: 'ranged', tags: ['chapter16', 'fortbreaker-volley'] });
            }
          });
          a.impacts.add(task);
          b.emit('ch16FortbreakerLaunch', { source: e, target, x, y, index: i, count: p.count });
          if (!current()) { a.finish(p); return; }
        }
        if (p.age + 1e-7 >= d.skillDuration) a.finish(p);
      };
      b.on('removed', ({ unit }) => { if (unit === e) { if (a.pending) a.finish(a.pending); if (ordinary.pending) ordinary.finish(ordinary.pending); } });
      b.on('battleEnd', () => {
        a.active = false; if (a.pending) a.finish(a.pending);
        if (ordinary.pending) ordinary.finish(ordinary.pending);
        for (const task of a.impacts) task.cancel(); a.impacts.clear();
        b.removeBuff(e, 'uacomd_a[power_effect]');
      });
    },
    tick(b, e, a, dt) {
      engagement.tick(b, e, a, dt);
      if (a.ordinary.pending) a.ordinary.advance(a.ordinary.pending);
      if (a.pending) a.advance(a.pending);
      else { a.cooldown = Math.max(0, a.cooldown - dt); if (!a.cooldown) a.cast(); }
      a.visualTime += dt;
      while (a.visualTime >= .1 - 1e-9) {
        a.visualTime -= .1;
        if (e.findBuff('enemy_uacomd_extra_power')) {
          if (!e.findBuff('uacomd_a[power_effect]')) b.addBuff(e, { key: 'uacomd_a[power_effect]', persist: true });
        } else b.removeBuff(e, 'uacomd_a[power_effect]');
      }
    },
    attack(c, b, e, a) {
      const sourceLife = e.deploySeq, sourceView = captureEnemySource(e);
      for (const target of c.targets) {
        const targetLife = target.deploySeq;
        const hit = (u, applyWay) => {
          if (!a.active || !live(u) || u.deploySeq !== targetLife) return;
          const source = e.deploySeq === sourceLife ? e : sourceView;
          b.dealDamage(source, u, { amount: source.s.atk, type: 'phys', isAttack: true, attackId: c.attackId,
            canDodge: true, applyWay, tags: ['chapter16'] });
        };
        if (c.fortbreakerMode === 'combat') hit(target, 'melee');
        else b.addProjectile({ from: e, target, source: e, speed: d.normalProjectileSpeed, maxAge: d.normalProjectileLife,
          onHit: c => { if (c.target) hit(c.target, 'ranged'); } });
      }
    },
    death(c, b, e, a) { if (a.pending) a.finish(a.pending); if (a.ordinary.pending) a.ordinary.finish(a.ordinary.pending); b.removeBuff(e, 'uacomd_a[power_effect]'); },
  };
}
