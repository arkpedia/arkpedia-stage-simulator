// SPDX-License-Identifier: GPL-3.0-or-later
// Opted-in owner diagnostic. Active skills and token controllers remain separate.
import evidence from '../../../data/arkpedia-tragodia-prefabs.json' with { type: 'json' };
import { TRAGODIA_ID as ID, selectedTragodiaBuild, tragodiaSourceComponent as component }
  from './arkpedia-tragodia-source.js';
import { normalizeChess, normSpType, flattenBlackboard } from '../simdata.js';
import { absoluteRangeKeys, canTargetEnemy, sortEnemyTargets } from '../targeting.js';
import { bodyInKeys } from '../body.js';

export const TRAGODIA_CORE_CONTRACT = Object.freeze({
  scope: 'Source-selected Tragodia ordinary Arts attacks, Nervous splash and E2 talents; diagnostic only',
  mapping: 'One retained ground/flying input, original Front/Back Attack_1 release, capped animation speed and independently repeating attack interval. A calculated Arts receipt commits the ATK-based main injury then centre-circle splash, excluding the primary. E2 applies fixed 70 Nervous to an in-range normal enemy attacker at the shared pre-attack hook, after existing palsy interruption; a newly created burst affects subsequent attacks. Source-owned global ASPD additions are the negative magnitude of the source talent during Nervous burst only.',
  limits: 'Accepted-output, dodge/shield/fatal ordering, numeric selector aliases, aura refresh, newly triggered palsy and the negative ASPD modifier bucket are explicit simulator policies, not recovered compiled Unity dispatch or frame parity. All active skills, lure attraction/pathing, cage lifecycle, token inheritance, delivered artwork and public review remain held. Modules and native particles/shaders/audio remain unsupported.',
  frameParity: false,
});
const present = u => u?.alive && u.deployed && !u._removing;
const live = u => present(u) && !u.hidden;
const due = (b, t) => b.time + 1e-9 >= t;
const same = (a, z) => JSON.stringify(a) === JSON.stringify(z);
const plain = Object.freeze({ canHitFly: true, attack: 'ranged', dmgType: 'arts' });
const splash = Object.freeze({ ...plain, ignoreCamouflage: true });
const neuralBurst = e => !!(e.burstPending?.neural || e.findBuff('neuralBurst'));

function validate(u, contract) {
  if (contract !== TRAGODIA_CORE_CONTRACT) throw Error('Tragodia requires the reviewed core contract');
  if (u.def.charId !== ID || u.deploySeq !== 0 || u.mem.tragodiaController)
    throw Error('Tragodia requires a fresh original owner');
  const build = { ...u.def.raw.arkpedia, skillId: u.def.skill?.id }, r = selectedTragodiaBuild(build), s = u.def.skill;
  if (u.def.raw.arkpedia.skillId != null && u.def.raw.arkpedia.skillId !== build.skillId
    || s.skillType !== r.source.skillType || s.durationType !== r.source.durationType
    || s.spType !== normSpType(r.source.spData.spType)
    || s.spCost !== r.source.spData.spCost || s.initSp !== r.source.spData.initSp
    || s.maxCharges !== r.source.spData.maxChargeTime || s.duration !== r.source.duration
    || !same(s.bb, r.bb) || !same(s.rangeGrid ?? [], r.skillRangeGrid)
    || !same(u.rangeGrid, r.rangeGrid) || !same(u.def.tags, r.tags)
    || !same(u.def.stats, normalizeChess({ stats: r.stats }).stats)
    || !same(u.def.talents.map(t => t.bb), r.talentBb)) throw Error('Incomplete Tragodia selected source');
  const attack = component('-8049361450338600694'), selector = component('-1291155014029199094');
  const aura = component('3305181275973826826');
  if (attack._waitForAttackEvent !== 1 || attack._animKey !== 'Attack_1'
    || attack._maxAnimScale !== 1 || attack._damageType !== 2
    || attack._selectTargetSource !== 2 || attack._alwaysIncludeTarget !== 1
    || selector._maxNum !== 1 || selector._targetMotion !== 3
    || aura._removeBuffWhenTargetLeave !== 1 || aura._removeBuffWhenAbilityDetached !== 1
    || component('3263765989569083658')._targetOptions.ignoreTargetFree !== 1)
    throw Error('Unreviewed Tragodia native core');
  for (const face of ['Front', 'Back']) {
    const m = evidence.models[ID][face];
    if (m.eventPayloads.Attack_1.length !== 1 || m.eventPayloads.Attack_1[0].name !== 'OnAttack'
      || m.eventPayloads.Attack_1[0].time !== .5 || m.durations.Start !== 1)
      throw Error('Unreviewed Tragodia native release');
  }
  return r;
}

export class TragodiaCoreController {
  constructor(b, u, record) {
    this.b = b; this.u = u; this.record = record; this.seq = null;
    this.phase = null; this.accepting = false; this.stopped = false; this.handles = [];
    this.auraEntries = new Map(); this.attackerReceipts = new WeakSet();
    this.t1 = flattenBlackboard(record.talents.find(t => t.prefabKey === '1')?.blackboard);
    this.t2 = flattenBlackboard(record.talents.find(t => t.prefabKey === '2')?.blackboard);
  }
  valid() { return !this.stopped && !this.b.finished && present(this.u) && this.seq === this.u.deploySeq; }
  model() { return evidence.models[ID][['UP', 'LEFT'].includes(this.u.dir) ? 'Back' : 'Front']; }
  visual(clip, speed = 1, loop = false) {
    this.u.mem.regularVisualDirection = ['UP', 'LEFT'].includes(this.u.dir) ? 'UP' : 'RIGHT';
    this.u.mem.regularFormVisual = { clip, speed, loop };
    if (this.model().durations.Die != null)
      this.u.mem.regularDeathVisual = { clip: 'Die', die: 'Die', duration: this.model().durations.Die };
    else delete this.u.mem.regularDeathVisual;
  }
  idle() { this.visual(this.skills?.idleClip() ?? 'Idle', 1, true); }
  keys() {
    return this.u.rangeKeySet ?? new Set(absoluteRangeKeys(this.u.rangeGrid,
      this.u.tileR, this.u.tileC, this.u.dir, this.u.s.rangeExtend));
  }
  targets(priority) {
    const keys = this.keys(), u = this.u;
    const out = this.b.enemies.filter(t => live(t) && canTargetEnemy(u, t, plain)
      && (!t.s.flags.camou || !!t.blockedBy) && (bodyInKeys(t, keys) || t.blockedBy === u));
    sortEnemyTargets(this.b, u, out, priority); return out.slice(0, 1);
  }
  injury(t, amount, tag, attackId, isSplash = false, isSkill = false) {
    if (!this.valid() || !live(this.u) || !live(t)) return 0;
    return this.b.dealDamage(this.u, t, { amount, type: 'element', element: 'neural',
      canDodge: false, isAttack: false, isSkill, isSplash, attackId,
      applyWay: 'ranged', tags: [`tragodia:${tag}`] });
  }
  release(t, info) {
    const { b, u, phase: p } = this;
    if (!this.accepting || !this.valid() || !live(u) || !u.canAct || u.s.flags.disarm
      || p?.kind !== 'attack' || p.epoch !== u.attackControlEpoch || p.accepted
      || p.target !== t || p.targetSeq !== t.deploySeq || !live(t)
      || !due(b, p.releaseAt) || !canTargetEnemy(u, t, plain)
      || t.s.flags.camou && !t.blockedBy) return false;
    p.accepted = true; p.info = info;
    const config = p.config ?? {};
    this.skills?.beforeStrike(t, config);
    if (!this.valid() || !live(u) || !u.canAct || u.s.flags.disarm || this.phase !== p
      || p.epoch !== u.attackControlEpoch || !live(t) || p.targetSeq !== t.deploySeq) return false;
    const atk = u.s.atk, x = t.x, y = t.y;
    const recipients = b.enemiesInRadius(x, y, config.radius ?? this.t1.range_radius, true)
      .filter(e => e !== t && live(e) && canTargetEnemy(u, e, splash))
      .map(e => ({ e, seq: e.deploySeq }));
    let accepted = false;
    const h = b.on('calculatedDamage', ctx => {
      if (ctx.source === u && ctx.target === t && ctx.dmg.type === 'arts'
        && ctx.dmg.attackId === info.attackId && ctx.dmg.tags.includes(`tragodia:${config.tag ?? 'ordinary'}`)) accepted = true;
    });
    try {
      b.dealDamage(u, t, { amount: atk * u.s.atkScaleMul * (config.scale ?? 1), type: 'arts', canDodge: true,
        isAttack: true, isSkill: !!config.isSkill, isSplash: false, applyWay: 'ranged',
        attackId: info.attackId, tags: [`tragodia:${config.tag ?? 'ordinary'}`] });
    } finally { b.off(h); }
    if (accepted && this.valid() && live(u)) {
      if (t.deploySeq === p.targetSeq) this.injury(t, atk * this.t1['attack@ep_damage_ratio'], 'primary-injury', info.attackId, false, !!config.isSkill);
      for (const { e, seq } of recipients) {
        if (!this.valid() || !live(u)) break;
        if (e.deploySeq === seq && live(e) && canTargetEnemy(u, e, splash))
          this.injury(e, atk * this.t1.ep_damage_ratio, 'splash-injury', info.attackId, true, !!config.isSkill);
      }
    }
    return true;
  }
  auraKey() { return `tragodia:${this.u.id}:neural-aspd`; }
  removeAura(e) { this.auraEntries.delete(e); this.b.removeBuff(e, this.auraKey()); }
  refreshAuras() {
    const active = this.valid() && live(this.u) && this.t2.attack_speed != null;
    for (const [e, seq] of this.auraEntries)
      if (!active || !live(e) || e.deploySeq !== seq || !neuralBurst(e)) this.removeAura(e);
    if (!active) return;
    for (const e of this.b.enemies) if (live(e) && neuralBurst(e) && !this.auraEntries.has(e)) {
      if (!this.valid() || !live(this.u)) return;
      const seq = e.deploySeq; this.auraEntries.set(e, seq);
      const applied = this.b.addBuff(e, { key: this.auraKey(), source: this.u,
        mods: { aspd: -Math.abs(this.t2.attack_speed) },
        onRemove: () => { if (this.auraEntries.get(e) === seq) this.auraEntries.delete(e); } });
      // Modifier hooks can retire the producer or the recipient synchronously.
      if (!applied || !this.valid() || !live(this.u) || !live(e) || e.deploySeq !== seq || !neuralBurst(e))
        this.removeAura(e);
    }
  }
  beforeEnemyAttack(ctx) {
    const e = ctx.attacker;
    if (this.attackerReceipts.has(ctx) || !this.valid() || !live(this.u) || this.t2.value == null
      || ctx.isSkill || e?.side !== 'enemy' || !live(e) || !e.canAct || e.s.flags.disarm
      || ctx.profile?.ignorePalsyInterrupt || !ctx.targets?.some(t => live(t))
      || !bodyInKeys(e, this.keys())) return;
    this.attackerReceipts.add(ctx);
    this.injury(e, this.t2.value, 'enemy-attack-injury', 0);
    this.refreshAuras();
  }
  tickAttack() {
    const { b, u } = this;
    if (!this.valid()) { this.phase = null; return; }
    let p = this.phase;
    if (p?.kind === 'born') { if (!due(b, p.readyAt)) return; this.phase = null; p = null; }
    if (!live(u) || !u.canAct || u.s.flags.disarm || p && p.epoch !== u.attackControlEpoch) {
      this.phase = null; this.skills?.cancelVolley(); this.idle(); return;
    }
    if (p) {
      if (!p.released && due(b, p.releaseAt)) {
        p.released = true;
        if (live(p.target) && p.target.deploySeq === p.targetSeq) {
          this.accepting = true;
          try { b.forceAttack(u, [p.target]); } finally { this.accepting = false; }
        }
      }
      if (p.info && p.config?.secondGap && !p.secondReleased && due(b, p.releaseAt + p.config.secondGap)) {
        p.secondReleased = true; p.accepted = false;
        this.accepting = true;
        try { this.release(p.target, p.info); } finally { this.accepting = false; }
      }
      if (p.config?.secondGap && (p.secondReleased || p.released && !p.info)) this.skills?.finishVolley();
      if (!this.valid() || this.phase !== p || !due(b, p.readyAt)) return;
      this.phase = null;
    }
    if (u.atkCd > 1e-9) return;
    this.skills?.beforeAcquire();
    const config = this.skills?.attackSpec() ?? {};
    const target = this.targets(config.priority)[0];
    if (!target) { this.idle(); return; }
    const speed = Math.min(1, u.base.bat / u.s.interval), m = this.model(), clip = config.clip ?? 'Attack_1';
    const windup = config.preDelay ?? m.eventPayloads[clip][0].time / speed;
    const cadence = Math.max(windup + (config.secondGap ?? 0), u.s.interval);
    this.phase = { kind: 'attack', config, startedAt: b.time, target, targetSeq: target.deploySeq,
      epoch: u.attackControlEpoch, accepted: false, released: false,
      releaseAt: b.time + windup, readyAt: b.time + cadence };
    this.visual(clip, speed); u.atkCd = cadence;
  }
  install() {
    if (this.stopped || this.handles.length) throw Error('Tragodia core cannot be installed twice or after retirement');
    const { b, u } = this;
    this.handles = [b.on('deploy', ({ unit, move }) => {
      if (unit === u && !move) {
        this.seq = u.deploySeq;
        this.phase = { kind: 'born', readyAt: b.time + this.model().durations.Start };
        this.visual('Start'); this.refreshAuras();
      }
    }, { owner: u }), b.on('tick', () => {
      if (this.stopped || b.finished || this.seq !== null && !this.valid()) { this.stop(); return; }
      this.refreshAuras(); this.skills?.tick(); this.tickAttack();
    }, { owner: u }), b.on('beforeAttack', ctx => this.beforeEnemyAttack(ctx), { owner: u }),
    b.on('elementBurst', ({ target, element }) => {
      if (element === 'neural' && target.side === 'enemy') this.refreshAuras();
    }, { owner: u }), b.on('death', ({ unit }) => {
      if (unit === u) this.stop(); else this.removeAura(unit);
    }, { owner: u }), b.on('battleEnd', () => this.stop())];
  }
  stop() {
    if (this.stopped) return;
    this.stopped = true; this.skills?.stop(); this.phase = null; this.accepting = false;
    for (const e of [...this.auraEntries.keys()]) this.removeAura(e);
    this.u.mem.regularFormVisual = null; delete this.u.mem.regularVisualDirection;
    for (const h of this.handles) this.b.off(h); this.handles = [];
  }
}

export function prepareTragodiaCore(b, u, { contract } = {}) {
  const record = validate(u, contract), controller = new TragodiaCoreController(b, u, record);
  u.mem.tragodiaController = controller;
  const trait = { noAttack: true, attackDrivenSkill: true, attack: 'ranged', projectile: 'none', dmgType: 'arts',
    canHitFly: true, maxTargets: 1, maxTargetsByBlock: false, hitAllBlocked: false,
    allInRange: false, rangeAoe: false, hits: 1, hitsFn: null, chain: null, splashRadius: 0, heal: null,
    onHit: null, onEachHit: null, install: null, requiresAcceptedLaunch: true, attackVisual: 'none',
    launchAttack: (_b, _u, _p, target, info) => controller.release(target, info) };
  return { record, controller, kit: { trait, talents: [], install: null,
    skill: { kind: 'instant', trigger: { rule: 'NEVER' }, canActivate: () => false } } };
}
