// SPDX-License-Identifier: GPL-3.0-or-later
// Owner/shared-attachment diagnostic. Form-specific skills and public approval stay held.
import evidence from '../../../data/arkpedia-muelsyse-prefabs.json' with { type: 'json' };
import { canTargetEnemy } from '../targeting.js';
import { muelsyseSourceComponent as component } from './arkpedia-muelsyse.js';
import { MUELSYSE_DEVICE_CONTRACT, prepareMuelsyseDevices } from './arkpedia-muelsyse-devices.js';

export const MUELSYSE_OWNER_SKILL_CONTRACT = Object.freeze({
  scope: 'Thirty selected owner skill ranks, owner projectile modes and existing-point shared attributes diagnostic',
  mapping: 'Natural time SP, manual activation and fifteen-second source duration. S1 grants DP only after each authored interval and adds owner/attached-point ATK and ASPD; S2/S3 grant immediate selected DP and ATK. Front/Back aliases select the exact skill attack event and source projectile. Existing nonrecovering points receive one source-owned shared attachment, cancel an open copy selection and cannot reopen copying until it ends. Rest/removal/owner finish clears the attachment. Launched projectiles retain current same-life impact ATK, or their final source snapshot after retirement.',
  limits: 'This is incomplete skill support: S2 melee regeneration/resistance and ranged repeats, S3 pulling/blocked-target stun/ranged binding and five-tile spawn, late/recovered-point native attachment dispatch, squad cost talent, delivered artwork and public UI remain held. S1 uses strict duration clipping: the authored fake_cost display can exceed the resulting pulse count because its rounded intervals end just beyond fifteen seconds; native frame/end dispatch is unresolved, so no early or extra DP is invented. Native protection, FSM/modifier clocks, numeric aliases, projectile paths and source-retirement ordering remain explicit local mappings, not compiled Unity parity. Modules and native particle/shader/audio remain unsupported.',
  frameParity: false,
});
const live = u => u?.alive && u.deployed && !u._removing && !u.hidden;
const due = (b, t) => b.time + 1e-9 >= t;
const holders = ['5124373801737529051', '4513608566020438761', '-8664638467870609220'];
const attachments = ['4041610759582983899', '8309884447838042857', '4890033320277782716'];
const attacks = ['9027021207714270410', '4704046007886548170', '-1673942802132169526'];
const animators = ['5724387735157411018', '8723316318952950986', '2313779850170731722'];
const clips = ['Skill_1', 'Skill_2_Loop', 'Skill_3_loop'];
const idles = ['Idle', 'Skill_2_Idle', 'Skill_3_Idle'];
const projectiles = ['projectile_chr_mlyss', 'projectile_chr_mlyss_s2', 'projectile_chr_mlyss_s3'];

function verify() {
  for (let i = 0; i < 3; i++) {
    const h = component(holders[i]), a = component(attacks[i]), p = component(attachments[i]);
    const attrs = p._buffs.find(v => v.buffKey === `mlyss_s_${i + 1}[buff]`).attributes.attributeModifiers;
    const holder = evidence.templates[`mlyss_s_${i + 1}[token_holder]`].eventToActions.ON_BUFF_START;
    const tb = holder.find(v => v._buff)?._buff;
    const interrupt = holder.find(v => v.$type.includes('+InterruptCharacterSkill,'));
    const pairs = component(animators[i])._replaceAnimPairs;
    const parts = evidence.projectiles[projectiles[i]].flatMap(r => r.components.map(c => c.data));
    if (h._canSilenced !== 0 || h._canUseInAbnormalState !== 0 || h._canCastDuringBorn !== 1
      || h._allowSpRecoveryWhenAffecting !== 0 || h._onlyAvailableWhenTokenValid !== 0 || h._allowNoTarget !== 1
      || h._playSkillBeginAnim !== (i ? 1 : 0) || i && h._beginAnim !== `Skill_${i + 1}_Begin`
      || attrs.length !== (i ? 1 : 2) || attrs[0].attributeType !== 1 || attrs[0].formulaItem !== 1
      || !attrs[0].loadFromBlackboard || !i && (attrs[1].attributeType !== 7 || attrs[1].formulaItem !== 0)
      || holder[2]._checkCurModeIndex !== 0 || !holder[3].$type.includes('+IfNot,')
      || tb.attributes.abnormalFlags.join() !== 'SKILL_NOT_ACTIVATABLE' || tb.lifeTimeType !== 'INFINITY'
      || tb.attributes.attributeModifiers[0].attributeType !== 'ATK'
      || tb.attributes.attributeModifiers[0].formulaItem !== 'MULTIPLIER'
      || interrupt._interruptSkillSelf || interrupt._switchOutFromSkillState
      || a._waitForAttackEvent !== 1 || a._animKey !== 'Attack' || a._damageType !== 1
      || a._maxAnimScale !== 1 || a._useCachedAtkOnly !== 0 || a._alwaysIncludeTarget !== 1
      || a._selectTargetSource !== 2 || a._projectileKey !== projectiles[i]
      || pairs.find(v => v.fromAnimKey === 'Attack')?.toAnimKey !== clips[i]
      || i && pairs.find(v => v.fromAnimKey === 'Idle')?.toAnimKey !== idles[i]
      || parts.find(v => v._speed !== undefined)?._speed !== 7
      || parts.find(v => v._lifeTime !== undefined)?._lifeTime !== 10
      || parts.find(v => v._maxHitNum !== undefined)?._maxHitNum !== 1
      || parts.find(v => v._stopWhenSourceInvalid !== undefined)?._stopWhenSourceInvalid !== 0)
      throw Error('Unreviewed Muelsyse owner skill source');
  }
  const dp = component(attachments[0])._buffs[0];
  if (dp.templateKey !== 'periodic_cost' || dp.lifeTimeType !== 1 || dp.triggerLifeType !== 2
    || dp.waitFirstTriggerInterval !== 1 || dp.firstTriggerInterval !== -1
    || dp.stripBlackboardParamsWithBuffKey !== 1
    || ['-6738590061411042583', '1234335844717375676'].some(id => {
      const d = component(id); return d._runActionOnEvent !== 2 || d._buffs[0].templateKey !== 'charge_cost';
    })) throw Error('Unreviewed Muelsyse owner DP dispatch');
}

export class MuelsyseOwnerSkills {
  constructor(core) {
    this.core = core; this.b = core.b; this.u = core.u; this.record = core.record;
    this.parents = new Map(); this.castSeq = 0; this.clock = 0; this.pulses = 0;
    this.accepting = false; this.endingUntil = null; this.stopped = false;
  }
  get active() { return !this.stopped && this.core.valid() && this.u.skill.active; }
  get ownsAttackClock() { return this.active || this.endingUntil != null; }
  canCast() { return !this.stopped && this.core.valid() && live(this.u) && this.u.canAct
    && !this.u.s.flags.disarm && this.endingUntil == null; }
  canCopy(s) { return !this.parents.has(s); }
  tokenRemoved(s) {
    const p = this.parents.get(s); if (!p) return;
    this.parents.delete(s); this.b.removeBuff(s.unit, p.key);
  }
  clearParents() { for (const s of [...this.parents.keys()]) this.tokenRemoved(s); }
  start() {
    const { core, u, b, record: r } = this;
    this.clearParents(); this.castSeq++; this.clock = 0; this.pulses = 0;
    this.endingUntil = null; core.phase = null; core.accepting = false; this.accepting = false; u.atkCd = 0;
    for (const s of [...core.devices.tokens.values()]) {
      if (!this.active) break;
      // Native shared holder rejects mode zero. Warming/reborn relay and
      // form-specific holders have separate unimplemented dispatch contracts.
      if (!core.devices.valid(s) || ![1, 2, 3].includes(s.mode)) continue;
      const p = { seq: s.seq, generation: s.generation, key: `muelsyse:owner-skill:${this.castSeq}` };
      this.parents.set(s, p);
      s.unit.skill.end('owner-skill');
      if (!this.active || !core.devices.valid(s) || s.generation !== p.generation) {
        this.tokenRemoved(s); continue;
      }
      const buff = b.addBuff(s.unit, { key: p.key, source: u,
        mods: { atkPct: r.bb.atk, ...(r.index === 0 ? { aspd: r.bb.attack_speed } : {}) } });
      if (!buff || !this.active || !core.devices.valid(s) || this.parents.get(s) !== p) {
        this.tokenRemoved(s); if (buff) b.removeBuff(s.unit, buff);
      }
    }
    if (!this.active) return;
    if (r.index) b.addDp(u.ownerId, r.bb.cost);
    if (!this.active) return;
    if (r.index) {
      const clip = `Skill_${r.index + 1}_Begin`;
      core.phase = { kind: 'muelsyse:begin', readyAt: b.time + core.model().durations[clip] };
      core.visual(clip);
    } else core.visual(idles[0], 1, true);
  }
  tickDp(dt) {
    if (!this.active || this.record.index !== 0) return;
    const bb = this.record.bb, interval = bb['mlyss_s_1[cost].interval'];
    this.clock = Math.min(this.record.source.duration, this.clock + dt);
    while (this.active && this.clock + 1e-9 >= interval * (this.pulses + 1)) {
      this.pulses++; this.b.addDp(this.u.ownerId, bb['mlyss_s_1[cost].cost']);
    }
  }
  release(target, info) {
    const { core, b, u, record: r } = this, p = core.phase;
    if (!this.accepting || !this.active || !live(u) || !u.canAct || u.s.flags.disarm
      || p?.kind !== 'muelsyse:active' || p.accepted || p.epoch !== u.attackControlEpoch
      || p.target !== target || p.targetSeq !== target.deploySeq || !live(target)
      || !due(b, p.releaseAt) || !canTargetEnemy(u, target, { canHitFly: true })) return false;
    p.accepted = true;
    return core.projectile(target, info, { isSkill: true, tag: `muelsyse:s${r.index + 1}`,
      projectileKey: projectiles[r.index] });
  }
  tickAttack() {
    const { core, b, u, record: r } = this;
    if (this.endingUntil != null) {
      if (due(b, this.endingUntil)) { this.endingUntil = null; core.visual('Idle', 1, true); }
      return;
    }
    if (!this.active) return;
    let p = core.phase;
    if (!live(u) || !u.canAct || u.s.flags.disarm || p?.epoch != null && p.epoch !== u.attackControlEpoch) {
      core.phase = null; core.visual(idles[r.index], 1, true); return;
    }
    if (p?.kind === 'muelsyse:begin') {
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
    const target = core.targets()[0]; if (!target) { core.visual(idles[r.index], 1, true); return; }
    const m = core.model(), clip = clips[r.index], speed = Math.min(1, u.base.bat / u.s.interval);
    core.phase = { kind: 'muelsyse:active', epoch: u.attackControlEpoch, target, targetSeq: target.deploySeq,
      accepted: false, released: false, startedAt: b.time,
      releaseAt: b.time + m.eventPayloads[clip].find(v => v.name === 'OnAttack').time / speed,
      readyAt: b.time + Math.max(u.s.interval, m.durations[clip] / speed) };
    core.visual(clip, speed); u.atkCd = u.s.interval;
  }
  end(reason) {
    const { core, u, b, record: r } = this;
    // SkillRuntime calls onEnd before removing its attributes; retire born
    // projectiles here so death cannot replace their final buffed snapshot.
    if (!live(u) || reason === 'death') for (const flight of core.flights) if (!flight.retired) {
      flight.atk = u.s.atk * u.s.atkScaleMul; flight.retired = true;
    }
    core.phase = null; this.accepting = false; this.clearParents(); this.endingUntil = null;
    if (!this.stopped && core.valid() && live(u)) {
      u.atkCd = 0;
      if (r.index) {
        const clip = `Skill_${r.index + 1}_End`;
        this.endingUntil = b.time + core.model().durations[clip]; core.visual(clip);
      } else core.visual('Idle', 1, true);
    }
  }
  stop() {
    this.stopped = true; this.endingUntil = null; this.accepting = false;
    this.clearParents(); this.u.skill.end('stopped');
  }
}

export function prepareMuelsyseOwnerSkills(b, u, { contract } = {}) {
  if (contract !== MUELSYSE_OWNER_SKILL_CONTRACT) throw Error('Muelsyse requires the reviewed owner skill contract');
  verify();
  const prepared = prepareMuelsyseDevices(b, u, { contract: MUELSYSE_DEVICE_CONTRACT });
  const skills = new MuelsyseOwnerSkills(prepared.controller); prepared.controller.skills = skills;
  const { bb, index, source } = prepared.record;
  return { ...prepared, skills, kit: { ...prepared.kit, skill: {
    kind: 'duration', duration: source.duration, trigger: { rule: 'NEVER' }, silenceable: false,
    mods: { atkPct: bb.atk, ...(index === 0 ? { aspd: bb.attack_speed } : {}) },
    canActivate: () => skills.canCast(), onStart: () => skills.start(),
    onTick: ({ dt }) => skills.tickDp(dt), onEnd: ({ reason }) => skills.end(reason),
  } } };
}
