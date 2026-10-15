// SPDX-License-Identifier: GPL-3.0-or-later
// Selected S2 command. Owner firing and public approval are separate.
import e from '../../../data/arkpedia-native-operators/char_4228_closur.json' with { type: 'json' };
export const CLOSUR_S2_CONTRACT = Object.freeze({
  scope: 'All ten source S2 ranks: immediate/periodic DP, owned reinforcement DEF/block aura, and BORN-entry refunds',
  mapping: 'One DP is granted at each original two-second interval. Current reinforcement recipients receive source DEF and block bonuses. An accepted new aura application records whether an operator is in BORN, then triggers once after the original .03s delay. Refunds use ceil(current normalized COST * cost_return), excluding actual move-like self/external respawns. Free card delivery is eligible: its cost attribute is distinct from payment.',
  limits: 'Global aura/category aliases, per-owner local keys and tick ordering are mappings. BORN follows advertised selected-native deadlines or the original deploy clip, not compiled Unity FSM state. Regular card COST retains the selected deployment cost including card discounts/redeployment scaling; low-level diagnostics fall back to base COST. Native dynamic COST modifiers, public delivery, modules/particles/audio and frame/pixel parity remain separate.',
  frameParity: false,
});
const present = u => u?.alive && u.deployed && !u._removing;
export function prepareClosurS2(point, { contract } = {}) {
  if (contract !== CLOSUR_S2_CONTRACT || point.record.owner.index !== 1 || point.u.deploySeq !== 0 || point.u.mem.closurS2)
    throw Error('Closure S2 requires a fresh selected command center and explicit source contract');
  const { b, u } = point, r = point.record.owner;
  const parts = e.skills.skchr_closur_2.flatMap(row => row.components);
  const native = parts.find(p => p.pathId === '-8775341784753306710').data;
  const aura = parts.find(p => p.pathId === '-7438602077884841046').data;
  if (native._allowNoTarget !== 1 || native._canCastDuringBorn !== 1 || native._canSilenced !== 0
    || native._resetAbilityCooldownWhenCastEnd !== 0 || aura._listenUnitRebornEvent !== 1
    || r.source.duration !== 30 || typeof b.isUnitInBornState !== 'function') throw Error('Unreviewed Closure S2 inputs');
  const state = { elapsed: 0, pulses: 0, recipients: new Map(), handles: [], stopped: false };
  const key = `closur:s2:friend:${u.id}`;
  const active = () => !state.stopped && point.valid() && u.skill.active;
  function remove(a, row) {
    row.timer?.cancel(); if (a.findBuff(key) === row.buff) b.removeBuff(a, key); state.recipients.delete(a);
  }
  function sync() {
    const wanted = new Set(active() ? point.friends() : []);
    for (const [a, row] of state.recipients) if (!wanted.has(a) || a.deploySeq !== row.seq || a.findBuff(key) !== row.buff) remove(a, row);
    for (const a of wanted) {
      if (state.recipients.has(a)) continue;
      const seq = a.deploySeq;
      const born = a.kind === 'op' && b.isUnitInBornState(a) && !a.moveLikeRespawn;
      const buff = b.addBuff(a, { key, source: u, mods: { defPct: r.bb.def, blockCnt: r.bb.block_cnt } });
      if (!buff) continue;
      // A beforeBuff hook may retire either owner or recipient synchronously.
      // Never leave a newly accepted aura behind after its controller stopped.
      if (!active() || !present(a) || a.deploySeq !== seq || !point.friends().includes(a)) {
        if (a.findBuff(key) === buff) b.removeBuff(a, key);
        continue;
      }
      const row = { seq, buff, timer: null }; state.recipients.set(a, row);
      if (!born) continue;
      row.timer = b.after(aura._buffs[0].triggerInterval, () => {
        row.timer = null;
        if (!active() || !present(a) || a.deploySeq !== row.seq || a.moveLikeRespawn
          || state.recipients.get(a) !== row || a.findBuff(key) !== row.buff || !point.friends().includes(a)) return;
        const cost = a.mem.regularCostAttribute ?? a.base.cost;
        b.addDp(u.ownerId, Math.ceil(Math.abs(cost * r.bb.cost_return)));
      }, { owner: u });
    }
  }
  const clear = () => { for (const [a, row] of [...state.recipients]) remove(a, row); };
  const stop = () => {
    if (state.stopped) return; state.stopped = true; clear();
    for (const h of state.handles) b.off(h); state.handles = [];
  };
  const spec = {
    kind: 'duration', duration: r.source.duration, silenceable: false, trigger: { rule: 'NEVER' },
    mods: { atkPct: r.bb.atk }, attack: { isSkill: false },
    canActivate: () => point.valid() && present(u) && !u.hidden && u.canAct && !u.skill.active,
    onStart: () => { state.elapsed = 0; state.pulses = 0; b.addDp(u.ownerId, r.bb.cost); sync(); },
    onTick: ({ dt }) => {
      if (!active()) return;
      state.elapsed += Math.min(dt, Math.max(0, u.skill.timeLeft));
      const interval = r.bb['closur_s_2[add_cost_period].interval'];
      while (state.pulses < r.bb.cost_period && state.elapsed + 1e-8 >= (state.pulses + 1) * interval) {
        state.pulses++; b.addDp(u.ownerId, r.bb['closur_s_2[add_cost_period].cost']);
      }
      sync();
    }, onEnd: clear,
  };
  const install = () => {
    if (state.handles.length || state.stopped) throw Error('Closure S2 cannot be reinstalled');
    state.handles = [b.on('deploy', () => { if (active()) sync(); }, { owner: u }),
      b.on('sourceMoveBorn', () => { if (active()) sync(); }, { owner: u }),
      b.on('tick', () => { if (active()) sync(); }, { owner: u }),
      b.on('death', ({ unit }) => { if (unit === u) stop(); else if (state.recipients.has(unit)) remove(unit, state.recipients.get(unit)); }, { owner: u }),
      b.on('battleEnd', stop)];
  };
  const result = { state, spec, sync, install, stop, auraKey: key }; u.mem.closurS2 = result; return result;
}
