// SPDX-License-Identifier: GPL-3.0-or-later
import e from '../../../data/arkpedia-akkord-prefabs.json' with { type: 'json' };
import { AKKORD_ID as ID, selectedAkkordBuild, akkordComponent as component } from './arkpedia-akkord-source.js';
import { normalizeChess, normSpType } from '../simdata.js';
import { absoluteRangeKeys, canTargetEnemy } from '../targeting.js';
import { bodyInKeys, bodyInRadius } from '../body.js';

export const AKKORD_CONTRACT = Object.freeze({
  scope: 'Original CN ordinary line Arts attack, conditional ATK talent and all twenty S1/S2 ranks; no modules',
  mapping: 'Enemy input is required at windup start; all current line targets are selected at the native OnAttack event. S1 consumes one of two time-SP charges. A release with no current targets refunds the charge only when every starting input has died or retired. S2 retains cooldown, switches attack/idle mode, adds ATK and creates one radius-0.9 normal Arts burst at every other normal-profession ally in the source line, including isolated allies. Overlapping bursts are independent damage instances of one attack account.',
  limits: 'Numeric selector aliases, frame-quantized controller ordering, release-time ATK snapshot, empty-release/refund and reentrant damage ordering are explicit simulator policies, not recovered compiled Unity dispatch. Enemy camouflage is excluded for ordinary selection but not the purpose-NONE area bursts; stealth/TargetFree remain respected. Source mode hooks request only the S2 idle replacement: no speculative Begin/End clips are played. Allied target-free/isolation flags are ignored by the native ally masks. Native SpriteRenderer/Rigidbody2D, particles, audio, modules, pixel and frame parity remain held.',
  gameplayCorroboration: 'https://prts.wiki/w/%E5%8D%8F%E5%BE%8B', frameParity: false,
});
const present = a => a?.alive && a.deployed && !a._removing;
const live = a => present(a) && !a.hidden;
const due = (b, at) => b.time + 1e-8 >= at;
const same = (a, z) => JSON.stringify(a) === JSON.stringify(z);
const professions = new Set(['WARRIOR', 'SNIPER', 'TANK', 'MEDIC', 'SUPPORT', 'CASTER', 'SPECIAL', 'PIONEER']);
const enemyProfile = Object.freeze({ canHitFly: true });
function selected(u, contract) {
  if (contract !== AKKORD_CONTRACT) throw Error('Akkord requires its selected source contract');
  if (u.def.charId !== ID || u.deploySeq !== 0 || u.mem.akkord) throw Error('Akkord requires a fresh original owner');
  const build = { ...u.def.raw.arkpedia, skillId: u.def.skill?.id }, r = selectedAkkordBuild(build), s = u.def.skill;
  if (u.def.raw.arkpedia.skillId != null && u.def.raw.arkpedia.skillId !== build.skillId || s.skillType !== r.source.skillType
    || s.durationType !== r.source.durationType || s.spType !== normSpType(r.source.spData.spType)
    || s.spCost !== r.source.spData.spCost || s.initSp !== r.source.spData.initSp
    || s.maxCharges !== r.source.spData.maxChargeTime || s.duration !== r.source.duration
    || !same(s.bb, r.bb) || !same(s.rangeGrid ?? [], []) || !same(u.rangeGrid, r.rangeGrid)
    || !same(u.def.stats, normalizeChess({ stats: r.stats }).stats) || !same(u.def.tags, r.tags)
    || !same(u.def.talents.map(t => t.bb), r.talentBb)) throw Error('Incomplete Akkord selected source');
  for (const id of ['-2710573998192986397', '-8239614100359022877', '540486838715167199']) {
    const a = component(id);
    if (a._damageType !== 2 || a._attackType !== 1 || a._waitForAttackEvent !== 1 || a._allowNoTarget !== 1
      || a._selectTargetTiming !== 1 || a._maxAnimScale !== 1 || a._ignoreIfOwnerDead !== 0)
      throw Error('Unreviewed Akkord attack ability');
  }
  for (const id of ['-6483668354255539745', '2696961248790865664'])
    if (component(id)._canSilenced !== 0 || component(id)._allowSpRecoveryWhenAffecting !== 0)
      throw Error('Unreviewed Akkord skill controller');
  if (component('-5367030229723908381')._targetOptions.professionMask !== 639
    || component('-5367030229723908381')._targetOptions.ignoreAllyTargetFree !== 1
    || component('-6483668354255539745')._recoverSpIfTargetDead !== 1)
    throw Error('Unreviewed Akkord ally/refund mask');
  return r;
}

export class AkkordController {
  constructor(b, u, record) {
    this.b = b; this.u = u; this.record = record; this.phase = null; this.seq = null;
    this.stopped = false; this.accepting = false; this.visualSeq = 0; this.handles = [];
  }
  valid() { return !this.stopped && !this.b.finished && present(this.u) && this.seq === this.u.deploySeq; }
  s2() { return this.record.index === 1 && this.u.skill.active; }
  keys() { return new Set(absoluteRangeKeys(this.record.rangeGrid, this.u.tileR, this.u.tileC, this.u.dir)); }
  allies() {
    const keys = this.keys();
    // Native profession mask 639 deliberately omits TOKEN/TRAP; do not use the
    // shared isolated-ally filter because this selector explicitly ignores it.
    return this.b.allyUnits.filter(a => a !== this.u && live(a) && a.side === 'ally'
      && professions.has(a.def.profession) && bodyInKeys(a, keys));
  }
  targets() {
    const keys = this.keys();
    return this.b.enemies.filter(t => canTargetEnemy(this.u, t, enemyProfile)
      && (!t.s.flags.camou || t.blockedBy) && bodyInKeys(t, keys));
  }
  syncTalent() {
    const key = 'akkord:talent', amount = this.record.talentBb[0]?.atk ?? 0;
    const applies = this.valid() && live(this.u) && amount > 0 && this.allies().length > 0;
    if (!applies) this.b.removeBuff(this.u, key);
    else if (!this.u.findBuff(key)) this.b.addBuff(this.u, { key, source: this.u, mods: { atkPct: amount } });
  }
  model() { return e.models[ID][['UP', 'LEFT'].includes(this.u.dir) ? 'Back' : 'Front']; }
  visual(clip, speed = 1, loop = false) {
    this.u.mem.regularFormVisual = { clip, speed, loop,
      ...(!loop ? { playId: `akkord:${this.u.deploySeq}:${++this.visualSeq}` } : {}) };
    this.u.mem.regularVisualDirection = ['UP', 'LEFT'].includes(this.u.dir) ? 'UP' : 'RIGHT';
  }
  idle() { this.visual(this.s2() ? 'Skill_2_Idle' : 'Idle', 1, true); }
  canCast() { return this.valid() && live(this.u) && this.u.canAct && !this.u.s.flags.disarm
    && !this.u.skill.active && (this.record.index === 1 || !this.phase && this.u.atkCd <= 1e-9 && this.targets().length > 0); }
  switchMode() {
    if (this.stopped || !present(this.u)) return;
    // Original mode switch detaches the pending ability but does not reset CD.
    if (this.phase?.kind === 'attack') this.phase = null;
    if (this.phase?.kind !== 'born') this.idle();
  }
  admissible() {
    const p = this.phase, u = this.u;
    return this.accepting && this.valid() && live(u) && u.canAct && !u.s.flags.disarm
      && p?.kind === 'attack' && !p.accepted && p.epoch === u.attackControlEpoch
      && p.s2 === this.s2() && due(this.b, p.releaseAt);
  }
  release(targets, info) {
    if (!this.admissible()) return false;
    const { b, u, record: r } = this, p = this.phase;
    p.accepted = true; this.syncTalent();
    const power = u.s.atk * u.s.atkScaleMul, scale = p.s1 ? r.bb.atk_scale : 1;
    const allies = p.s2 ? this.allies().map(a => ({ unit: a, seq: a.deploySeq, x: a.x, y: a.y })) : [];
    const keys = this.keys();
    const hits = targets.filter(target => target.side === 'enemy' && canTargetEnemy(u, target, enemyProfile)
      && (!target.s.flags.camou || target.blockedBy) && bodyInKeys(target, keys))
      .map(target => ({ target, seq: target.deploySeq }));
    const hit = (target, amount, tag) => b.dealDamage(u, target, { amount, type: 'arts', isAttack: true,
      isSkill: p.s1 || p.s2, attackId: info.attackId, tags: ['akkord:attack', tag] });
    // One accepted native area receipt; never recursively forceAttack for an
    // ally-centered burst. The accepted main batch retains its source credit.
    for (const { target, seq } of hits) if (live(target) && target.deploySeq === seq)
      hit(target, power * scale, 'akkord:line');
    for (const point of allies) {
      if (!this.valid() || !live(u) || !this.s2()) break;
      if (!live(point.unit) || point.unit.deploySeq !== point.seq) continue;
      const enemies = b.enemies.filter(t => canTargetEnemy(u, t, enemyProfile)
        && bodyInRadius(t, point.x, point.y, r.bb['attack@range_radius'])).map(target => ({ target, seq: target.deploySeq }));
      for (const { target, seq } of enemies) if (live(target) && target.deploySeq === seq)
        hit(target, power * r.bb['attack@aoe_atk_scale'], 'akkord:burst');
    }
    return true;
  }
  finishS1(p, targets) {
    if (!p.s1 || !this.u.skill.active) return;
    const refund = p.accepted && targets.length === 0 && p.inputs.every(({ unit, seq }) => !present(unit) || unit.deploySeq !== seq);
    this.u.skill.end(refund ? 'dead-input-refund' : 'attack-finished');
    if (refund && this.valid()) this.u.skill.setSpTotal(this.u.skill.spTotal + this.u.skill.spCost);
  }
  tick() {
    if (!this.valid()) return;
    this.syncTalent();
    const { b, u } = this;
    let p = this.phase;
    if (p?.kind === 'born') { if (!due(b, p.readyAt)) return; this.phase = p = null; }
    if (!live(u) || !u.canAct || u.s.flags.disarm || p && p.epoch !== u.attackControlEpoch) {
      this.phase = null;
      if (this.record.index === 0 && u.skill.active) u.skill.end('interrupted');
      this.idle(); return;
    }
    if (p) {
      if (!p.released && due(b, p.releaseAt)) {
        p.released = true;
        const targets = this.targets(); this.accepting = true;
        try { b.forceAttack(u, targets, { allowEmpty: targets.length === 0 }); }
        finally { this.accepting = false; }
        this.finishS1(p, targets);
      }
      if (!this.valid() || this.phase !== p || !due(b, p.readyAt)) return;
      this.phase = null;
    }
    if (u.atkCd > 1e-9) return;
    const targets = this.targets();
    if (!targets.length) { this.idle(); return; }
    if (this.record.index === 0 && u.skill.ready && this.canCast()) u.skill.activate('DEFAULT');
    const s1 = this.record.index === 0 && u.skill.active, s2 = this.s2();
    const clip = s2 ? (u.dir === 'DOWN' ? 'Skill_Down_2_Loop' : 'Skill_2_Loop')
      : u.dir === 'DOWN' ? 'Attack_Down' : 'Attack';
    const speed = Math.min(1, u.base.bat / u.s.interval);
    const release = this.model().eventPayloads[clip].find(ev => ev.name === 'OnAttack').time / speed;
    const cadence = Math.max(release, u.s.interval);
    this.phase = { kind: 'attack', startedAt: b.time, s1, s2, accepted: false,
      inputs: targets.map(unit => ({ unit, seq: unit.deploySeq })), epoch: u.attackControlEpoch,
      releaseAt: b.time + release, readyAt: b.time + cadence };
    u.atkCd = cadence; this.visual(clip, speed);
  }
  spec() {
    return this.record.index === 0 ? { kind: 'instant', silenceable: false, trigger: { rule: 'NEVER' },
      flags: { noSp: true }, attack: {}, completeOnAttack: false, canActivate: () => this.canCast() }
      : { kind: 'duration', silenceable: false, trigger: { rule: 'NEVER' }, attack: {},
        mods: { atkPct: this.record.bb.atk }, canActivate: () => this.canCast(),
        onStart: () => this.switchMode(), onEnd: () => this.switchMode() };
  }
  install() {
    if (this.handles.length || this.stopped) throw Error('Akkord cannot be reinstalled');
    const { b, u } = this;
    this.handles = [b.on('deploy', ({ unit, move }) => {
      if (unit !== u || move) return;
      this.seq = u.deploySeq; this.phase = { kind: 'born', readyAt: b.time + this.model().durations.Start };
      this.visual('Start'); this.syncTalent();
    }, { owner: u }), b.on('tick', () => {
      if (this.stopped || b.finished || this.seq !== null && !this.valid()) this.stop(); else this.tick();
    }, { owner: u }), b.on('death', ({ unit }) => { if (unit === u) this.stop(); }, { owner: u }),
    b.on('battleEnd', () => this.stop())];
  }
  stop() {
    if (this.stopped) return;
    this.stopped = true; this.phase = null; this.accepting = false;
    for (const h of this.handles) this.b.off(h);
    this.handles = []; this.b.removeBuff(this.u, 'akkord:talent');
    delete this.u.mem.regularFormVisual; delete this.u.mem.regularVisualDirection;
  }
}
export function prepareAkkord(b, u, { contract } = {}) {
  const record = selected(u, contract), controller = new AkkordController(b, u, record);
  u.mem.akkord = controller;
  return { record, controller, kit: { talents: [], install: null,
    trait: { noAttack: true, attackDrivenSkill: true, attack: 'ranged', projectile: 'none', dmgType: 'none',
      rangeAoe: false, heal: null, splashRadius: 0, chain: null, windup: 0, attackVisual: 'none',
      requiresAcceptedLaunch: true, acceptAreaAttack: () => controller.admissible(),
      launchAreaAttack: (_b, _u, _p, targets, info) => controller.release(targets, info) }, skill: controller.spec() } };
}
