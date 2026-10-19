// SPDX-License-Identifier: GPL-3.0-or-later
// Held original selected S3 composition; native fidelity/public admission are separate.
import clocks from '../../../data/arkpedia-aphrissa-clocks.json' with {type: 'json'};
import {APHRISSA_ID as ID, selectedAphrissaInputs, aphrissaNativeInputs} from './arkpedia-aphrissa-source.js';
import {prepareAphrissaOrdinary, APHRISSA_ORDINARY_CONTRACT,
  prepareAphrissaS3Attacks, APHRISSA_S3_ATTACK_CONTRACT} from './arkpedia-aphrissa-ordinary.js';
import {prepareAphrissaS3Relay, APHRISSA_S3_RELAY_CONTRACT} from './arkpedia-aphrissa-relay.js';
import {prepareAphrissaRelayBonus, APHRISSA_RELAY_BONUS_CONTRACT} from './arkpedia-aphrissa-relay-bonus.js';
import {prepareAphrissaResistance, APHRISSA_RESISTANCE_CONTRACT} from './arkpedia-aphrissa-resistance.js';
import {resolveProfile} from '../professions.js';

export const APHRISSA_S3_CONTRACT = Object.freeze({
  scope: 'Held selected S3 three-second charge, twenty-round manual ammunition, independent stat/mode parents, relay lease and source attack payloads.',
  mapping: 'The real selected time-SP ammo account grants twenty rounds, not the native counter default forty. Original Start must finish before a manual cast. Charge lasts selected charge_time world seconds; literal Begin and End are included within that window with Loop between. Forced-disarm18 maps to disarm and ordinary/S3 acquisition is separately gated during charge. The original ordered charge parents grant the relay lease only if token-withdraw is admitted. Active parents independently grant selected ATK/BAT and modes2/3. Each nonempty accepted S3 attack spends one actual runtime round regardless of recipient or extra-hit count. The final accepted staggered batch may drain after ammo exhaustion with its owned stats/relays retained, then full cleanup and original End precede ordinary combat. Manual cancel drops unborn work immediately. Ending the exact lease withdraws its relays and restores one ready normal card.',
  limits: 'Charge window including wrapper End, world-time charge through control, manual cancellation during charge, retained final-ammo batch, immediate account end with a later presentation tail, restartFSM cooldown preservation and independent parent rejection/removal are explicit local policies. Native sequence/finish/counter dispatch and frame parity remain unverified. A missing mode parent suppresses skill attacks rather than inventing ordinary-mode ammo consumption. Attribute buckets, relay relation/card actions, ray traversal and producer-before-main/Slow/miss behavior retain their component limits. Native particles/audio, logical VFX dispatch, modules and public admission are unapproved.',
  frameParity: false,
});
const MARK = 'aphris_sk3[mark]', SHELTER = 'aphris_sk3[sheltering]', WITHDRAW = 'aphris_sk3[token-withdraw]';
const STATS = 'aphris_sk3[on_finish]', MODE = 'aphris_sk3_switch_mode';
const CHARGE_FX = 'aphris_sk3[charge-vfx]', WING_FX = 'aphris_sk3[wing-vfx]', FINISH_FX = 'aphris_sk3_finishvfx';
const present = u => u?.alive && u.deployed && !u.removed && !u._removing;
const due = (b, at) => b.time + 1e-7 >= at;

export function prepareAphrissaS3(b, u, {contract} = {}) {
  if (contract !== APHRISSA_S3_CONTRACT || u.def.charId !== ID || u.deploySeq !== 0 || u.mem.aphrissaS3Owner)
    throw Error('Fresh selected Aphrissa and exact S3 owner contract required');
  const record = selectedAphrissaInputs(u), n = aphrissaNativeInputs(), charge = n.s3ChargeBuffs._buffs;
  const active = n.s3Active._buffs, mode = n.templates[MODE].eventToActions;
  if (record.index !== 2 || record.source.durationType !== 'AMMO' || record.bb['attack@trigger_time'] !== 20
    || record.bb.charge_time !== 3 || n.s3._canCastDuringBorn !== 0 || n.s3._canSilenced !== 0
    || n.s3._showSpAsBulletMode !== 1 || n.s3._canDiscardRemainingCount !== 1
    || n.s3._finishSkillWithProgress !== 1 || n.s3._allowSpRecoveryWhenAffecting !== 0
    || n.s3._fetchFromMainAttack !== 1 || n.s3._modeIndex !== 2 || n.s3._extraModeIndex.join(',') !== '3'
    || n.s3Sequence._abilities.map(p => p.m_PathID).join(',') !== '-4303161870961327889,-5427451279434235665'
    || n.s3Sequence._alwaysNext !== 1 || n.s3Sequence._enableLoop !== 0
    || n.s3Charge._durationKey !== 'charge_time' || n.s3Charge._isInfinity !== 0
    || charge.map(b => b.buffKey).join(',') !== `${SHELTER},${WITHDRAW},aphris_sk3[charge-vfx]`
    || charge[0].attributes.abnormalFlags.join(',') !== '18' || charge[0].lifeTimeType !== 1
    || active.map(b => b.buffKey).join(',') !== `${STATS},${MODE},aphris_sk3_finishvfx`
    || active[0].attributes.attributeModifiers.map(a => [a.attributeType, a.formulaItem].join(':')).join(',') !== '1:1,8:0'
    || mode.ON_BUFF_START[1]._restartFSM !== true || mode.ON_BUFF_FINISH[0]._restoreDefault !== true
    || mode.ON_DIRECTION_CHANGED[1]._restartFSM !== true || n.s3Mark._buffs[0].buffKey !== MARK
    || n.s3ChargeAnimation._default.beginAnim !== 'Skill_3_Charge_Begin'
    || n.s3ChargeAnimation._default.endAnim !== 'Skill_3_Charge_End')
    throw Error('Changed original Aphrissa S3 owner inputs');
  const controller = new S3Owner(b, u, record);
  u.mem.aphrissaS3Owner = controller;
  return {record, controller, kit: {trait: controller.ordinary.trait(), talents: [], skill: controller.spec}};
}

class S3Owner {
  constructor(b, u, record) {
    Object.assign(this, {b, u, record, seq: null, account: null, state: null, tail: null,
      mode: 'normal', stopped: false, parents: new Map(), handles: [], visuals: new WeakSet(), visualSeq: 0});
    this.ordinary = prepareAphrissaOrdinary(b, u, {contract: APHRISSA_ORDINARY_CONTRACT,
      mayBegin: () => this.valid() && !this.account.active && !this.state && !this.tail});
    this.attacks = prepareAphrissaS3Attacks(b, u, {contract: APHRISSA_S3_ATTACK_CONTRACT,
      mayBegin: () => this.attackAllowed()});
    this.deck = prepareAphrissaS3Relay(b, u, {contract: APHRISSA_S3_RELAY_CONTRACT});
    this.bonus = prepareAphrissaRelayBonus(b, u, {contract: APHRISSA_RELAY_BONUS_CONTRACT,
      relatedRelays: () => this.deck.own()});
    this.resistance = prepareAphrissaResistance(b, u, {contract: APHRISSA_RESISTANCE_CONTRACT, rangeMode: () => 'normal'});
    this.parts = [this.deck, this.bonus, this.resistance, this.ordinary, this.attacks];
    this.spec = {kind: 'ammo', ammo: record.bb['attack@trigger_time'], silenceable: false, manualCancel: true,
      canManualCancel: () => this.valid() && !!this.state,
      canActivate: () => this.valid() && u.canAct && !u.hidden && !this.state && !this.tail
        && due(b, this.ordinary.bornUntil),
      onStart: () => this.start(), onEnd: ({reason, activation}) => this.end(reason, activation)};
  }
  valid() { return !this.stopped && !this.b.finished && present(this.u) && this.seq === this.u.deploySeq
    && this.u.mem.aphrissaS3Owner === this && this.u.skill === this.account && this.account?.spec === this.spec; }
  current(state = this.state) { return !!state && this.valid() && this.state === state
    && this.account.activations === state.activation; }
  owns(record) { return !!record?.buff && this.u.findBuff(record.key) === record.buff
    && record.buff.source === this.u && record.buff.data?.aphrissaS3Parent === record; }
  has(key) { return this.owns(this.parents.get(key)); }
  attackAllowed() {
    const state = this.state;
    if (!this.current(state) || !this.has(MODE)) return false;
    if (state.stage === 'active') return this.account.active;
    const p = this.attacks.phase;
    return state.stage === 'drain' && p === state.draining && p.accepted && (p.next < p.pending.length || !!p.delivering);
  }
  profile(skill) {
    if (!this.valid()) return;
    this.u.kit.trait = skill ? this.attacks.trait() : this.ordinary.trait();
    this.u.profile = resolveProfile(this.u.def, this.u.kit.trait);
  }
  ownedVisual() { return this.visuals.has(this.u.mem.regularFormVisual)
    || this.attacks.visuals.has(this.u.mem.regularFormVisual); }
  clip(name, {loop = false, preserveForeign = false} = {}) {
    if (!this.valid()) return null;
    const clip = this.u.dir === 'DOWN' ? name.replace('Skill_3', 'Skill_Down_3') : name;
    const model = this.u.dir === 'UP' ? 'Back' : 'Front', duration = clocks.models[model].exactDurations[clip];
    if (!Number.isFinite(duration)) throw Error('Missing original Aphrissa S3 wrapper clip');
    if (preserveForeign && !this.ownedVisual()) return {visual: null, until: this.b.time + duration};
    const visual = {clip, loop, speed: 1, ...(loop ? {replace: true}
      : {playId: `aphrissa:s3:${this.seq}:${++this.visualSeq}`})};
    this.visuals.add(visual); this.u.mem.regularFormVisual = visual; this.u.mem.regularVisualDirection = this.u.dir;
    return {visual, until: this.b.time + duration};
  }
  parent(state, key, {duration = Infinity, mods = {}, flags = {}} = {}) {
    const record = {key, buff: null, activation: state.activation, startedAt: this.b.time};
    const same = (a, z) => JSON.stringify(a ?? {}) === JSON.stringify(z);
    const admit = (unit, buff) => unit === this.u && this.current(state) && this.account.active && !this.u.findBuff(key)
      && buff.key === key && buff.source === this.u && buff.data?.aphrissaS3Parent === record
      && buff.duration === duration && same(buff.mods, mods) && same(buff.flags, flags);
    const finished = () => {
      if (this.parents.get(key) !== record) return;
      if ([CHARGE_FX, STATS, WING_FX].includes(key) && this.u.mem.aphrissaStatePresentation)
        this.b._safe(() => this.u.mem.aphrissaStatePresentation.onParentRemoved(this, record), 'aphrissa.stateFinishPresentation', this.u);
      this.parents.delete(key);
      if (key === FINISH_FX) this.remove(WING_FX);
      if (key === MODE) { this.mode = 'normal'; this.attacks.phase = null; this.profile(false); }
      if (key === STATS && state.lease) this.deck.endS3(state.lease);
    };
    // The shared buff runtime calls onExpire instead of onRemove on timeout.
    // Both paths finish this exact source parent and its ON_BUFF_FINISH work.
    record.buff = this.b.addBuff(this.u, {key, source: this.u, duration, mods, flags,
      data: {nativeKey: key, aphrissaS3Parent: record}, admit, onRemove: finished, onExpire: finished});
    if (this.current(state) && this.owns(record)) { this.parents.set(key, record); return record; }
    if (this.owns(record)) this.b.removeBuff(this.u, record.buff);
    return null;
  }
  remove(key) {
    const record = this.parents.get(key);
    if (this.owns(record)) this.b.removeBuff(this.u, record.buff);
    if (this.parents.get(key) === record) this.parents.delete(key);
  }
  start() {
    if (!this.valid() || !this.account.active || this.state || this.tail) return;
    const state = this.state = {activation: this.account.activations, stage: 'charge', lease: null,
      chargeUntil: this.b.time + this.record.bb.charge_time, animation: 'begin', intro: null};
    this.ordinary.phase = null; this.attacks.phase = null;
    this.parent(state, MARK);
    if (!this.current(state) || !this.account.active) return;
    this.parent(state, SHELTER, {duration: this.record.bb.charge_time, flags: {disarm: true}});
    if (!this.current(state) || !this.account.active) return;
    this.parent(state, WITHDRAW, {duration: this.record.bb.charge_time});
    if (!this.current(state) || !this.account.active) return;
    if (this.has(WITHDRAW)) state.lease = this.deck.beginS3();
    if (!this.current(state) || !this.account.active) {
      // beginS3 withdraws through callbacks before returning its new ticket.
      // An account cancelled inside them cannot leave that late ticket alive.
      if (state.lease) this.deck.endS3(state.lease);
      return;
    }
    this.parent(state, CHARGE_FX, {duration: this.record.bb.charge_time});
    if (!this.current(state) || !this.account.active) return;
    state.intro = this.clip('Skill_3_Charge_Begin'); this.bonus.sync(); this.resistance.sync();
  }
  activate(state) {
    if (!this.current(state) || !this.account.active) return;
    state.stage = 'active';
    // Local mapping of the original charge ability's event-6 wing grant.
    // Its ON_BUFF_START independently finishes the owned charge-vfx parent.
    this.parent(state, WING_FX);
    if (this.has(WING_FX)) this.remove(CHARGE_FX);
    if (!this.current(state) || !this.account.active) return;
    this.remove(SHELTER); this.remove(WITHDRAW);
    this.parent(state, STATS, {mods: {atkPct: this.record.bb.atk, batFlat: this.record.bb.base_attack_time}});
    if (!this.current(state) || !this.account.active) return;
    this.parent(state, MODE);
    if (!this.current(state) || !this.account.active) return;
    this.parent(state, FINISH_FX);
    if (!this.current(state) || !this.account.active) return;
    this.mode = this.has(MODE) ? 's3' : 'normal'; this.profile(this.has(MODE));
    if (this.has(MODE) && this.ownedVisual()) this.clip('Skill_3_Idle', {loop: true});
    this.bonus.sync(); this.resistance.sync();
  }
  end(reason, activation) {
    const state = this.state;
    if (!state || state.activation !== activation) return;
    const p = this.attacks.phase;
    if (reason === 'ammo' && this.current(state) && p?.accepted && p.next < p.pending.length) {
      state.stage = 'drain'; state.draining = p; return;
    }
    this.finish(state);
  }
  finish(state) {
    if (this.state !== state) return;
    this.state = null; this.attacks.phase = null;
    for (const key of [...this.parents.keys()].reverse()) this.remove(key);
    if (state.lease) this.deck.endS3(state.lease);
    this.mode = 'normal'; this.profile(false); this.bonus.sync(); this.resistance.sync();
    if (this.valid()) this.tail = this.clip('Skill_3_End', {preserveForeign: true});
  }
  tick() {
    if (!this.valid()) return;
    const state = this.state;
    if (state && !this.current(state)) { this.finish(state); return; }
    if (state?.stage === 'charge') {
      const face = this.u.dir === 'UP' ? 'Back' : 'Front';
      const end = clocks.models[face].exactDurations[this.u.dir === 'DOWN' ? 'Skill_Down_3_Charge_End' : 'Skill_3_Charge_End'];
      if (due(this.b, state.chargeUntil)) { this.activate(state); return; }
      if (state.animation !== 'end' && due(this.b, state.chargeUntil - end)) {
        state.animation = 'end'; state.intro = this.clip('Skill_3_Charge_End', {preserveForeign: true});
      } else if (state.animation === 'begin' && due(this.b, state.intro.until)) {
        state.animation = 'loop';
        if (this.u.mem.regularFormVisual === state.intro.visual) this.clip('Skill_3_Charge_Loop', {loop: true});
      }
    }
    if (state?.stage === 'drain' && (!this.attacks.phase || !this.attackAllowed())) this.finish(state);
    if (this.tail && due(this.b, this.tail.until)) {
      const owned = this.ownedVisual(); this.tail = null;
      if (owned) { const v = {clip: 'Idle', loop: true, replace: true}; this.visuals.add(v);
        this.u.mem.regularFormVisual = v; this.u.mem.regularVisualDirection = this.u.dir; }
    }
  }
  install() {
    if (this.stopped || this.handles.length || this.u.deploySeq !== 0 || this.u.skill?.spec !== this.spec)
      throw Error('Fresh exact Aphrissa S3 account installation required');
    this.account = this.u.skill; for (const part of this.parts) part.install();
    this.handles = [this.b.on('deploy', ({unit, move}) => {
      if (unit !== this.u || move) return;
      if (this.seq !== null) this.stop(); else this.seq = unit.deploySeq;
    }, {owner: this.u}), this.b.on('tick', () => {
      if (this.seq !== null && !this.valid()) this.stop(); else this.tick();
    }, {owner: this.u}), this.b.on('death', ({unit}) => { if (unit === this.u) this.stop(); }, {owner: this.u}),
    this.b.on('battleEnd', () => this.stop(), {owner: this.u})];
  }
  stop() {
    if (this.stopped) return;
    if (this.account === this.u.skill && this.account?.spec === this.spec && this.account.active)
      this.account.end('source-finished');
    if (this.state) this.finish(this.state);
    this.stopped = true; this.tail = null;
    for (const key of [...this.parents.keys()]) this.remove(key);
    for (const part of this.parts) part.stop();
    for (const handle of this.handles) this.b.off(handle); this.handles = [];
    if (this.visuals.has(this.u.mem.regularFormVisual)) {
      delete this.u.mem.regularFormVisual; delete this.u.mem.regularVisualDirection;
    }
  }
}
