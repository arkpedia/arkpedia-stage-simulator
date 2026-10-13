// SPDX-License-Identifier: GPL-3.0-or-later
// Explicit ordinary/S2 diagnostic; S1, S3 and output-damage stacks remain held.
import evidence from '../../../data/arkpedia-rmixer-prefabs.json' with { type: 'json' };
import { RMIXER_ID, rmixerSourceComponent } from './arkpedia-rmixer-source.js';
import { RMIXER_RESOURCE_CONTRACT, prepareRmixerResources } from './arkpedia-rmixer-resources.js';
import { canTargetEnemy, sortEnemyTargets } from '../targeting.js';
import { bodyInKeys } from '../body.js';
import { makeDamageInfo } from '../damage.js';

export const RMIXER_ATTACK_CONTRACT = Object.freeze({
  scope: 'Selected-source ordinary and S2 projectile attacks, with the existing barrier/fatal-hit diagnostic',
  mapping: 'First ordinary engagement plays Attack_Begin, then releases one Physical projectile at Attack_Loop OnAttack. S2 plays Skill_2_Begin and releases at Skill_2_Loop OnAttack. Both projectiles have speed ten, a ten-second lifetime and one retained input. Playback uses current attack interval without a native speed cap. Ordinary completion waits for the loop/cooldown; S2 completes when its projectile becomes invalid, without waiting for animation end. S2 spends one round at that completion, after impact damage, and empty ammo ends the skill. Next attacks still respect the interval. Same-life impacts read current ATK. Born shots survive owner removal: active S2 captures ATK in its pre-clear onEnd callback; ordinary/inactive retirement captures final runtime stats at the death callback.',
  limits: 'Native countEvent 4 is preserved but its compiled enum/dispatch is unrecovered: spending at S2 completion is an explicit local mapping. Fizzles and external removal are observed at the next tick. Engagement reset, cooldown combination, source retirement, skill transitions and completed ability dispatch are simulator policies, not Unity frame parity. An interrupted unfired ability emits no completion; accepted shots retain completion across control interruption, without debiting a different activation. S1 recipient ordering/three-shot activation, S3 counters/replenishment, output-damage stacks, public combat approval, modules and native particles/audio remain held. An accepted survival guard may exhaust S2 before a shot arrives; that live shot then uses current post-skill ATK.',
  frameParity: false,
});
const present = u => u?.alive && u.deployed && !u._removing;
const live = u => present(u) && !u.hidden;
const due = (b, at) => b.time + 1e-9 >= at;
const enemyProfile = Object.freeze({ canHitFly: true });

export function verifyRmixerAttackSource() {
  for (const [id, clip, projectile, wait] of [
    ['-7035987159684059176', 'Attack_Loop', 'projectile_chr_rmixer', 0],
    ['7781548002548215768', 'Skill_2_Loop', 'projectile_chr_rmixer_sk2', 1],
  ]) {
    const a = rmixerSourceComponent(id);
    if (a._waitForAttackEvent !== 1 || a._animKey !== clip || a._projectileKey !== projectile
      || a._damageType !== 1 || a._atkScale !== 1 || a._useCachedAtkOnly !== 0
      || a._alwaysIncludeTarget !== 1 || a._selectTargetSource !== 1
      || a._waitForProjectileInvalid !== wait || a._fireAttackFinishWhenProjectileInvalid !== wait
      || a._maxAnimScale !== -1) throw Error('Unreviewed Sankta Miksaparato attack source');
    const parts = evidence.projectiles[projectile].flatMap(r => r.components.map(c => c.data));
    for (const [key, value] of Object.entries({ _speed: 10, _lifeTime: 10, _maxHitNum: 1,
      _stopAfterMaxHit: 1, _stopWhenSourceInvalid: 0 }))
      if (!parts.some(d => d[key] === value)) throw Error('Unreviewed Sankta Miksaparato projectile source');
  }
  const animator = rmixerSourceComponent('2934293333015424984');
  const count = rmixerSourceComponent('8590064657825624024');
  const s2 = rmixerSourceComponent('8666956974333455062');
  if (animator._beginAnim !== 'Attack_Begin' || animator._oneshotAnim !== 'Attack_Loop'
    || animator._onlyPlayBeginAnimWhenFirstAttack !== 1 || animator._maxAnimScale !== -1
    || count._countEvent !== 4 || count._expendPerTrigger !== 1 || count._resetWhenAttackFinished !== 1
    || s2._beginAnim !== 'Skill_2_Begin' || s2._playSkillBeginAnim !== 1
    || s2._canDiscardRemainingCount !== 1) throw Error('Unreviewed Sankta Miksaparato attack clock');
  for (const m of [evidence.models[RMIXER_ID].Front, evidence.models[RMIXER_ID].Back])
    for (const clip of ['Attack_Loop', 'Skill_2_Loop']) {
      const events = m.eventPayloads[clip];
      if (events.length !== 1 || events[0].name !== 'OnAttack' || events[0].time !== 0
        || !(m.durations[clip] > 0)) throw Error('Unreviewed Sankta Miksaparato animation event');
    }
}

export class RmixerAttackController {
  constructor(b, u, record, resources) {
    this.b = b; this.u = u; this.record = record; this.resources = resources;
    this.seq = null; this.stopped = false; this.handles = []; this.phase = null;
    this.accepting = false; this.engaged = false; this.serial = 0; this.flights = new Set();
    this.completions = new Set();
  }
  valid() { return !this.stopped && !this.b.finished && live(this.u) && this.seq === this.u.deploySeq; }
  model() { return evidence.models[RMIXER_ID][['UP', 'LEFT'].includes(this.u.dir) ? 'Back' : 'Front']; }
  visual(clip, speed = 1, loop = false) {
    this.u.mem.regularVisualDirection = ['UP', 'LEFT'].includes(this.u.dir) ? 'UP' : 'RIGHT';
    this.u.mem.regularFormVisual = { clip, speed, loop,
      ...(!loop ? { idle: this.record.index === 1 && this.u.skill.active ? 'Skill_2_Idle' : 'Idle' } : {}),
      ...(!loop && this.phase?.kind === 'attack' ? { playId: `${this.seq}:${this.phase.serial}` } : {}) };
    if (this.model().durations.Die != null)
      this.u.mem.regularDeathVisual = { clip: 'Die', die: 'Die', duration: this.model().durations.Die };
    else delete this.u.mem.regularDeathVisual;
  }
  targets(limit = 1) {
    const u = this.u;
    const out = this.b.enemies.filter(t => live(t) && canTargetEnemy(u, t, enemyProfile)
      && (!t.s.flags.camou || !!t.blockedBy) && (bodyInKeys(t, u.rangeKeySet) || t.blockedBy === u));
    sortEnemyTargets(this.b, u, out); return out.slice(0, limit);
  }
  idle() { this.visual(this.u.skill.active ? 'Skill_2_Idle' : 'Idle', 1, true); }
  transition(clip) {
    if (!this.valid()) return;
    this.phase = { kind: 'transition', readyAt: this.b.time + this.model().durations[clip] };
    this.engaged = false; this.visual(clip);
  }
  canActivate() {
    return this.record.index === 1 && this.valid() && this.u.canAct && !this.u.s.flags.disarm
      && this.phase?.kind !== 'transition';
  }
  release(target, info) {
    const { b, u, phase: p } = this;
    if (!this.accepting || !this.valid() || !u.canAct || u.s.flags.disarm
      || p?.kind !== 'attack' || p.epoch !== u.attackControlEpoch || p.accepted
      || p.target !== target || p.targetSeq !== target.deploySeq || !live(target)
      || !canTargetEnemy(u, target, enemyProfile) || target.s.flags.camou && !target.blockedBy
      || !due(b, p.releaseAt)) return false;
    p.accepted = true; this.engaged = true; this.completions.add(p);
    p.flight = this.launchFlight(target, info, { isSkill: p.skill,
      projectile: p.skill ? 'projectile_chr_rmixer_sk2' : 'projectile_chr_rmixer',
      tag: p.skill ? 'rmixer:s2' : 'rmixer:ordinary', activation: p.activation });
    return true;
  }
  launchFlight(target, info, { isSkill, projectile, tag, activation, scale = 1 }) {
    const { b, u } = this;
    const flight = { sourceSeq: u.deploySeq, targetSeq: target.deploySeq, target,
      attackId: info.attackId, atk: u.s.atk * u.s.atkScaleMul, retired: false,
      isSkill, done: false, activation };
    this.flights.add(flight);
    flight.projectile = b.addProjectile({ from: u, target, source: u, speed: 10, maxAge: 10,
      visual: 'arrow', data: { arkpediaTrackedVisual: true, rmixerSourceSeq: flight.sourceSeq,
        projectileKey: projectile },
      onHit: ({ target: t }) => {
        try {
          if (b.finished || t !== target || !t || t.deploySeq !== flight.targetSeq
            || !canTargetEnemy(u, t, enemyProfile) || t.s.flags.camou && !t.blockedBy) return;
          const sameLife = !flight.retired && present(u) && u.deploySeq === flight.sourceSeq;
          const atk = sameLife ? u.s.atk * u.s.atkScaleMul : flight.atk;
          b.dealDamage(u, t, makeDamageInfo({ amount: atk * scale, type: 'phys', isAttack: true,
            isSkill: flight.isSkill, isSplash: false, applyWay: 'ranged', attackId: flight.attackId,
            tags: [tag] }));
        } finally { flight.done = true; this.flights.delete(flight); }
      } });
    return flight;
  }
  complete(p) {
    if (!p.accepted || !this.valid()) return;
    this.resources.completeAttack('Attack', `${this.seq}:${p.serial}`);
    const s = this.u.skill;
    if (!p.skill || !s.active || s.activations !== p.activation || s.kind !== 'ammo') return;
    // The common runtime spends at birth; this opted-in controller spends only
    // after its S2 projectile is invalid, independently of animation end.
    s.ammoLeft = Math.max(0, s.ammoLeft - 1);
    this.b.emit('ammoUsed', { unit: this.u, left: s.ammoLeft, skill: s });
    if (s.active && s.activations === p.activation && s.ammoLeft <= 0) s.end('ammo');
  }
  monitorFlights() {
    const { b } = this;
    for (const f of this.flights) if (f.projectile.removed || !b.projectiles.list.includes(f.projectile)) {
      f.done = true; this.flights.delete(f);
    }
  }
  tick() {
    if (!this.valid()) return;
    const { b, u } = this;
    for (const c of this.completions) if (c.skill ? c.flight.done : due(b, c.readyAt)) {
      this.completions.delete(c); this.complete(c);
      if (!this.valid()) return;
    }
    let p = this.phase;
    if (p?.kind === 'born' || p?.kind === 'transition') {
      if (!due(b, p.readyAt)) return;
      this.phase = null; p = null;
    }
    if (!u.canAct || u.s.flags.disarm || p && p.epoch !== u.attackControlEpoch) {
      // Born projectiles and their original completion obligations survive.
      // Unfired phases are cancelled, including transient control epochs.
      this.phase = null; this.engaged = false; this.idle(); return;
    }
    if (p) {
      if (!p.released && due(b, p.releaseAt)) {
        p.released = true;
        if (live(p.target) && p.target.deploySeq === p.targetSeq) {
          this.visual(p.clip, p.speed);
          this.accepting = true;
          try { b.forceAttack(u, [p.target], { noAmmo: true }); } finally { this.accepting = false; }
        }
      }
      if (this.phase !== p || !this.valid() || !due(b, p.readyAt) || p.skill && p.flight && !p.flight.done) return;
      this.phase = null;
    }
    if (u.atkCd > 1e-9) return;
    if ([...this.completions].some(c => c.skill)) return;
    const target = this.targets()[0];
    if (!target) { this.engaged = false; this.idle(); return; }
    this.beginAttack(target);
  }
  beginAttack(target) {
    const { b, u } = this;
    const skill = this.record.index === 1 && u.skill.active;
    const speed = u.base.bat / u.s.interval, m = this.model();
    const clip = skill ? 'Skill_2_Loop' : 'Attack_Loop';
    const begin = !skill && !this.engaged ? m.durations.Attack_Begin / speed : 0;
    this.phase = { kind: 'attack', serial: ++this.serial, startedAt: b.time, target,
      targetSeq: target.deploySeq, epoch: u.attackControlEpoch, skill, activation: u.skill.activations,
      clip, speed, accepted: false, released: false,
      releaseAt: b.time + begin + m.eventPayloads[clip][0].time / speed,
      readyAt: b.time + begin + Math.max(u.s.interval, m.durations[clip] / speed) };
    this.visual(begin ? 'Attack_Begin' : clip, speed); u.atkCd = u.s.interval;
  }
  install() {
    if (this.stopped || this.handles.length) throw Error('Sankta Miksaparato attacks already installed');
    this.resources.install();
    const { b, u } = this;
    this.handles = [b.on('deploy', ({ unit, move }) => {
      if (unit !== u || move) return;
      this.seq = u.deploySeq; this.phase = { kind: 'born', readyAt: b.time + this.model().durations.Start };
      this.visual('Start');
    }), b.on('tick', () => {
      if (this.stopped || b.finished || this.seq != null && (!present(u) || this.seq !== u.deploySeq)) { this.stop(); return; }
      this.monitorFlights();
      if (!u.hidden) this.tick(); else { this.phase = null; this.engaged = false; }
    }), b.on('removed', ({ unit }) => { if (unit === u) this.stop(); }),
    b.on('death', ({ unit }) => { if (unit === u) this.stop(); }), b.on('battleEnd', () => this.stop())];
  }
  stop() {
    if (this.stopped) return;
    this.stopped = true; this.phase = null; this.accepting = false; this.completions.clear();
    for (const f of this.flights) { f.atk = this.u.s.atk * this.u.s.atkScaleMul; f.retired = true; }
    this.flights.clear(); this.resources.stop();
    this.u.mem.regularFormVisual = null; delete this.u.mem.regularVisualDirection;
    for (const h of this.handles) this.b.off(h); this.handles = [];
  }
}

export function rmixerAttackTrait(controller) {
  return { noAttack: true, attackDrivenSkill: true, attack: 'ranged', projectile: 'none', dmgType: 'phys',
    canHitFly: true, maxTargets: 1, maxTargetsByBlock: false, hitAllBlocked: false, allInRange: false,
    rangeAoe: false, hits: 1, hitsFn: null, chain: null, splashRadius: 0, heal: null,
    onHit: null, onEachHit: null, install: null, requiresAcceptedLaunch: true, attackVisual: 'none',
    launchAttack: (_b, _u, _p, target, info) => controller.release(target, info) };
}

export function prepareRmixerAttacks(b, u, { contract } = {}) {
  if (contract !== RMIXER_ATTACK_CONTRACT) throw Error('Sankta Miksaparato requires the reviewed attack contract');
  verifyRmixerAttackSource();
  const prepared = prepareRmixerResources(b, u, { contract: RMIXER_RESOURCE_CONTRACT });
  const { record, resources, kit } = prepared;
  const controller = new RmixerAttackController(b, u, record, resources);
  u.mem.rmixerAttacks = controller;
  kit.trait = rmixerAttackTrait(controller);
  kit.skill = { ...kit.skill, silenceable: false,
    manualCancel: record.index === 1,
    canActivate: () => controller.canActivate(),
    attack: record.index === 1 ? { isSkill: true } : undefined,
    onStart: () => controller.transition('Skill_2_Begin'),
    onEnd: ({ reason }) => {
      // Removal marks the owner absent before ending its skill, but the skill
      // mods and other buffs still exist here. Capture before their cleanup.
      if (reason === 'death') controller.stop();
      else controller.transition('Skill_2_End');
    } };
  return { ...prepared, controller };
}
