// SPDX-License-Identifier: GPL-3.0-or-later
// Direct candidate only. Registration stays held pending the remaining native
// control/FSM and rate-boundary review; source retention alone grants no support.
import review from '../../../data/candidates/arkpedia-ch17-reviewed-brute.json' with { type: 'json' };
import { canTargetAlly } from '../targeting.js';
const live = e => e?.alive && e.deployed && !e.hidden;
const controlled = e => ['stun','freeze','sleep','levitate','fear','disarm'].some(flag => e.s.flags[flag]);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export function pollutionBrute(r) {
  const proof = review.enemies[r.key];
  if (!proof || r.prefabKey !== r.key || !same(r.talents.groups,proof.groups)
    || !same(r.talents.bb,proof.bb) || !same(r.skills,proof.skills) || !same(r.abilities,proof.abilities))
    throw Error('Unreviewed pollution Brute contract');
  return {
    spawn(b, e, a) {
      const life = e.deploySeq;
      const valid = () => a.active && live(e) && e.deploySeq === life;
      a.active = true; a.mode = 0; a.pending = null; a.cooldown = 0;
      e.profile.noAttack = true;
      a.finish = (p, restore = true) => {
        if (a.pending !== p) return;
        a.pending = null;
        for (const task of p.tasks) task.cancel();
        b.removeBuff(e,p.hold);
        if (restore && p.mode === 1 && valid()) {
          // enemy_mubrut_switch_back restores Default and explicitly updates
          // Combat's cooldown to a fresh full period at the cast's end.
          a.mode = 0; a.cooldown = e.s.interval;
        }
      };
      a.contact = () => {
        if (!valid() || a.mode === 1) return;
        if (a.pending) a.finish(a.pending,false);
        a.mode = 1; a.cooldown = 0; e.atkStandUntil = -Infinity;
      };
      e.mem.ch17PollutionReaction = a.contact;
      a.cast = () => {
        const target = e.blockedBy;
        if (!valid() || controlled(e) || a.pending || !live(target) || !canTargetAlly(e,target,true)) return false;
        const ctx = { attacker:e, targets:[target], isSkill:false, profile:e.profile };
        b.emit('beforeAttack',ctx);
        const selected = ctx.targets?.find(live);
        if (!valid() || !selected) return false;
        const mode = a.mode, duration = mode ? review.defaults.enhancedDuration : review.defaults.normalDuration;
        // Match the battle's existing attack-clip rate convention. Native
        // ASPD/slow-down/FSM parity remains a separately held review boundary.
        const rate = e.s.interval > 0 ? Math.max(1,duration/e.s.interval) : 1;
        const p = { mode, target:selected, targetLife:selected.deploySeq, epoch:e.attackControlEpoch, startedAt:b.time,
          attackId:++b._attackSeq, tasks:[] };
        a.pending = p; a.cooldown = e.s.interval;
        p.hold = b.addBuff(e,{key:'ch17:brute-cast',persist:true,flags:{noMove:true}});
        p.epoch = e.attackControlEpoch;
        e.stats.attacks++;
        const current = () => valid() && a.pending === p && !controlled(e) && p.epoch === e.attackControlEpoch;
        const times = mode ? review.defaults.enhancedHits : [review.defaults.normalHit];
        for (let index=0; index<times.length; index++) p.tasks.push(b.after(times[index]/rate,() => {
          if (!current()) { a.finish(p); return; }
          // Input-target refresh is false. Never transfer a remaining hit to a
          // new blocker, or to a later deployment reusing the same Unit object.
          if (!live(p.target) || p.target.deploySeq !== p.targetLife) return;
          b._ev(['atk',e.id,p.target.id,'none']);
          b.dealDamage(e,p.target,{amount:e.s.atk,type:'phys',isAttack:true,attackId:p.attackId,
            canDodge:true,applyWay:'melee',tags:['chapter17','brute']});
          b.emit('ch17BruteHit',{attacker:e,target:p.target,index,mode,attackId:p.attackId});
        },{owner:e}));
        p.tasks.push(b.after(duration/rate,() => a.finish(p),{owner:e}));
        b.emit('attack',{attacker:e,targets:[selected],isSkill:false});
        return true;
      };
      a.detach = () => {
        a.active = false;
        if (e.mem.ch17PollutionReaction === a.contact) delete e.mem.ch17PollutionReaction;
        if (a.pending) a.finish(a.pending,false);
      };
      b.on('battleEnd',a.detach,{owner:e});
    },
    tick(b, e, a, dt) {
      if (!a.active || !live(e)) {
        if (a.pending) a.finish(a.pending);
        return;
      }
      if (!e.s.flags.stun) a.cooldown = Math.max(0,a.cooldown-dt);
      if (a.pending) {
        if (controlled(e) || a.pending.epoch !== e.attackControlEpoch) a.finish(a.pending);
      } else if (!a.cooldown) a.cast();
    },
    death(c, b, e, a) { a.detach(); },
  };
}
