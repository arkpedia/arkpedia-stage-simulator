// SPDX-License-Identifier: GPL-3.0-or-later
// Selected source skill bridge; delivered artwork and public approval are separate.
import evidence from '../../../data/arkpedia-mitm-prefabs.json' with { type: 'json' };
import { absoluteRangeKeys, canTargetEnemy } from '../targeting.js';
import { bodyInKeys } from '../body.js';
import { makeDamageInfo } from '../damage.js';
import { MITM_ID, mitmSourceComponent as component } from './arkpedia-mitm.js';
import { MITM_DEVICE_CONTRACT, prepareMitmDevices } from './arkpedia-mitm-devices.js';

export const MITM_SKILL_CONTRACT = Object.freeze({
  scope: 'Selected S1 owner-source explosion and S2 timed attack/token/DP diagnostic',
  mapping: 'Natural selected time SP and manual activation with native silence permission. S1 gives immediate DP separately from a retained-token command at the original Skill_1 event; only current normal buggy mode explodes over the source ground cross, including the centre, using live owner ATK and own-token blocking trait. S2 uses selected owner ATK and one retained projectile input at Skill_2_Loop; source token mode replaces normal block with its own two-block/DEF attachment, without HP restoration. One attachment pass records all existing tokens, including a recovering point; late tokens do not inherit it. Parent finish removes derived attributes and withdraws eligible recorded points. Source interval DP starts after one interval and ends with the selected duration. Skill-driven Withdraw maps to point recovery separately from accepted-fatal SpawnTrash.',
  limits: 'Public/artwork approval remains held. Compiled RallyPoint Withdraw, attachment retention, numeric abnormal aliases, modifier/action dispatch, start/begin/end and instant-affecting/SP/FSM clocks, token input-selection timing and Unity frame parity remain explicit local mappings. In particular, skill-driven Withdraw does not invent an accepted-fatal SpawnTrash call absent from its decoded action chain. Original particle/shader/audio and modules remain unsupported.',
  frameParity: false,
});
const TOKEN = 'token_10037_mitm_trshrb', NO_SP = 'mitm:command-no-sp', BLOCK = 'mitm:point-block';
const live = u => u?.alive && u.deployed && !u._removing && !u.hidden;
const due = (b, time) => b.time + 1e-9 >= time;
const grid = evidence.tables.ranges['x-5'].grids.map(g => [g.row, g.col]);

function verify() {
  const s1 = component('-3546622456979472834'), s2 = component('-6833631102932632390');
  for (const h of [s1, s2]) if (h._canSilenced !== 0 || h._canUseInAbnormalState !== 0
    || h._allowSpRecoveryWhenAffecting !== 0 || h._canCastDuringBorn !== 1
    || h._onlyAvailableWhenTokenValid !== 0) throw Error('Unreviewed Mitm skill holder');
  const a1 = component('5583230842637041214'), a2 = component('3874914894432222394');
  const attack = component('4774015682578427396'), selector = component('4488980832178089476');
  const command = evidence.templates.mitm_s_1.eventToActions.ON_BUFF_START;
  const token = evidence.templates['mitm_s_2[to_token]'].eventToActions;
  const attach = evidence.templates['mitm_s_2[token_switch_mode]'].eventToActions.ON_BUFF_START;
  const attrs = token.ON_BUFF_START[3]._buff.attributes.attributeModifiers;
  const dp = a2._buffs[2], dp1 = component('1698600789270249022');
  const projectiles = evidence.projectiles.projectile_chr_mitm_s2.flatMap(r => r.components.map(c => c.data));
  if (s1._playSkillBeginAnim !== 0 || s2._beginAnim !== 'Skill_2_Begin' || s2._playSkillBeginAnim !== 1
    || s2._attackBlackboardModeIndex !== 1 || a1._animKey !== 'Skill_1' || a1._waitForAttackEvent !== 1
    || a1._allowNoTarget !== 1 || a1._activeBuffs[0].overrideKey !== 'trshrb_state'
    || dp1._runActionOnEvent !== 2 || dp1._buffs[0].templateKey !== 'mitm_s_1[cost]'
    || command[0]._checkCurModeIndex !== 1 || command[3]._sourceType !== 'BUFF_SOURCE'
    || command[3]._rangeId !== 'x-5' || command[3]._targetOptions.targetMotion !== 'WALK_ONLY'
    || command[3]._damageType !== 'PHYSICAL' || !command[4].$type.includes('Withdraw')
    || a2._buffs[0].attributes.attributeModifiers[0].attributeType !== 1
    || a2._buffs[0].attributes.attributeModifiers[0].formulaItem !== 1
    || attach.length !== 1 || attach[0]._sourceType !== 'BUFF_SOURCE' || !attach[0]._isDerivedBuff
    || !attach[0]._finishDerivedBuffIfParentFinish || token.ON_BUFF_START[0]._checkCurModeIndex !== 1
    || token.ON_BUFF_START[1]._modeIndex !== 3 || attrs.length !== 2
    || attrs[0].attributeType !== 'BLOCK_CNT' || attrs[0].formulaItem !== 'ADDITION'
    || attrs[1].attributeType !== 'DEF' || attrs[1].formulaItem !== 'MULTIPLIER'
    || token.ON_BUFF_FINISH[0]._checkCurModeIndex !== 0 || token.ON_BUFF_FINISH[2]._checkCurModeIndex !== 2
    || !token.ON_BUFF_FINISH[4].$type.includes('Withdraw') || dp.triggerLifeType !== 2 || !dp.waitFirstTriggerInterval
    || attack._animKey !== 'Skill_2_Loop' || attack._waitForAttackEvent !== 1 || attack._maxAnimScale !== 1
    || attack._damageType !== 1 || attack._projectileKey !== 'projectile_chr_mitm_s2'
    || selector._maxTargetKey !== 'max_target' || selector._limitTargetNum !== 1
    || projectiles.find(p => p._speed !== undefined)?._speed !== 10
    || projectiles.find(p => p._lifeTime !== undefined)?._lifeTime !== 10
    || projectiles.find(p => p._stopWhenSourceInvalid !== undefined)?._stopWhenSourceInvalid !== 0)
    throw Error('Unreviewed Mitm skill action chain');
}

export class MitmSkills {
  constructor(core) {
    this.core = core; this.b = core.b; this.u = core.u; this.record = core.record;
    this.command = null; this.parents = []; this.accepting = false; this.castSeq = 0;
    this.clock = 0; this.pulses = 0; this.endingUntil = null;
  }
  get active() { return this.core.valid() && !!this.u.skill.active; }
  get ownsAttackClock() { return this.active || !!this.command || this.endingUntil != null; }
  canCast() { return this.core.valid() && live(this.u) && this.u.canAct && !this.u.s.flags.disarm
    && !this.command && this.endingUntil == null; }
  inputValid(input) { return this.core.devices.valid(input.state) && input.state.seq === input.seq; }
  cancelCommand() {
    this.command = null; this.core.phase = null; this.accepting = false;
    this.b.removeBuff(this.u, NO_SP);
  }
  start() {
    const { b, u, core } = this;
    this.cancelCommand(); this.endingUntil = null; this.castSeq++;
    if (this.record.index === 0) {
      const m = core.model();
      this.command = { seq: this.castSeq, epoch: u.attackControlEpoch, released: false,
        inputs: [...core.devices.tokens.values()].map(state => ({ state, seq: state.seq })),
        releaseAt: b.time + m.eventPayloads.Skill_1.find(e => e.name === 'OnAttack').time,
        readyAt: b.time + m.durations.Skill_1 };
      b.addBuff(u, { key: NO_SP, flags: { noSp: true } });
      core.visual('Skill_1'); b.addDp(u.ownerId, this.record.bb.cost);
      return;
    }
    this.clock = 0; this.pulses = 0; u.atkCd = 0;
    const key = `mitm:token-s2:${this.castSeq}`, bb = this.record.bb;
    // Keep the parent even if its ON_BUFF_START mode check fails. Its separate
    // ON_BUFF_FINISH still checks the point's current mode after recovery.
    this.parents = [...core.devices.tokens.values()].map(state => ({ state, seq: state.seq, key }));
    for (const input of this.parents) {
      if (!this.active) break;
      if (!this.inputValid(input)) continue;
      const { state } = input;
      if (state.mode !== 1) continue;
      state.phase = null; state.mode = 3; state.unit.mem.mitmMode = 3;
      b.removeBuff(state.unit, BLOCK);
      b.addBuff(state.unit, { key, source: u, mods: {
        blockCnt: bb['mitm_s_2[to_token].block_cnt'], defPct: bb['mitm_s_2[to_token].def'] } });
      core.devices.visual(state, 'Skill_Begin');
      state.skillBeginUntil = b.time + core.devices.record.models.Single.durations.Skill_Begin;
    }
    if (!this.active) return;
    core.phase = { kind: 'mitm:begin', readyAt: b.time + core.model().durations.Skill_2_Begin };
    core.visual('Skill_2_Begin');
  }
  tickDp(dt) {
    if (!this.active || this.record.index !== 1) return;
    const bb = this.record.bb, interval = bb['mitm_s_2[cost].interval'];
    this.clock = Math.min(this.record.source.duration, this.clock + dt);
    while (this.active && this.clock + 1e-9 >= interval * (this.pulses + 1)) {
      this.pulses++; this.b.addDp(this.u.ownerId, bb['mitm_s_2[cost].cost']);
    }
  }
  ownBlock(target) {
    const t = target.blockedBy;
    return t?.alive && t.deployed && !t._removing && t.defId === TOKEN && t.ownerUnit === this.u;
  }
  explode(input) {
    const { core, b, u } = this, state = input.state;
    if (!this.inputValid(input) || state.mode !== 1) return;
    const keys = new Set(absoluteRangeKeys(grid, state.unit.tileR, state.unit.tileC, 'RIGHT'));
    const inputs = b.enemies.filter(t => live(t) && canTargetEnemy(u, t, { canHitFly: false })
      && (!t.s.flags.camou || t.blockedBy) && bodyInKeys(t, keys)).map(unit => ({ unit, seq: unit.deploySeq }));
    for (const target of inputs) {
      if (!core.valid() || !this.inputValid(input) || state.mode !== 1) return;
      const t = target.unit;
      if (!live(t) || t.deploySeq !== target.seq || !canTargetEnemy(u, t, { canHitFly: false })) continue;
      b.dealDamage(u, t, makeDamageInfo({ amount: u.s.atk * u.s.atkScaleMul * this.record.bb.aoe_damage_scale
        * (this.ownBlock(t) ? this.record.traitBb.atk_scale : 1), type: 'phys', applyWay: 'none',
        isAttack: false, isSkill: true, isSplash: true, tags: ['mitm:s1'] }));
    }
    if (core.valid() && this.inputValid(input) && state.mode === 1)
      core.devices.rest(state, { spawnWreckage: false });
  }
  tickCommand() {
    const p = this.command, { b, u, core } = this;
    if (!p) return;
    if (!core.valid() || !live(u) || !u.canAct || u.s.flags.disarm || p.epoch !== u.attackControlEpoch) {
      this.cancelCommand(); if (core.valid()) core.visual('Idle', 1, true); return;
    }
    if (!p.released && due(b, p.releaseAt)) {
      p.released = true;
      for (const input of p.inputs) {
        if (this.command !== p || !core.valid()) break;
        this.explode(input);
      }
    }
    if (this.command !== p || !core.valid()) return;
    if (due(b, p.readyAt)) { this.cancelCommand(); core.visual('Idle', 1, true); }
  }
  release(target, info) {
    const { core, u, b } = this, p = core.phase;
    if (!this.accepting || !this.active || !live(u) || !u.canAct || u.s.flags.disarm
      || p?.kind !== 'mitm:active' || p.epoch !== u.attackControlEpoch || p.accepted
      || p.target !== target || p.targetSeq !== target.deploySeq || !live(target)
      || !due(b, p.releaseAt) || !canTargetEnemy(u, target, { canHitFly: true })) return false;
    p.accepted = true;
    return core.projectile(target, info, { isSkill: true, tag: 'mitm:s2', projectileKey: 'projectile_chr_mitm_s2' });
  }
  tickAttack() {
    const { b, u, core } = this;
    if (this.command) { this.tickCommand(); return; }
    if (this.endingUntil != null) {
      if (due(b, this.endingUntil)) { this.endingUntil = null; core.visual('Idle', 1, true); }
      return;
    }
    if (!this.active) return;
    for (const input of this.parents) if (this.inputValid(input) && input.state.mode === 3
      && due(b, input.state.skillBeginUntil)) core.devices.visual(input.state, 'Skill_Loop', true);
    let p = core.phase;
    if (!live(u) || !u.canAct || u.s.flags.disarm || p?.epoch != null && p.epoch !== u.attackControlEpoch) {
      core.phase = null; core.visual('Idle', 1, true); return;
    }
    if (p?.kind === 'mitm:begin') {
      if (!due(b, p.readyAt)) return;
      core.phase = null; p = null;
    }
    if (p) {
      if (!p.released && due(b, p.releaseAt)) {
        p.released = true;
        if (live(p.target) && p.target.deploySeq === p.targetSeq) {
          this.accepting = true;
          try { b.forceAttack(u, [p.target]); } finally { this.accepting = false; }
        }
      }
      if (!this.active || core.phase !== p || !due(b, p.readyAt)) return;
      core.phase = null;
    }
    if (u.atkCd > 1e-9) return;
    const target = core.targets(this.record.bb['attack@max_target'])[0];
    if (!target) { core.visual('Idle', 1, true); return; }
    const m = core.model(), clip = 'Skill_2_Loop', speed = Math.min(1, u.base.bat / u.s.interval);
    core.phase = { kind: 'mitm:active', epoch: u.attackControlEpoch, target, targetSeq: target.deploySeq,
      accepted: false, released: false, startedAt: b.time,
      releaseAt: b.time + m.eventPayloads[clip].find(e => e.name === 'OnAttack').time / speed,
      readyAt: b.time + Math.max(u.s.interval, m.durations[clip] / speed) };
    core.visual(clip, speed); u.atkCd = u.s.interval;
  }
  clearParents(withdraw) {
    const parents = this.parents; this.parents = [];
    for (const input of parents) {
      this.b.removeBuff(input.state.unit, input.key);
      if (withdraw && this.core.valid() && this.inputValid(input) && [1, 3].includes(input.state.mode))
        this.core.devices.rest(input.state, { spawnWreckage: false });
    }
  }
  end(reason) {
    if (this.record.index === 0) {
      if (reason !== 'instant') this.cancelCommand();
      return;
    }
    this.core.phase = null; this.accepting = false;
    const normal = this.core.valid() && reason !== 'death' && reason !== 'withdrawn';
    this.clearParents(normal);
    if (normal && this.core.valid()) {
      this.u.atkCd = 0;
      this.endingUntil = this.b.time + this.core.model().durations.Skill_2_End;
      this.core.visual('Skill_2_End');
    }
  }
  stop() { this.cancelCommand(); this.endingUntil = null; this.clearParents(false); }
}

export function prepareMitmSkills(b, u, { contract } = {}) {
  if (contract !== MITM_SKILL_CONTRACT) throw Error('Mitm requires the reviewed skill contract');
  verify();
  const prepared = prepareMitmDevices(b, u, { contract: MITM_DEVICE_CONTRACT });
  const skills = new MitmSkills(prepared.controller); prepared.controller.skills = skills;
  return { ...prepared, skills, kit: { ...prepared.kit, skill: {
    kind: prepared.record.index === 0 ? 'instant' : 'duration', duration: prepared.record.source.duration,
    trigger: { rule: 'NEVER' }, silenceable: false,
    mods: prepared.record.index === 1 ? { atkPct: prepared.record.bb.atk } : null,
    canActivate: () => skills.canCast(), onStart: () => skills.start(),
    onTick: ({ dt }) => skills.tickDp(dt), onEnd: ({ reason }) => skills.end(reason),
  } } };
}
