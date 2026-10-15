// SPDX-License-Identifier: GPL-3.0-or-later
// Selected S1 command only. Owner attacks and public approval remain separate.
import e from '../../../data/arkpedia-native-operators/char_4228_closur.json' with { type: 'json' };
export const CLOSUR_S1_CONTRACT = Object.freeze({
  scope: 'All ten source S1 ranks: automatic channel, per-deployment DP ramp and owned one-hit reinforcement shields',
  mapping: 'Capture the previous cast count at activation, compute min(cost + count * cost_per_add, cost_add_max), then increment count. Grant one DP per fixed duration/total interval, starting at half an interval. Apply a separate nonstacking owned one-hit shield to current reinforcement recipients at activation.',
  limits: 'Tick-sampled pulse ordering, native status/category aliases and retained shield lifetimes are explicit local mappings. No owner attack controller, other source skills, browser registration, particles/audio/modules or original game-frame/pixel parity are supplied.',
  frameParity: false,
});
const present = u => u?.alive && u.deployed && !u._removing;
export function prepareClosurS1(point, { contract } = {}) {
  if (contract !== CLOSUR_S1_CONTRACT || point.record.owner.index !== 0 || point.u.deploySeq !== 0 || point.u.mem.closurS1)
    throw Error('Closure S1 requires a fresh selected command center and explicit source contract');
  const { b, u } = point, r = point.record.owner;
  const native = e.skills.skchr_closur_1.flatMap(row => row.components).find(p => p.pathId === '2968310938367155906').data;
  if (native._allowNoTarget !== 1 || native._canCastDuringBorn !== 1 || native._canSilenced !== 0
    || native._stopAffectOnInterrupt !== 0 || r.source.duration !== 8 || r.bb.shield_cnt !== 1)
    throw Error('Unreviewed Closure S1 channel inputs');
  const state = { seq: null, casts: 0, total: 0, elapsed: 0, pulses: 0, interval: 0 };
  const key = `closur:s1:shield:${u.id}`;
  const spec = {
    kind: 'duration', duration: r.source.duration, silenceable: false, trigger: { rule: 'SP_FULL' },
    canActivate: () => point.valid() && present(u) && !u.hidden && u.canAct && !u.skill.active,
    onStart: () => {
      if (state.seq !== u.deploySeq) { state.seq = u.deploySeq; state.casts = 0; }
      state.total = Math.min(r.bb.cost + state.casts * r.bb.cost_per_add, r.bb.cost_add_max);
      state.casts++; state.elapsed = 0; state.pulses = 0; state.interval = r.source.duration / state.total;
      for (const a of point.friends()) b.addBuff(a, { key, source: u, shieldHits: r.bb.shield_cnt, refresh: 'replace' });
    },
    onTick: ({ dt }) => {
      if (!point.valid() || !present(u)) return;
      state.elapsed += Math.min(dt, Math.max(0, u.skill.timeLeft));
      while (state.pulses < state.total && state.elapsed + 1e-8 >= state.interval * (state.pulses + .5)) {
        state.pulses++; b.addDp(u.ownerId, 1);
      }
    },
  };
  const result = { state, spec, shieldKey: key }; u.mem.closurS1 = result; return result;
}
