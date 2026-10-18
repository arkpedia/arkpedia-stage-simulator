// SPDX-License-Identifier: GPL-3.0-or-later
// Held entry clocks. The owning kit must separately map the original buff actions.
import evidence from '../../../data/arkpedia-native-operators/char_4217_makoto.json' with {type: 'json'};
import clocks from '../../../data/arkpedia-makoto-clocks.json' with {type: 'json'};
import {MAKOTO_ID, selectedMakotoInputs} from './arkpedia-makoto-source.js';
import {sourceAbilityDelta} from './arkpedia-slow-down.js';

export const MAKOTO_ENTRY_CONTRACT = Object.freeze({
  scope: 'Original persona-entry chain, force-Front fixed animation clock, cast-start producer and independent delayed switch-end only.',
  mapping: 'A separately reviewed owner supplies the current mode and acknowledges each original begin/heal/switchIn/commit instruction. This component does not interpret numeric abnormal flags, clear buffs/SP, heal, intercept fatal damage, implement skill accounts, persona combat or return/all-out. S3 P1 to P2 snapshots remaining time before begin actions. Its commit carries that snapshot rather than a fresh twenty seconds. Tick-boundary subability entry and the raw delayed-duration fallback are explicit local timing mappings.',
  limitations: 'Action acknowledgement is not proof of a native action interpreter. Same-tick ordering, delayed-duration blackboard context, control dispatch, fatal repair, ordinary A/B dispatch, full mode composition, native effects/audio/modules and compiled/frame/pixel parity remain unapproved. No public admission.',
  frameParity: false,
});

// Full-width source pointers remain strings. Each row is chain/begin/out/in/producer.
const IDS = [
  ['9010935887596408357', '8100680329917746725', '-3264811659591823835', '-7800576647773696475', '1268721692273724965'],
  ['-920625357597389275', '5087010491772423717', '-2051853352821141979', '-2733003840051229147', '6551988282310905381'],
  ['-5036944756814066139', '5855105512771014181', '6906994981503159845', '-8683484900279857627', '7342522337367739941'],
  ['-7050887514664219099', '-7833372326858338779', '179465160630914597', '-308551428170920411', '-5264945501409128923'],
];
const IN = ['Doll_Skill_1_SwitchIn', 'Doll_Skill_2_SwitchIn', 'Doll_Skill_3_P1_SwitchIn', 'Doll_Skill_3_P1toP2_ChangeEnd'];
const freeze = v => {if (v && typeof v === 'object') {for (const x of Object.values(v)) freeze(x); Object.freeze(v);} return v;};
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const due = (a, z) => a >= z - 1e-8;

export function makotoEntryPlans(e = evidence, c = clocks) {
  const fail = () => {throw Error('Changed original Makoto persona-entry inputs');};
  const parts = e.characters[MAKOTO_ID].flatMap(r => r.components);
  const get = id => {const rows = parts.filter(p => p.pathId === id); if (rows.length !== 1) fail(); return rows[0].data;};
  const root = get('-1218499832398557659');
  const duration = e.tables.character.trait.candidates[0].blackboard.find(v => v.key === 'duration')?.value;
  if (duration !== 20 || root._modes.length !== 6 || c.receiptSha256 !== '7489e0dea8732f27fdbe6bd90b7ab2584f9a30d6547f7de14d1b82581072c817') fail();
  return freeze(IDS.map((ids, index) => {
    const [chain, begin, out, into, producer] = ids.map(get), to = index + 1;
    const alias = `makoto[switch2stand_s${to === 4 ? '3_2' : to === 3 ? '3_1' : to}]`;
    if (chain._metadata.namedAsAlias !== alias || !root._commonAbilities.some(p => p.m_PathID === ids[0])
      || !same(chain._abilities.map(p => p.m_PathID), ids.slice(1, 4)) || chain._alwaysNext !== 1
      || chain._forceNextIfCastFail !== 0 || chain._checkCanUseSubAbility !== 0 || chain._timeMode !== 1
      || chain._stopMoveNextWhenNotCasting !== 0 || chain._alsoInterruptCurrentSubAbility !== 0
      || chain._alsoStopSubAbilityAffect !== 1 || chain._alsoResetSubAbilityCooldown !== 1
      || chain._fireCastStartEventWhenCast !== (to >= 3 ? 1 : 0)
      || begin._waitForCasting !== 0 || begin._preDelay !== 0 || begin._escapeTime !== 0
      || begin._buffs.length !== (to === 4 ? 2 : 1) || begin._buffs[0].buffKey !== 'makoto_switchbegin'
      || !same(begin._buffs[0].attributes.abnormalFlags, [5, 18, 1, 6, 7, 15, 24])
      || !same(begin._buffs[0].attributes.abnormalImmunes, [0, 16, 19])) fail();
    if (to === 4 && (begin._buffs[1].buffKey !== 'makoto_s3_2_mod_block_cnt'
      || begin._buffs[1].templateKey !== 'makoto_s3_2_mod_block_cnt' || begin._buffs[1].lifeTimeType !== 0)) fail();
    for (const [a, clip, wait] of [[out, to === 4 ? 'Doll_Skill_3_P1toP2_ChangeBegin' : 'SwitchOut', 0], [into, IN[index], 1]]) {
      if (a._animKey !== clip || a._timeMode !== 1 || a._maxAnimScale !== 1 || a._affectedBySlowDown !== 1
        || a._faceToFront !== 1 || a._faceToTarget !== 0 || a._preDelay !== 0 || a._escapeTime !== 0
        || a._waitForAttackEvent !== wait || a._endAnimKey !== '' || a._ignorePalsyInterrupt !== 0) fail();
    }
    const heal = out._activeBuffs[0];
    if (out._activeBuffs.length !== 1 || heal.buffKey !== 'makoto_switch[heal]' || heal.templateKey !== 'HealViaMaxHpRatio'
      || !same(heal.blackboard, [{key: 'hp_ratio', value: 1, valueStr: ''}]) || into._activeBuffs.length
      || producer.m_GameObject.m_PathID !== into.m_GameObject.m_PathID || producer._runActionOnEvent !== 2
      || producer._onlyRunOnce !== 0) fail();
    const delay = producer._buffs.find(b => b.buffKey === 'makoto_delayed_switchend');
    if (!delay || delay.lifeTimeType !== 1 || delay.lifeTime !== 0.9900000095367432
      || delay.durationKey !== 'makoto_delayed_switchend_duration'
      || !same(delay.blackboard, to === 4 ? [{key: 'is_trans_to_s3_2', value: 1, valueStr: ''}] : [])) fail();
    const front = c.models.Front;
    if (front.exactDurations[out._animKey] !== (to === 4 ? .5 : 1) || front.exactDurations[into._animKey] !== 1) fail();
    // SwitchIn has no marker for S1/S2/S3P1. P2 has one at .8, but its
    // attached producer still runs on cast-start event2, not attack event4.
    const markers = (e.models[MAKOTO_ID].Front.eventPayloads[into._animKey] ?? []).filter(v => v.name === 'OnAttack').map(v => v.time);
    if (!same(markers, to === 4 ? [0.800000011920929] : [])) fail();
    return structuredClone({to, from: to === 4 ? 3 : 0, alias, chainId: ids[0], duration,
      fireCastStart: !!chain._fireCastStartEventWhenCast,
      beginBuff: begin._buffs[0], beginBuffs: begin._buffs, healBuff: heal, producerBuffs: producer._buffs,
      out: {clip: out._animKey, duration: front.exactDurations[out._animKey]},
      into: {clip: into._animKey, duration: front.exactDurations[into._animKey]}, delay: delay.lifeTime,
      beginActions: e.templates.makoto_switchbegin.eventToActions.ON_BUFF_START,
      healActions: e.templates.HealViaMaxHpRatio.eventToActions.ON_BUFF_START,
      commitActions: e.templates.makoto_switchend.eventToActions.ON_BUFF_START});
  }));
}

export class MakotoPersonaEntry {
  constructor(b, u, {contract, currentMode, applySource} = {}) {
    if (contract !== MAKOTO_ENTRY_CONTRACT || typeof currentMode !== 'function' || typeof applySource !== 'function'
      || u.def.charId !== MAKOTO_ID || u.deploySeq !== 0) throw Error('Fresh selected Makoto, exact entry contract and explicit source-action adapters required');
    this.record = selectedMakotoInputs(u);
    Object.assign(this, {b, u, currentMode, applySource, plans: makotoEntryPlans(), seq: null, phase: null,
      busy: false, stopped: false, handles: [], visuals: new WeakSet(), visualSeq: 0});
  }
  valid() {return !this.stopped && !this.b.finished && this.seq !== null && this.u.deploySeq === this.seq
    && this.u.alive && this.u.deployed && !this.u.hidden && !this.u.removed && !this.u._removing;}
  owned(p) {return this.valid() && this.phase === p;}
  queryMode() {try {return this.currentMode();} catch (error) {this.cancel(); throw error;}}
  instruction(p, kind) {
    if (!this.owned(p)) return false;
    // Acknowledge every stage; an omitted adapter cannot silently look complete.
    let accepted;
    try {accepted = this.applySource(kind, p.plan, Object.freeze({from: p.plan.from, to: p.plan.to,
      remaining: p.remaining, duration: p.duration, seq: this.seq}));}
    catch (error) {this.cancel(); throw error;}
    if (accepted !== true) {this.cancel(); return false;}
    if (!this.owned(p)) {if (this.phase === p) this.cancel(); return false;}
    if (kind !== 'commit') {
      const mode = this.queryMode();
      if (!this.owned(p) || mode !== p.plan.from) {this.cancel(); return false;}
    }
    return true;
  }
  visual(p, clip) {
    if (!this.owned(p)) return;
    const v = {clip, loop: false, speed: this.u.s.slowDownRate, forceFront: true,
      playId: `makoto:entry:${this.seq}:${++this.visualSeq}`};
    this.visuals.add(v); p.visual = v; this.u.mem.regularFormVisual = v;
  }
  start({to, remaining, duration = 20} = {}) {
    if (this.busy || this.phase || !this.valid()) return false;
    this.busy = true;
    try {
      const from = this.queryMode();
      if (!this.valid()) return false;
      const plan = this.plans.find(p => p.to === to && p.from === from);
      if (!plan || (to === 4 ? this.record.index !== 2 : to !== this.record.index + 1)) return false;
      if (to === 4 && (!Number.isFinite(remaining) || remaining <= 0 || !Number.isFinite(duration)
        || duration <= 0 || remaining > duration)) return false;
      const p = {plan, remaining: to === 4 ? remaining : plan.duration, duration: to === 4 ? duration : plan.duration,
        step: 'out', age: 0, lastAt: this.b.time};
      // Claim before callbacks. Snapshot P1 remaining time before clear/born actions.
      this.phase = p;
      if (!this.instruction(p, 'begin') || !this.instruction(p, 'heal')) return false;
      this.visual(p, plan.out.clip);
      return true;
    } finally {this.busy = false;}
  }
  tick() {
    const p = this.phase;
    if (!p || this.busy) return;
    this.busy = true;
    try {
      const mode = this.queryMode();
      if (!this.owned(p) || mode !== p.plan.from) {this.cancel(); return;}
      if (this.u.mem.regularFormVisual === p.visual) p.visual.speed = this.u.s.slowDownRate;
      if (p.step === 'out') {
        p.age += sourceAbilityDelta(this.u, Math.max(0, this.b.time - p.lastAt), true); p.lastAt = this.b.time;
        if (!due(p.age, p.plan.out.duration)) return;
        p.step = 'in'; p.commitAt = this.b.time + p.plan.delay;
        this.visual(p, p.plan.into.clip);
        if (!this.instruction(p, 'switchIn')) return;
      }
      // The delayed buff's wall-clock lifetime is independent of animation
      // progress/ASPD. No invented OnAttack is used for an absent SwitchIn marker.
      if (p.step === 'in' && due(this.b.time, p.commitAt)) {
        p.step = 'commit';
        if (!this.instruction(p, 'commit')) return;
        this.phase = null;
        this.clearVisual();
      }
    } finally {this.busy = false;}
  }
  clearVisual() {
    if (this.u.deploySeq === this.seq && this.visuals.has(this.u.mem.regularFormVisual)) delete this.u.mem.regularFormVisual;
  }
  cancel() {this.phase = null; this.clearVisual();}
  install() {
    if (this.stopped || this.handles.length || this.u.mem.makotoEntry && this.u.mem.makotoEntry !== this) throw Error('Makoto entry clock cannot be reinstalled');
    this.u.mem.makotoEntry = this;
    const {b, u} = this;
    this.handles = [
      b.on('deploy', ({unit, move}) => {if (unit !== u || move) return; if (this.seq !== null) {if (u.deploySeq !== this.seq) this.stop(); return;} this.seq = u.deploySeq;}, {owner: u}),
      b.on('tick', () => {if (this.seq !== null && !this.valid()) this.stop(); else this.tick();}, {owner: u}),
      ...['removed', 'death'].map(event => b.on(event, ({unit}) => {if (unit === u) this.stop();}, {owner: u})),
      b.on('battleEnd', () => this.stop(), {owner: u}),
    ];
  }
  stop() {if (this.stopped) return; this.stopped = true; this.cancel(); for (const h of this.handles) this.b.off(h); this.handles = [];}
}
