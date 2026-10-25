// SPDX-License-Identifier: GPL-3.0-or-later
// Selected source combat; public registration/artwork approval remain separate.
import e from '../../../data/arkpedia-native-operators/char_4228_closur.json' with { type: 'json' };
import { CLOSUR_ID as ID } from './arkpedia-closur-source.js';
import { prepareClosurPoint, CLOSUR_POINT_CONTRACT } from './arkpedia-closur-point.js';
import { prepareClosurS1, CLOSUR_S1_CONTRACT } from './arkpedia-closur-s1.js';
import { prepareClosurS2, CLOSUR_S2_CONTRACT } from './arkpedia-closur-s2.js';
import { prepareClosurS3, CLOSUR_S3_CONTRACT } from './arkpedia-closur-s3.js';
import { canTargetEnemy, sortEnemyTargets } from '../targeting.js';
import { bodyInKeys } from '../body.js';
import {prepareClosurModule} from './arkpedia-closur-module.js';
export const CLOSUR_COMBAT_CONTRACT = Object.freeze({
  scope: 'Selected original ordinary fire, owned-blocker trait, all thirty source skill ranks and command-center interactions',
  mapping: 'Ordinary first fire plays the explicit Begin then the aliased Attack_Loop; subsequent continuous attacks omit Begin. Presentation follows the selected primary, retaining deployment geometry. S2 captures up to two windup inputs and fires independent speed-ten projectiles. S3 selects at release, grows to seven targets, and attaches a delayed hit at the target for the original .30000001192092896s. Both use literal mode clips. Direct damage is normal physical; current source ATK and owned-blocker trait are sampled at impact.',
  limits: 'Selector/collider aliases, first-fire cooldown/FSM timing, target/body geometry and fixed-tick dispatch are explicit mappings. Ordinary cooldown is retained through skill-mode changes. Unrequested End clips are not inferred. Launched projectiles retain their source after retreat; unreleased casts are cancelled. BORN executable parity, future enemy slow-down clock bindings, dynamic COST modifier coverage, native particles/audio/modules and original frame/pixel parity remain unverified. Public card/art/browser admission has its separate runtime-review receipt.',
  frameParity: false,
});
const present = u => u?.alive && u.deployed && !u._removing;
const live = u => present(u) && !u.hidden;
const due = (b, at) => b.time + 1e-8 >= at;
const profile = Object.freeze({ canHitFly: true });
export class ClosurCombatController {
  constructor(point, command) {
    this.point = point; this.command = command; this.b = point.b; this.u = point.u; this.record = point.record.owner;
    this.seq = null; this.phase = null; this.accepting = false; this.continuing = false;
    this.stopped = false; this.handles = []; this.visualSeq = 0; this.facing = this.u.dir;
  }
  valid() { return !this.stopped && !this.b.finished && present(this.u) && this.seq === this.u.deploySeq; }
  s2() { return this.record.index === 1 && this.u.skill.active; }
  s3() { return this.record.index === 2 && this.u.skill.active; }
  mode() { return this.s3() ? 3 : this.s2() ? 2 : 0; }
  model() { return e.models[ID][this.facing === 'UP' ? 'Back' : 'Front']; }
  face(target) {
    const dx = target.x - this.u.x, dy = target.y - this.u.y;
    if (Math.hypot(dx, dy) > 1e-8) this.facing = Math.abs(dy) > Math.abs(dx) ? dy > 0 ? 'UP' : 'DOWN' : dx < 0 ? 'LEFT' : 'RIGHT';
  }
  clip(mode, part) {
    if (mode === 0) return part === 'idle' ? 'Idle' : `Attack${this.facing === 'DOWN' ? '_Down' : ''}_${part === 'begin' ? 'Begin' : 'Loop'}`;
    return `Skill_${this.facing === 'DOWN' ? 'Down_' : ''}${mode}_${part === 'idle' ? 'Idle' : part === 'begin' ? 'Begin' : 'Loop'}`;
  }
  visual(clip, speed = 1, loop = false) {
    if (this.model().durations[clip] == null) throw Error('Missing literal Closure clip: ' + clip);
    this.u.mem.regularFormVisual = { clip, speed, loop,
      ...(!loop ? { playId: `closur:${this.u.deploySeq}:${++this.visualSeq}` } : {}) };
    this.u.mem.regularVisualDirection = this.facing;
  }
  idle() { this.facing = this.u.dir; this.visual(this.clip(this.mode(), 'idle'), 1, true); }
  targets(s2 = this.s2()) {
    if (this.b.rangeChanged(this.u)) this.b._refreshRange(this.u);
    if (this.s3()) this.command.refreshRange();
    this.point.mark();
    const all = this.b.enemies.filter(a => canTargetEnemy(this.u, a, profile) && (!a.s.flags.camou || a.blockedBy)
      && (a.blockedBy === this.u || bodyInKeys(a, this.u.rangeKeySet)
        || (s2 || this.s3()) && live(a.blockedBy) && !!a.blockedBy.findBuff(this.point.friendKey)));
    const own = all.filter(a => a.blockedBy === this.u);
    return [...sortEnemyTargets(this.b, this.u, own), ...sortEnemyTargets(this.b, this.u, all.filter(a => a.blockedBy !== this.u))]
      .slice(0, this.s3() ? this.command.state.maxTargets : s2 ? this.record.bb['attack@max_target'] : 1);
  }
  traitScale(target) {
    const blocker = target.blockedBy;
    return live(blocker) && (blocker.ownerUnit === this.u || blocker.findBuff(this.point.friendKey))
      ? e.tables.character.trait.candidates[0].blackboard.find(p => p.key === 'atk_scale').value : 1;
  }
  startMode(mode) {
    this.continuing = false; this.facing = this.u.dir;
    const clip = this.clip(mode, 'begin'); this.visual(clip);
    this.phase = { kind: 'begin', until: this.b.time + this.model().durations[clip] };
  }
  endMode() {
    if (!this.valid()) return;
    this.phase = null; this.continuing = false; this.idle();
  }
  admissible(targets) {
    const p = this.phase;
    return this.accepting && this.valid() && live(this.u) && this.u.canAct && !this.u.s.flags.disarm
      && p?.kind === 'attack' && !p.accepted && p.epoch === this.u.attackControlEpoch && due(this.b, p.releaseAt)
      && targets.length > 0 && new Set(targets).size === targets.length
      && targets.every(a => p.inputs.some(input => input.unit === a && input.seq === a.deploySeq)
        && canTargetEnemy(this.u, a, profile));
  }
  release(targets, info) {
    if (!this.admissible(targets)) return false;
    const phase = this.phase; phase.accepted = true;
    for (const target of targets) {
      if (!this.valid()) break;
      const seq = phase.inputs.find(input => input.unit === target).seq;
      if (!live(target) || target.deploySeq !== seq) continue;
      this.b.addProjectile({ from: phase.s3 ? target : this.u, source: this.u, target, speed: 10, maxAge: 10,
        ...(phase.s3 ? { flightTime: .30000001192092896, attached: true } : {}), visual: phase.s3 ? 'none' : 'arrow',
        data: { arkpediaTrackedVisual: true, closur: true, nativeKey: phase.s3 ? 'projectile_chr_closur_s3' : phase.s2 ? 'projectile_chr_closur_s2' : 'projectile_chr_closur' },
        onHit: ({ target: a }) => {
          if (this.b.finished || !a || a.deploySeq !== seq || !canTargetEnemy(this.u, a, profile)) return;
          this.point.mark();
          if (phase.s3) this.command.slow(a);
          if (!live(a) || a.deploySeq !== seq) return;
          this.b.dealDamage(this.u, a, { amount: this.u.s.atk * this.u.s.atkScaleMul * this.traitScale(a)
            * (phase.s3 ? this.record.bb['attack@atk_scale'] : 1),
            type: 'phys', isAttack: true, isSkill: false, attackId: info.attackId, applyWay: 'ranged',
            tags: ['closur:direct', phase.s3 ? 'closur:s3' : phase.s2 ? 'closur:s2' : 'closur:ordinary'] });
        } });
    }
    if (phase.s3) this.command.acceptedAttack();
    return true;
  }
  tick() {
    if (!this.valid()) return;
    const { b, u } = this; let p = this.phase;
    if (!live(u) || !u.canAct || u.s.flags.disarm || p?.kind === 'attack' && p.epoch !== u.attackControlEpoch) {
      this.phase = null; this.continuing = false; this.idle(); return;
    }
    if (p?.kind === 'born' || p?.kind === 'begin') {
      if (!due(b, p.until)) return; this.phase = p = null;
    }
    if (p) {
      if (!p.loopStarted && due(b, p.loopAt)) { p.loopStarted = true; this.visual(p.loop, p.speed); }
      if (!p.released && due(b, p.releaseAt)) {
        p.released = true;
        if (p.s3) p.inputs = this.targets().map(unit => ({ unit, seq: unit.deploySeq }));
        const targets = p.inputs.filter(input => live(input.unit) && input.unit.deploySeq === input.seq
          && canTargetEnemy(u, input.unit, profile)).map(input => input.unit);
        this.accepting = true;
        try { if (targets.length) b.forceAttack(u, targets); } finally { this.accepting = false; }
      }
      if (!this.valid() || this.phase !== p || !due(b, p.until)) return;
      this.phase = null;
    }
    if (u.atkCd > 1e-9) return;
    const targets = this.targets();
    if (!targets.length) { this.continuing = false; this.idle(); return; }
    const s2 = this.s2(), s3 = this.s3(); this.face(targets[0]);
    const loop = this.clip(this.mode(), 'loop'), speed = Math.min(1, u.base.bat / u.s.interval);
    const begin = !s2 && !s3 && !this.continuing ? this.clip(0, 'begin') : null;
    const beginDelay = begin ? this.model().durations[begin] / speed : 0;
    const release = beginDelay + this.model().eventPayloads[loop].find(p => p.name === 'OnAttack').time / speed;
    const cadence = beginDelay + Math.max(u.s.interval, release - beginDelay);
    this.phase = { kind: 'attack', inputs: targets.map(unit => ({ unit, seq: unit.deploySeq })), s2, s3,
      loop, loopAt: b.time + beginDelay, loopStarted: !begin, speed, epoch: u.attackControlEpoch,
      releaseAt: b.time + release, until: b.time + cadence, accepted: false, released: false };
    u.atkCd = cadence; this.continuing = !s2 && !s3; this.visual(begin ?? loop, speed);
  }
  install() {
    if (this.handles.length || this.stopped) throw Error('Closure combat cannot be reinstalled');
    this.point.install(); this.command.install?.();this.module?.install();
    this.handles = [this.b.on('deploy', ({ unit, move }) => {
      if (unit !== this.u || move) return;
      this.seq = unit.deploySeq; this.facing = unit.dir; this.continuing = false;
      const until = this.b.time + this.model().durations.Start;
      unit.mem.regularBornUntil = until; this.phase = { kind: 'born', until }; this.visual('Start');
    }, { owner: this.u }), this.b.on('tick', () => {
      if (this.seq !== null && !this.valid()) this.stop(); else this.tick();
    }, { owner: this.u }), this.b.on('death', ({ unit }) => { if (unit === this.u) this.stop(); }, { owner: this.u }),
    this.b.on('battleEnd', () => this.stop())];
  }
  stop() {
    if (this.stopped) return; this.stopped = true; this.phase = null; this.accepting = false;
    this.module?.stop();this.command.stop?.(); this.point.stop();
    for (const h of this.handles) this.b.off(h); this.handles = [];
    delete this.u.mem.regularFormVisual; delete this.u.mem.regularVisualDirection;
  }
}
export function prepareClosurCombat(b, u, { contract } = {}) {
  if (contract !== CLOSUR_COMBAT_CONTRACT) throw Error('Closure requires its selected combat contract');
  const { controller: point, record } = prepareClosurPoint(b, u, { contract: CLOSUR_POINT_CONTRACT });
  const parts = e.characters[ID].flatMap(row => row.components), part = id => parts.find(p => p.pathId === id).data;
  if (part('1012175510054882834')._onlyPlayBeginAnimWhenFirstAttack !== 1
    || part('1012175510054882834')._maxAnimScale !== 1 || part('-7792546040983204334')._selectTargetTiming !== 0)
    throw Error('Unreviewed Closure continuous-fire inputs');
  const motion = e.projectiles.projectile_chr_closur_s3.flatMap(row => row.components)
    .find(p => p.pathId === '-7962353101399098955').data;
  if (part('1116450498941406738')._selectTargetTiming !== 2 || part('-6472147311241474542')._maxAnimScale !== 1
    || motion._delayTime !== .30000001192092896 || motion._followTarget !== 1 || motion._immediatelyReach !== 0
    || motion._stopIfTargetDead !== 1 || motion._stopIfTargetDisappeared !== 1)
    throw Error('Unreviewed Closure S3 selector/attachment inputs');
  const command = record.owner.index === 0 ? prepareClosurS1(point, { contract: CLOSUR_S1_CONTRACT })
    : record.owner.index === 1 ? prepareClosurS2(point, { contract: CLOSUR_S2_CONTRACT })
      : prepareClosurS3(point, { contract: CLOSUR_S3_CONTRACT });
  const controller = new ClosurCombatController(point, command);
  controller.module=prepareClosurModule(point);
  const skill = { ...command.spec, onStart: ctx => { command.spec.onStart?.(ctx); if (record.owner.index > 0) controller.startMode(record.owner.index + 1); },
    onEnd: ctx => { command.spec.onEnd?.(ctx); if (record.owner.index > 0) controller.endMode(); } };
  return { record: record.owner, tokenRecord: record, controller, point, command, kit: { talents: [], install: null,
    trait: { noAttack: true, install: null, attackDrivenSkill: true, attack: 'ranged', projectile: 'none',
      dmgType: 'none', canHitFly: true, heal: null, windup: 0, attackVisual: 'none', requiresAcceptedLaunch: true,
      acceptAreaAttack: (_b, _u, _p, targets) => controller.admissible(targets),
      launchAreaAttack: (_b, _u, _p, targets, info) => controller.release(targets, info) }, skill } };
}
