// SPDX-License-Identifier: GPL-3.0-or-later
// Selected-source diagnostic only; no public registration or silent defaults.
import evidence from '../../../data/arkpedia-rmixer-prefabs.json' with { type: 'json' };
import { RMIXER_ID, rmixerSourceComponent as component } from './arkpedia-rmixer-source.js';
import { RMIXER_RESOURCE_CONTRACT, prepareRmixerResources } from './arkpedia-rmixer-resources.js';
import { RmixerAttackController, rmixerAttackTrait, verifyRmixerAttackSource } from './arkpedia-rmixer-attacks.js';
import { absoluteRangeKeys, canTargetEnemy, sortEnemyTargets } from '../targeting.js';
import { bodyInKeys } from '../body.js';
import { makeDamageInfo, isHpLoss } from '../damage.js';

export const RMIXER_SKILL_CONTRACT = Object.freeze({
  scope: 'Sankta selected-source ordinary/S1/S2/S3 and both talents, diagnostic only',
  mapping: 'S1 holds one defensive-SP charge and its SP lock through the three original Skill_Loop events. Each accepted event launches one current-ATK Physical projectile; the ability completes once at the loop boundary. One successful launch attempts one Laterano ammo replenishment in the nonextendable surrounding eight tiles. External grants share the recipient’s loaded-capacity recovery allowance for that activation. A sole eligible recipient is supported; multiple recipients are explicitly held rather than guessing compiled postFilter 66. S3 stops ordinary attacks, changes fixed nonextendable range/HP/ATK/DEF/BAT, replenishes other active Laterano ammo skills globally, and issues direct Physical counters to at most three legal in-range targets. One round is spent per counter group, including an empty group. Its normal counter interval uses the current modified attack interval. Accepted calculated HP damage triggers counters before shields/HP application; dodges, cancellation, invulnerability, elemental gauges and HP loss do not. Talent stacks use accepted post-shield damage receipts, including fully absorbed output, and the table-selected DEF/ASPD, three-stack cap and shared ten-second refresh.',
  limits: 'The compiled S1 recipient comparator, event/FSM dispatch and final-ammo clocks remain unrecovered. S1 wave target reselection, interruption completion and pre-first-shot target-loss refund are local mappings. Each wave emits a simulator attack event; this is not a claim about Unity event count. The talent table cap is three but CreateBuff has a literal maxStackCnt of one; applying the table cap is an explicit unresolved binding, not verified native execution. S3 counter receipt order, Begin/End eligibility, cooldown reset and other-only replenishment follow the diagnostic contract; native CreateBuffInRange does not explicitly exclude its owner. Selected table ranks all have positive base_attack_time; the unreachable zero-BB branch is preserved in evidence but not approved here. Public roster/browser combat approval, modules, particles/audio and Unity frame parity remain held.',
  frameParity: false,
});
const live = u => u?.alive && u.deployed && !u.hidden && !u._removing;
const due = (b, at) => b.time + 1e-9 >= at;
const profile = Object.freeze({ canHitFly: true });
const stacksKey = 'rmixer:damage-stacks';

function verifySource() {
  verifyRmixerAttackSource();
  const s1 = component('-3268392782567208198'), selector = component('-2442329197482112262');
  const s3 = component('-8831280125258731560'), count = component('3109481951465074648');
  const s1Holder = component('825391216249572090'), counterSelector = component('6379982231158288344');
  const recoverRange = component('-7988606994752828678'), counterMode = component('7410210635446120408');
  const counterRule = evidence.templates.rmixer_sk3.eventToActions.ON_TAKE_DAMAGE[0];
  const t1 = evidence.templates.rmixer_t1.eventToActions.ON_AFTER_OUTPUT_DAMAGE;
  if (s1._animKey !== 'Skill_Loop' || s1._additionalTimes !== 2 || s1._waitAttackEventForAllAttacks !== 1
    || s1._atkScaleKey !== 'atk_scale' || s1._useCachedAtkOnly !== 0
    || s1._projectileKey !== 'projectile_chr_rmixer_sk1' || selector._postFilter !== 66 || selector._excludeOwner !== 1
    || recoverRange._rangeId !== 'x-4' || recoverRange._extendable !== 0
    || recoverRange.m_GameObject.m_PathID !== selector.m_GameObject.m_PathID
    || counterMode._updateAttackRangeExtendByAttributeDirty !== 0
    || s1Holder._allowSpRecoveryWhenAffecting !== 0 || s1Holder._playSkillBeginAnim !== 0
    || s3._metadata.namedAsAlias !== 'S3Attack' || s3._waitForAttackEvent !== 0 || s3._allowNoTarget !== 1
    || s3._damageType !== 1 || s3._atkScale !== 1 || count._countEvent !== 4 || count._expendPerTrigger !== 1
    || counterSelector._postFilter !== 4 || counterSelector._maxTargetKey !== 'max_target'
    || counterRule._conditionsNode[0]._blackboardKey !== 'base_attack_time'
    || counterRule._failNodes[0]._abilityName !== 'S3Attack' || counterRule._failNodes[0]._checkCanUseAblityFlag !== true
    || t1[0]._buff.maxStackCnt !== 1 || !t1[0]._buff.refreshRemainingTimeWhenStackMax
    || !t1[0]._buff.clearAllStackCntWhenTimeUp || t1[1]._stackCountKey !== 'max_stack_cnt')
    throw Error('Unreviewed Sankta Miksaparato skill source');
  const projectile = evidence.projectiles.projectile_chr_rmixer_sk1.flatMap(r => r.components.map(c => c.data));
  for (const [key, value] of Object.entries({ _speed: 10, _lifeTime: 10, _maxHitNum: 1,
    _stopAfterMaxHit: 1, _stopWhenSourceInvalid: 0 }))
    if (!projectile.some(d => d[key] === value)) throw Error('Unreviewed Sankta Miksaparato S1 projectile');
  const expected = [0, .23333333432674408, .46666666865348816];
  for (const m of [evidence.models[RMIXER_ID].Front, evidence.models[RMIXER_ID].Back]) {
    const events = m.eventPayloads.Skill_Loop;
    if (events.length !== 3 || events.some((ev, i) => ev.name !== 'OnAttack' || ev.time !== expected[i]))
      throw Error('Unreviewed Sankta Miksaparato three-shot clock');
  }
  if (evidence.tables.skills.skchr_rmixer_3.levels.some(s => !s.blackboard.some(x => x.key === 'base_attack_time' && x.value > 0)))
    throw Error('Unreviewed Sankta Miksaparato zero-interval rank');
}

export class RmixerSkillController extends RmixerAttackController {
  constructor(...args) {
    super(...args); this.counterAt = -Infinity; this.countering = false;
    this.t1 = this.record.talentBb.find(t => t.max_stack_cnt != null);
  }
  visual(...args) {
    super.visual(...args);
    if (this.record.index === 2 && this.u.skill.active) this.u.mem.regularFormVisual.idle = 'Skill_3_Idle';
  }
  idle() {
    this.visual(this.u.skill.active && this.record.index > 0 ? `Skill_${this.record.index + 1}_Idle` : 'Idle', 1, true);
  }
  targets(limit = 1) {
    if (this.record.index === 2 && this.u.skill.active) return [];
    return super.targets(limit);
  }
  canActivate() {
    if (!this.valid() || !this.u.canAct || this.u.s.flags.disarm || this.phase?.kind === 'transition') return false;
    if (this.record.index === 0) return !this.phase && !this.u.skill.active && this.targets().length > 0;
    return !this.u.skill.active;
  }
  recipients(global = false) {
    const keys = global ? null : new Set(absoluteRangeKeys(evidence.tables.ranges['x-4'].grids
      .map(g => [g.row, g.col]), this.u.tileR, this.u.tileC, this.u.dir));
    return this.b.alliesFor(this.u).filter(a => a !== this.u && live(a) && a.kind === 'op'
      && a.def.tags.includes('laterano') && a.def.skill?.durationType === 'AMMO'
      && a.skill?.active && a.skill.kind === 'ammo' && a.skill.ammoReplenishmentLeft > 0
      && (global || bodyInKeys(a, keys)));
  }
  replenish(one) {
    const candidates = this.recipients(!one);
    if (one && candidates.length > 1) {
      this.b.emit('rmixerRecipientHeld', { owner: this.u, candidates: candidates.map(a => a.id), postFilter: 66 });
      return;
    }
    for (const [recipient, seq] of candidates.map(a => [a, a.deploySeq])) {
      if (!this.valid()) return;
      if (!live(recipient) || recipient.deploySeq !== seq || !recipient.skill.active) continue;
      const count = recipient.skill.replenishAmmo(one ? this.record.bb.charge : this.record.bb.ammo);
      if (count > 0) this.b.emit('rmixerAmmoRecovered', { owner: this.u, recipient, count });
    }
  }
  beginAttack(target) {
    const { b, u } = this;
    if (this.record.index !== 0 || (!u.skill.pending && !u.skill.ready)) return super.beginAttack(target);
    if (!u.skill.pending && !u.skill.activate('DEFAULT')) return super.beginAttack(target);
    const m = this.model(), speed = u.base.bat / u.s.interval;
    this.phase = { kind: 'attack', s1: true, serial: ++this.serial, target, targetSeq: target.deploySeq,
      epoch: u.attackControlEpoch, activation: u.skill.activations, speed, clip: 'Skill_Loop',
      startedAt: b.time, readyAt: b.time + Math.max(u.s.interval, m.durations.Skill_Loop / speed),
      events: m.eventPayloads.Skill_Loop.map(ev => b.time + ev.time / speed), next: 0,
      accepted: false, acceptedWaves: new Set(), recovered: false };
    this.visual('Skill_Loop', speed); u.atkCd = u.s.interval;
  }
  release(target, info) {
    const p = this.phase;
    if (!p?.s1 && p?.kind !== 'counter') return super.release(target, info);
    const { b, u } = this;
    if (!this.accepting || !this.valid() || !u.canAct || u.s.flags.disarm || p.epoch !== u.attackControlEpoch
      || !u.skill.active || u.skill.activations !== p.activation || !live(target)
      || !canTargetEnemy(u, target, profile) || target.s.flags.camou && !target.blockedBy) return false;
    if (p.s1) {
      if (p.waveTarget !== target || p.waveSeq !== target.deploySeq || p.acceptedWaves.has(p.wave)) return false;
      p.acceptedWaves.add(p.wave); p.accepted = true; this.engaged = true;
      this.launchFlight(target, info, { isSkill: true, projectile: 'projectile_chr_rmixer_sk1',
        tag: 'rmixer:s1', scale: this.record.bb.atk_scale, activation: p.activation });
      if (!p.recovered) { p.recovered = true; this.replenish(true); }
    } else {
      if (!p.inputs.has(target) || p.inputs.get(target) !== target.deploySeq || p.acceptedTargets.has(target)) return false;
      p.acceptedTargets.add(target);
      b.dealDamage(u, target, makeDamageInfo({ amount: u.s.atk * u.s.atkScaleMul,
        type: 'phys', isAttack: true, isSkill: true, isSplash: false,
        applyWay: 'ranged', attackId: info.attackId, tags: ['rmixer:s3'] }));
    }
    return true;
  }
  finishS1(p, reason, refund = false) {
    if (this.phase !== p) return;
    this.phase = null;
    if (p.accepted && this.valid()) this.resources.completeAttack('Attack', `${this.seq}:s1:${p.serial}`);
    if (this.u.skill.active && this.u.skill.activations === p.activation) {
      this.u.skill.end(reason);
      if (refund && this.valid()) this.u.skill.addCharge(1);
    }
  }
  tick() {
    const p = this.phase;
    if (!p?.s1) return super.tick();
    const { b, u } = this;
    if (!this.valid()) return;
    if (!u.canAct || u.s.flags.disarm || p.epoch !== u.attackControlEpoch
      || !u.skill.active || u.skill.activations !== p.activation) {
      this.finishS1(p, 'interrupted'); this.engaged = false; this.idle(); return;
    }
    while (p.next < p.events.length && due(b, p.events[p.next])) {
      p.wave = p.next++;
      let target = live(p.target) && p.target.deploySeq === p.targetSeq && canTargetEnemy(u, p.target, profile)
        && (!p.target.s.flags.camou || p.target.blockedBy) ? p.target : this.targets()[0];
      if (!target) {
        if (!p.accepted) this.finishS1(p, 'target-lost', true);
        break;
      }
      p.waveTarget = target; p.waveSeq = target.deploySeq;
      this.accepting = true;
      try { b.forceAttack(u, [target], { noAmmo: true }); } finally { this.accepting = false; }
      if (this.phase !== p || !this.valid() || !u.skill.active) return;
    }
    if (due(b, p.readyAt)) this.finishS1(p, 'instant');
  }
  counter(ctx) {
    const { b, u } = this, s = u.skill;
    if (ctx.target !== u || !ctx.dmg || isHpLoss(ctx.dmg) || ctx.dmg.type === 'element'
      || this.record.index !== 2 || !s.active || !this.valid() || !u.canAct || u.s.flags.disarm
      || this.countering || !due(b, this.counterAt) || this.phase?.kind === 'born'
      || this.phase?.kind === 'transition') return;
    const targets = b.enemies.filter(t => live(t) && canTargetEnemy(u, t, profile)
      && (!t.s.flags.camou || t.blockedBy) && bodyInKeys(t, u.rangeKeySet));
    sortEnemyTargets(b, u, targets);
    const chosen = targets.slice(0, this.record.bb['attack@max_target']), activation = s.activations;
    const saved = this.phase;
    const p = { kind: 'counter', serial: ++this.serial, epoch: u.attackControlEpoch, activation,
      inputs: new Map(chosen.map(t => [t, t.deploySeq])), acceptedTargets: new Set() };
    // Reserve cooldown before reentrant damage callbacks, using current ASPD/BAT.
    this.counterAt = b.time + u.s.interval; this.countering = true; this.phase = p; this.accepting = true;
    try { if (chosen.length) b.forceAttack(u, chosen, { noAmmo: true }); }
    finally { this.countering = false; this.accepting = false; if (this.phase === p) this.phase = saved; }
    if (!this.valid() || !s.active || s.activations !== activation) return;
    // The source explicitly allows an empty input, still completing its ability.
    // A nonempty set rejected by beforeAttack has no accepted ability here.
    if (p.inputs.size && !p.acceptedTargets.size) return;
    this.resources.completeAttack('S3Attack', `${this.seq}:s3:${p.serial}`);
    s.ammoLeft = Math.max(0, s.ammoLeft - 1);
    b.emit('ammoUsed', { unit: u, left: s.ammoLeft, skill: s });
    if (s.active && s.activations === activation && s.ammoLeft <= 0) s.end('ammo');
  }
  output(ctx) {
    if (!this.t1 || ctx.source !== this.u || !ctx.dmg || isHpLoss(ctx.dmg) || ctx.dmg.type === 'element'
      || !this.valid()) return;
    const t = this.t1;
    this.b.addBuff(this.u, { key: stacksKey, source: this.u, duration: t.duration,
      refresh: 'stack', maxStacks: t.max_stack_cnt, mods: { defFlat: t.def, aspd: t.attack_speed } });
  }
  install() {
    super.install();
    this.handles.push(this.b.on('calculatedDamage', ctx => this.counter(ctx)),
      this.b.on('damaged', ctx => this.output(ctx)));
  }
  stop() {
    if (this.stopped) return;
    super.stop(); this.b.removeBuff(this.u, stacksKey);
    // Battle finish stops controllers without killing the unit. Release the
    // controller-owned pending SP lock as well as its future attack callbacks.
    if (this.seq === this.u.deploySeq && this.u.mem.rmixerAttacks === this && this.u.skill?.active)
      this.u.skill.end('controller-stop');
  }
}

export function prepareRmixerSkills(b, u, { contract } = {}) {
  if (contract !== RMIXER_SKILL_CONTRACT) throw Error('Sankta Miksaparato requires the reviewed skill contract');
  verifySource();
  const prepared = prepareRmixerResources(b, u, { contract: RMIXER_RESOURCE_CONTRACT });
  const { record, resources, kit } = prepared, bb = record.bb;
  const controller = new RmixerSkillController(b, u, record, resources);
  u.mem.rmixerAttacks = controller;
  kit.trait = rmixerAttackTrait(controller);
  kit.skill = { ...kit.skill, silenceable: false, manualCancel: record.index > 0,
    completeOnAttack: record.index !== 0,
    flags: record.index === 0 ? { noSp: true } : {},
    mods: record.index === 2 ? { atkPct: bb.atk, defPct: bb.def, hpPct: bb.max_hp, batMul: bb.base_attack_time } : kit.skill.mods,
    targeting: record.index === 2 ? { rangeGrid: record.skillRange, noRangeExtend: true } : undefined,
    attack: { isSkill: true }, canActivate: () => controller.canActivate(),
    onStart: () => {
      if (record.index > 0) controller.transition(`Skill_${record.index + 1}_Begin`);
      if (record.index === 2) { controller.counterAt = -Infinity; controller.replenish(false); }
    },
    onEnd: ({ reason }) => {
      if (reason === 'death') controller.stop();
      else if (record.index > 0) controller.transition(`Skill_${record.index + 1}_End`);
    } };
  return { ...prepared, controller };
}
