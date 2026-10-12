// SPDX-License-Identifier: GPL-3.0-or-later
// Selected source skill diagnostic; public/artwork approval is separate.
import { makeDamageInfo } from '../damage.js';
import { canTargetEnemy } from '../targeting.js';
import { prepareStainlessDevices, STAINLESS_DEVICE_CONTRACT } from './arkpedia-stainless-devices.js';
import { stainlessSourceComponent as component } from './arkpedia-stainless.js';
import evidence from '../../../data/arkpedia-stainless-prefabs.json' with { type: 'json' };

export const STAINLESS_SKILL_CONTRACT = Object.freeze({
  scope: 'Selected S1/S2/S3 owner attack modes, timed modifiers, active platform modes and source-timed device recharge/destruction diagnostic',
  mapping: 'Natural selected time SP, selected duration and manual activation with native silence permission. Owner mode switch resets retained owner work; token modes replace only their own support attachments. S1 source attack multiplier and token talent scale; S2 source ATK/DEF and ground input cap from current block capacity; S3 owner-only ATK/ASPD. Source Front/Back events and capped/slowed animation clocks. S1/S3 grant one bounded device on activation; S2 grants one on non-removal finish; S1 finish destroys current devices with normal finish recycling.',
  limits: 'Public/runtime-artwork approval remains separate. Compiled mode/FSM/event identity, missing-count RechargeToken fallback, NORMAL recharge cooldown interaction, owner Born-cast permission, source-category filtering, phase/first-tick scheduling and Unity frame parity remain local mappings. Existing device numeric aliases, turret drain-event and modifier/SP limits still apply. Modules and original shader/particle/audio parity remain unsupported.',
  frameParity: false,
});
const live = u => u?.alive && u.deployed && !u._removing && !u.hidden;
const due = (b, time) => b.time + 1e-9 >= time;
function verify() {
  for (const id of ['-1269674001586490572', '4710807244327504429', '1475390526369100390']) {
    const s = component(id);
    if (s._canSilenced !== 0 || s._canUseInAbnormalState !== 0 || s._allowSpRecoveryWhenAffecting !== 0
      || s._playSkillBeginAnim !== 0) throw Error('Unreviewed Stainless skill holder');
  }
  for (const [id, clip] of [['-738060726003506789', 'Skill_1'], ['4881375071490204059', 'Skill_2'], ['-7000981387854356069', 'Skill_3']]) {
    const a = component(id);
    if (a._animKey !== clip || a._damageType !== 1 || a._waitForAttackEvent !== 1 || a._maxAnimScale !== 1)
      throw Error('Unreviewed Stainless active attack');
  }
  const selector = component('5737511446915309979');
  if (selector._limitedMaxTargetNumToBlockedCnt !== 1 || selector._allowZeroBlockCntLimit !== 0
    || selector._limitTargetNum !== 0 || selector._targetMotion !== 1)
    throw Error('Unreviewed Stainless S2 target capacity');
  for (const [i, id] of ['-3850729860844981452', '1810916134118509101', '-3658677020862123418'].entries()) {
    const ability = component(id), owner = ability._passiveBuffs[0], key = `ironmn_s_${i + 1}`;
    const attrs = owner.attributes.attributeModifiers.map(a => [a.attributeType, a.formulaItem, a.loadFromBlackboard]);
    const expected = [[], [[1, 1, 1], [2, 1, 1]], [[1, 1, 1], [7, 0, 1]]][i];
    const actions = evidence.templates[key].eventToActions;
    const start = actions.ON_BUFF_START, end = actions.ON_BUFF_FINISH;
    if (owner.buffKey !== key || owner.templateKey !== key || JSON.stringify(attrs) !== JSON.stringify(expected)
      || !start[0]._loadModeFromBlackboard || !start[0]._restartFSM
      || !end[0]._restoreDefault || !end[0]._restartFSM
      || (i === 1 ? end : start)[2]._rechargeTiming !== 'NORMAL'
      || i === 0 && !end[2].$type.includes('KillTokens')
      || i < 2 && ability._buffs[0].templateKey !== 'switch_mode'
      || i === 2 && ability._buffs.some(b => b.templateKey !== 'empty' || b.attributes.attributeModifiers.length))
      throw Error('Unreviewed Stainless skill mode/modifiers');
  }
}

export class StainlessSkills {
  constructor(core) { this.core = core; this.b = core.b; this.u = core.u; this.record = core.record; this.accepting = false; }
  get active() { return this.core.valid() && !!this.u.skill.active; }
  get mods() { return this.record.index === 1 ? { atkPct: this.record.bb.atk, defPct: this.record.bb.def }
    : this.record.index === 2 ? { atkPct: this.record.bb.atk, aspd: this.record.bb.attack_speed } : null; }
  canCast() { return this.core.valid() && live(this.u) && this.u.canAct && !this.u.s.flags.disarm; }
  start() {
    this.core.phase = null; this.accepting = false;
    this.core.devices.setMode(true);
    if (!this.active) return;
    if (this.record.index !== 1) this.core.devices.recharge(1);
  }
  end(reason) {
    this.core.phase = null; this.accepting = false;
    this.core.devices.setMode(false);
    if (!this.core.valid() || reason === 'death' || reason === 'withdrawn') return;
    if (this.record.index === 0) {
      for (const t of this.core.devices.own()) if (t.alive && t.deployed && !t._removing) this.b.kill(t);
    } else if (this.record.index === 1) this.core.devices.recharge(1);
  }
  targets() {
    const limit = this.record.index === 1 ? Math.max(0, Math.floor(this.u.s.blockCnt)) : 1;
    return this.core.targets(Infinity).filter(t => this.record.index !== 1 || !t.isFlying).slice(0, limit);
  }
  release(target, info) {
    const { core, u, b } = this, p = core.phase;
    const retained = p?.inputs?.find(v => v.unit === target);
    if (!this.accepting || !this.active || !live(u) || !u.canAct || u.s.flags.disarm
      || p?.kind !== 'ironmn:active' || p.epoch !== u.attackControlEpoch
      || !retained || retained.seq !== target.deploySeq || !live(target)
      || p.accepted.has(target) || !due(b, p.releaseAt)
      || !canTargetEnemy(u, target, { canHitFly: target.blockedBy === u })) return false;
    p.accepted.add(target);
    const scale = this.record.index === 0 ? this.record.bb['attack@atk_scale'] : 1;
    b.dealDamage(u, target, makeDamageInfo({ amount: u.s.atk * u.s.atkScaleMul * scale,
      type: 'phys', isAttack: true, isSkill: true, isSplash: false, applyWay: 'melee',
      attackId: info.attackId ?? 0, tags: [`ironmn:s${this.record.index + 1}`] }));
    return true;
  }
  tickAttack() {
    const { core, u, b } = this;
    if (!this.active) return;
    let p = core.phase;
    if (!live(u) || !u.canAct || u.s.flags.disarm || p && p.epoch !== u.attackControlEpoch) {
      core.phase = null; core.visual('Idle', 1, true); return;
    }
    if (p) {
      if (!p.released && due(b, p.releaseAt)) {
        p.released = true;
        const inputs = p.inputs.filter(v => live(v.unit) && v.unit.deploySeq === v.seq).map(v => v.unit);
        if (inputs.length) {
          this.accepting = true;
          try { b.forceAttack(u, inputs); } finally { this.accepting = false; }
        }
      }
      if (!this.active || core.phase !== p || !due(b, p.readyAt)) return;
      core.phase = null;
    }
    if (u.atkCd > 1e-9) return;
    const targets = this.targets();
    if (!targets.length) { core.visual('Idle', 1, true); return; }
    const clip = `Skill_${this.record.index + 1}`, model = core.model(), speed = Math.min(1, u.base.bat / u.s.interval);
    core.phase = { kind: 'ironmn:active', epoch: u.attackControlEpoch,
      inputs: targets.map(unit => ({ unit, seq: unit.deploySeq })), accepted: new Set(), released: false,
      startedAt: b.time, releaseAt: b.time + model.eventPayloads[clip][0].time / speed,
      readyAt: b.time + Math.max(u.s.interval, model.durations[clip] / speed) };
    core.visual(clip, speed); u.atkCd = u.s.interval;
  }
  stop() { this.accepting = false; this.core.phase = null; this.core.devices.setMode(false); }
}

export function prepareStainlessSkills(b, u, { contract } = {}) {
  if (contract !== STAINLESS_SKILL_CONTRACT) throw Error('Stainless requires the reviewed skill contract');
  verify();
  const prepared = prepareStainlessDevices(b, u, { contract: STAINLESS_DEVICE_CONTRACT });
  const bridge = new StainlessSkills(prepared.controller); prepared.controller.skills = bridge;
  return { ...prepared, skills: bridge, kit: { ...prepared.kit, skill: {
    kind: 'duration', duration: prepared.record.source.duration, trigger: { rule: 'NEVER' }, silenceable: false,
    mods: bridge.mods, canActivate: () => bridge.canCast(),
    onStart: () => bridge.start(), onEnd: ({ reason }) => bridge.end(reason),
  } } };
}
