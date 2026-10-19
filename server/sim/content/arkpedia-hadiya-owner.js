// SPDX-License-Identifier: GPL-3.0-or-later
// Selected source composition only. Public art, UI and roster admission are separate.
import evidence from '../../../data/arkpedia-native-operators/char_394_hadiya.json' with {type: 'json'};
import clocks from '../../../data/arkpedia-hadiya-clocks.json' with {type: 'json'};
import {HADIYA_ID as ID, selectedHadiyaInputs, hadiyaNativeInputs} from './arkpedia-hadiya-source.js';
import {HadiyaPayments, HADIYA_PAYMENT_CONTRACT} from './arkpedia-hadiya-payments.js';
import {HadiyaTalent, HADIYA_TALENT_CONTRACT} from './arkpedia-hadiya-talent.js';
import {canTargetEnemy, sortEnemyTargets} from '../targeting.js';
import {bodyInKeys} from '../body.js';

export const HADIYA_OWNER_CONTRACT = Object.freeze({
  scope: 'Held selected Hadiya ordinary/S1/S2 direct melee, real manual SP/DP account, primary/mode/extra buffs and paid adaptation; public admission remains separate.',
  mapping: 'Ordinary and S1 select one ground input, S2 up to the selected attack@max_target distinct inputs. Source A/B replacement maps locally to B/A alternation per mode entry. Each retained batch owns one accepted attack receipt and at most one direct live-ATK Physical packet per still-legal original recipient life. No block-count target multiplier, projectile or splash is invented. Source timeMode0 samples BAT/interval playback capped at1; affectedBySlowDown0 never multiplies its elapsed clock a second time. Next acquisition waits for max(current interval, original marker/playback), not the full art clip. Casting replaces Born/ordinary work without resetting positive cooldown. Cast OnAttack independently admits the primary stat buff; clip finish independently admits the mode parent. S1 accepted primary gets its original30-second lifetime and bounds the real account; refused/missed primary uses the finite activation-duration fallback. S2 base duration starts at mode-producer entry and its infinite primary checks skill-affecting on the original0.03-second trigger. Cast interruption cancels unborn markers and follows the original force-next sequence into its mode producer. Active nonsilenceable/nonstunnable buffs and duration persist through ordinary controls. S2 adaptation extends its original deadline, and removal restores that original deadline rather than retaining a detached bonus. Adaptation consumes one DP ticket and independently attempts its extra buff and talent signal, including S1 full-SP entry. Accepted paid actions are not refunded for a later refused buff. Mode/primary removal ends only this owned activation. Original S2-to-default mix rows choose the literal End clip; the account ends before that local presentation lock, so SP resumes normally.',
  limitations: 'Numeric event4/selector aliases, B/A dispatch, sampled playback/cooldown, retained batch legality, sequence/marker/mode origins, force-next interruption, resource/buff/signal ordering, stat-buff lifetime-to-account binding, displayed range and End gameplay lock are declared local mappings. Exact native cooldown-origin, compiled status/event/mix behavior, visual blending, RNG/frame/pixel parity, modules, original effects/audio, public art delivery and browser admission are unverified.',
  frameParity: false,
});
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const live = u => u?.alive && u.deployed && !u.hidden && !u.removed && !u._removing;
const due = (a, z) => a >= z - 1e-7;

export function verifyHadiyaOwner(n = hadiyaNativeInputs()) {
  const fail = () => { throw Error('Changed original Hadiya owner inputs'); };
  const modeIds = ['667418768306686177', '-5949462224016553759', '5792691836790196449'];
  const attacks = ['7048047928707401953', '9020135240677869793', '5468999303584565473'];
  if (!same(n.root._modes.map(p => p.m_PathID), modeIds) || n.root._useRealBornTimeFromAnim !== 0
    || n.root.m_overrideBornTime !== -1 || n.root._occupiedRemainingCharacterCnt !== 1) fail();
  for (const [i, row] of n.modes.entries()) {
    const {mode, attack: a, trigger: t, selector: s, range: r} = row;
    if (mode._attack.m_PathID !== attacks[i] || a._waitForAttackEvent !== 1 || a._timeMode !== 0
      || a._maxAnimScale !== 1 || a._affectedBySlowDown !== 0 || a._selectTargetSource !== 1
      || a._selectTargetTiming !== 0 || a._interuptIfTargetDead !== 0 || a._allowNoTarget !== 0
      || a._animKey !== (i === 2 ? 'Skill_2_Loop' : 'Attack_A') || a._endAnimKey !== 'Idle'
      || a._downAnimKey !== (i === 2 ? 'Skill_Down_2_Loop' : '')
      || a._alwaysIncludeTarget !== (i === 2 ? 1 : 0) || a._forceFaceToDirection !== (i === 2 ? 1 : 0)
      || a._faceToTarget !== (i === 2 ? 0 : 1) || a._faceToDefault !== (i === 2 ? 1 : 0)
      || a._atkScale !== 1 || a._damageType !== 1 || a._attackType !== 1 || a._activeBuffs.length
      || a._preDelay !== 0 || a._resetCdStrategy !== 1 || a._ignorePalsyInterrupt !== 0
      || t._keepTarget !== 0 || t._minTargetNum !== 1 || s._postFilter !== 4 || s._maxNum !== 1
      || s._maxTargetKey !== 'max_target' || s._targetSide !== 2 || s._targetMotion !== 1
      || s._limitTargetNum !== 1 || s._limitedMaxTargetNumToBlockedCnt !== 0 || s._ignoreTargetFree !== 0
      || s._forceIgnoreCamouflage !== 0 || s._ignoreHitRange !== 0 || r._extendable !== (i === 0 ? 1 : 0)) fail();
    if (i < 2 && (row.replacement._sourceAnimKey !== 'Attack_A' || row.replacement._loopType !== 1
      || !same(row.replacement._replaceGroup.map(p => p.anim), ['Attack_B', 'Attack_A']))) fail();
  }
  for (const [i, row] of n.skills.entries()) {
    const {root: r, sequence: q, animation: a, marker, mode, extra} = row;
    if (r._canSilenced !== 0 || r._canUseInAbnormalState !== 0 || r._canCastWithNoSp !== 0
      || r._allowSpRecoveryWhenAffecting !== 0 || r._canCastDuringBorn !== 1 || r._canSwitchDuringBorn !== 1
      || r._allowNoTarget !== 1 || r._maxRetriggerCount !== 1 || r._retriggerCostKey !== 'retrigger_cost'
      || r._emitRetriggerSignal !== 1 || r._allowRetriggerOutsideSkill !== (i === 0 ? 1 : 0)
      || r._attackBlackboardModeIndex !== (i === 0 ? -1 : 2) || r._rangeIdModeIndex !== (i === 0 ? -1 : 2)
      || q._alwaysNext !== 1 || q._forceNextIfCastFail !== 1 || q._timeMode !== 1
      || q._useLongestAbilityCooldown !== (i === 0 ? 1 : 0)
      || a._animKey !== (i === 0 ? 'Skill_1' : 'Skill_2_Begin') || a._waitForAttackEvent !== 0
      || a._timeMode !== 0 || a._maxAnimScale !== 1 || a._affectedBySlowDown !== 0 || a._allowNoTarget !== 1
      || marker._runActionOnEvent !== 4 || marker._buffs.length !== 1
      || marker._buffs[0].lifeTimeType !== (i === 0 ? 1 : 2)
      || marker._buffs[0].isSilenceable !== 0 || marker._buffs[0].isStunnable !== 0
      || mode._waitForCasting !== 1 || mode._updateLifetimeWhenSpellStart !== 1 || mode._checkBuffEarlyFinish !== 1
      || mode._buffs[0].templateKey !== 'switch_mode_restart_fsm' || mode._buffs[0].lifeTimeType !== 2
      || extra._metadata.blackboardPrefix !== 'extra.' || extra._buffs[0].lifeTimeType !== 2) fail();
    const attribute = type => [{attributeType: type, formulaItem: 1, value: 0,
      loadFromBlackboard: 1, fetchBaseValueFromSourceEntity: 0}];
    if (!same(marker._buffs[0].attributes.attributeModifiers, attribute(i === 0 ? 2 : 1))
      || marker._buffs[0].buffKey !== `hadiya_s_${i + 1}[buff]`
      || marker._buffs[0].triggerInterval !== (i === 0 ? -1 : .029999999329447746)
      || mode._buffs[0].buffKey !== `hadiya_s_${i + 1}[switch_mode]`
      || !same(mode._buffs[0].blackboard, i === 0 ? [] : [{key: 'mode', value: 2, valueStr: ''}])
      || !same(extra._buffs[0].attributes.attributeModifiers, i === 0 ? attribute(1) : [])
      || extra._buffs[0].buffKey !== (i === 0 ? 'hadiya_s_1[extra_buff]' : 'hadiya_s_2[extand_time]')) fail();
  }
  const t = n.templates, ex = t['hadiya_s_2[extand_time]'].eventToActions;
  if (ex.ON_BUFF_START[0]._abilityName !== 'S2Ability' || ex.ON_BUFF_START[0]._extendTimeKey !== 'duration'
    || !ex.ON_BUFF_START[0]._keepPassedTime || !ex.ON_BUFF_FINISH[0]._useOriginalCooldown
    || !ex.ON_BUFF_FINISH[0]._keepPassedTime || ex.ON_BUFF_FINISH[0]._newPeriod !== 0
    || !same(t['hadiya_s_2[buff]'].eventToActions.ON_BUFF_START[0]._buffKeys, ['hadiya_t_1'])
    || t.switch_mode_restart_fsm.eventToActions.ON_BUFF_START[0]._modeIndex !== 1
    || !t.switch_mode_restart_fsm.eventToActions.ON_BUFF_FINISH[0]._restoreDefault) fail();
  const aliases = Object.fromEntries(n.art._animations.map(a => [a.animKey, a.animName]));
  for (const clip of ['Idle', 'Die', 'Attack_A', 'Attack_B', 'Skill_1', 'Skill_2_Begin', 'Skill_2_Idle',
    'Skill_2_Loop', 'Skill_Down_2_Loop', 'Skill_2_End', 'Skill_2_Die']) if (aliases[clip] !== clip) fail();
  if (aliases.Born !== 'Start' || !same(n.modes[2].hook._replaceAnimPairs,
    [{fromAnimKey: 'Die', toAnimKey: 'Skill_2_Die'}, {fromAnimKey: 'Idle', toAnimKey: 'Skill_2_Idle'}])) fail();
  if (!same(n.art._mixSettings.map(a => [a.sourceAnimName, a.targetAnimName, a.mixAnimName]), [
    ['Skill_2_Idle', 'Idle', 'Skill_2_End'], ['Skill_2_Loop', 'Idle', 'Skill_2_End'],
    ['Skill_Down_2_Loop', 'Idle', 'Skill_2_End'], ['Skill_2_Loop', 'Attack_A', 'Skill_2_End'],
    ['Skill_2_Loop', 'Attack_B', 'Skill_2_End'], ['Skill_Down_2_Loop', 'Attack_A', 'Skill_2_End'],
    ['Skill_Down_2_Loop', 'Attack_B', 'Skill_2_End']])) fail();
}

export class HadiyaOwner {
  constructor(b, u, {contract} = {}) {
    if (contract !== HADIYA_OWNER_CONTRACT || u.def.charId !== ID || u.deploySeq !== 0 || u.mem.hadiyaOwner)
      throw Error('Fresh selected Hadiya and exact complete-owner contract required');
    verifyHadiyaOwner();
    this.record = selectedHadiyaInputs(u);
    Object.assign(this, {b, u, mode: 0, seq: null, stopped: false, installed: false, finishing: false,
      phase: null, state: null, accepting: false, busy: false, turn: [0, 0, 0], owned: new Set(),
      handles: [], visuals: new WeakSet(), visualSeq: 0, facing: u.dir});
    this.payment = new HadiyaPayments(b, u, {contract: HADIYA_PAYMENT_CONTRACT,
      guard: () => this.valid() && !this.finishing && this.phase?.kind !== 'end'});
    this.talent = new HadiyaTalent(b, u, {contract: HADIYA_TALENT_CONTRACT,
      ownsTrigger: (r, event) => this.valid() && this.state?.activation === r.activation
        && this.payment.owns(r) && (event === 'ON_BUFF_TRIGGER' ? r.kind === 'cast' && this.record.index === 1
          : r.kind === 'adaptation' || r.kind === 'adaptation-active')});
  }

  valid() {
    return !this.stopped && !this.b.finished && live(this.u) && this.seq === this.u.deploySeq
      && this.b.unitById(this.u.id) === this.u && this.u.mem.hadiyaOwner === this
      && this.u.skill === this.account && this.account?.spec === this.skillSpec;
  }
  model() {
    const face = this.facing === 'UP' ? 'Back' : 'Front';
    return {...evidence.models[ID][face], ...clocks.models[face]};
  }
  visual(clip, speed = 1, loop = false) {
    if (!this.valid()) return null;
    if (!Object.hasOwn(this.model().exactDurations, clip)) throw Error('Missing original Hadiya clip: ' + clip);
    const v = {clip, speed, loop, ...(loop ? {replace: true} : {playId: `hadiya:${this.seq}:${++this.visualSeq}`})};
    this.visuals.add(v); this.u.mem.regularFormVisual = v; this.u.mem.regularVisualDirection = this.facing;
    const die = this.mode === 2 ? 'Skill_2_Die' : 'Die', duration = this.model().exactDurations[die];
    this.u.mem.regularDeathVisual = duration == null ? {hide: true, duration: 1} : {clip: die, die, duration};
    return v;
  }
  idle() { this.facing = this.u.dir; this.visual(this.mode === 2 ? 'Skill_2_Idle' : 'Idle', 1, true); }
  face(t) {
    const dx = t.x - this.u.x, dy = t.y - this.u.y;
    if (Math.hypot(dx, dy) > 1e-8) this.facing = Math.abs(dy) > Math.abs(dx)
      ? dy > 0 ? 'UP' : 'DOWN' : dx < 0 ? 'LEFT' : 'RIGHT';
  }
  legal(t) {
    return live(t) && t.side === 'enemy' && this.b.unitById(t.id) === t
      && canTargetEnemy(this.u, t, {groundOnly: true, canHitFly: false}) && (!t.s.flags.camou || !!t.blockedBy);
  }
  choices() {
    const {b, u} = this;
    if (b.rangeChanged(u)) b._refreshRange(u);
    const ts = b.enemies.filter(t => this.legal(t) && bodyInKeys(t, u.rangeKeySet));
    for (const t of b.blockedTargets(u, {groundOnly: true, canHitFly: false, canTarget: (_u, e) => this.legal(e)}))
      if (!ts.includes(t)) ts.push(t);
    return sortEnemyTargets(b, u, ts, 'normal').slice(0, this.mode === 2 ? this.record.bb['attack@max_target'] : 1);
  }
  beginAttack(ts) {
    if (this.busy || this.finishing || this.phase || !this.valid() || !this.u.canAct || this.u.s.flags.disarm || !ts.length) return false;
    const expected = this.choices();
    if (ts.length !== expected.length || ts.some((t, i) => t !== expected[i])) return false;
    if (this.mode === 2) this.facing = this.u.dir; else this.face(ts[0]);
    const clip = this.mode === 2 ? this.facing === 'DOWN' ? 'Skill_Down_2_Loop' : 'Skill_2_Loop'
      : ['Attack_B', 'Attack_A'][this.turn[this.mode]++ % 2];
    const model = this.model(), speed = Math.min(1, this.u.base.bat / this.u.s.interval);
    const marker = model.eventPayloads[clip].filter(e => e.name === 'OnAttack');
    if (marker.length !== 1) throw Error('Missing original Hadiya single attack marker');
    const period = Math.max(this.u.s.interval, marker[0].time / speed);
    this.phase = {kind: 'attack', mode: this.mode, epoch: this.u.attackControlEpoch,
      targets: ts.map(t => ({t, life: t.deploySeq})), age: 0, lastAt: this.b.time, speed,
      releaseAge: marker[0].time, untilAge: period * speed, released: false, accepted: false};
    this.u.atkCd = period; this.phase.visual = this.visual(clip, speed); return true;
  }
  admissible(ts) {
    const p = this.phase;
    return this.accepting && this.valid() && this.u.canAct && !this.u.s.flags.disarm
      && p?.kind === 'attack' && !p.accepted && p.mode === this.mode && p.epoch === this.u.attackControlEpoch
      && due(p.age, p.releaseAge) && ts.length > 0 && ts.length === p.delivery?.length
      && ts.every((t, i) => t === p.delivery[i].t && t.deploySeq === p.delivery[i].life && this.legal(t));
  }
  release(ts, info) {
    if (!this.admissible(ts)) return false;
    const p = this.phase; p.accepted = true;
    for (const {t, life} of p.delivery) {
      if (!this.valid() || this.phase !== p || p.mode !== this.mode || p.epoch !== this.u.attackControlEpoch) break;
      if (t.deploySeq === life && this.legal(t)) this.b.dealDamage(this.u, t, {
        amount: this.u.s.atk * this.u.s.atkScaleMul, type: 'phys', isAttack: true, isSkill: p.mode !== 0,
        isProjectile: false, attackId: info.attackId, applyWay: 'melee', tags: ['hadiya:melee', `hadiya:mode:${p.mode}`],
      });
    }
    return true;
  }

  owns(buff) { return !!buff && this.owned.has(buff) && this.u.buffs.includes(buff) && buff.data?.hadiyaOwner === this; }
  attach(s, name, {mods = {}, duration = Infinity, interval = 0, onTick, onFinish} = {}) {
    if (!this.valid() || this.state !== s || !this.account.active) return null;
    const key = `hadiya:owner:${this.u.id}:${this.seq}:${s.activation}:${name}`;
    const expected = {...mods};
    const permit = (_u, a) => this.valid() && this.state === s && this.account.active
      && a.key === key && a.source === this.u && a.data?.hadiyaOwner === this && a.data?.nativeKey === name
      && a.duration === duration && a.timeLeft === duration && a.interval === interval
      && same(a.mods, expected) && !Object.keys(a.flags ?? {}).length && !this.u.findBuff(key);
    const buff = this.b.addBuff(this.u, {key, source: this.u, duration, timeLeft: duration, interval, mods: {...mods},
      sourceStatusResistable: false, data: {hadiyaOwner: this, nativeKey: name}, admit: permit, onTick,
      onRemove: ({buff}) => { this.owned.delete(buff); onFinish?.(buff); },
      onExpire: ({buff}) => { this.owned.delete(buff); onFinish?.(buff); }});
    if (!buff) return null;
    this.owned.add(buff);
    if (!this.valid() || this.state !== s || !this.account.active) { this.remove(buff); return null; }
    return buff;
  }
  remove(buff) {
    if (this.owns(buff)) this.b.removeBuff(this.u, buff);
    this.owned.delete(buff);
  }
  setMode(mode) {
    if (!this.valid()) return;
    this.mode = mode; this.turn[mode] = 0;
    this.u.rangeGrid = mode === 2 ? this.record.skillRangeGrid : this.record.rangeGrid;
    this.skillSpec.targeting = mode ? {noRangeExtend: true} : null;
    this.b.refreshRange(this.u);
  }
  canCast() { return this.valid() && !this.finishing && !this.state && this.phase?.kind !== 'end'; }
  startSkill() {
    if (!this.valid() || !this.account.active) return;
    const receipt = this.payment.current;
    if (!this.payment.owns(receipt)) { this.account.end('unowned-cast'); return; }
    const s = {activation: this.account.activations, receipt, primary: null, mode: null, extra: null,
      baseDeadline: this.b.time + this.record.source.duration, deadline: this.b.time + this.record.source.duration,
      modeEntered: false, extraAttempted: false};
    this.state = s; this.phase = null; this.facing = this.u.dir;
    this.u.mem.regularBornUntil = this.b.time;
    const clip = this.record.index === 0 ? 'Skill_1' : 'Skill_2_Begin', m = this.model();
    const speed = Math.min(1, this.u.base.bat / this.u.s.interval);
    const marker = m.eventPayloads[clip].filter(e => e.name === 'OnAttack');
    if (marker.length !== 1) throw Error('Missing original Hadiya cast marker');
    this.phase = {kind: 'cast', state: s, epoch: this.u.actionControlEpoch, released: false,
      speed, age: 0, lastAt: this.b.time, releaseAge: marker[0].time, untilAge: m.exactDurations[clip]};
    this.phase.visual = this.visual(clip, speed);
    if (receipt.kind === 'adaptation') this.applyAdaptation(s, receipt);
  }
  primary(s) {
    const skill = this.record.index + 1, name = `hadiya_s_${skill}[buff]`;
    const buff = this.attach(s, name, {mods: this.record.index === 0 ? {defPct: this.record.bb.def} : {atkPct: this.record.bb.atk},
      duration: this.record.index === 0 ? this.record.source.duration : Infinity,
      interval: this.record.index === 0 ? 0 : .029999999329447746,
      onTick: () => { if (this.state === s && !this.account.active) this.finishSkill('source-not-affecting'); },
      onFinish: () => { if (this.state === s && !this.finishing) this.finishSkill('primary-finished'); }});
    if (!buff || !this.valid() || this.state !== s) return;
    s.primary = buff;
    if (this.record.index === 0) s.deadline = s.baseDeadline = this.b.time + this.record.source.duration;
    else this.talent.trigger(s.receipt, 'ON_BUFF_TRIGGER');
  }
  enterMode(s) {
    if (!this.valid() || this.state !== s || !this.account.active || s.modeEntered) return;
    s.modeEntered = true;
    if (this.record.index === 1) {
      s.baseDeadline = this.b.time + this.record.source.duration;
      s.deadline = s.baseDeadline + (this.owns(s.extra) ? this.record.bb['extra.duration'] : 0);
    }
    const buff = this.attach(s, `hadiya_s_${this.record.index + 1}[switch_mode]`, {
      onFinish: () => { if (this.state === s && !this.finishing) this.finishSkill('mode-finished'); },
    });
    if (buff && this.valid() && this.state === s) { s.mode = buff; this.setMode(this.record.index + 1); }
    if (this.valid() && this.state === s) this.idle();
  }
  applyAdaptation(s, receipt) {
    if (!this.valid() || this.state !== s || s.extraAttempted || !this.payment.owns(receipt)) return false;
    s.extraAttempted = true;
    const name = this.record.index === 0 ? 'hadiya_s_1[extra_buff]' : 'hadiya_s_2[extand_time]';
    const extra = this.attach(s, name, {mods: this.record.index === 0 ? {atkPct: this.record.bb['extra.atk']} : {},
      onFinish: () => {
        if (this.state !== s || this.finishing || this.record.index !== 1) return;
        s.deadline = s.baseDeadline;
        if (this.valid() && s.modeEntered && due(this.b.time, s.deadline)) this.finishSkill('original-deadline');
      }});
    if (extra && this.valid() && this.state === s) {
      s.extra = extra;
      if (this.record.index === 1) s.deadline = s.baseDeadline + this.record.bb['extra.duration'];
    }
    if (this.valid() && this.state === s) this.talent.trigger(receipt, 'ON_SKILL_RETRIGGERED');
    return true;
  }
  adapt() {
    if (!this.valid() || this.finishing || this.phase?.kind === 'end') return false;
    if (!this.account.active) return this.payment.activateAdaptation();
    const s = this.state;
    if (!s || s.extraAttempted) return false;
    return this.payment.adapt(receipt => this.applyAdaptation(s, receipt));
  }
  finishSkill(reason = 'duration') {
    if (this.finishing) return;
    this.finishing = true;
    const s = this.state, prior = this.u.mem.regularFormVisual?.clip;
    try {
      this.state = null; this.phase = null;
      for (const a of [...this.owned]) this.remove(a);
      if (this.u.skill === this.account && this.seq === this.u.deploySeq && this.account.active) this.account.end(reason);
      if (this.valid()) {
        const mix = hadiyaNativeInputs().art._mixSettings.find(a => a.sourceAnimName === prior && a.targetAnimName === 'Idle');
        this.setMode(0);
        if (mix) {
          this.phase = {kind: 'end', until: this.b.time + this.model().exactDurations[mix.mixAnimName]};
          this.visual(mix.mixAnimName);
        } else this.idle();
      }
      return !!s;
    } finally { this.finishing = false; }
  }

  tick() {
    if (!this.valid()) return;
    const {b, u} = this, s = this.state;
    if (s && ((!this.account.active) || s.primary && !this.owns(s.primary) || s.mode && !this.owns(s.mode))) {
      this.finishSkill('source-replaced'); return;
    }
    if (s?.extra && !this.owns(s.extra) && this.record.index === 1) s.deadline = s.baseDeadline;
    if (s && (s.modeEntered || this.record.index === 0) && due(b.time, s.deadline)) {
      this.finishSkill('duration'); return;
    }
    const p = this.phase;
    if (p?.kind === 'cast') {
      if (!u.canAct || p.epoch !== u.actionControlEpoch) {
        this.phase = null; this.enterMode(p.state); return;
      }
      p.age += Math.max(0, b.time - p.lastAt) * p.speed; p.lastAt = b.time;
      if (!p.released && due(p.age, p.releaseAge)) { p.released = true; this.primary(p.state); }
      if (this.valid() && this.phase === p && due(p.age, p.untilAge)) { this.phase = null; this.enterMode(p.state); }
      return;
    }
    if (p?.kind === 'born' || p?.kind === 'end') {
      if (!due(b.time, p.until)) return;
      this.phase = null; this.idle();
    }
    const attack = this.phase;
    if (!u.canAct || u.s.flags.disarm || attack?.kind === 'attack' && attack.epoch !== u.attackControlEpoch) {
      this.phase = null; this.idle(); return;
    }
    if (attack?.kind === 'attack') {
      attack.age += Math.max(0, b.time - attack.lastAt) * attack.speed; attack.lastAt = b.time;
      if (!attack.released && due(attack.age, attack.releaseAge)) {
        attack.released = true;
        attack.delivery = attack.targets.filter(({t, life}) => t.deploySeq === life && this.legal(t));
        this.accepting = true;
        try { if (attack.delivery.length) b.forceAttack(u, attack.delivery.map(v => v.t)); }
        finally { this.accepting = false; }
      }
      if (!this.valid() || this.phase !== attack || !due(attack.age, attack.untilAge)) return;
      this.phase = null;
    }
    if (u.atkCd > 1e-8) return;
    const ts = this.choices();
    if (ts.length) this.beginAttack(ts); else this.idle();
  }

  trait() {
    return {noAttack: true, attackDrivenSkill: true, attack: 'melee', dmgType: 'phys', applyWay: 'melee',
      canHitFly: false, groundOnly: true, heal: null, projectile: 'none', maxTargets: 1, maxTargetsByBlock: false,
      hitAllBlocked: false, allInRange: false, hits: 1, hitsFn: null, chain: null, splashRadius: 0, windup: 0,
      attackVisual: 'none', requiresAcceptedLaunch: true,
      acceptAreaAttack: (_b, _u, _p, ts) => this.admissible(ts),
      launchAreaAttack: (_b, _u, _p, ts, info) => this.release(ts, info)};
  }
  spec() {
    return {kind: 'toggle', trigger: 'NEVER', silenceable: false, manualTriggerOnly: () => true,
      canActivate: () => this.canCast(), onStart: () => this.startSkill(), onEnd: () => this.finishSkill('account-ended'),
      durationRemaining: () => this.state ? Math.max(0, this.state.deadline - this.b.time) : 0};
  }
  install() {
    if (this.installed || this.stopped || this.u.mem.hadiyaOwner) throw Error('Hadiya owner cannot be reinstalled');
    const {b, u} = this;
    this.installed = true; this.account = u.skill; this.skillSpec = u.skill.spec; u.mem.hadiyaOwner = this;
    this.payment.install(); this.talent.install();
    this.handles = [
      b.on('deploy', ({unit, move}) => {
        if (unit !== u || move) return;
        if (this.seq != null) { if (this.seq !== u.deploySeq) this.stop(); return; }
        this.seq = u.deploySeq; this.facing = u.dir;
        const until = b.time + this.model().exactDurations.Start;
        this.phase = {kind: 'born', until}; u.mem.regularBornUntil = until; this.visual('Start');
      }, {owner: u}),
      b.on('tick', () => { if (this.seq != null && !this.valid()) this.stop(); else this.tick(); }, {owner: u}),
      b.on('palsyTriggered', ({unit}) => { if (unit === u && this.phase?.kind === 'attack') { this.phase = null; if (this.valid()) this.idle(); } }, {owner: u}),
      b.on('removed', ({unit}) => { if (unit === u) this.stop(); }, {owner: u}),
      b.on('death', ({unit, reason}) => {
        if (unit !== u) return;
        if (reason !== 'killed' && u.deploySeq === this.seq && u.mem.hadiyaOwner === this)
          u.mem.regularDeathVisual = {hide: true, duration: 1};
        this.stop();
      }, {owner: u}),
      b.on('battleEnd', () => this.stop(), {owner: u}),
    ];
  }
  stop() {
    if (this.stopped) return;
    this.stopped = true; this.finishing = true; this.phase = null; this.state = null; this.accepting = false;
    for (const h of this.handles) this.b.off(h);
    this.handles = [];
    for (const a of [...this.owned]) this.remove(a);
    if (this.u.skill === this.account && this.seq === this.u.deploySeq && this.account.active) this.account.end('source-retired');
    this.payment.stop(); this.talent.stop();
    if (this.seq === this.u.deploySeq && this.visuals.has(this.u.mem.regularFormVisual)) {
      delete this.u.mem.regularFormVisual; delete this.u.mem.regularVisualDirection;
    }
    if (this.u.mem.hadiyaOwner === this) delete this.u.mem.hadiyaOwner;
  }
}

export function prepareHadiya(b, u, {contract} = {}) {
  const controller = new HadiyaOwner(b, u, {contract});
  return {controller, record: controller.record, payment: controller.payment, talent: controller.talent,
    kit: {install: null, talents: [], trait: controller.trait(), skill: controller.spec()}};
}
