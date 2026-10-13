// SPDX-License-Identifier: GPL-3.0-or-later
// Explicit source-selected combat layer; complete public kit remains held.
import evidence from '../../../data/arkpedia-marcil-prefabs.json' with { type: 'json' };
import { MARCIL_ID, marcilSourceComponent as component } from './arkpedia-marcil-source.js';
import { MARCIL_MANA_CONTRACT, prepareMarcilMana } from './arkpedia-marcil-mana.js';
import { absoluteRangeKeys, canTargetEnemy, sortEnemyTargets } from '../targeting.js';
import { bodyInKeys } from '../body.js';
import { makeDamageInfo } from '../damage.js';
import { performAttack } from '../ai.js';

export const MARCIL_ATTACK_CONTRACT = Object.freeze({
  scope: 'Selected-source ordinary Arts splash and S1 chanting, damage/healing and mana lifecycle diagnostic',
  clocks: 'Original facing Start/Attack and S1 Begin/Chant/End clips. Attack event and complete clip use captured base/current interval capped at native maxAnimScale one. Main chanting follows Begin, selected chant_duration, then End; compiled inclusion of transition frames remains unverified.',
  selection: 'One enemy input by this engine’s closest-goal priority; ordinary and S1 splash use original 1.1/1.5 circles according to mana at attack start. Retained input lives identify the centre at release, including a dead input’s last position. S1 falls back to one injured, healable ally by HP ratio/deployment sequence when no selectable enemy is present at windup.',
  mana: 'S1 requires the selected minimum mana, not a full wallet, and cannot switch into chanting during deployment. All three source roots switch state but forbid switching during birth; PRTS gameplay notes corroborate the deployment/minimum gates. The original Start clip bounds the local birth clock; compiled born-time dispatch remains unverified. Half-second original chant checks stop later insufficient-mana casts. One legal output group spends the selected cost after capturing ATK and before output callbacks. Empty/cancelled groups spend nothing. Main chanting cannot be manually canceled; the running S1 can.',
  limits: 'Compiled selector/event dispatch, centre/body collision, external circle scaling, transition frame inclusion, control interruption and same-frame ordering are explicit local mappings. Source circles are tested with the existing area/body queries. S2/S3, party buffs, terrain effects, public registration, modules, native effects/audio and Unity frame parity remain held.',
  frameParity: false,
});
const live = u => u?.alive && u.deployed && !u.hidden && !u._removing;
const due = (b, time) => b.time + 1e-9 >= time;
const enemyProfile = Object.freeze({ canHitFly: true });
const SKILL_BUFF = 'marcil:s1';
const NORMAL_RADIUS = component('-1275573190307791893').m_Radius;
const POWER_RADIUS = component('5242925538742582251').m_Radius;
export function verifyMarcilAttackSource() {
  for (const id of ['478083744964993879', '2321002891159124941', '-7137456302563982919']) {
    const root = component(id);
    if (root._switchToState !== 1 || root._canSwitchDuringBorn !== 0 || root._canCastDuringBorn !== 1
      || root._canCastWithNoSp !== 1 || root._canUseInAbnormalState !== 0)
      throw Error('Unreviewed Marcille activation state gate');
  }
  for (const id of ['1999087216603380715', '6531036271420849131', '-2255832452526097429', '9204866056716958699']) {
    const a = component(id);
    if (a._animKey !== 'Attack' || a._damageType !== 2 || a._waitForAttackEvent !== 1
      || a._maxAnimScale !== 1 || a._selectTargetSource !== 3 || a._selectTargetTiming !== 1
      || a._interuptIfTargetDead !== 0 || a._alwaysIncludeTarget !== 0)
      throw Error('Unreviewed Marcille ordinary/S1 damage ability');
  }
  const heal = component('3828167012056513515'), chant = component('-4309445818410409129');
  if (heal._animKey !== 'Attack' || heal._waitForAttackEvent !== 1 || heal._selectTargetTiming !== 0
    || heal._maxAnimScale !== 1 || chant._suspendableWhenMainChant !== 0
    || component('478083744964993879')._canCastWithNoSp !== 1
    || component('478083744964993879')._canSilenced !== 0
    || NORMAL_RADIUS !== 1.100000023841858 || POWER_RADIUS !== 1.5
    || component('1461726976627915755').m_Radius !== NORMAL_RADIUS
    || component('3479196395924831211').m_Radius !== POWER_RADIUS)
    throw Error('Unreviewed Marcille healing, mana or chant ability');
  for (const m of [evidence.models[MARCIL_ID].Front, evidence.models[MARCIL_ID].Back])
    if (m.eventPayloads.Attack.length !== 1 || m.eventPayloads.Attack[0].time !== .5
      || m.eventPayloads.Attack[0].name !== 'OnAttack' || m.durations.Attack !== 2)
      throw Error('Unreviewed Marcille original attack event');
}

export class MarcilAttackController {
  constructor(b, u, record, mana) {
    this.b = b; this.u = u; this.record = record; this.mana = mana; this.wallet = mana.wallet;
    this.seq = null; this.phase = null; this.mode = 'ordinary'; this.serial = 0;
    this.stopped = false; this.handles = []; this.accepting = false; this.bornUntil = Infinity;
  }
  valid() { return !this.stopped && !this.b.finished && !this.b._endReq && live(this.u) && this.seq === this.u.deploySeq; }
  model() { return evidence.models[MARCIL_ID][['UP', 'LEFT'].includes(this.u.dir) ? 'Back' : 'Front']; }
  visual(clip, speed = 1, loop = false) {
    this.u.mem.regularVisualDirection = ['UP', 'LEFT'].includes(this.u.dir) ? 'UP' : 'RIGHT';
    this.u.mem.regularFormVisual = { clip, speed, loop,
      ...(!loop ? { idle: 'Idle', playId: `${this.seq}:${++this.serial}` } : {}) };
    if (this.model().durations.Die != null) this.u.mem.regularDeathVisual = { clip: 'Die', die: 'Die', duration: this.model().durations.Die };
    else delete this.u.mem.regularDeathVisual;
  }
  keys() { return new Set(absoluteRangeKeys(this.record.rangeGrid, this.u.tileR, this.u.tileC, this.u.dir)); }
  enemies() {
    const keys = this.keys(), out = this.b.enemies.filter(t => live(t) && canTargetEnemy(this.u, t, enemyProfile)
      && (!t.s.flags.camou || !!t.blockedBy) && bodyInKeys(t, keys));
    sortEnemyTargets(this.b, this.u, out); return out;
  }
  healable(t) {
    return live(t) && t.kind !== 'device' && !t.s.flags.untargetable && !t.s.flags.healFree
      && this.b.allySelectable(t, this.u) && (t === this.u || !(t.s.flags.noHeal || t.profile?.noHeal));
  }
  healingTarget() {
    const keys = this.keys();
    return this.b.allyUnits.filter(t => this.healable(t) && t.hp < t.s.maxHp - 1e-6 && bodyInKeys(t, keys))
      .sort((a, z) => a.hpRatio - z.hpRatio || a.deploySeq - z.deploySeq)[0];
  }
  canBegin() { return this.valid() && due(this.b, this.bornUntil) && this.mode === 'ordinary'
    && this.u.canAct && !this.u.s.flags.disarm && !this.u.skill.active
    && this.wallet.value >= this.record.bb.skill_cost_min_sp; }
  canActivate() { return this.record.index === 0 && this.canBegin(); }
  canCancel() { return this.valid() && this.mode === 's1' && this.u.skill.active && this.u.canAct && !this.u.s.flags.disarm; }
  cancel() { if (!this.canCancel()) return false; this.u.skill.end('manual'); return true; }
  start() {
    if (!this.valid()) return;
    this.phase = { kind: 'chant', stage: 'begin', epoch: this.u.attackControlEpoch,
      nextCheck: this.b.time + .5, deadline: this.b.time + this.model().durations.Skill_1_Begin };
    this.mode = 'chant'; this.visual('Skill_1_Begin');
  }
  end(reason) {
    this.b.removeBuff(this.u, SKILL_BUFF);
    if (reason === 'death') { this.stop(this.u.removeReason ?? 'killed'); return; }
    this.mode = 'ordinary'; this.phase = null;
    if (this.valid()) this.visual('Idle', 1, true);
  }
  finishChant() {
    this.phase = null; this.mode = 's1';
    this.nextManaCheck = this.b.time + .5;
    const buff = this.b.addBuff(this.u, { key: SKILL_BUFF, source: this.u, mods: { atkPct: this.record.bb.atk } });
    if (!this.valid() || !this.u.skill.active || this.mode !== 's1') {
      if (buff) this.b.removeBuff(this.u, buff); return;
    }
    this.visual('Idle', 1, true);
  }
  output(target, info) {
    const p = this.phase, u = this.u, b = this.b;
    if (!this.accepting || !this.valid() || !u.canAct || u.s.flags.disarm || p?.kind !== 'attack'
      || p.accepted || p.target !== target || p.targetSeq !== target.deploySeq
      || p.epoch !== u.attackControlEpoch || !due(b, p.releaseAt)) return false;
    let victims;
    if (p.heal) victims = this.healable(target) ? [target] : [];
    else victims = b.foesInRadius(target.x, target.y, p.radius).filter(t => live(t) && !t.s.flags.sleep);
    if (!victims.length) return false;
    const amount = u.s.atk * u.s.atkScaleMul;
    if (p.skill && !this.mana.controller.consume(this.record.bb.sp_cost)) return false;
    p.accepted = true;
    if (p.heal) b.heal(u, target, amount);
    else for (const victim of victims) if (this.valid() && live(victim)) b.dealDamage(u, victim, makeDamageInfo({
      amount, type: 'arts', isAttack: true, isSkill: p.skill, isSplash: true,
      attackId: info.attackId, applyWay: 'ranged', tags: [p.skill ? 'marcil:s1' : 'marcil:ordinary'],
    }));
    b.emit('marcilOutput', { unit: u, heal: p.heal, skill: p.skill, victims, amount, radius: p.radius,
      attackId: info.attackId, mana: this.wallet.value });
    return true;
  }
  releaseAttack(p) {
    if (!this.valid() || p.epoch !== this.u.attackControlEpoch || !this.u.canAct || this.u.s.flags.disarm) return;
    this.accepting = true;
    try {
      // Both source branches retain the same attack hooks and accepted-output
      // gate. The healing branch uses the custom launch, not the profession's
      // generic healer path, so a removed input never spends mana.
      performAttack(this.b, this.u, { ...this.u.profile, isSkill: p.skill }, [p.target], { noAmmo: true });
    } finally { this.accepting = false; }
  }
  beginAttack(target, heal = false) {
    const u = this.u, m = this.model(), speed = Math.min(1, u.base.bat / u.s.interval);
    this.phase = { kind: 'attack', target, targetSeq: target.deploySeq, epoch: u.attackControlEpoch,
      heal, skill: this.mode === 's1', radius: this.wallet.value >= this.record.talentBb[0].sp ? POWER_RADIUS : NORMAL_RADIUS,
      speed, releaseAt: this.b.time + m.eventPayloads.Attack[0].time / speed,
      readyAt: this.b.time + Math.max(u.s.interval, m.durations.Attack / speed), accepted: false, released: false };
    this.visual('Attack', speed); u.atkCd = u.s.interval;
  }
  tick() {
    if (!this.valid()) {
      if (!this.stopped && this.u.alive && this.u.deployed && !this.u._removing
        && this.u.hidden && this.seq === this.u.deploySeq) {
        this.phase = null;
        if (this.mode === 'chant' && this.u.skill.active) this.u.skill.end('hidden');
      }
      return;
    }
    const { b, u } = this; let p = this.phase;
    // A hidden/control epoch may clear the animation phase, but cannot shorten
    // the deployment gate for attacks or skills in this same actor life.
    if (!due(b, this.bornUntil)) return;
    if (!u.canAct || u.s.flags.disarm || p && p.epoch !== u.attackControlEpoch) {
      this.phase = null;
      if (u.skill.active) u.skill.end('control'); else this.visual('Idle', 1, true);
      return;
    }
    // Original S1 buff also checks its mana threshold every half second,
    // including while idle with no enemy or injured recipient.
    if (this.mode === 's1' && due(b, this.nextManaCheck)) {
      this.nextManaCheck += .5;
      if (this.wallet.value < this.record.bb.skill_cost_min_sp) { u.skill.end('insufficient-mana'); return; }
    }
    if (p?.kind === 'born') {
      if (!due(b, p.deadline)) return;
      this.phase = null; p = null;
    }
    if (p?.kind === 'chant') {
      if (due(b, p.nextCheck)) {
        p.nextCheck += .5;
        if (this.wallet.value < this.record.bb.skill_cost_min_sp) { u.skill.end('insufficient-mana'); return; }
      }
      if (!due(b, p.deadline)) return;
      if (p.stage === 'begin') {
        p.stage = 'main'; p.deadline += this.record.bb.chant_duration;
        this.visual(p.loopClip ?? 'Skill_1_Chant', 1, true);
      } else if (p.stage === 'main') {
        p.stage = 'end'; p.deadline += this.model().durations[p.endClip ?? 'Skill_1_End'];
        this.visual(p.endClip ?? 'Skill_1_End');
      } else this.finishChant();
      return;
    }
    if (p?.kind === 'attack') {
      if (!p.released && due(b, p.releaseAt)) {
        p.released = true;
        this.releaseAttack(p);
        if (this.phase !== p || !this.valid()) return;
        if (this.mode === 's1' && p.skill && this.wallet.value < this.record.bb.skill_cost_min_sp) { u.skill.end('mana'); return; }
      }
      if (!due(b, p.readyAt)) return;
      this.phase = null;
    }
    if (u.atkCd > 1e-9) return;
    const target = this.enemies()[0];
    if (target) this.beginAttack(target);
    else if (this.mode === 's1') {
      const ally = this.healingTarget();
      if (ally) this.beginAttack(ally, true); else this.visual('Idle', 1, true);
    } else this.visual('Idle', 1, true);
  }
  install() {
    if (this.stopped || this.handles.length) throw Error('Marcille combat already installed');
    this.mana.controller.install();
    this.originalActivate = this.u.skill.activate; this.originalEnd = this.u.skill.end;
    this.boundActivate = reason => this.canActivate() ? this.originalActivate.call(this.u.skill, reason, { free: true }) : false;
    this.boundEnd = reason => reason === 'manual' && !this.canCancel() ? false : this.originalEnd.call(this.u.skill, reason);
    this.u.skill.activate = this.boundActivate; this.u.skill.end = this.boundEnd;
    this.handles = [
      this.b.on('deploy', ({ unit, move }) => {
        if (unit !== this.u || move) return;
        this.seq = unit.deploySeq; this.bornUntil = this.b.time + this.model().durations.Start;
        this.phase = { kind: 'born', epoch: unit.attackControlEpoch, deadline: this.bornUntil };
        this.visual('Start');
      }),
      this.b.on('tick', () => this.tick()),
      this.b.on('death', ({ unit, reason }) => { if (unit === this.u) this.stop(reason); }),
      this.b.on('battleEnd', () => this.stop('battle-end')),
    ];
  }
  stop(reason) {
    if (this.stopped) return;
    if (this.u.skill.active) this.originalEnd.call(this.u.skill, reason === 'battle-end' ? reason : 'death');
    if (this.stopped) return; // onEnd('death') already retired this controller
    this.stopped = true; this.phase = null; this.accepting = false;
    this.b.removeBuff(this.u, SKILL_BUFF); this.mana.controller.stop(reason);
    if (this.u.skill.activate === this.boundActivate) this.u.skill.activate = this.originalActivate;
    if (this.u.skill.end === this.boundEnd) this.u.skill.end = this.originalEnd;
    this.u.mem.regularFormVisual = null; delete this.u.mem.regularVisualDirection;
    for (const h of this.handles) this.b.off(h); this.handles = [];
  }
}

export function prepareMarcilAttacks(b, u, { contract } = {}) {
  if (contract !== MARCIL_ATTACK_CONTRACT) throw Error('Marcille requires her explicit combat contract');
  verifyMarcilAttackSource();
  const mana = prepareMarcilMana(b, u, { contract: MARCIL_MANA_CONTRACT });
  const controller = new MarcilAttackController(b, u, mana.record, mana); u.mem.marcilAttacks = controller;
  return bindMarcilCombat(mana, controller);
}

// Shared by later explicit source diagnostics; it does not select a build or
// expose an operator. Each entry point must validate its own source contract.
export function bindMarcilCombat(mana, controller) {
  if (!(controller instanceof MarcilAttackController) || controller.mana !== mana)
    throw Error('Invalid Marcille combat binding');
  mana.kit.trait = { noAttack: true, attackDrivenSkill: true, attack: 'ranged', dmgType: 'arts',
    canHitFly: true, maxTargets: 1, maxTargetsByBlock: false, hitAllBlocked: false, allInRange: false,
    rangeAoe: false, hits: 1, hitsFn: null, splashRadius: 0, chain: null, projectile: 'none',
    heal: null, install: null, onHit: null, onEachHit: null, requiresAcceptedLaunch: true,
    acceptAttackInput: t => t === controller.phase?.target,
    launchAttack: (_b, _u, _p, t, info) => controller.output(t, info), attackVisual: 'none' };
  mana.kit.skill = { ...mana.kit.skill, kind: 'toggle', silenceable: false,
    canActivate: () => controller.canActivate(), manualCancel: true,
    canManualCancel: () => controller.canCancel(), onManualCancel: () => controller.cancel(),
    onStart: () => controller.start(), onEnd: ({ reason }) => controller.end(reason),
    resourceGauge: () => controller.valid() ? { current: mana.wallet.value, maximum: mana.record.mana.maximum,
      label: 'Mana', canActivate: controller.canActivate(), canCancel: controller.canCancel() } : null };
  return { ...mana, mana, controller };
}
