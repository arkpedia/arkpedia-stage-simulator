// SPDX-License-Identifier: GPL-3.0-or-later
import {HADIYA_ID, selectedHadiyaInputs} from './arkpedia-hadiya-source.js';

export const HADIYA_PAYMENT_CONTRACT = Object.freeze({
  scope: 'Held Hadiya DP transactions around the real selected SkillRuntime; no playable kit or UI admission.',
  mapping: 'Reserve selected cost from the original player before the real SP activation. A rejected action refunds only that reservation to the original ledger, preserving independent changes and the DP cap. A successful SP activation commits even if its onStart removes the owner. S1 adaptation can start a full-SP skill, or adapt once while active; S2 adaptation is active-only. Each accepted activation has at most one paid adaptation. Reentrant actions are rejected. Accepted receipts bind the source, account, player, life and activation; copies grant no authority.',
  limits: 'DP reservation and callback ordering are local simulator policy, not recovered compiled transactions. Skill owner supplies original animation/buff deadlines and receipt consumers. No global DP-spend talent hook, free SP cast, second SP pool, native cooldown parity or public admission.',
  frameParity: false,
});

const present = u => u?.alive && u.deployed && !u.hidden && !u.removed && !u._removing;
const restore = (obj, key, saved) => saved.own ? obj[key] = saved.value : delete obj[key];

export class HadiyaPayments {
  constructor(b, u, {contract, guard = () => true} = {}) {
    if (contract !== HADIYA_PAYMENT_CONTRACT || u.def.charId !== HADIYA_ID
      || u.deploySeq !== 0 || typeof guard !== 'function')
      throw Error('Fresh selected Hadiya and exact payment contract required');
    this.record = selectedHadiyaInputs(u);
    Object.assign(this, {b, u, guard, stopped: false, installed: false, seq: null,
      busy: false, checking: false, current: null, usedActivation: null, handles: []});
    this.receipts = new WeakSet();
  }

  rawValid() {
    const {b, u, account: a, spec: s, player: p} = this;
    return this.installed && !this.stopped && !b.finished && present(u)
      && u.deploySeq === this.seq && b.unitById(u.id) === u && u.canAct
      && !u.s.flags.noSkill && !a.silenceBlocked
      && u.skill === a && a.unit === u && a.battle === b && a.spec === s
      && a.activate === this.activateWrapper && s.canActivate === this.eligibilityWrapper
      && u.player === p && b.getPlayer(p.playerId) === p
      && Number.isFinite(p.dp) && p.dp >= 0;
  }

  valid() {
    if (this.checking || !this.rawValid()) return false;
    this.checking = true;
    try { return this.guard() === true && this.rawValid(); }
    finally { this.checking = false; }
  }

  get activationCost() { return this.record.bb.cost ?? 0; }
  get adaptationCost() { return this.record.bb.retrigger_cost; }
  get used() {
    return this.usedActivation === this.account?.activations
      || this.current?.kind.startsWith('adaptation') === true;
  }

  // During the real cast predicate, our own reservation already paid this cost.
  // Merely reading eligibility never spends DP.
  canPayActivation() {
    return this.valid() && (this.current != null || this.player.dp >= this.activationCost);
  }

  owns(receipt) {
    return !!receipt && this.valid() && receipt.life === this.seq
      && receipt.activation === this.account.activations
      && (receipt === this.current || this.receipts.has(receipt));
  }

  install() {
    if (this.installed || this.stopped || this.u.mem.hadiyaPayments)
      throw Error('Hadiya payment adapter cannot be reinstalled');
    const {b, u} = this, a = u.skill, s = a?.spec;
    if (!a || a.unit !== u || a.battle !== b || a.id !== u.def.skill.id
      || typeof s?.manualTriggerOnly !== 'function' || s.manualCastWithoutSp != null)
      throw Error('Hadiya payments require the real manual selected skill account');
    this.account = a;
    this.spec = s;
    this.player = u.player;
    this.savedActivate = {own: Object.hasOwn(a, 'activate'), value: a.activate};
    this.savedEligibility = {own: Object.hasOwn(s, 'canActivate'), value: s.canActivate};
    this.activateWrapper = (reason = 'manual', options = {}) => this.activate(reason, options);
    this.eligibilityWrapper = (...args) => {
      if (!this.canPayActivation()) return false;
      const original = this.savedEligibility.value;
      const allowed = typeof original !== 'function' || original.apply(s, args);
      return !!allowed && this.canPayActivation();
    };
    a.activate = this.activateWrapper;
    s.canActivate = this.eligibilityWrapper;
    this.installed = true;
    u.mem.hadiyaPayments = this;
    this.handles = [
      b.on('deploy', ({unit, move}) => {
        if (unit !== u || move) return;
        if (this.seq == null) this.seq = u.deploySeq;
        else if (this.seq !== u.deploySeq) this.stop();
      }, {owner: u}),
      b.on('removed', ({unit}) => { if (unit === u) this.stop(); }, {owner: u}),
      b.on('death', ({unit}) => { if (unit === u) this.stop(); }, {owner: u}),
      b.on('battleEnd', () => this.stop(), {owner: u}),
    ];
  }

  transact(cost, kind, activation, action) {
    if (this.busy || !Number.isFinite(cost) || cost < 0 || !this.valid()) return false;
    // Claim before callbacks (including the owner guard and real cast predicate).
    this.busy = true;
    const player = this.player;
    let paid = false, accepted = false;
    try {
      if (!this.valid() || player.dp < cost) return false;
      player.dp -= cost;
      paid = true;
      this.current = Object.freeze({kind, cost, life: this.seq, activation});
      if (!this.valid()) return false;
      accepted = action(this.current) === true;
      return accepted;
    } finally {
      const receipt = this.current;
      // A real SP activation already accepted before its onStart/skillStart
      // callbacks cannot be undone by a later death or presentation exception.
      if (kind !== 'adaptation-active' && this.account.activations >= activation) accepted = true;
      if (accepted && receipt) {
        this.receipts.add(receipt);
        if (kind.startsWith('adaptation')) this.usedActivation = activation;
      } else if (paid) {
        // Deliberately update the captured ledger, never a replacement player.
        player.dp = Math.min(this.b.flags.dpMax, player.dp + cost);
      }
      this.current = null;
      this.busy = false;
    }
  }

  activate(reason = 'manual', options = {}) {
    if (this.busy || reason !== 'manual' || options.free || !this.valid()) return false;
    return this.transact(this.activationCost, 'cast', this.account.activations + 1,
      () => this.savedActivate.value.call(this.account, reason, options));
  }

  activateAdaptation() {
    if (this.busy || this.record.index !== 0 || !this.valid() || this.account.active) return false;
    return this.transact(this.adaptationCost, 'adaptation', this.account.activations + 1,
      () => this.savedActivate.value.call(this.account, 'manual'));
  }

  adapt(action) {
    if (this.busy || typeof action !== 'function' || !this.valid()
      || !this.account.active || this.used) return false;
    return this.transact(this.adaptationCost, 'adaptation-active', this.account.activations, action);
  }

  stop() {
    if (this.stopped) return;
    this.stopped = true;
    for (const handle of this.handles) this.b.off(handle);
    this.handles = [];
    if (this.account && this.account.activate === this.activateWrapper) restore(this.account, 'activate', this.savedActivate);
    if (this.spec && this.spec.canActivate === this.eligibilityWrapper) restore(this.spec, 'canActivate', this.savedEligibility);
    if (this.u.mem.hadiyaPayments === this) delete this.u.mem.hadiyaPayments;
  }
}
