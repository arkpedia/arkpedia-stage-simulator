// SPDX-License-Identifier: GPL-3.0-or-later
// Held S2 owner composition. Public admission and S3 remain separate gates.
import clocks from '../../../data/arkpedia-aphrissa-clocks.json' with {type: 'json'};
import {APHRISSA_ID as ID, APHRISSA_RELAY_ID as TOKEN, selectedAphrissaInputs,
  aphrissaNativeInputs} from './arkpedia-aphrissa-source.js';
import {prepareAphrissaOrdinary, APHRISSA_ORDINARY_CONTRACT} from './arkpedia-aphrissa-ordinary.js';
import {prepareAphrissaS2Beam, APHRISSA_S2_BEAM_CONTRACT} from './arkpedia-aphrissa-s2-beam.js';
import {prepareAphrissaRelay, APHRISSA_RELAY_CONTRACT} from './arkpedia-aphrissa-relay.js';
import {prepareAphrissaRelayBonus, APHRISSA_RELAY_BONUS_CONTRACT} from './arkpedia-aphrissa-relay-bonus.js';
import {prepareAphrissaResistance, APHRISSA_RESISTANCE_CONTRACT} from './arkpedia-aphrissa-resistance.js';
import {resolveProfile} from '../professions.js';

export const APHRISSA_S2_CONTRACT = Object.freeze({
  scope: 'Held selected S2 manual time-SP account, independent mode4 parent, original animation wrapper, periodic Arts beam and shared talents.',
  mapping: 'One manual account uses the selected eight-second duration as an explicit local account window despite the source durationType NONE. It admits the separate infinite mode4 parent, starts the original Begin and independently starts the native non-event beam predelay. The original full Begin duration changes presentation to Loop. At account end the beam detaches, the owned mode parent restores default, and the literal End completes before ordinary attacks or another cast. restartFSM0 preserves positive ordinary cooldown rather than resetting it. Control/hiding skips beam releases on the continuing account clock; it neither replays Begin nor invents a catch-up burst. Relay presence and fixed RES penetration compose through their separately held contracts.',
  limits: 'Selected duration as account lifetime, wrapper/ability completion order, fixed-tick Begin/End, control skip/resume, independent mode-parent rejection/removal and anchored deployed-facing presentation are explicit local policies. Native timeMode3/postDelayChecker, finish/FSM semantics, faceToTarget1 visual rotation and compiled frame parity remain unverified. A mode-parent rejection leaves the separately owned beam running while the owner aura keeps normal range. Custom relay relationship maps to actual ownerUnit relays, with the component limits on geometry, damage buckets and aura ties. No S3, modules, native particles/audio or public admission.',
  frameParity: false,
});
const MODE = 'aphris_sk2_switch_mode4';
const present = unit => unit?.alive && unit.deployed && !unit.removed && !unit._removing;
const due = (b, at) => b.time + 1e-7 >= at;

export function prepareAphrissaS2(b, u, {contract} = {}) {
  if (contract !== APHRISSA_S2_CONTRACT || u.def.charId !== ID || u.deploySeq !== 0 || u.mem.aphrissaS2Owner)
    throw Error('Fresh selected Aphrissa and exact S2 owner contract required');
  const record = selectedAphrissaInputs(u), n = aphrissaNativeInputs(), buff = n.s2ModeBuff._buffs[0];
  const template = n.templates[MODE], start = template.eventToActions.ON_BUFF_START[0], end = template.eventToActions.ON_BUFF_FINISH[0];
  if (record.index !== 1 || record.source.skillType !== 'MANUAL' || record.source.durationType !== 'NONE'
    || n.s2._allowSpRecoveryWhenAffecting !== 0 || n.s2._canSilenced !== 0 || n.s2._allowNoTarget !== 1
    || n.s2._canCastDuringBorn !== 1 || n.s2._checkHasTargetBeforeDoCast !== 0 || n.s2._playSkillBeginAnim !== 0
    || n.s2._stopAffectOnInterrupt !== 0 || n.s2._uninterruptibleOnAbilityPredelay !== 1
    || n.s2._resetAbilityCooldownWhenCastEnd !== 0 || n.s2._earlySkillFinishAtAttackFinished !== 0
    || n.s2ModeBuff._buffs.length !== 1 || buff.buffKey !== MODE || buff.templateKey !== MODE
    || buff.lifeTimeType !== 2 || buff.isSilenceable !== 0 || buff.isStunnable !== 0
    || buff.attributes.attributeModifiers.length || buff.blackboard.length !== 1 || buff.blackboard[0].value !== 4
    || n.root._modes[4].m_PathID !== '-6037644826992189346'
    || n.s2Mode._attack.m_PathID !== '-3448132305512046498'
    || start._restartFSM !== false || end._restartFSM !== false || start._loadModeFromBlackboard !== true
    || start._restoreDefault !== false || end._restoreDefault !== true
    || n.s2Animation._default.beginAnim !== 'Skill_2_Begin' || n.s2Animation._default.loopAnim !== 'Skill_2_Loop'
    || n.s2Animation._default.endAnim !== 'Skill_2_End' || n.s2Animation._overrideDownAnimation !== 1
    || n.s2Animation._down.beginAnim !== 'Skill_Down_2_Begin' || n.s2Animation._down.loopAnim !== 'Skill_Down_2_Loop'
    || n.s2Animation._down.endAnim !== 'Skill_Down_2_End' || n.s2Animation._overrideUpAnimation !== 0)
    throw Error('Changed original Aphrissa S2 owner inputs');
  const controller = new S2Owner(b, u, record, n.s2Animation);
  u.mem.aphrissaS2Owner = controller;
  return {record, controller, kit: {trait: controller.ordinary.trait(), talents: [], skill: controller.spec}};
}

class S2Owner {
  constructor(b, u, record, animation) {
    Object.assign(this, {b, u, record, animation, seq: null, account: null, stopped: false,
      state: null, tail: null, modeParent: null, mode: 'normal', handles: [], visuals: new WeakSet(), visualSeq: 0});
    this.ordinary = prepareAphrissaOrdinary(b, u, {contract: APHRISSA_ORDINARY_CONTRACT,
      mayBegin: () => this.valid() && !this.account.active && !this.state && !this.tail});
    this.beam = prepareAphrissaS2Beam(b, u, {contract: APHRISSA_S2_BEAM_CONTRACT,
      channelCurrent: () => this.current(), mayRelease: () => {
        if (!this.current() || !u.canAct || u.s.flags.disarm || u.hidden) return false;
        this.resistance.sync(); return this.current() && u.canAct && !u.s.flags.disarm && !u.hidden;
      }});
    this.deck = prepareAphrissaRelay(b, u, {contract: APHRISSA_RELAY_CONTRACT});
    this.bonus = prepareAphrissaRelayBonus(b, u, {contract: APHRISSA_RELAY_BONUS_CONTRACT,
      relatedRelays: () => this.relays()});
    this.resistance = prepareAphrissaResistance(b, u, {contract: APHRISSA_RESISTANCE_CONTRACT,
      rangeMode: () => this.ownsMode() ? 's2' : 'normal'});
    this.parts = [this.deck, this.bonus, this.resistance, this.ordinary, this.beam];
    this.spec = {kind: 'duration', duration: record.source.duration, silenceable: false, manualCancel: false,
      canActivate: () => this.valid() && u.canAct && !u.hidden && !this.state && !this.tail,
      onStart: () => this.start(), onEnd: ({activation}) => this.end(activation)};
  }
  valid() { return !this.stopped && !this.b.finished && present(this.u) && this.seq === this.u.deploySeq
    && this.u.mem.aphrissaS2Owner === this && this.u.skill === this.account && this.account?.spec === this.spec; }
  current(state = this.state) { return !!state && this.valid() && this.state === state && this.account.active
    && this.account.activations === state.activation; }
  relays() { return this.b.allyUnits.filter(unit => unit.ownerUnit === this.u && unit.defId === TOKEN && present(unit)); }
  ownsMode(record = this.modeParent) { return !!record?.buff && this.u.findBuff(MODE) === record.buff
    && record.buff.source === this.u && record.buff.data?.aphrissaS2Mode === record; }
  removeMode() {
    const record = this.modeParent; this.modeParent = null; this.mode = 'normal';
    if (this.ownsMode(record)) this.b.removeBuff(this.u, record.buff);
  }
  profile(skill) {
    if (!this.valid()) return;
    this.u.kit.trait = skill ? this.beam.trait() : this.ordinary.trait();
    this.u.profile = resolveProfile(this.u.def, this.u.kit.trait);
  }
  visual(phase, {preserveForeign = false} = {}) {
    if (!this.valid()) return null;
    const variants = this.u.dir === 'DOWN' ? this.animation._down : this.animation._default;
    const clip = variants[`${phase}Anim`], model = this.u.dir === 'UP' ? 'Back' : 'Front';
    const duration = clocks.models[model].exactDurations[clip];
    if (!Number.isFinite(duration)) throw Error('Missing original Aphrissa S2 wrapper clip');
    if (preserveForeign && !this.visuals.has(this.u.mem.regularFormVisual))
      return {visual: null, until: this.b.time + duration};
    const v = {clip, speed: 1, loop: phase === 'loop', ...(phase === 'loop' ? {replace: true}
      : {playId: `aphrissa:s2:${this.seq}:${++this.visualSeq}`})};
    this.visuals.add(v); this.u.mem.regularFormVisual = v; this.u.mem.regularVisualDirection = this.u.dir;
    return {visual: v, until: this.b.time + duration};
  }
  addMode(state) {
    const record = {buff: null, activation: state.activation};
    const admit = (unit, buff) => unit === this.u && this.current(state) && !this.u.findBuff(MODE)
      && buff.key === MODE && buff.source === this.u && buff.data?.aphrissaS2Mode === record
      && buff.duration === Infinity && Object.keys(buff.mods ?? {}).length === 0 && Object.keys(buff.flags ?? {}).length === 0;
    record.buff = this.b.addBuff(this.u, {key: MODE, source: this.u, duration: Infinity,
      data: {nativeKey: MODE, aphrissaS2Mode: record}, admit,
      onRemove: () => { if (this.modeParent === record) {
        this.modeParent = null; this.mode = 'normal'; this.resistance.sync();
      }}});
    if (this.current(state) && this.ownsMode(record)) return record;
    // A callback may retire/replace the account after accepting this parent.
    if (this.ownsMode(record)) this.b.removeBuff(this.u, record.buff);
    return null;
  }
  start() {
    if (!this.valid() || !this.account.active || this.state || this.tail) return;
    const state = this.state = {activation: this.account.activations, intro: null};
    this.ordinary.phase = null; // Positive cooldown remains intact across restartFSM0.
    this.modeParent = this.addMode(state);
    if (!this.current(state)) return;
    this.mode = this.ownsMode() ? 's2' : 'normal';
    this.profile(true); state.intro = this.visual('begin');
    this.beam.start(); this.bonus.sync(); this.resistance.sync();
  }
  end(activation) {
    if (this.state?.activation !== activation) return;
    this.state = null; this.beam.detach(); this.removeMode(); this.profile(false);
    this.resistance.sync();
    if (this.valid()) this.tail = this.visual('end', {preserveForeign: true});
  }
  tick() {
    if (!this.valid()) return;
    const state = this.state;
    if (state && !this.current(state)) {
      // A changed activation may never lend its account to the old channel.
      this.state = null; this.beam.detach(); this.removeMode(); this.profile(false);
      this.resistance.sync(); this.tail = this.visual('end', {preserveForeign: true});
    }
    if (this.current(state) && state.intro && due(this.b, state.intro.until)) {
      const owned = this.u.mem.regularFormVisual === state.intro.visual;
      state.intro = null;
      if (owned) this.visual('loop');
    }
    if (this.tail && due(this.b, this.tail.until)) {
      const owned = this.visuals.has(this.u.mem.regularFormVisual);
      this.tail = null;
      if (owned) {
        const v = {clip: 'Idle', loop: true, replace: true}; this.visuals.add(v);
        this.u.mem.regularFormVisual = v; this.u.mem.regularVisualDirection = this.u.dir;
      }
    }
  }
  install() {
    if (this.stopped || this.handles.length || this.u.deploySeq !== 0 || this.u.skill?.spec !== this.spec)
      throw Error('Fresh exact Aphrissa S2 account installation required');
    this.account = this.u.skill;
    for (const part of this.parts) part.install();
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
    this.stopped = true; this.state = null; this.tail = null; this.beam.detach(); this.removeMode();
    for (const part of this.parts) part.stop();
    for (const token of this.relays()) this.b._remove(token, 'aphrissa-owner-finished', null, true);
    for (const handle of this.handles) this.b.off(handle);
    this.handles = [];
    if (this.visuals.has(this.u.mem.regularFormVisual)) {
      delete this.u.mem.regularFormVisual; delete this.u.mem.regularVisualDirection;
    }
  }
}
