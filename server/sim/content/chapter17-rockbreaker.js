// SPDX-License-Identifier: GPL-3.0-or-later
// Experimental candidate. Retained Skill events, not a guessed release delay.
import { spawnChildren } from './enemies.js';
import contract from '../../../data/candidates/arkpedia-ch17-rockbreaker-contract.json' with { type: 'json' };
import {sourceAbilityDelta} from './arkpedia-slow-down.js';
const FLAG = 'enemy_mudia_casted_flag';
const live = e => e?.alive && e.deployed && !e.hidden;
const controlled = e => e.s.flags.stun || e.s.flags.sleep || e.s.flags.freeze || e.s.flags.levitate;
const mark = (b, e) => b.addBuff(e, { key: FLAG, persist: true });

export function rockbreaker(r) {
  if (!Object.hasOwn(contract.enemies, r.key) || r.prefabKey !== r.key) throw Error('Unreviewed Rockbreaker identity');
  const skills=contract.enemies[r.key].native.map(row=>JSON.parse(row)).filter(row=>row._animKey==='Skill');
  if(skills.length!==1||skills[0]._affectedBySlowDown!==1||skills[0]._timeMode!==1||skills[0]._maxAnimScale!==1||skills[0]._waitForAttackEvent!==1)
    throw Error('Unreviewed Rockbreaker Skill clock');
  return {
    spawn(b, e, a) {
      const life = e.deploySeq;
      a.active = true; a.pending = null;
      const valid = () => a.active && live(e) && e.deploySeq === life;
      a.finish = pending => {
        if (a.pending !== pending) return;
        a.pending = null;
        b.removeBuff(e, pending.hold);
      };
      a.contact = () => {
        if (!valid() || a.pending || e.findBuff(FLAG)) return;
        // TriggerEnemySkill bypasses readiness/cooldown. The initial-control
        // convention is still an explicit candidate boundary in the contract.
        if (controlled(e)) return;
        // The native request clears pending ordinary attacks and palsy before
        // entering Skill; it does not reset the main Combat cooldown on exit.
        b.removeBuff(e, 'palsy');
        e.atkStandUntil = -Infinity;
        const pending = { epoch: e.actionControlEpoch, age:0, lastAt:b.time, released:false };
        a.pending = pending;
        pending.hold = b.addBuff(e, { key: 'enemy_mudia_summon_ing', persist: true,
          flags: { noMove: true, disarm: true } });
        if (!valid()) { a.finish(pending); return; }
      };
      a.advance = pending => {
        const current = () => a.pending === pending && valid() && !controlled(e) && pending.epoch === e.actionControlEpoch;
        if (!current()) { a.finish(pending); return; }
        // Native Skill is affected by slow_down. Consume only the remaining
        // animation work, including speed changes between its hit and end.
        pending.age+=sourceAbilityDelta(e,Math.max(0,b.time-pending.lastAt),true);pending.lastAt=b.time;
        if(!pending.released&&pending.age+1e-7>=contract.defaults.skillHit){
          pending.released=true;
          const bound = contract.defaults.offsetBound;
          const pos = [Math.round(e.y) + b.rng.range(-bound, bound), Math.round(e.x) + b.rng.range(-bound, bound)];
          const child = spawnChildren(b, e, r.key, 1, { pos, countInTotal: true })[0];
          if (child) {
            // The new body has canonical full stats. Existing damage/debuffs
            // are not copied; only its split mark and remaining route travel.
            mark(b, child); mark(b, e);
            child.mem.ch17RockbreakerParent = e.id;
            for (const key of ['visitEveryCheckPoint', 'nativeReachRadius'])
              if (e.route[key] != null) child.route[key] = e.route[key];
            if (e.route.goal) child.route.goal = { ...e.route.goal };
          }
        }
        if(!current()||pending.age+1e-7>=contract.defaults.skillDuration)a.finish(pending);
      };
      e.mem.ch17PollutionReaction = a.contact;
      a.detach = () => {
        a.active = false;
        if (e.mem.ch17PollutionReaction === a.contact) delete e.mem.ch17PollutionReaction;
        if (a.pending) a.finish(a.pending);
      };
      b.on('battleEnd', a.detach, { owner: e });
    },
    tick(b, e, a) {
      if (a.pending) a.advance(a.pending);
    },
    death(c, b, e, a) { a.detach(); },
  };
}
