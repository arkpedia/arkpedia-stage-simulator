// SPDX-License-Identifier: GPL-3.0-or-later
import {JU_ID, juNativeInputs, juSourceComponent, selectedJuInputs} from './arkpedia-ju-source.js';
import {canTargetEnemy} from '../targeting.js';
import {bodyInKeys} from '../body.js';

export const JU_EXTRA_CONTRACT = Object.freeze({
  scope: 'Selected Ju S2 range aura and non-derived delayed extra damage; no skill/mode controller or public admission.',
  mapping: 'Original ON_BUFF_TRIGGER/FINISH nodes map to world-time aura polls and target-owned delay/trigger/damage stages. A shared permanent done key suppresses repeat admission across sources. Accepted damage starts a caster-wide source gate. Recipient life is retained through callbacks; a stopped source cancels waiting stages but not an accepted damage stage, which uses live matching-life ATK or its start snapshot.',
  limitations: 'Buff-finish reasons, aura scheduling, source-invalid attribute lookup and target-free enum mapping remain local runtime mappings. External removal cancels a pending stage. Native particles, alternating visual effects, audio and compiled-client/frame parity are not claimed.',
  frameParity: false,
});
const alive = u => u?.alive && u.deployed && !u.removed;
const due = (a, z) => a >= z - 1e-8;
const K = Object.freeze({aura: 'ju_s_2', delay: 'ju_s_2[damage_dalay]', trigger: 'ju_s_2[damage_trigger]',
  damage: 'ju_s_2[damage]', gate: 'ju_s_2[source]', done: 'ju_s_2[done]'});

export function verifyJuExtra(n = juNativeInputs()) {
  const events = k => n.templates[k]?.eventToActions;
  const root = events(K.aura)?.ON_BUFF_TRIGGER?.[0];
  const done = root?._failNodes?.[0], affecting = done?._failNodes?.[0];
  const hp = affecting?._succeedNodes?.[0], creates = hp?._succeedNodes;
  const trigger = events(K.delay)?.ON_BUFF_FINISH?.[0];
  const attempt = events(K.trigger)?.ON_BUFF_TRIGGER?.[0];
  const gate = attempt?._succeedNodes?.[0], damage = gate?._failNodes?.[0];
  const finish = events(K.damage)?.ON_BUFF_FINISH?.[0];
  const packet = finish?._succeedNodes?.[0], source = events(K.damage)?.ON_BUFF_START?.[0];
  const aura = n.s2Aura._buffs[0];
  const validator = juSourceComponent('skills', 'skchr_ju_2', '8097321484707999909')._targetOptions;
  if (root?._conditionNode?._customKey !== 'ju_s2_extra'
    || done?._conditionNode?._buffKeys?.join() !== K.done || done?._conditionNode?._checkBuffSource !== false
    || !affecting?._conditionNode?.$type?.includes('CheckCharSkillAffecting')
    || hp?._conditionNode?._condType !== 'LT' || hp?._conditionNode?._value !== 0
    || creates?.[0]?._buff?.buffKey !== K.delay || creates?.[0]?._isDerivedBuff !== false
    || creates?.[1]?._buff?.buffKey !== K.done || creates?.[1]?._buff?.lifeTimeType !== 'INFINITY'
    || creates?.[1]?._isDerivedBuff !== false || trigger?._buff?.buffKey !== K.trigger
    || trigger?._buff?.lifeTimeType !== 'INFINITY' || trigger?._buff?.waitFirstTriggerInterval !== false
    || attempt?._conditionNode?._targetType !== 'BUFF_SOURCE' || attempt?._conditionNode?._checkTargetAlive !== true
    || gate?._conditionNode?._buffKeys?.join() !== K.gate || gate?._conditionNode?._checkBuffSource !== false
    || damage?._buff?.buffKey !== K.damage || damage?._isDerivedBuff !== false
    || !gate?._failNodes?.[1]?.$type?.includes('FinishBuff')
    || finish?._conditionNode?._checkTargetAlive !== true || finish?._conditionNode?._checkTargetFree !== true
    || packet?._damageType !== 'PHYSICAL' || packet?._applyWay !== 'NONE' || packet?._attackType !== 'NORMAL'
    || packet?._modifierKey !== 'ju_s2_extra' || packet?._atkScaleVar !== 'atk_scale_s2_extra'
    || packet?._forceUseProjectileCachedAtk !== false || packet?._noSource !== false
    || source?._buff?.buffKey !== K.gate || source?._buffOwner !== 'BUFF_SOURCE'
    || aura.buffKey !== K.aura || aura.triggerInterval !== .20000000298023224 || aura.waitFirstTriggerInterval !== 0
    || n.s2Aura._removeBuffWhenTargetLeave !== 1 || n.s2Aura._removeBuffWhenAbilityDetached !== 1
    || validator.targetSide !== 2 || validator.ignoreTargetFree !== 0)
    throw Error('Changed original Ju S2 extra inputs');
  return {poll: aura.triggerInterval, delay: creates[0]._buff.lifeTime,
    retry: trigger._buff.triggerInterval, damage: damage._buff.lifeTime, gate: source._buff.lifeTime};
}

export class JuExtraDamage {
  constructor(b, u, {contract, affecting} = {}) {
    if (contract !== JU_EXTRA_CONTRACT || u.def.charId !== JU_ID || u.deploySeq !== 0 || typeof affecting !== 'function')
      throw Error('Fresh selected Ju and explicit S2 extra contract/affecting predicate required');
    this.b = b; this.u = u; this.record = selectedJuInputs(u);
    if (this.record.index !== 1) throw Error('Selected Ju S2 required');
    this.times = verifyJuExtra(); this.affecting = affecting; this.seq = null; this.stopped = false;
    this.auras = new Map(); this.pending = new Set(); this.handles = []; this.watchers = [];
    this.admitting = new WeakSet(); this.processing = false; this.scanning = false; this.gate = null;
  }
  valid() { return !this.stopped && !this.b.finished && alive(this.u) && this.u.deploySeq === this.seq; }
  targetLife(p) { return alive(p.target) && p.target.deploySeq === p.life; }
  owns(p) { return !p.finished && this.targetLife(p) && p.target.findBuff(p.key) === p.buff; }
  attachBuff(p, key) {
    p.key = key; p.buff = null;
    const buff = this.b.addBuff(p.target, {key, source: this.u, refresh: 'keep', data: {juExtra: p},
      onRemove: () => { if (!p.transition) this.finish(p); }});
    p.buff = buff;
    if (buff?.data?.juExtra !== p) return false;
    if (p.finished || !this.targetLife(p) || this.b.finished) {
      if (p.target.buffs.includes(buff)) this.b.removeBuff(p.target, buff);
      return false;
    }
    return p.target.findBuff(key) === buff;
  }
  detach(p) {
    p.transition = true;
    try { if (p.buff?.data?.juExtra === p && p.target.buffs.includes(p.buff)) this.b.removeBuff(p.target, p.buff); }
    finally { p.transition = false; p.buff = null; }
  }
  admit(target) {
    if (!this.valid() || !this.affecting() || !alive(target) || target.findBuff(K.done) || this.admitting.has(target)
      || !(target.hp / target.s.maxHp < this.record.bb.hp_ratio)) return;
    const p = {target, life: target.deploySeq, stage: 'delay', until: this.b.time + this.times.delay, finished: false};
    this.admitting.add(target);
    try {
      const accepted = this.attachBuff(p, K.delay);
      // The original actions create the done tag separately from delay admission.
      if (this.targetLife(p) && !this.b.finished) {
        const token = {};
        const done = this.b.addBuff(target, {key: K.done, source: this.u, refresh: 'keep', data: {juExtraDone: token}});
        if ((!this.targetLife(p) || this.b.finished) && done?.data?.juExtraDone === token && target.buffs.includes(done))
          this.b.removeBuff(target, done);
      }
      if (!accepted || !this.owns(p) || this.b.finished) { this.finish(p); return; }
      this.pending.add(p); this.watch();
    } finally { this.admitting.delete(target); }
  }
  scan() {
    if (this.scanning) return;
    this.scanning = true;
    try { this.scanRange(); } finally { this.scanning = false; }
  }
  scanRange() {
    if (!this.valid() || !this.affecting()) { this.clearAuras(); return; }
    if (this.b.rangeChanged(this.u)) this.b._refreshRange(this.u);
    const eligible = new Set(this.b.enemies.filter(t => canTargetEnemy(this.u, t, {canHitFly: true}) && alive(t)
      && bodyInKeys(t, this.u.rangeKeySet)));
    for (const [target, a] of this.auras) if (!eligible.has(target) || target.deploySeq !== a.life
      || target.findBuff(K.aura) !== a.buff) { this.removeAura(target, a); }
    for (const target of eligible) {
      if (!this.valid() || !this.affecting()) break;
      let a = this.auras.get(target);
      if (!a) {
        a = {life: target.deploySeq, at: this.b.time, buff: null};
        const token = {}; a.token = token;
        a.buff = this.b.addBuff(target, {key: K.aura, source: this.u, refresh: 'keep', data: {juAura: token}});
        if (a.buff?.data?.juAura !== token) continue;
        if (!this.valid() || !alive(target) || target.deploySeq !== a.life || !this.affecting()) {
          this.removeAura(target, a); continue;
        }
        this.auras.set(target, a);
      }
      if (due(this.b.time, a.at)) { a.at = this.b.time + this.times.poll; this.admit(target); }
    }
  }
  process() {
    if (this.processing) return;
    this.processing = true;
    try {
      if (this.b.finished) { this.drain(); return; }
      for (const p of [...this.pending]) {
        if (!this.owns(p)) { this.finish(p); continue; }
        if (!due(this.b.time, p.until)) continue;
        if (p.stage === 'delay') {
          this.detach(p); p.stage = 'trigger'; p.until = this.b.time;
          if (!this.attachBuff(p, K.trigger)) { this.finish(p); continue; }
        }
        if (p.stage === 'trigger') {
          if (!this.valid()) { this.finish(p); continue; }
          if (this.u.findBuff(K.gate)) { p.until = this.b.time + this.times.retry; continue; }
          this.detach(p); p.stage = 'damage'; p.until = this.b.time + this.times.damage;
          p.atk = this.u.s.atk * this.u.s.atkScaleMul;
          if (!this.attachBuff(p, K.damage)) { this.finish(p); continue; }
          if (this.valid()) {
            const token = {};
            const gate = this.b.addBuff(this.u, {key: K.gate, duration: this.times.gate, source: this.u,
              refresh: 'keep', data: {juGate: token}});
            if (gate?.data?.juGate === token) this.gate = gate;
            if (!this.valid() && gate?.data?.juGate === token && this.u.buffs.includes(gate)) this.b.removeBuff(this.u, gate);
          }
        } else if (p.stage === 'damage') {
          const canHit = !p.target.hidden && !p.target.s.flags.untargetable;
          this.detach(p); this.pending.delete(p); p.finished = true;
          if (canHit && this.targetLife(p)) {
            const atk = this.valid() ? this.u.s.atk * this.u.s.atkScaleMul : p.atk;
            this.b.dealDamage(this.u, p.target, {amount: atk * this.record.bb.atk_scale_s2_extra,
              type: 'phys', isAttack: false, isProjectile: false, isSkill: true, applyWay: 'none', tags: ['ju_s2_extra']});
          }
        }
      }
    } finally { this.processing = false; this.unwatch(); }
  }
  finish(p) { if (p.finished) return; p.finished = true; this.pending.delete(p); this.detach(p); this.unwatch(); }
  removeAura(target, a) {
    if (a.buff?.data?.juAura === a.token && target.buffs.includes(a.buff)) this.b.removeBuff(target, a.buff);
    if (this.auras.get(target) === a) this.auras.delete(target);
  }
  clearAuras() { for (const [target, a] of [...this.auras]) this.removeAura(target, a); }
  watch() {
    if (this.watchers.length || !this.pending.size) return;
    this.watchers = [this.b.on('tick', () => this.process()), this.b.on('battleEnd', () => this.drain()),
      this.b.on('removed', ({unit}) => { for (const p of [...this.pending]) if (p.target === unit) this.finish(p); })];
  }
  unwatch() { if (this.pending.size) return; for (const h of this.watchers) this.b.off(h); this.watchers = []; }
  drain() { for (const p of [...this.pending]) this.finish(p); this.clearAuras(); }
  install() {
    if (this.handles.length || this.stopped) throw Error('Ju extra component cannot be reinstalled');
    const {b, u} = this;
    this.handles = [b.on('deploy', ({unit, move}) => { if (unit === u && !move) this.seq = u.deploySeq; }, {owner: u}),
      b.on('tick', () => { if (this.seq !== null && !this.valid()) this.stop(); else this.scan(); }, {owner: u}),
      b.on('removed', ({unit}) => { if (unit === u) this.stop(); }, {owner: u}),
      b.on('death', ({unit}) => { if (unit === u) this.stop(); }, {owner: u}),
      b.on('battleEnd', () => { this.stop(); this.drain(); }, {owner: u})];
  }
  stop() {
    if (this.stopped) return;
    this.stopped = true; this.clearAuras();
    for (const p of [...this.pending]) if (p.stage !== 'damage') this.finish(p);
    if (this.gate && this.u.buffs.includes(this.gate)) this.b.removeBuff(this.u, this.gate);
    this.gate = null;
    for (const h of this.handles) this.b.off(h); this.handles = [];
    if (this.b.finished) this.drain();
  }
}
