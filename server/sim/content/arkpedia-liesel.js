// SPDX-License-Identifier: GPL-3.0-or-later
// Selected diagnostic contract; no public operator registration is performed.
import e from '../../../data/arkpedia-native-operators/char_4031_liesel.json' with { type: 'json' };
import { LIESEL_ID as ID, selectedLieselBuild, lieselNativeInputs } from './arkpedia-liesel-source.js';
import { normalizeChess, normSpType } from '../simdata.js';
import { absoluteRangeKeys, canTargetEnemy, sortEnemyTargets } from '../targeting.js';
import { bodyInKeys, bodyInRadius } from '../body.js';
export const LIESEL_CONTRACT = Object.freeze({
  scope: 'Selected original CN normal splash attacks, count-dependent talent and all twenty S1/S2 ranks',
  mapping: 'Normal/S1 select a primary at windup and current splash recipients at the literal attack event. S1 spends one charge, expands the splash and refunds only a dead captured input. S2 requires an eligible input, selects up to three distinct current targets, leaves durable 1.5-second exclusion marks, and emits homing fixed-time shots. Each impact samples current ATK and its own eligible splash count; the six-second one-second-tick DOT snapshots launch ATK, extends per owner and excludes the talent.',
  limits: 'Selector/event aliases, tick-sampled ordering, body geometry and tile-center projectile origins are explicit local mappings. S2 completes its skill account at launch while retaining a local recovery gate to the literal AnimeAttack event; emitted shots persist after that account ends. This is not recovered compiled Unity cast/FSM proof. The exclusion selector follows the corroborated any-Ripresa predicate over independently owned marks. DOT refresh replaces its cached launch ATK without resetting its existing tick clock. Native particles, audio, modules and original game-frame/pixel parity remain unsupported.',
  gameplayCorroboration: 'https://prts.wiki/w/%E5%A4%8D%E5%A5%8F', frameParity: false,
});
const present = a => a?.alive && a.deployed && !a._removing;
const live = a => present(a) && !a.hidden;
const due = (b, time) => b.time + 1e-8 >= time;
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const enemyProfile = Object.freeze({ canHitFly: true });
function selected(u, contract) {
  if (contract !== LIESEL_CONTRACT) throw Error('Ripresa requires its selected native source contract');
  if (u.def.charId !== ID || u.deploySeq !== 0 || u.mem.liesel) throw Error('Ripresa requires a fresh original owner');
  const build = { ...u.def.raw.arkpedia, skillId: u.def.skill?.id }, r = selectedLieselBuild(build), s = u.def.skill;
  if (u.def.raw.arkpedia.skillId != null && u.def.raw.arkpedia.skillId !== build.skillId
    || s.skillType !== r.source.skillType || s.durationType !== r.source.durationType
    || s.spType !== normSpType(r.source.spData.spType) || s.spCost !== r.source.spData.spCost || s.initSp !== r.source.spData.initSp
    || s.maxCharges !== r.source.spData.maxChargeTime || s.duration !== r.source.duration || !same(s.bb, r.bb)
    || !same(s.rangeGrid ?? [], r.skillRangeGrid) || !same(u.rangeGrid, r.rangeGrid)
    || !same(u.def.stats, normalizeChess({ stats: r.stats }).stats) || !same(u.def.tags, r.tags)
    || !same(u.def.talents.map(t => t.bb), r.talentBb)) throw Error('Incomplete Ripresa selected source');
  const n = lieselNativeInputs();
  if (n.ordinary._maxAnimScale !== 1 || n.s1._maxAnimScale !== -1 || n.s2._maxAnimScale !== 1
    || n.s2._additionalTimes !== 2 || n.s2._triggerDelta !== 0 || n.s2._waitAttackEventForAllAttacks !== 0
    || n.shots.some(p => p.projectile._stopWhenSourceInvalid !== 1 || p.motion._followTarget !== 1)
    || n.exclusion.lifeTime !== 1.5) throw Error('Unreviewed Ripresa original ability inputs');
  return r;
}
export class LieselController {
  constructor(b, u, record) {
    this.b = b; this.u = u; this.record = record; this.native = lieselNativeInputs();
    this.seq = null; this.phase = null; this.stopped = false; this.accepting = false; this.handles = []; this.visualSeq = 0; this.facing = u.dir;
  }
  valid() { return !this.stopped && !this.b.finished && present(this.u) && this.seq === this.u.deploySeq; }
  model() { return e.models[ID][this.facing === 'UP' ? 'Back' : 'Front']; }
  visual(clip, speed = 1, loop = false) {
    this.u.mem.regularFormVisual = { clip, speed, loop, ...(!loop ? { playId: `liesel:${this.u.deploySeq}:${++this.visualSeq}` } : {}) };
    this.u.mem.regularVisualDirection = this.facing;
  }
  idle() { this.visual('Idle', 1, true); }
  eligible(a) { return canTargetEnemy(this.u, a, enemyProfile); }
  targets(s2 = false) {
    const keys = new Set(absoluteRangeKeys(this.record.rangeGrid, this.u.tileR, this.u.tileC, this.u.dir));
    const all = this.b.enemies.filter(a => this.eligible(a) && (!a.s.flags.camou || a.blockedBy)
      && (a.blockedBy === this.u || bodyInKeys(a, keys))
      && (!s2 || !a.buffs.some(b => b.key.startsWith('liesel:exclude:'))));
    const blocked = all.filter(a => a.blockedBy === this.u);
    return [...sortEnemyTargets(this.b, this.u, blocked), ...sortEnemyTargets(this.b, this.u, all.filter(a => a.blockedBy !== this.u))];
  }
  area(center, radius) {
    // Native area-purpose NONE ignores camouflage, unlike primary acquisition.
    return this.b.enemies.filter(a => this.eligible(a) && bodyInRadius(a, center.x, center.y, radius));
  }
  canCast() {
    return this.valid() && live(this.u) && this.u.canAct && !this.u.s.flags.disarm && !this.u.skill.active
      && (this.record.index === 1 ? !this.phase || this.phase.kind === 'born' || this.phase.kind === 'attack' && !this.phase.s2
        : !this.phase && this.u.atkCd <= 1e-9) && this.targets(this.record.index === 1).length > 0;
  }
  beginS2() {
    const event = this.model().eventPayloads.Skill_2, release = event.find(e => e.name === 'OnAttack').time;
    this.facing = this.u.dir;
    this.phase = { kind: 'attack', s2: true, s1: false, accepted: false, epoch: this.u.attackControlEpoch,
      startedAt: this.b.time, releaseAt: this.b.time + release,
      readyAt: this.b.time + event.find(e => e.name === 'AnimeAttack').time };
    this.visual('Skill_2');
  }
  admissible(targets) {
    const p = this.phase, u = this.u;
    return this.accepting && this.valid() && live(u) && u.canAct && !u.s.flags.disarm && p?.kind === 'attack'
      && !p.accepted && p.epoch === u.attackControlEpoch && due(this.b, p.releaseAt)
      && targets.every(a => p.receiptTargets.includes(a));
  }
  boost(count) {
    const talent = this.record.talentBb[0];
    return talent && count >= talent.min_target_cnt ? talent.damage_scale : 1;
  }
  attachDot(target, cachedAtk) {
    if (!present(target)) return;
    const { b, u, record: r } = this, key = `liesel:dot:${u.id}`;
    const old = target.findBuff(key), power = cachedAtk * r.bb['liesel_s_2[dot].atk_scale'];
    const buff = b.addBuff(target, { key, source: u, duration: r.bb['liesel_s_2[dot].duration'], interval: 1,
      refresh: 'extend', data: { power }, onTick: ({ buff }) => {
        if (b.finished || !live(target)) return;
        b.dealDamage(u, target, { amount: buff.data.power, type: 'arts', sourceless: true, canDodge: false,
          applyWay: 'ranged', tags: ['dot', 'liesel:dot'] });
      } });
    if (old && buff) buff.data.power = power;
  }
  emitShot(target, index, info) {
    const { b, u } = this, cachedAtk = u.s.atk, shot = this.native.shots[index];
    b.addBuff(target, { key: `liesel:exclude:${u.id}`, source: u, duration: this.native.exclusion.lifeTime, refresh: 'extend' });
    b.addProjectile({ from: u, source: u, target, flightTime: shot.projectile._lifeTime, hitDead: true,
      visual: 'arts', data: { arkpediaTrackedVisual: true, liesel: true, nativeKey: shot.key },
      onHit: ({ x, y }) => {
        if (!this.valid() || !live(u)) return;
        const targets = this.area({ x, y }, this.native.enhancedRadius).map(target => ({ target, seq: target.deploySeq }));
        const amount = u.s.atk * u.s.atkScaleMul * this.record.bb.atk_scale * this.boost(targets.length);
        for (const { target, seq } of targets) {
          if (!this.valid() || !live(u)) break;
          if (!present(target) || target.deploySeq !== seq) continue;
          b.dealDamage(u, target, { amount, type: 'arts', isAttack: true, isSkill: false, attackId: info.attackId,
            applyWay: 'ranged', tags: ['liesel:burst', `liesel:shot:${index}`] });
          this.attachDot(target, cachedAtk);
        }
      } });
  }
  release(targets, info) {
    if (!this.admissible(targets)) return false;
    const p = this.phase; p.accepted = true;
    if (p.s2) {
      for (const [i, target] of targets.entries()) if (this.valid() && live(target)) this.emitShot(target, i, info);
    } else {
      const amount = this.u.s.atk * this.u.s.atkScaleMul * (p.s1 ? this.record.bb.atk_scale : 1) * this.boost(targets.length);
      const receipts = targets.map(target => ({ target, seq: target.deploySeq }));
      for (const { target, seq } of receipts) if (present(target) && target.deploySeq === seq)
        this.b.dealDamage(this.u, target, { amount, type: 'arts', isAttack: true, isSkill: false,
          attackId: info.attackId, applyWay: 'melee', tags: ['liesel:area', p.s1 ? 'liesel:s1' : 'liesel:ordinary'] });
    }
    return true;
  }
  finish(p) {
    if (!(p.s1 || p.s2) || !this.u.skill.active) return;
    const refund = p.s1 && (!present(p.input) || p.input.deploySeq !== p.inputSeq) && !p.accepted;
    this.u.skill.end(refund ? 'dead-input-refund' : 'cast-launched');
    if (refund && this.valid()) this.u.skill.setSpTotal(this.u.skill.spTotal + this.u.skill.spCost);
  }
  tick() {
    if (!this.valid()) return;
    const { b, u } = this; let p = this.phase;
    if (p?.kind === 'born') { if (!due(b, p.readyAt)) return; this.phase = p = null; }
    if (!live(u) || !u.canAct || u.s.flags.disarm || p && p.epoch !== u.attackControlEpoch) {
      this.phase = null; if (u.skill.active) u.skill.end('interrupted'); this.idle(); return;
    }
    if (p) {
      if (!p.released && due(b, p.releaseAt)) {
        p.released = true;
        const targets = p.s2 ? this.targets(true).slice(0, this.native.s2._additionalTimes + 1)
          : present(p.input) && p.input.deploySeq === p.inputSeq && this.eligible(p.input)
            ? this.area(p.input, p.s1 ? this.native.enhancedRadius : this.native.ordinaryRadius) : [];
        p.receiptTargets = targets; this.accepting = true;
        try { if (targets.length) b.forceAttack(u, targets); } finally { this.accepting = false; }
        this.finish(p);
      }
      if (!this.valid() || this.phase !== p || !due(b, p.readyAt)) return;
      this.phase = null;
    }
    if (u.atkCd > 1e-9) return;
    const target = this.targets()[0]; if (!target) { this.idle(); return; }
    if (this.record.index === 0 && u.skill.ready && this.canCast()) u.skill.activate('DEFAULT');
    const s1 = this.record.index === 0 && u.skill.active, clip = s1 ? 'Skill_1' : 'Attack';
    const dx = target.x - u.x, dy = target.y - u.y;
    if (Math.hypot(dx, dy) > 1e-8) this.facing = Math.abs(dy) > Math.abs(dx) ? dy > 0 ? 'UP' : 'DOWN' : dx < 0 ? 'LEFT' : 'RIGHT';
    const rate = u.base.bat / u.s.interval, speed = s1 ? rate : Math.min(1, rate);
    const release = this.model().eventPayloads[clip][0].time / speed, cadence = Math.max(release, u.s.interval);
    this.phase = { kind: 'attack', input: target, inputSeq: target.deploySeq, s1, s2: false, accepted: false,
      epoch: u.attackControlEpoch, startedAt: b.time, releaseAt: b.time + release, readyAt: b.time + cadence };
    u.atkCd = cadence; this.visual(clip, speed);
  }
  install() {
    if (this.handles.length || this.stopped) throw Error('Ripresa cannot be reinstalled');
    const { b, u } = this;
    this.handles = [b.on('deploy', ({ unit, move }) => {
      if (unit !== u || move) return;
      this.seq = u.deploySeq; this.phase = { kind: 'born', readyAt: b.time + this.model().durations.Start }; this.visual('Start');
    }, { owner: u }), b.on('tick', () => {
      if (this.stopped || b.finished || this.seq !== null && !this.valid()) this.stop(); else this.tick();
    }, { owner: u }), b.on('death', ({ unit }) => { if (unit === u) this.stop(); }, { owner: u }), b.on('battleEnd', () => this.stop())];
  }
  stop() {
    if (this.stopped) return;
    this.stopped = true; this.phase = null; this.accepting = false;
    this.b.projectiles.remove(p => p.source === this.u && p.data?.liesel);
    for (const handle of this.handles) this.b.off(handle);
    this.handles = []; delete this.u.mem.regularFormVisual; delete this.u.mem.regularVisualDirection;
    // Durable target exclusion and already attached DOT keep their own expiry.
  }
  spec() {
    return { kind: 'instant', silenceable: false, trigger: { rule: 'NEVER' }, flags: { noSp: true }, attack: {},
      completeOnAttack: false, canActivate: () => this.canCast(),
      ...(this.record.index === 1 ? { onStart: () => this.beginS2() } : {}) };
  }
}
export function prepareLiesel(b, u, { contract } = {}) {
  const record = selected(u, contract), controller = new LieselController(b, u, record); u.mem.liesel = controller;
  return { record, controller, kit: { talents: [], install: null,
    trait: { noAttack: true, attackDrivenSkill: true, attack: 'ranged', projectile: 'none', dmgType: 'none', canHitFly: true,
      heal: null, splashRadius: 0, chain: null, windup: 0, attackVisual: 'none', requiresAcceptedLaunch: true,
      acceptAreaAttack: (_b, _u, _p, targets) => controller.admissible(targets),
      launchAreaAttack: (_b, _u, _p, targets, info) => controller.release(targets, info) }, skill: controller.spec() } };
}
