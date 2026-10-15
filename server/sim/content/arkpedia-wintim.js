// SPDX-License-Identifier: GPL-3.0-or-later
import e from '../../../data/arkpedia-native-operators/char_4208_wintim.json' with { type: 'json' };
import { WINTIM_ID as ID, selectedWintimBuild, wintimComponent as component } from './arkpedia-wintim-source.js';
import { normalizeChess, normSpType } from '../simdata.js';
import { absoluteRangeKeys, canTargetEnemy, sortEnemyTargets } from '../targeting.js';
import { bodyInKeys } from '../body.js';
export const WINTIM_CONTRACT = Object.freeze({
  scope: 'Selected original CN ordinary melee/ranged physical attacks, damage-lost ASPD talent and all twenty S1/S2 ranks',
  mapping: 'Ordinary and S2 attacks prefer blocked enemies, otherwise one source-range input including air. Melee uses the original Combat ability; S1 always emits its native speed-ten projectile. S1 grants three DP on activation, retains that grant if the captured input dies, and refunds its consumed offensive-SP charge on dead input before release. S2 is nine seconds of ASPD and one-second Sluggish; its unfiltered output-damage buff grants DP for accepted HP-damage output while active, including shield-absorbed zero loss, excluding HPLOSS and elemental gauge fill. Talent is lost once per deployment on actual HP damage, not HPLOSS or a shielded hit.',
  limits: 'Numeric selector/event aliases, sampled mode/FSM ordering, damage output bridge, phase cancellation, launch ATK snapshot, tile-center projectile origin and active-at-impact dispatch are explicit simulator mappings, not recovered compiled Unity proof. S2 duration includes its native Begin gate; mode changes cancel unfired phases and retain cooldown. Target-facing uses the shared renderer direction convention while deployment range stays fixed. Launched projectiles retain source credit/slow after expiry or owner removal; current target-selection flags are rechecked at impact. DP updates the common counter; S2 forced floating-number presentation is unsupported. Native particles, audio, modules and game-frame/pixel parity remain held.',
  gameplayCorroboration: 'https://prts.wiki/w/%E5%86%AC%E6%97%B6', frameParity: false,
});
const present = a => a?.alive && a.deployed && !a._removing;
const live = a => present(a) && !a.hidden;
const due = (b, at) => b.time + 1e-8 >= at;
const same = (a, z) => JSON.stringify(a) === JSON.stringify(z);
const profile = Object.freeze({ canHitFly: true });
const isHpDamage = ctx => ctx.type !== 'element' && ctx.dmg && !ctx.dmg.tags.includes('hpLoss');
function selected(u, contract) {
  if (contract !== WINTIM_CONTRACT) throw Error('Snegurochka requires its selected native source contract');
  if (u.def.charId !== ID || u.deploySeq !== 0 || u.mem.wintim) throw Error('Snegurochka requires a fresh original owner');
  const build = { ...u.def.raw.arkpedia, skillId: u.def.skill?.id }, r = selectedWintimBuild(build), s = u.def.skill;
  if (u.def.raw.arkpedia.skillId != null && u.def.raw.arkpedia.skillId !== build.skillId || s.skillType !== r.source.skillType
    || s.durationType !== r.source.durationType || s.spType !== normSpType(r.source.spData.spType)
    || s.spCost !== r.source.spData.spCost || s.initSp !== r.source.spData.initSp || s.maxCharges !== r.source.spData.maxChargeTime
    || s.duration !== r.source.duration || !same(s.bb, r.bb) || !same(s.rangeGrid ?? [], r.skillRangeGrid)
    || !same(u.rangeGrid, r.rangeGrid) || !same(u.def.stats, normalizeChess({ stats: r.stats }).stats)
    || !same(u.def.tags, r.tags) || !same(u.def.talents.map(t => t.bb), r.talentBb)) throw Error('Incomplete Snegurochka selected source');
  for (const [id, clip, projectile, scale] of [['733469241643020047', 'Attack', 'projectile_chr_wintim', -1],
    ['-7138488055286428150', 'Skill_1', 'projectile_chr_wintim_s1', 1], ['2155664795980377871', 'Skill_2_Loop', 'projectile_chr_wintim_s2', 1]]) {
    const a = component(id);
    if (a._projectileKey !== projectile || a._animKey !== clip || a._maxAnimScale !== scale
      || a._waitForAttackEvent !== 1 || a._selectTargetTiming !== 0 || a._allowNoTarget !== 0 || a._damageType !== 1)
      throw Error('Unreviewed Snegurochka native attack');
  }
  if (component('-6405844080858067446')._recoverSpIfTargetDead !== 1
    || component('-8871476108691993078')._runActionOnEvent !== 2
    || component('-7319671354103259603')._beginAnim !== 'Skill_2_Begin'
    || component('-7319671354103259603')._allowSpRecoveryWhenAffecting !== 0
    || component('-6405844080858067446')._canSilenced !== 0
    || component('-7319671354103259603')._canSilenced !== 0) throw Error('Unreviewed Snegurochka skill controller');
  for (const rows of Object.values(e.projectiles)) {
    const parts = rows.flatMap(r => r.components.map(p => p.data));
    if (parts.find(p => '_speed' in p)?._speed !== 10 || parts.find(p => '_lifeTime' in p)?._lifeTime !== 10
      || parts.find(p => '_stopWhenSourceInvalid' in p)?._stopWhenSourceInvalid !== 0)
      throw Error('Unreviewed Snegurochka projectile transport');
  }
  return r;
}
export class WintimController {
  constructor(b, u, record) {
    this.b = b; this.u = u; this.record = record; this.seq = null; this.phase = null;
    this.stopped = false; this.accepting = false; this.talentLost = false; this.visualSeq = 0; this.handles = []; this.facing = u.dir;
  }
  valid() { return !this.stopped && !this.b.finished && present(this.u) && this.seq === this.u.deploySeq; }
  s2() { return this.record.index === 1 && this.u.skill.active; }
  eligible(t) { return t?.side === 'enemy' && canTargetEnemy(this.u, t, profile) && (!t.s.flags.camou || t.blockedBy); }
  targets() {
    const keys = new Set(absoluteRangeKeys(this.record.rangeGrid, this.u.tileR, this.u.tileC, this.u.dir));
    const targets = this.b.enemies.filter(t => this.eligible(t) && (t.blockedBy === this.u || bodyInKeys(t, keys)));
    const blocked = targets.filter(t => t.blockedBy === this.u);
    return (blocked.length ? sortEnemyTargets(this.b, this.u, blocked) : sortEnemyTargets(this.b, this.u, targets)).slice(0, 1);
  }
  model() { return e.models[ID][this.facing === 'UP' ? 'Back' : 'Front']; }
  visual(clip, speed = 1, loop = false) {
    this.u.mem.regularFormVisual = { clip, speed, loop,
      ...(!loop ? { playId: `wintim:${this.u.deploySeq}:${++this.visualSeq}` } : {}) };
    this.u.mem.regularVisualDirection = this.facing;
  }
  idle() { this.visual(this.s2() ? 'Skill_2_Idle' : 'Idle', 1, true); }
  canCast() { return this.valid() && live(this.u) && this.u.canAct && !this.u.s.flags.disarm && !this.u.skill.active
    && (this.record.index === 1 || !this.phase && this.u.atkCd <= 1e-9 && this.targets().length > 0); }
  start() {
    if (this.record.index === 0) { this.b.addDp(this.u.ownerId, this.record.bb.cost); return; }
    // Native mode/FSM restart is modeled by an explicit Begin gate and a
    // retained cooldown; the serialized attachment flags do not prove all
    // compiled concurrent-ability dispatch details.
    this.phase = { kind: 'begin', readyAt: this.b.time + this.model().durations.Skill_2_Begin };
    this.visual('Skill_2_Begin');
  }
  end() {
    if (this.stopped || !present(this.u)) return;
    if (this.record.index === 1) { this.phase = null; this.idle(); }
  }
  admissible(targets) {
    const p = this.phase;
    return this.accepting && this.valid() && live(this.u) && this.u.canAct && !this.u.s.flags.disarm
      && p?.kind === 'attack' && !p.accepted && p.epoch === this.u.attackControlEpoch && due(this.b, p.releaseAt)
      && targets.length === 1 && targets[0] === p.target && p.target.deploySeq === p.targetSeq && this.eligible(p.target);
  }
  release(targets, info) {
    if (!this.admissible(targets)) return false;
    const { b, u, record: r } = this, p = this.phase, target = p.target, seq = p.targetSeq;
    p.accepted = true;
    const power = u.s.atk * u.s.atkScaleMul * (p.s1 ? r.bb.atk_scale : 1), slow = p.s2 ? r.bb['attack@sluggish'] : 0;
    const impact = t => {
      if (b.finished || !t || t.deploySeq !== seq || !this.eligible(t)) return;
      // Source active-buff is isDamageMissable=0; mitigation and physical
      // dodge do not suppress the separate Sluggish attachment.
      if (slow) b.applyStatus(t, 'sluggish', { duration: slow, source: u });
      b.dealDamage(u, t, { amount: power, type: 'phys', isAttack: true, isSkill: p.s1 || p.s2,
        attackId: info.attackId, applyWay: p.projectile ? 'ranged' : 'melee', tags: ['wintim:attack', p.s1 ? 'wintim:s1' : p.s2 ? 'wintim:s2' : 'wintim:ordinary'] });
    };
    if (p.projectile) b.addProjectile({ from: u, target, source: u, speed: 10, maxAge: 10,
      visual: 'arrow', data: { arkpediaTrackedVisual: true, wintim: true, skill: p.s1 || p.s2 }, onHit: ({ target }) => impact(target) });
    else impact(target);
    return true;
  }
  finishS1(p) {
    if (!p.s1 || !this.u.skill.active) return;
    const refund = !p.accepted && (!present(p.target) || p.target.deploySeq !== p.targetSeq);
    this.u.skill.end(refund ? 'dead-input-refund' : 'attack-finished');
    if (refund && this.valid()) this.u.skill.setSpTotal(this.u.skill.spTotal + this.u.skill.spCost);
  }
  tick() {
    if (!this.valid()) return;
    const { b, u } = this;
    let p = this.phase;
    if (p?.kind === 'born' || p?.kind === 'begin') { if (!due(b, p.readyAt)) return; this.phase = p = null; }
    if (!live(u) || !u.canAct || u.s.flags.disarm || p && p.epoch !== u.attackControlEpoch) {
      this.phase = null; if (this.record.index === 0 && u.skill.active) u.skill.end('interrupted'); this.idle(); return;
    }
    if (p) {
      if (!p.released && due(b, p.releaseAt)) {
        p.released = true; this.accepting = true;
        try { if (this.eligible(p.target) && p.target.deploySeq === p.targetSeq) b.forceAttack(u, [p.target]); }
        finally { this.accepting = false; }
        this.finishS1(p);
      }
      if (!this.valid() || this.phase !== p || !due(b, p.readyAt)) return;
      this.phase = null;
    }
    if (u.atkCd > 1e-9) return;
    const target = this.targets()[0]; if (!target) { this.idle(); return; }
    if (this.record.index === 0 && u.skill.ready && this.canCast()) u.skill.activate('DEFAULT');
    if (!this.valid() || !live(u) || !u.canAct || u.s.flags.disarm) return;
    const s1 = this.record.index === 0 && u.skill.active, s2 = this.s2(), melee = target.blockedBy === u;
    // Native abilities request faceToTarget=1 and faceToDefault=0. Preserve
    // the deployment/range direction while the actor tracks its attack input.
    const dx = target.x - u.x, dy = target.y - u.y;
    if (Math.hypot(dx, dy) > 1e-8) this.facing = Math.abs(dy) > Math.abs(dx)
      ? dy > 0 ? 'UP' : 'DOWN' : dx < 0 ? 'LEFT' : 'RIGHT';
    const clip = s1 ? 'Skill_1' : s2 ? 'Skill_2_Loop' : melee ? 'Combat' : 'Attack';
    const speed = s1 || s2 ? Math.min(1, u.base.bat / u.s.interval) : u.base.bat / u.s.interval;
    const delay = this.model().eventPayloads[clip].find(ev => ev.name === 'OnAttack').time / speed;
    const cadence = Math.max(delay, u.s.interval);
    this.phase = { kind: 'attack', startedAt: b.time, target, targetSeq: target.deploySeq, s1, s2,
      projectile: s1 || !melee, epoch: u.attackControlEpoch, accepted: false,
      releaseAt: b.time + delay, readyAt: b.time + cadence };
    u.atkCd = cadence; this.visual(clip, speed);
  }
  install() {
    if (this.handles.length || this.stopped) throw Error('Snegurochka cannot be reinstalled');
    const { b, u } = this;
    this.handles = [b.on('deploy', ({ unit, move }) => {
      if (unit !== u || move) return;
      this.seq = u.deploySeq; this.phase = { kind: 'born', readyAt: b.time + this.model().durations.Start };
      this.visual('Start'); const aspd = this.record.talentBb[0]?.attack_speed ?? 0;
      if (aspd) b.addBuff(u, { key: 'wintim:talent', source: u, mods: { aspd } });
    }, { owner: u }), b.on('damaged', ctx => {
      if (!this.valid() || !isHpDamage(ctx)) return;
      if (ctx.target === u && ctx.hpLoss > 0 && !this.talentLost) {
        this.talentLost = true; b.removeBuff(u, 'wintim:talent');
      }
      // No native IsAttack/side/type filter: retain accepted HP output while
      // the S2 owner buff is active, including fully absorbed damage.
      if (ctx.source === u && live(u) && this.s2()) b.addDp(u.ownerId, this.record.bb.cost);
    }, { owner: u }), b.on('tick', () => {
      if (this.stopped || b.finished || this.seq !== null && !this.valid()) this.stop(); else this.tick();
    }, { owner: u }), b.on('death', ({ unit }) => { if (unit === u) this.stop(); }, { owner: u }),
    b.on('battleEnd', () => this.stop())];
  }
  stop() {
    if (this.stopped) return;
    this.stopped = true; this.phase = null; this.accepting = false;
    for (const h of this.handles) this.b.off(h);
    this.handles = []; this.b.removeBuff(this.u, 'wintim:talent');
    delete this.u.mem.regularFormVisual; delete this.u.mem.regularVisualDirection;
  }
  spec() {
    return this.record.index === 0 ? { kind: 'instant', silenceable: false, trigger: { rule: 'NEVER' }, flags: { noSp: true },
      attack: {}, completeOnAttack: false, canActivate: () => this.canCast(), onStart: () => this.start() }
      : { kind: 'duration', duration: this.record.source.duration, silenceable: false, trigger: { rule: 'NEVER' },
        attack: {}, mods: { aspd: this.record.bb.attack_speed }, canActivate: () => this.canCast(),
        onStart: () => this.start(), onEnd: () => this.end() };
  }
}
export function prepareWintim(b, u, { contract } = {}) {
  const record = selected(u, contract), controller = new WintimController(b, u, record);
  u.mem.wintim = controller;
  return { record, controller, kit: { talents: [], install: null,
    trait: { noAttack: true, attackDrivenSkill: true, attack: 'ranged', projectile: 'none', dmgType: 'none',
      canHitFly: true, heal: null, splashRadius: 0, chain: null, windup: 0, attackVisual: 'none',
      requiresAcceptedLaunch: true, acceptAreaAttack: (_b, _u, _p, targets) => controller.admissible(targets),
      launchAreaAttack: (_b, _u, _p, targets, info) => controller.release(targets, info) }, skill: controller.spec() } };
}
