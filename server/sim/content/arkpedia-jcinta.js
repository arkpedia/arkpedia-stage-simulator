// SPDX-License-Identifier: GPL-3.0-or-later
// Selected-source contract. Public registration and approval remain separate.
import e from '../../../data/arkpedia-native-operators/char_4237_jcinta.json' with { type: 'json' };
import { JCINTA_ID as ID, selectedJcintaBuild, jcintaComponent as component } from './arkpedia-jcinta-source.js';
import { normalizeChess, normSpType } from '../simdata.js';
import { absoluteRangeKeys, canTargetEnemy, sortEnemyTargets } from '../targeting.js';
import { bodyInKeys } from '../body.js';
export const JCINTA_CONTRACT = Object.freeze({
  scope: 'Selected original CN normal attacks, owned flying-source Sanctuary and both source skills at all twenty ranks',
  mapping: 'S1 follows the explicit character override skchr_jcinta_1 despite its shared rank prefab being null. Both channels stop attacks and set block count to zero. DP waits each original blackboard interval; S2 continuously heals the lowest-HP eligible ally and expands/scales its owned aerial Sanctuary.',
  limits: 'Selector aliases, tick-sampled aura/heal selection, source motion via the local isFlying convention, animation/FSM ordering and timing are explicit simulator policies. The local damage receipt has one credited projectile owner, not an independent recovered Unity PROJECTILE_SOURCE pointer. Native particles, audio, modules and original game-frame/pixel parity remain unsupported.',
  frameParity: false,
});
const present = a => a?.alive && a.deployed && !a._removing;
const live = a => present(a) && !a.hidden;
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const due = (b, at) => b.time + 1e-8 >= at;
function selected(u, contract) {
  if (contract !== JCINTA_CONTRACT) throw Error('Jacinta requires its selected native source contract');
  if (u.def.charId !== ID || u.deploySeq !== 0 || u.mem.jcinta) throw Error('Jacinta requires a fresh original owner');
  const build = { ...u.def.raw.arkpedia, skillId: u.def.skill?.id }, r = selectedJcintaBuild(build), s = u.def.skill;
  if (u.def.raw.arkpedia.skillId != null && u.def.raw.arkpedia.skillId !== build.skillId
    || s.skillType !== r.source.skillType || s.durationType !== r.source.durationType
    || s.spType !== normSpType(r.source.spData.spType) || s.spCost !== r.source.spData.spCost || s.initSp !== r.source.spData.initSp
    || s.duration !== r.source.duration || s.maxCharges !== r.source.spData.maxChargeTime || !same(s.bb, r.bb)
    || !same(s.rangeGrid ?? [], r.skillRangeGrid) || !same(u.rangeGrid, r.rangeGrid)
    || !same(u.def.stats, normalizeChess({ stats: r.stats }).stats) || !same(u.def.tags, r.tags)
    || !same(u.def.talents.map(t => t.bb), r.talentBb)) throw Error('Incomplete Jacinta selected source');
  const attack = component('5882382451570297162'), heal = component('8039878411083565386');
  if (attack._animKey !== 'Attack' || attack._maxAnimScale !== -1 || attack._waitForAttackEvent !== 1
    || heal._isCont !== 1 || heal._preDelay !== 0 || heal._affectedBySlowDown !== 0
    || !same(e.skillPrefabOverrides, { 'skcom_assist_cost[3]': 'skchr_jcinta_1' })
    || !same(e.skillBindings['skcom_assist_cost[3]'], [null]) || e.ownerModeSkills.length)
    throw Error('Unreviewed Jacinta native attack/heal/override');
  return r;
}
export class JcintaController {
  constructor(b, u, record) {
    this.b = b; this.u = u; this.record = record; this.seq = null; this.phase = null;
    this.stopped = false; this.accepting = false; this.visualSeq = 0; this.facing = u.dir; this.handles = [];
    this.recipients = new Set(); this.elapsed = 0; this.granted = 0;
  }
  valid() { return !this.stopped && !this.b.finished && present(this.u) && this.seq === this.u.deploySeq; }
  model() { return e.models[ID][this.facing === 'UP' ? 'Back' : 'Front']; }
  visual(clip, loop = false, speed = 1) {
    this.u.mem.regularFormVisual = { clip, loop, speed, ...(!loop ? { playId: `jcinta:${this.u.deploySeq}:${++this.visualSeq}` } : {}) };
    this.u.mem.regularVisualDirection = this.facing;
  }
  idle() { this.visual('Idle', true); }
  range() {
    const key = this.u.skill.active && this.record.index === 1 ? 'x-1' : 'x-4';
    return new Set(absoluteRangeKeys(e.tables.ranges[key].grids.map(g => [g.row, g.col]), this.u.tileR, this.u.tileC, this.u.dir));
  }
  aura() {
    const { b, u, record: r } = this, keys = this.range(), key = `jcinta:aerial-sanctuary:${u.id}`;
    const value = (r.talentBb[0]?.damage_resistance ?? 0) * (u.skill.active && r.index === 1 ? r.bb.talent_scale : 1);
    const candidates = new Set([...this.recipients, ...b.allyUnits]);
    for (const a of candidates) {
      // Native validator ignores TargetFree/HealFree, but retains ally isolation.
      const inside = this.valid() && live(u) && value > 0 && live(a) && a.kind !== 'device'
        && b.allySelectable(a, u) && bodyInKeys(a, keys);
      if (!inside) { b.removeBuff(a, key); this.recipients.delete(a); continue; }
      const old = a.findBuff(key);
      if (old?.data.flyingSourceSanctuary !== value) {
        b.removeBuff(a, key); b.addBuff(a, { key, source: u, status: 'sanctuary', data: { flyingSourceSanctuary: value } });
      }
      this.recipients.add(a);
    }
  }
  canCast() { return this.valid() && live(this.u) && this.u.canAct && !this.u.skill.active; }
  start() {
    this.elapsed = 0; this.granted = 0; this.phase = { kind: 'begin', until: this.b.time + this.model().durations[`Skill_${this.record.index + 1}_Begin`] };
    this.visual(`Skill_${this.record.index + 1}_Begin`); this.aura();
  }
  channel(dt) {
    if (!this.valid() || !live(this.u)) return;
    const { b, u, record: r } = this, span = Math.min(dt, Math.max(0, u.skill.timeLeft));
    this.elapsed += span;
    while (this.granted < r.bb.value && this.elapsed + 1e-8 >= (this.granted + 1) * r.bb.interval) {
      this.granted++; b.addDp(u.ownerId, r.bb.cost);
    }
    this.aura();
    if (r.index !== 1 || !u.canAct || u.s.flags.disarm || span <= 0) return;
    const keys = this.range();
    const targets = b.allyUnits.filter(a => live(a) && a.kind !== 'device' && b.allySelectable(a, u)
      && !a.s.flags.untargetable && !a.s.flags.healFree && (a === u || !(a.s.flags.noHeal || a.profile?.noHeal))
      && bodyInKeys(a, keys) && a.hp < a.s.maxHp - .01)
      .sort((a, z) => a.hpRatio - z.hpRatio || a.deploySeq - z.deploySeq).slice(0, r.bb['attack@heal_max_target']);
    for (const a of targets) b.heal(u, a, u.s.atk * r.bb['attack@heal_scale'] * span);
  }
  end() {
    if (!this.valid()) return;
    this.phase = { kind: 'end', until: this.b.time + this.model().durations[`Skill_${this.record.index + 1}_End`] };
    this.visual(`Skill_${this.record.index + 1}_End`); this.aura();
  }
  targets() {
    const keys = new Set(absoluteRangeKeys(this.record.rangeGrid, this.u.tileR, this.u.tileC, this.u.dir));
    const all = this.b.enemies.filter(a => canTargetEnemy(this.u, a, { canHitFly: false })
      && (!a.s.flags.camou || a.blockedBy) && (a.blockedBy === this.u || bodyInKeys(a, keys)));
    const blocked = all.filter(a => a.blockedBy === this.u);
    return sortEnemyTargets(this.b, this.u, blocked.length ? blocked : all).slice(0, 1);
  }
  admissible(targets) {
    const p = this.phase;
    return this.accepting && this.valid() && live(this.u) && this.u.canAct && !this.u.s.flags.disarm && !this.u.skill.active
      && p?.kind === 'attack' && !p.accepted && p.epoch === this.u.attackControlEpoch && due(this.b, p.releaseAt)
      && targets.length === 1 && targets[0] === p.target && p.target.deploySeq === p.targetSeq
      && canTargetEnemy(this.u, p.target, { canHitFly: false });
  }
  release(targets, info) {
    if (!this.admissible(targets)) return false;
    this.phase.accepted = true;
    this.b.dealDamage(this.u, targets[0], { amount: this.u.s.atk * this.u.s.atkScaleMul, type: 'phys',
      isAttack: true, attackId: info.attackId, applyWay: 'melee', tags: ['jcinta:ordinary'] }); return true;
  }
  tick() {
    if (!this.valid()) return;
    this.aura(); const { b, u } = this; let p = this.phase;
    if (p && ['born', 'begin', 'end'].includes(p.kind)) {
      if (!due(b, p.until)) return;
      this.phase = p = null;
      if (u.skill.active) this.visual(`Skill_${this.record.index + 1}_Loop`, true); else this.idle();
    }
    if (u.skill.active) return;
    if (!live(u) || !u.canAct || u.s.flags.disarm || p && p.epoch !== u.attackControlEpoch) { this.phase = null; this.idle(); return; }
    if (p) {
      if (!p.released && due(b, p.releaseAt)) {
        p.released = true; this.accepting = true;
        try { b.forceAttack(u, [p.target]); } finally { this.accepting = false; }
      }
      if (!this.valid() || this.phase !== p || !due(b, p.until)) return;
      this.phase = null;
    }
    if (u.atkCd > 1e-9) return;
    const target = this.targets()[0]; if (!target) { this.idle(); return; }
    const dx = target.x - u.x, dy = target.y - u.y;
    if (Math.hypot(dx, dy) > 1e-8) this.facing = Math.abs(dy) > Math.abs(dx) ? dy > 0 ? 'UP' : 'DOWN' : dx < 0 ? 'LEFT' : 'RIGHT';
    const speed = u.base.bat / u.s.interval, delay = this.model().eventPayloads.Attack[0].time / speed;
    const interval = Math.max(delay, u.s.interval);
    this.phase = { kind: 'attack', target, targetSeq: target.deploySeq, epoch: u.attackControlEpoch,
      startedAt: b.time, releaseAt: b.time + delay, until: b.time + interval, accepted: false };
    u.atkCd = interval; this.visual('Attack', false, speed);
  }
  install() {
    if (this.handles.length || this.stopped) throw Error('Jacinta cannot be reinstalled');
    const { b, u } = this;
    this.handles = [b.on('deploy', ({ unit, move }) => {
      if (unit !== u || move) return;
      this.seq = u.deploySeq; this.phase = { kind: 'born', until: b.time + this.model().durations.Start };
      this.visual('Start'); this.aura();
    }, { owner: u }), b.on('tick', () => {
      if (this.stopped || b.finished || this.seq !== null && !this.valid()) this.stop(); else this.tick();
    }, { owner: u }), b.on('death', ({ unit }) => { if (unit === u) this.stop(); }, { owner: u }), b.on('battleEnd', () => this.stop())];
  }
  stop() {
    if (this.stopped) return;
    this.stopped = true; this.phase = null; this.accepting = false;
    for (const handle of this.handles) this.b.off(handle);
    this.handles = [];
    for (const a of this.recipients) this.b.removeBuff(a, `jcinta:aerial-sanctuary:${this.u.id}`);
    this.recipients.clear(); delete this.u.mem.regularFormVisual; delete this.u.mem.regularVisualDirection;
  }
  spec() {
    return { kind: 'duration', duration: this.record.source.duration, silenceable: false, trigger: { rule: 'NEVER' },
      mods: { blockCntMul: 0 }, attack: {}, canActivate: () => this.canCast(),
      ...(this.record.index === 1 ? { targeting: { rangeGrid: this.record.skillRangeGrid, noRangeExtend: true } } : {}),
      onStart: () => this.start(), onTick: ({ dt }) => this.channel(dt), onEnd: () => this.end() };
  }
}
export function prepareJcinta(b, u, { contract } = {}) {
  const record = selected(u, contract), controller = new JcintaController(b, u, record); u.mem.jcinta = controller;
  return { record, controller, kit: { talents: [], install: null,
    trait: { noAttack: true, attackDrivenSkill: true, attack: 'melee', projectile: 'none', dmgType: 'none',
      canHitFly: false, heal: null, splashRadius: 0, chain: null, windup: 0, attackVisual: 'none',
      requiresAcceptedLaunch: true, acceptAreaAttack: (_b, _u, _p, targets) => controller.admissible(targets),
      launchAreaAttack: (_b, _u, _p, targets, info) => controller.release(targets, info) }, skill: controller.spec() } };
}
