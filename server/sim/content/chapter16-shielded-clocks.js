// SPDX-License-Identifier: GPL-3.0-or-later
// Selected source-bound clocks; native initial FSM/frame ordering is unclaimed.
import contract from '../../../data/candidates/arkpedia-ch16-shielded-clock-contract.json' with { type: 'json' };
import { sourceAbilityDelta } from './arkpedia-slow-down.js';
const live = u => u?.alive && u.deployed && !u.hidden;
const controlled = e => ['stun', 'freeze', 'sleep', 'levitate', 'fear', 'disarm'].some(k => e.s.flags[k])
  || e.s.flags.noCombat && !!e.blockedBy;
export function shieldedClocks(record, family) {
  const proof = contract.enemies[record.key];
  if (!proof || proof.family !== family || record.prefabKey !== record.key) throw Error('Unreviewed shielded enemy clock identity');
  const casts = {};
  for (const mode of [0, 1]) for (const kind of ['Attack', 'Combat']) {
    const key = `m${mode}${kind}`, n = JSON.parse(proof.casts[key].originalJson);
    if (n._timeMode !== 0 || n._maxAnimScale !== 1 || n._affectedBySlowDown !== 1
      || n._selectTargetSource !== 2 || n._selectTargetTiming !== 0 || n._waitForAttackEvent !== 1
      || n._damageType !== 1 || n._attackType !== 1 || n._animKey !== (mode ? 'B_Attack' : 'A_Attack'))
      throw Error('Unreviewed shielded enemy ordinary clock');
    casts[key] = proof.timings[n._animKey];
  }
  const t = JSON.parse(proof.transition.originalJson);
  if (t._timeMode !== (family === 'abnormal-slug' ? 1 : 0) || t._maxAnimScale !== -1
    || t._affectedBySlowDown !== 1 || t._waitForAttackEvent !== 0 || proof.timings.Trans.duration !== 1)
    throw Error('Unreviewed shielded enemy transition clock');
  return { casts, transition: { duration: proof.timings.Trans.duration, timeMode: t._timeMode } };
}
export function installShieldedAttackClock(b, e, a, clocks) {
  const life = e.deploySeq, port = { pending: null };
  const valid = () => a.active && !b.finished && !b._endReq && live(e) && e.deploySeq === life && e.profile.sourceAttack === port;
  port.finish = p => { if (port.pending !== p) return; port.pending = null; b.removeBuff(e, p.hold); };
  port.begin = targets => {
    if (!valid() || a.phase || port.pending || controlled(e) || !targets.length || targets.some(t => !live(t))) return false;
    const key = e.profile.attackMode(), p = { key, targets: targets.map(unit => ({ unit, life: unit.deploySeq })),
      epoch: e.attackControlEpoch, age: 0, lastAt: b.time, rate: Math.min(1, e.base.bat / e.s.interval),
      released: false, attackId: ++b._attackSeq };
    if (!clocks.casts[key]) throw Error('Unreviewed shielded enemy attack mode');
    port.pending = p; e.lastAttackAt = b.time; e.atkCd = e.s.interval; e.stats.attacks++;
    p.hold = b.addBuff(e, { key: 'ch16:shielded-ordinary', persist: true, flags: { noMove: true } });
    return true;
  };
  port.advance = p => {
    const current = () => valid() && port.pending === p && !a.phase && !controlled(e)
      && e.attackControlEpoch === p.epoch && p.key.startsWith(`m${a.mode}`);
    if (!current()) { port.finish(p); return; }
    p.age += sourceAbilityDelta(e, Math.max(0, b.time-p.lastAt), true) * p.rate; p.lastAt = b.time;
    const timing = clocks.casts[p.key];
    if (!p.released && p.age + 1e-7 >= timing.hit) {
      p.released = true;
      const targets = p.targets.filter(t => live(t.unit) && t.unit.deploySeq === t.life);
      for (const { unit, life } of targets) {
        if (!current()) { port.finish(p); return; }
        if (!live(unit) || unit.deploySeq !== life) continue;
        b._ev(['atk', e.id, unit.id, 'none']);
        b.dealDamage(e, unit, { amount: e.s.atk * (e.profile.atkScale ?? 1), type: 'phys', isAttack: true,
          attackId: p.attackId, canDodge: true, applyWay: 'melee', tags: ['chapter16', 'shielded-native-event'] });
      }
      if (current()) b.emit('attack', { attacker: e, targets: targets.map(t => t.unit), isSkill: false, profile: e.profile, attackId: p.attackId });
    }
    if (!current() || p.age + 1e-7 >= timing.duration) port.finish(p);
  };
  e.profile.sourceAttack = port; e.profile.attackCooldownAffectedBySlowDown = true;
  a.ordinary = port;
}
export function shieldedTransitionClock(b, e, clocks) {
  return { epoch: e.actionControlEpoch, age: 0, lastAt: b.time,
    rate: clocks.transition.timeMode === 1 ? 1 : e.base.bat / e.s.interval };
}
export function advanceShieldedTransition(b, e, phase, clocks) {
  phase.age += sourceAbilityDelta(e, Math.max(0, b.time-phase.lastAt), true) * phase.rate; phase.lastAt = b.time;
  return phase.age + 1e-7 >= clocks.transition.duration;
}
