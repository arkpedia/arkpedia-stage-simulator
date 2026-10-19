// SPDX-License-Identifier: GPL-3.0-or-later
// Held S1 owner composition. S2/S3 and public admission remain separate.
import clocks from '../../../data/arkpedia-aphrissa-clocks.json' with {type: 'json'};
import {APHRISSA_ID as ID, APHRISSA_RELAY_ID as TOKEN, selectedAphrissaInputs,
  aphrissaNativeInputs} from './arkpedia-aphrissa-source.js';
import {prepareAphrissaOrdinary, APHRISSA_ORDINARY_CONTRACT,
  prepareAphrissaS1Attacks, APHRISSA_S1_ATTACK_CONTRACT} from './arkpedia-aphrissa-ordinary.js';
import {prepareAphrissaRelay, APHRISSA_RELAY_CONTRACT} from './arkpedia-aphrissa-relay.js';
import {prepareAphrissaRelayBonus, APHRISSA_RELAY_BONUS_CONTRACT} from './arkpedia-aphrissa-relay-bonus.js';
import {prepareAphrissaResistance, APHRISSA_RESISTANCE_CONTRACT} from './arkpedia-aphrissa-resistance.js';
import {resolveProfile} from '../professions.js';

export const APHRISSA_S1_CONTRACT = Object.freeze({
  scope: 'Selected original S1 automatic infinite account, independent ATK/mode parents, normal/S1 combat and relay permanence; held owner only.',
  mapping: 'The real time-SP AUTO account activates without a target. Literal Begin completes on its original full duration before the separate infinite ATK and mode grants; it invents no missing OnAttack marker. Positive ordinary cooldown is preserved. Native mode1/5 uses explicit local A/B alternation and the original down clips. The original CreateBuffToToken action marks existing owned relays with nonderived infinite markers; new relay birth checks the current host ATK parent and receives a self-sourced marker. disableOverride preserves preexisting markers. Ending the ATK/mode parent does not retract accepted nonderived token markers. The relay source timer performs its literal one-time marker check at its original deadline.',
  limits: 'World-time Begin completion, local loopType1 alternation, exact dispatcher/profile updates and fixed-tick ordering are local mappings. The custom talent relation is explicitly mapped to actual ownerUnit relays in this composition; its compiled validator meaning remains unverified. Shared attribute buckets, ray geometry, recipient order, RES family arbitration and native frame parity retain their component limits. Native particles/audio, modules, full S2/S3 and public admission remain unapproved.',
  frameParity: false,
});
const ATK = 'aphris_sk1', MODE = 'aphris_sk1_switch_mode', MARKER = 'aphris_sk1_token';
const present = unit => unit?.alive && unit.deployed && !unit.removed && !unit._removing;
const due = (b, time) => b.time + 1e-7 >= time;

export function prepareAphrissaS1(b, u, {contract} = {}) {
  if (contract !== APHRISSA_S1_CONTRACT || u.def.charId !== ID || u.deploySeq !== 0 || u.mem.aphrissaS1Owner)
    throw Error('Fresh selected Aphrissa and exact S1 owner contract required');
  const record = selectedAphrissaInputs(u), n = aphrissaNativeInputs();
  const producer = n.s1BuffAbility._buffs, marker = n.templates[ATK].eventToActions.ON_BUFF_START[0];
  if (record.index !== 0 || record.source.skillType !== 'AUTO' || record.source.duration !== -1
    || n.s1._canSilenced !== 0 || n.s1._canCastDuringBorn !== 1 || n.s1._checkHasTargetBeforeDoCast !== 0
    || n.s1._beginAnim !== 'Skill_1_Begin' || n.s1._beginAnimDown !== 'Skill_Down_1_Begin'
    || producer.map(buff => buff.buffKey).join(',') !== `${ATK},${MODE}`
    || producer[0].attributes.attributeModifiers[0].attributeType !== 1
    || producer[0].attributes.attributeModifiers[0].formulaItem !== 1
    || producer[1].blackboard.map(row => row.value).join(',') !== '1,5'
    || marker._isDerivedBuff !== false || marker._finishDerivedBuffIfParentFinish !== false
    || marker._buffData.buffKey !== MARKER || marker._buffData.disableOverride !== true
    || marker._buffData.lifeTimeType !== 'INFINITY') throw Error('Changed original Aphrissa S1 inputs');
  const controller = new S1Owner(b, u, record);
  u.mem.aphrissaS1Owner = controller;
  return {record, controller, kit: {trait: controller.ordinary.trait(), talents: [], skill: controller.spec}};
}

class S1Owner {
  constructor(b, u, record) {
    Object.assign(this, {b, u, record, seq: null, account: null, stopped: false, mode: 'normal',
      intro: null, activation: null, turn: 0, atkParent: null, modeParent: null, handles: [], visuals: new WeakSet()});
    this.ordinary = prepareAphrissaOrdinary(b, u, {contract: APHRISSA_ORDINARY_CONTRACT,
      mayBegin: () => this.valid() && !this.intro && this.mode === 'normal'});
    this.s1Attacks = prepareAphrissaS1Attacks(b, u, {contract: APHRISSA_S1_ATTACK_CONTRACT,
      mayBegin: () => this.valid() && !this.intro && this.mode === 's1',
      pickClip: () => `${u.dir === 'DOWN' ? 'Skill_Down_1' : 'Skill_1'}_Loop_${this.turn++ % 2 ? 'B' : 'A'}`});
    this.deck = prepareAphrissaRelay(b, u, {contract: APHRISSA_RELAY_CONTRACT});
    this.bonus = prepareAphrissaRelayBonus(b, u, {contract: APHRISSA_RELAY_BONUS_CONTRACT,
      relatedRelays: () => this.relays()});
    this.resistance = prepareAphrissaResistance(b, u, {contract: APHRISSA_RESISTANCE_CONTRACT, rangeMode: () => 'normal'});
    this.parts = [this.deck, this.bonus, this.resistance, this.ordinary, this.s1Attacks];
    this.spec = {kind: 'toggle', trigger: {rule: 'SP_FULL'}, silenceable: false, manualCancel: false,
      canActivate: () => this.valid() && this.u.canAct && !this.u.hidden && !this.intro && this.mode === 'normal',
      onStart: () => this.start(), onEnd: ({activation}) => this.end(activation)};
  }
  valid() {
    return !this.stopped && !this.b.finished && present(this.u) && this.seq === this.u.deploySeq
      && this.u.mem.aphrissaS1Owner === this && this.u.skill === this.account && this.account?.spec === this.spec;
  }
  relays() { return this.b.allyUnits.filter(unit => unit.ownerUnit === this.u && unit.defId === TOKEN && present(unit)); }
  owns(record) { return !!record?.buff && this.u.findBuff(record.key) === record.buff
    && record.buff.source === this.u && record.buff.data?.aphrissaS1Parent === record; }
  removeParent(record) { if (this.owns(record)) this.b.removeBuff(this.u, record.buff); }
  profile(mode, {visual = true} = {}) {
    if (!this.valid()) return false;
    this.mode = mode;
    this.u.kit.trait = mode === 's1' ? this.s1Attacks.trait() : this.ordinary.trait();
    this.u.profile = resolveProfile(this.u.def, this.u.kit.trait);
    if (visual) {
      const clip = mode === 's1' ? this.u.dir === 'DOWN' ? 'Skill_Down_1_Idle' : 'Skill_1_Idle' : 'Idle';
      const v = {clip, loop: true, replace: true}; this.visuals.add(v);
      this.u.mem.regularFormVisual = v; this.u.mem.regularVisualDirection = this.u.dir;
    }
    return true;
  }
  start() {
    if (!this.valid() || this.intro || this.mode !== 'normal' || !this.account.active) return;
    this.activation = this.account.activations;
    this.ordinary.phase = null; this.s1Attacks.phase = null;
    const clip = this.u.dir === 'DOWN' ? 'Skill_Down_1_Begin' : 'Skill_1_Begin';
    const face = this.u.dir === 'UP' ? 'Back' : 'Front', duration = clocks.models[face].exactDurations[clip];
    if (!Number.isFinite(duration)) throw Error('Missing original Aphrissa S1 Begin');
    const visual = {clip, loop: false, speed: 1, playId: `aphrissa:s1:${this.seq}:${this.activation}`};
    this.visuals.add(visual); this.u.mem.regularFormVisual = visual; this.u.mem.regularVisualDirection = this.u.dir;
    this.intro = {activation: this.activation, until: this.b.time + duration};
  }
  current(state) { return this.valid() && this.intro === state && this.account.active
    && this.account.activations === state.activation && this.activation === state.activation && !this.u.hidden; }
  parent(state, key, mods) {
    const record = {key, buff: null, activation: state.activation, startedAt: this.b.time};
    const admit = (unit, buff) => unit === this.u && this.current(state) && !this.u.findBuff(key)
      && buff.key === key && buff.source === this.u && buff.data?.aphrissaS1Parent === record
      && buff.duration === Infinity && Object.keys(buff.flags ?? {}).length === 0
      && JSON.stringify(buff.mods ?? {}) === JSON.stringify(mods);
    record.buff = this.b.addBuff(this.u, {key, source: this.u, duration: Infinity, mods,
      data: {aphrissaS1Parent: record, nativeKey: key}, admit,
      onRemove: () => {
        if (this.atkParent === record) this.atkParent = null;
        if (this.modeParent === record) {
          this.modeParent = null; this.s1Attacks.phase = null;
          if (this.valid()) this.profile('normal');
        }
      }});
    return this.current(state) && this.owns(record) ? record : null;
  }
  markRelay(target, source) {
    if (!this.valid() || !present(target) || target.ownerUnit !== this.u || target.defId !== TOKEN
      || target.findBuff(MARKER)) return null;
    const life = target.deploySeq, ticket = Object.freeze({sourceLife: this.seq, targetLife: life});
    const permit = (unit, buff) => unit === target && this.valid() && present(target)
      && target.deploySeq === life && target.ownerUnit === this.u && !target.findBuff(MARKER)
      && buff.key === MARKER && buff.source === source && buff.data?.aphrissaS1Marker === ticket
      && buff.duration === Infinity && Object.keys(buff.mods ?? {}).length === 0 && Object.keys(buff.flags ?? {}).length === 0;
    const marker = this.b.addBuff(target, {key: MARKER, source, duration: Infinity,
      data: {nativeKey: MARKER, aphrissaS1Marker: ticket}, admit: permit});
    const point = this.deck.point;
    if (marker && target.findBuff(MARKER) === marker && point?.unit === target && point.seq === life)
      point.timerHidden = true;
    return marker;
  }
  commit(state) {
    if (!this.current(state)) return;
    this.atkParent = this.parent(state, ATK, {atkPct: this.record.bb.atk});
    if (!this.current(state)) return;
    if (this.owns(this.atkParent)) for (const target of this.relays()) {
      this.markRelay(target, this.u); if (!this.current(state)) return;
    }
    this.modeParent = this.parent(state, MODE, {});
    if (!this.current(state)) return;
    this.intro = null;
    if (this.owns(this.modeParent)) this.profile('s1'); else this.profile('normal');
    this.bonus.sync(); this.resistance.sync();
  }
  end(activation) {
    if (this.activation !== activation) return;
    this.intro = null; this.activation = null;
    this.removeParent(this.modeParent); this.modeParent = null;
    this.removeParent(this.atkParent); this.atkParent = null;
    this.s1Attacks.phase = null;
    if (this.valid()) this.profile('normal');
  }
  tick() {
    if (!this.valid()) return;
    if (this.u.hidden && this.intro) { this.account.end('source-hidden'); return; }
    const state = this.intro;
    if (state && due(this.b, state.until)) this.commit(state);
  }
  install() {
    if (this.stopped || this.handles.length || this.u.deploySeq !== 0 || this.u.skill?.spec !== this.spec)
      throw Error('Fresh exact Aphrissa S1 account installation required');
    this.account = this.u.skill;
    for (const part of this.parts) part.install();
    this.handles = [this.b.on('deploy', ({unit, move}) => {
      if (unit === this.u && !move) {
        if (this.seq !== null) { this.stop(); return; }
        this.seq = unit.deploySeq; this.profile('normal', {visual: false});
      } else if (unit.ownerUnit === this.u && unit.defId === TOKEN && this.valid() && this.owns(this.atkParent))
        this.markRelay(unit, unit);
    }, {owner: this.u}), this.b.on('tick', () => {
      if (this.seq !== null && !this.valid()) this.stop(); else this.tick();
    }, {owner: this.u}), this.b.on('death', ({unit}) => { if (unit === this.u) this.stop(); }, {owner: this.u}),
    this.b.on('battleEnd', () => this.stop(), {owner: this.u})];
  }
  stop() {
    if (this.stopped) return;
    if (this.account === this.u.skill && this.account?.spec === this.spec && this.account.active) this.account.end('source-finished');
    this.stopped = true; this.intro = null;
    this.removeParent(this.modeParent); this.modeParent = null;
    this.removeParent(this.atkParent); this.atkParent = null;
    for (const part of this.parts) part.stop();
    for (const token of this.relays()) this.b._remove(token, 'aphrissa-owner-finished', null, true);
    for (const handle of this.handles) this.b.off(handle);
    this.handles = [];
    if (this.visuals.has(this.u.mem.regularFormVisual)) {
      delete this.u.mem.regularFormVisual; delete this.u.mem.regularVisualDirection;
    }
  }
}
