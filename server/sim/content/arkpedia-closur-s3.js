// SPDX-License-Identifier: GPL-3.0-or-later
import e from '../../../data/arkpedia-native-operators/char_4228_closur.json' with { type: 'json' };
import { absoluteRangeKeys } from '../targeting.js';
import { applySourceSlowDown, NATIVE_SLOW_DOWN_CONTRACT } from './arkpedia-slow-down.js';
export const CLOSUR_S3_CONTRACT = Object.freeze({
  scope: 'All ten source S3 ranks: protected DP, attack-time modifier, composite vision, growing target count and owned slow_down',
  mapping: 'One DP per original 1.66s interval, eighteen total. Accepted attacks increment one counter; every nine increases the next selection limit, up to seven targets. Composite vision unions the owner main collider, command-center passive geometry and current owned reinforcements main colliders, excluding recursively inherited extra ranges. slow_down is attached before missable physical damage.',
  limits: 'Range-collider/category aliases, retained tactical-point geometry during recharge, attack-count/selection ordering and fixed ticks are explicit local mappings. Native compiled collider/FSM dispatch, absent enemy affectedBySlowDown flags, cast/animation controllers, modules/particles/audio and frame/pixel parity remain unverified. Public approval is separate.',
  frameParity: false,
});
const present = u => u?.alive && u.deployed && !u._removing;
export function prepareClosurS3(point, { contract } = {}) {
  if (contract !== CLOSUR_S3_CONTRACT || point.record.owner.index !== 2 || point.u.deploySeq !== 0 || point.u.mem.closurS3)
    throw Error('Closure S3 requires a fresh selected point and explicit source contract');
  const { b, u } = point, r = point.record.owner;
  const parts = e.skills.skchr_closur_3.flatMap(row => row.components);
  const native = parts.find(p => p.pathId === '-2608830075419771222').data;
  if (native._canSilenced !== 0 || native._allowSpRecoveryWhenAffecting !== 0 || native._stopAffectOnInterrupt !== 0
    || native._resetAbilityCooldownWhenCastEnd !== 0 || r.bb.attack_trigger_cnt !== 9 || r.bb.max_trigger_cnt !== 6)
    throw Error('Unreviewed Closure S3 inputs');
  const state = { elapsed: 0, pulses: 0, attacks: 0, upgrades: 0, maxTargets: 1, previousExtra: [], stopped: false, handles: [] };
  const active = () => !state.stopped && point.valid() && u.skill.active;
  const mainKeys = a => {
    if (b.rangeChanged(a)) b._refreshRange(a);
    return absoluteRangeKeys(a.liveRangeGrid ?? a.rangeGrid, a.tileR, a.tileC, a.dir);
  };
  function refreshRange() {
    if (!active()) return;
    const extra = new Set(state.previousExtra);
    const t = point.point?.unit;
    // Recharge keeps the passive range assignment even while its friend aura
    // is off. This selected geometry mapping does not reactivate that aura.
    if (present(t)) for (const key of absoluteRangeKeys(point.record.rangeGrid, t.tileR, t.tileC, 'RIGHT')) extra.add(key);
    for (const a of point.friends()) if (a !== u && a !== t && present(a)) for (const key of mainKeys(a)) extra.add(key);
    const own = new Set(mainKeys(u)); for (const key of own) extra.delete(key);
    const keys = [...extra];
    if (JSON.stringify(keys) !== JSON.stringify(u.extraRangeKeys ?? [])) b.setExtraRange(u, keys);
  }
  function end() { b.setExtraRange(u, state.previousExtra); }
  function stop() {
    if (state.stopped) return; state.stopped = true; end();
    for (const h of state.handles) b.off(h); state.handles = [];
  }
  const spec = {
    kind: 'duration', duration: r.source.duration, silenceable: false, trigger: { rule: 'NEVER' },
    mods: { batFlat: r.bb.base_attack_time }, attack: { isSkill: false },
    canActivate: () => point.valid() && present(u) && !u.hidden && u.canAct && !u.skill.active,
    onStart: () => {
      state.elapsed = 0; state.pulses = 0; state.attacks = 0; state.upgrades = 0; state.maxTargets = 1;
      state.previousExtra = [...(u.extraRangeKeys ?? [])]; refreshRange();
    },
    onTick: ({ dt }) => {
      if (!active()) return;
      state.elapsed += Math.min(dt, Math.max(0, u.skill.timeLeft));
      const interval = r.bb['closur_s_3[add_cost_period].interval'];
      while (state.pulses < r.bb.cost_period && state.elapsed + 1e-8 >= (state.pulses + 1) * interval) {
        state.pulses++; b.addDp(u.ownerId, r.bb['closur_s_3[add_cost_period].cost']);
      }
      refreshRange();
    }, onEnd: end,
  };
  const acceptedAttack = () => {
    if (!active()) return;
    state.attacks++;
    if (state.upgrades < r.bb.max_trigger_cnt && state.attacks >= r.bb.attack_trigger_cnt) {
      state.attacks = 0; state.upgrades++; state.maxTargets++;
    }
  };
  const slow = target => applySourceSlowDown(b, u, target, { key: 'closur', increment: r.bb['attack@slow_down'],
    duration: r.bb['attack@slow_down_time'], maxStacks: r.bb['attack@max_stack_cnt'], maxStrength: r.bb['attack@slow_down_max'],
    contract: NATIVE_SLOW_DOWN_CONTRACT });
  const install = () => {
    if (state.handles.length || state.stopped) throw Error('Closure S3 cannot be reinstalled');
    state.handles = [b.on('tick', refreshRange, { owner: u }), b.on('deploy', refreshRange, { owner: u }),
      b.on('sourceMoveBorn', refreshRange, { owner: u }),
      b.on('death', ({ unit }) => { if (unit === u) stop(); else refreshRange(); }, { owner: u }), b.on('battleEnd', stop)];
  };
  const result = { state, spec, refreshRange, acceptedAttack, slow, install, stop }; u.mem.closurS3 = result; return result;
}
