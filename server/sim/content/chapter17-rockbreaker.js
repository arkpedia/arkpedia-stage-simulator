// SPDX-License-Identifier: GPL-3.0-or-later
// Experimental candidate. Retained Skill events, not a guessed release delay.
import { spawnChildren } from './enemies.js';
import contract from '../../../data/candidates/arkpedia-ch17-rockbreaker-contract.json' with { type: 'json' };
const FLAG = 'enemy_mudia_casted_flag';
const live = e => e?.alive && e.deployed && !e.hidden;
const controlled = e => e.s.flags.stun || e.s.flags.sleep || e.s.flags.freeze || e.s.flags.levitate;
const mark = (b, e) => b.addBuff(e, { key: FLAG, persist: true });

export function rockbreaker(r) {
  if (!Object.hasOwn(contract.enemies, r.key) || r.prefabKey !== r.key) throw Error('Unreviewed Rockbreaker identity');
  return {
    spawn(b, e, a) {
      const life = e.deploySeq;
      a.active = true; a.pending = null;
      const valid = () => a.active && live(e) && e.deploySeq === life;
      a.finish = pending => {
        if (a.pending !== pending) return;
        pending.release?.cancel(); pending.end?.cancel(); a.pending = null;
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
        const pending = { epoch: e.actionControlEpoch };
        a.pending = pending;
        pending.hold = b.addBuff(e, { key: 'enemy_mudia_summon_ing', persist: true,
          flags: { noMove: true, disarm: true } });
        if (!valid()) { a.finish(pending); return; }
        const current = () => a.pending === pending && valid() && !controlled(e) && pending.epoch === e.actionControlEpoch;
        pending.release = b.after(contract.defaults.skillHit, () => {
          if (!current()) { a.finish(pending); return; }
          const bound = contract.defaults.offsetBound;
          const pos = [Math.round(e.y) + b.rng.range(-bound, bound), Math.round(e.x) + b.rng.range(-bound, bound)];
          const child = spawnChildren(b, e, r.key, 1, { pos, countInTotal: true })[0];
          if (!child) return;
          // The new body has canonical full stats. Existing damage/debuffs are
          // not copied; only the native split mark and remaining route travel.
          mark(b, child); mark(b, e);
          child.mem.ch17RockbreakerParent = e.id;
          for (const key of ['visitEveryCheckPoint', 'nativeReachRadius'])
            if (e.route[key] != null) child.route[key] = e.route[key];
          if (e.route.goal) child.route.goal = { ...e.route.goal };
        }, { owner: e });
        pending.end = b.after(contract.defaults.skillDuration, () => a.finish(pending), { owner: e });
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
      if (a.pending && (controlled(e) || a.pending.epoch !== e.actionControlEpoch)) a.finish(a.pending);
    },
    death(c, b, e, a) { a.detach(); },
  };
}
