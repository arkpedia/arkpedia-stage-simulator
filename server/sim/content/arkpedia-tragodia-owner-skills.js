// SPDX-License-Identifier: GPL-3.0-or-later
// Source owner skills shared by opt-in diagnostics and the reviewed public adapter.
import evidence from '../../../data/arkpedia-tragodia-prefabs.json' with { type: 'json' };
import { tragodiaSourceComponent as component } from './arkpedia-tragodia-source.js';
import { prepareTragodiaCore, TRAGODIA_CORE_CONTRACT } from './arkpedia-tragodia.js';
import { bodyInKeys } from '../body.js';
import { burstLocked } from '../damage.js';

export const TRAGODIA_OWNER_SKILLS_CONTRACT = Object.freeze({
  scope: 'Diagnostic owner portions of all three source-selected Tragodia skills; public approval recorded separately',
  mapping: 'S1 retains one non-burst-prioritized input, feeds its non-damage-missable Bind before each Arts receipt and releases two hits on one attack account, 0.4 seconds apart. Nervous-only nonstacking amplification follows the accepted owned Bind lifetime. S2 switches to permanent ASPD and expanded centre splash after its native begin clip. S3 uses its source range, ATK, target priority and native 0.2-second ability predelay, rather than the unrelated zero-time Spine event. Positive owner Nervous receipts start a derived 0.1-second-first/selected-interval injury clock, removed at any burst or parent end. In-range Nervous cooldown speed is a source-owned extra elapsed clock and applies to existing bursts on aura enable.',
  limits: 'Selector numeric aliases, Bind-before-Arts ordering, one retained attack account, nonstacking amplification, derived clock refresh, mode presentation and sampled cooldown speed are explicit simulator policies, not recovered Unity dispatch or frame parity. S2 lure and S3 cage mechanics are supplied by their separate controllers and public review. Modules, owner/lure native particles and audio remain unsupported; the original cage presentation retains separate fidelity limits.',
  frameParity: false,
});
const live = u => u?.alive && u.deployed && !u.hidden && !u._removing;
const events = key => evidence.templates[key].eventToActions;
const key = (u, suffix) => `tragodia:${u.id}:${suffix}`;
const due = (b, t) => b.time + 1e-8 >= t;
// Native derived buff has one world slot, not independent character sources.
const injuryOwners = new WeakMap();

function verify() {
  const s1 = component('1442620349020702503'), s2 = component('3425545671465711882');
  const s3 = component('-349624819848431350');
  const bind = s1._activeBuffs[0], scale = events('phatm2_s_1[unmove]').ON_TAKE_EP_DAMAGE[0];
  const dot = events('phatm2_s_3[sanity]').ON_AFTER_OUTPUT_ELEMENT_DAMAGE[2];
  if (s1._animKey !== 'Skill_1' || s1._additionalTimes !== 1 || s1._triggerDelta !== .4000000059604645
    || s1._waitAttackEventForAllAttacks !== 0 || s1._refreshInputTargetOnCheckSpell !== 0
    || s1._onlyFeedActiveBuffToFirstOne !== 0 || s1._onlyFeedActiveBuffToLastOne !== 0
    || bind.durationKey !== 'unmove' || bind.isDamageMissable !== 0
    || !bind.attributes.abnormalFlags.includes(13) || scale._elementType !== 'SANITY' || scale._isStackable
    || s2._animKey !== 'Skill_2_Loop_1' || s2._atkScaleKey !== 'atk_scale_attack'
    || s3._waitForAttackEvent !== 0 || s3._preDelay !== .20000000298023224
    || s3._animKey !== '' || dot._buff.firstTriggerInterval !== .10000000149011612
    || !dot._finishDerivedBuffIfParentFinish || dot._buff.refreshRemainingTimeWhenStackMax
    || !events('phatm2_t_2[s3]').ON_BUFF_ENABLE)
    throw Error('Unreviewed Tragodia native owner skills');
  const begin = component('2803650784831634387'), permanent = component('816565793324825555')._buffs[0];
  const duration = component('7825631545386975319')._buffs[0];
  if (begin._beginAnim !== 'Skill_2_Begin' || begin._playSkillBeginAnim !== 1
    || permanent.lifeTimeType !== 2 || permanent.attributes.attributeModifiers[0].attributeType !== 7
    || permanent.attributes.attributeModifiers[0].formulaItem !== 0
    || duration.lifeTimeType !== 1 || duration.attributes.attributeModifiers[0].attributeType !== 1
    || duration.attributes.attributeModifiers[0].formulaItem !== 1)
    throw Error('Unreviewed Tragodia native owner modes');
  for (const id of ['-7067969616294705369', '2803650784831634387', '9180617851817869399'])
    if (component(id)._canSilenced !== 0 || component(id)._allowSpRecoveryWhenAffecting !== 0)
      throw Error('Unreviewed Tragodia native skill controller');
  for (const m of ['Front', 'Back'].map(face => evidence.models.char_1042_phatm2[face]))
    if (m.eventPayloads.Skill_1[0].time !== .5 || m.eventPayloads.Skill_2_Loop_1[0].time !== .8999999761581421
      || !(m.durations.Skill_2_Begin > 0) || !(m.durations.Skill_3_Loop > 0))
      throw Error('Unreviewed Tragodia native skill clips');
}

export class TragodiaOwnerSkills {
  constructor(core) {
    this.core = core; this.b = core.b; this.u = core.u; this.record = core.record;
    this.index = core.record.index + 1; this.bb = core.record.bb; this.mode = 0;
    this.dots = new Map(); this.cooldowns = new Map(); this.handles = []; this.stopped = false;
  }
  active() { return !this.stopped && this.core.valid() && live(this.u) && this.u.skill.active; }
  canCast() {
    if (this.stopped || !this.core.valid() || !live(this.u) || !this.u.canAct || this.u.skill.active) return false;
    return this.index !== 1 || !this.u.s.flags.disarm && (!this.core.phase || due(this.b, this.core.phase.readyAt)) && this.u.atkCd <= 1e-9
      && !!this.core.targets('notBurst')[0];
  }
  spec() {
    const spec = { silenceable: false, trigger: { rule: this.index === 1 ? 'DEFAULT' : this.index === 2 ? 'SP_FULL' : 'NEVER' },
      kind: this.index === 1 ? 'instant' : this.index === 2 ? 'toggle' : 'duration',
      canActivate: () => this.canCast(), onStart: () => this.start(), onEnd: ({ reason }) => this.end(reason) };
    if (this.index === 1) Object.assign(spec, { attack: {}, completeOnAttack: false, flags: { noSp: true } });
    if (this.index === 2) spec.mods = { aspd: this.bb.attack_speed };
    if (this.index === 3) Object.assign(spec, { mods: { atkPct: this.bb.atk },
      targeting: { rangeGrid: this.record.skillRangeGrid, priority: 'notBurst' } });
    return spec;
  }
  start() {
    if (!this.active()) { this.u.skill.end('retired'); return; }
    this.mode = this.index; this.core.phase = null; this.u.atkCd = 0;
    if (this.index === 2) {
      this.core.phase = { kind: 'born', readyAt: this.b.time + this.core.model().durations.Skill_2_Begin };
      this.core.visual('Skill_2_Begin');
    } else if (this.index === 3) {
      this.core.visual('Skill_3_Loop', 1, true); this.refreshCooldowns();
    }
  }
  end(reason) {
    const previous = this.mode; this.mode = 0;
    if (previous !== 1 || reason !== 'volley') this.core.phase = null;
    this.clearDerived();
    if (this.core.valid() && live(this.u)) this.core.visual('Idle', 1, true);
  }
  idleClip() { return this.active() && this.mode === 2 ? 'Skill_2_Idle'
    : this.active() && this.mode === 3 ? 'Skill_3_Loop' : 'Idle'; }
  beforeAcquire() {
    if (this.index === 1 && this.u.skill.ready && this.canCast()) this.u.skill.activate('DEFAULT');
  }
  attackSpec() {
    if (!this.active()) return {};
    if (this.mode === 1) return { clip: 'Skill_1', priority: 'notBurst', scale: this.bb.atk_scale,
      tag: 's1', isSkill: true, secondGap: component('1442620349020702503')._triggerDelta };
    if (this.mode === 2) return { clip: 'Skill_2_Loop_1', tag: 's2', isSkill: true,
      radius: this.bb['talent@range_radius'], scale: this.bb.atk_scale_attack ?? 1 };
    if (this.mode === 3) return { clip: 'Skill_3_Loop', tag: 's3', isSkill: true, priority: 'notBurst',
      preDelay: component('-349624819848431350')._preDelay };
    return {};
  }
  finishVolley() { if (this.mode === 1 && this.u.skill.active) this.u.skill.end('volley'); }
  cancelVolley() { if (this.mode === 1) this.u.skill.end('interrupted'); }
  beforeStrike(t, config) { if (config.tag === 's1' && this.active()) this.bind(t); }
  bind(t) {
    const { b, u, bb } = this, ownedKey = key(u, 's1-bind'), originalSeq = t.deploySeq;
    if (t.findBuff(ownedKey)) return; // Native max-stack buff does not refresh its remaining lifetime.
    if (!b.applyStatus(t, 'bind', { source: u, duration: bb.unmove, key: ownedKey, sourceStatusResistable: true })) return;
    const buff = t.findBuff(ownedKey);
    if (!buff) return;
    if (!this.active() || !u.canAct || !live(t) || t.deploySeq !== originalSeq) { b.removeBuff(t, buff); return; }
    // This active buff is not derived: it survives its caster's retreat. Hooks
    // belong to the accepted target lifetime, not the retired owner controller.
    if (buff._tragodiaScaleHandle) return;
    const seq = t.deploySeq, factor = bb.ep_damage_scale;
    const h = b.on('elementHit', ({ target, dmg }) => {
      if (target !== t || !live(t) || t.deploySeq !== seq || !t.buffs.includes(buff) || !t.s.flags.bind
        || dmg.element !== 'neural') return;
      const previous = dmg._tragodiaNeuralScale ?? 1;
      if (factor > previous) { dmg.mul *= factor / previous; dmg._tragodiaNeuralScale = factor; }
    }, { owner: t });
    buff._tragodiaScaleHandle = h;
    const remove = buff.onRemove, expire = buff.onExpire;
    buff.onRemove = ctx => { b.off(h); remove?.(ctx); };
    buff.onExpire = ctx => { b.off(h); expire?.(ctx); };
  }
  output(ctx) {
    const t = ctx.target;
    if (this.mode !== 3 || !this.active() || ctx.source !== this.u || ctx.type !== 'element'
      || ctx.dmg.element !== 'neural' || !(ctx.amount > 0) || !live(t) || burstLocked(t) || this.dots.has(t)) return;
    const existing = injuryOwners.get(t);
    if (existing && existing.seq === t.deploySeq && existing.owner.active()
      && (existing.admitting || t.buffs.includes(existing.buff))) return;
    const seq = t.deploySeq, entry = { seq, owner: this, admitting: true, next: this.b.time + .10000000149011612, buff: null };
    injuryOwners.set(t, entry);
    this.dots.set(t, entry);
    entry.buff = this.b.addBuff(t, { key: key(this.u, 's3-injury'), source: this.u,
      onRemove: () => {
        if (this.dots.get(t) === entry) this.dots.delete(t);
        if (injuryOwners.get(t) === entry) injuryOwners.delete(t);
      } });
    entry.admitting = false;
    if (!entry.buff || !this.active() || !live(t) || seq !== t.deploySeq || burstLocked(t)
      || injuryOwners.get(t) !== entry) this.removeDot(t, entry);
  }
  removeDot(t, entry = this.dots.get(t)) {
    if (this.dots.get(t) === entry) this.dots.delete(t);
    if (entry && injuryOwners.get(t) === entry) injuryOwners.delete(t);
    if (entry?.buff) this.b.removeBuff(t, entry.buff);
  }
  removeCooldown(t, entry = this.cooldowns.get(t)) { if (this.cooldowns.get(t) === entry) this.cooldowns.delete(t); if (entry?.buff) this.b.removeBuff(t, entry.buff); }
  refreshCooldowns() {
    const active = this.mode === 3 && this.active(), keys = this.core.keys();
    for (const [t, entry] of this.cooldowns)
      if (!active || !live(t) || t.deploySeq !== entry.seq || !bodyInKeys(t, keys)
        || t.findBuff('neuralBurst') !== entry.burst) this.removeCooldown(t);
    if (!active) return;
    for (const t of this.b.enemies) {
      const burst = t.findBuff('neuralBurst');
      if (!live(t) || !burst || !bodyInKeys(t, keys) || this.cooldowns.has(t)) continue;
      const entry = { seq: t.deploySeq, burst, buff: null };
      this.cooldowns.set(t, entry);
      entry.buff = this.b.addBuff(t, { key: key(this.u, 's3-cooldown'), source: this.u,
        onTick: ({ dt }) => {
          if (this.mode !== 3 || !this.active() || !live(t) || t.deploySeq !== entry.seq
            || !bodyInKeys(t, this.core.keys()) || t.findBuff('neuralBurst') !== burst) { this.removeCooldown(t); return; }
          // Same native max-stack recovery modifier: overlapping producers use
          // the highest sampled speed, rather than speeding the same clock twice.
          const sample = burst._tragodiaRecoverySample?.tick === this.b.tickCount
            ? burst._tragodiaRecoverySample : { tick: this.b.tickCount, extra: 0 };
          const speed = this.bb['talent@ep_break_recover_speed'];
          const delta = Math.max(0, speed - sample.extra);
          sample.extra = Math.max(sample.extra, speed); burst._tragodiaRecoverySample = sample;
          burst.timeLeft = Math.max(0, burst.timeLeft - delta * dt);
          if (burst.timeLeft <= 1e-9) this.b.removeBuff(t, burst);
        }, onRemove: () => { if (this.cooldowns.get(t) === entry) this.cooldowns.delete(t); } });
      if (!entry.buff || !this.active() || !live(t) || t.deploySeq !== entry.seq || t.findBuff('neuralBurst') !== burst)
        this.removeCooldown(t, entry);
    }
  }
  tick() {
    this.refreshCooldowns();
    for (const [t, entry] of this.dots) {
      if (this.mode !== 3 || !this.active() || !live(t) || t.deploySeq !== entry.seq || burstLocked(t)) { this.removeDot(t); continue; }
      if (due(this.b, entry.next)) {
        entry.next += this.bb.interval;
        this.core.injury(t, this.u.s.atk * this.bb.ep_damage_ratio, 's3-continuing-injury', 0, false, true);
        if (!this.active() || burstLocked(t)) this.removeDot(t);
      }
    }
  }
  clearDerived() {
    for (const t of [...this.dots.keys()]) this.removeDot(t);
    for (const t of [...this.cooldowns.keys()]) this.removeCooldown(t);
  }
  install() {
    this.handles = [this.b.on('damaged', ctx => this.output(ctx), { owner: this.u })];
  }
  stop() {
    if (this.stopped) return;
    this.stopped = true; this.u.skill?.end('retired'); this.clearDerived();
    for (const h of this.handles) this.b.off(h); this.handles = [];
  }
}

export function prepareTragodiaOwnerSkills(b, u, { contract } = {}) {
  if (contract !== TRAGODIA_OWNER_SKILLS_CONTRACT) throw Error('Tragodia requires the reviewed owner skills contract');
  verify();
  const prepared = prepareTragodiaCore(b, u, { contract: TRAGODIA_CORE_CONTRACT });
  const skills = new TragodiaOwnerSkills(prepared.controller); prepared.controller.skills = skills;
  const installCore = prepared.controller.install.bind(prepared.controller);
  prepared.controller.install = () => { installCore(); skills.install(); };
  prepared.kit.skill = skills.spec();
  return { ...prepared, skills };
}
