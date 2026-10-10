// SPDX-License-Identifier: GPL-3.0-or-later
// Unregistered cast links. Native numeric callbacks and frame order remain
// source evidence; installation requires reviewed local execution choices.
import evidence from '../../../data/arkpedia-lemuen-prefabs.json' with { type: 'json' };
import { LEMUEN_ID, LemuenCombatLinks, selectedLemuenBlackboard } from './arkpedia-lemuen-links.js';
import { LemuenAmmunition, lemuenWanted } from './arkpedia-lemuen-resources.js';
import { canTargetEnemy } from '../targeting.js';
import { bodyInKeys } from '../body.js';

const live = u => u?.alive && u.deployed && !u.hidden && !u._removing;
const profile = Object.freeze({ canHitFly: true });
const targetable = (u, e) => live(e) && canTargetEnemy(u, e, profile) && (!e.s.flags.camou || e.blockedBy);
const components = key => evidence.projectiles[key].flatMap(r => r.components.map(c => c.data));
const source = (u, skill) => {
  const rank = u.def.raw.arkpedia?.skillRank;
  if (u.def.charId !== LEMUEN_ID || u.def.skill.id !== `skchr_lemuen_${skill}`)
    throw Error('Lemuen cast requires its selected source skill');
  const bb = selectedLemuenBlackboard(skill, rank);
  if (Object.keys(bb).length !== Object.keys(u.def.skill.bb).length
    || Object.entries(bb).some(([k, v]) => u.def.skill.bb[k] !== v)) throw Error('Incomplete Lemuen cast blackboard');
  return bb;
};
const note = c => typeof c?.reviewNote === 'string' && !!c.reviewNote.trim();

/** S2's native graph checks lethal output before increasing the coefficient,
 * then snapshots ATK when the aim finishes. The immediate first check and
 * expiry-before-trigger boundary are explicit local scheduling choices. */
export class LemuenAiming {
  constructor(b, u, links, ammo, contract) {
    this.selected = source(u, 2);
    if (!(links instanceof LemuenCombatLinks) || links.u !== u || links.b !== b
      || !(ammo instanceof LemuenAmmunition) || ammo.skill !== 2 || ammo.rank !== u.def.raw.arkpedia.skillRank)
      throw Error('Missing Lemuen aiming impact/resource links');
    if (!note(contract) || contract.firstCheck !== 'immediate'
      || contract.boundary !== 'expiry-before-trigger' || typeof contract.isLethal !== 'function')
      throw Error('Lemuen aiming requires reviewed scheduling and lethal-check contracts');
    this.b = b; this.u = u; this.links = links; this.ammo = ammo; this.contract = contract;
    this.state = null; this.result = null; this.stopped = false; this.hooks = [];
    this.controlEpoch = u.attackControlEpoch;
  }
  get busy() { return !!this.state; }
  get effectKey() { return `lemuen:${this.u.id}:aiming`; }
  begin(e, attackId) {
    if (this.stopped || this.busy || !live(this.u) || !this.u.canAct || this.u.s.flags.disarm
      || !targetable(this.u, e) || !lemuenWanted(this.b, e)) return false;
    if (!this.ammo.consume(attackId)) return false;
    const bb = this.selected, now = this.b.time;
    this.controlEpoch = this.u.attackControlEpoch; this.result = null;
    this.state = { target: e, targetLife: e.deploySeq, attackId, startedAt: now,
      scale: bb['attack@main_atk_scale'], checks: 0, next: now,
      expires: now + bb['attack@aim_duration'] };
    this.effect = this.b.addBuff(e, { key: this.effectKey, source: this.u });
    this.tick(); return true;
  }
  finish(reason) {
    const s = this.state;
    if (!s) return false;
    this.state = null; this.clearEffect(s.target);
    const currentValue = this.links.snapshotS2(s.scale);
    const validLife = s.target.deploySeq === s.targetLife;
    const born = !!(validLife && this.links.launch(s.target, s.attackId, 2, { currentValue }));
    this.result = { ...s, reason, currentValue, born, completedAt: this.b.time };
    return born;
  }
  clearEffect(e) { if (this.effect) this.b.removeBuff(e, this.effect); this.effect = null; }
  cancel(reason = 'interrupted') {
    const s = this.state;
    if (!s) return;
    this.state = null; this.clearEffect(s.target);
    this.result = { ...s, reason, born: false, completedAt: this.b.time };
  }
  tick() {
    if (this.stopped) return;
    if (!live(this.u)) { this.stop(); return; }
    if (!this.state) { this.controlEpoch = this.u.attackControlEpoch; return; }
    if (!this.u.canAct || this.u.s.flags.disarm || this.controlEpoch !== this.u.attackControlEpoch) {
      this.cancel(); this.controlEpoch = this.u.attackControlEpoch; return;
    }
    const s = this.state, bb = this.selected;
    if (this.b.time + 1e-9 >= s.expires) { this.finish('duration'); return; }
    while (this.state === s && s.checks < bb['attack@trig_cnt'] && this.b.time + 1e-9 >= s.next) {
      // A lost victim keeps the original cast clock, but cannot create a new
      // target, a lethal callback or a shot at its later reborn life.
      if (targetable(this.u, s.target) && s.target.deploySeq === s.targetLife
        && this.contract.isLethal({ battle: this.b, unit: this.u, target: s.target, scale: s.scale }) === true) {
        this.finish('lethal'); return;
      }
      s.scale = Math.min(bb['attack@fin_atk_scale'], s.scale + bb['attack@ex_atk_scale']);
      s.checks++; s.next += bb['attack@interval'];
    }
  }
  install() {
    if (this.hooks.length || this.stopped) return;
    this.hooks.push(this.b.on('tick', () => this.tick()));
    this.hooks.push(this.b.on('death', ({ unit }) => { if (unit === this.u) this.stop(); }));
  }
  stop() {
    if (this.stopped) return;
    this.cancel('owner-finish'); this.stopped = true;
    for (const h of this.hooks) this.b.off(h); this.hooks = [];
  }
}

/** Original managed marks become one unowned parent/child chain apiece at
 * release. The parent's one-hit limit, .1 + .3*i delay and child's .25 lifetime
 * remain distinct. Callback translation, spread distribution and travel-time
 * mapping require explicit review; this is not a decoded Unity runtime. */
export class LemuenBombardment {
  constructor(b, u, links, ammo, contract) {
    this.selected = source(u, 3);
    if (!(links instanceof LemuenCombatLinks) || links.u !== u || links.b !== b
      || !(ammo instanceof LemuenAmmunition) || ammo.skill !== 3 || ammo.rank !== u.def.raw.arkpedia.skillRank)
      throw Error('Missing Lemuen bombardment impact/resource links');
    if (!note(contract) || contract.parentEvent !== 'one-child-at-first-period'
      || contract.parentExpiry !== 'before-period'
      || typeof contract.sampleOffset !== 'function' || contract.childTravel !== 'lifetime')
      throw Error('Lemuen bombardment requires reviewed callback, spread and travel contracts');
    const parents = components('projectile_chr_lemuen_s3'), children = components('projectile_chr_lemuen_s3_attack');
    const parentBody = parents.find(c => c._lifeTime != null), childBody = children.find(c => c._lifeTime != null);
    const lifetime = childBody._lifeTime;
    const collider = parents.find(c => c._intervalBbKey === 'hit_interval');
    const emitter = parents.find(c => c._ev != null);
    const action = evidence.templates.lemuen_s3_end.eventToActions.ON_BUFF_START[1];
    if (lifetime !== .25 || childBody._alwaysReachInTheEnd !== 1 || childBody._stopWhenSourceInvalid !== 0
      || parentBody._lifeTime !== 10 || parentBody._lifeTimeType !== 1
      || parentBody._managedBySource !== 0 || parentBody._stopAfterFirstHit !== 1 || parentBody._stopWhenSourceInvalid !== 0
      || emitter._ev !== 2 || collider._stopWhenLimitedHitTimesUsedUp !== 1
      || this.selected['attack@limited_hit_time'] !== 1 || action._addBbKeyForEachProjectile !== 'hit_interval')
      throw Error('Unreviewed Lemuen managed projectile source');
    this.parentLifetime = parentBody._lifeTime;
    this.childLifetime = lifetime; this.firstDelay = action._addBbDefaultValue; this.delayStep = action._addBbValue;
    this.b = b; this.u = u; this.links = links; this.ammo = ammo; this.contract = contract;
    this.marks = []; this.emitted = []; this.released = false; this.stopped = false; this.hooks = [];
  }
  mark(e, attackId) {
    if (this.stopped || this.released || !live(this.u) || !this.u.canAct || this.u.s.flags.disarm
      || !targetable(this.u, e) || !(bodyInKeys(e, this.u.rangeKeySet) || lemuenWanted(this.b, e))) return false;
    if (!this.ammo.consume(attackId)) return false;
    const entry = { target: e, targetLife: e.deploySeq, attackId, x: e.x, y: e.y };
    entry.buff = this.b.addBuff(e, { key: `lemuen:${this.u.id}:mark:${attackId}`, source: this.u });
    this.marks.push(entry); return true;
  }
  sync() {
    if (this.stopped || this.released) return;
    for (const entry of this.marks) if (live(entry.target) && entry.target.deploySeq === entry.targetLife) {
      entry.x = entry.target.x; entry.y = entry.target.y;
    }
  }
  release() {
    if (this.stopped || this.released || !live(this.u)) return false;
    this.sync();
    // Validate every supplied offset before detaching marks or scheduling output.
    const plans = this.marks.map((m, index) => {
      const offset = this.contract.sampleOffset({ battle: this.b, index, maximum: this.selected['attack@emit_offset'] });
      if (!Number.isFinite(offset?.x) || !Number.isFinite(offset?.y)
        || Math.hypot(offset.x, offset.y) > this.selected['attack@emit_offset'] + 1e-9)
        throw Error('Unreviewed Lemuen bombardment offset');
      return { x: m.x, y: m.y, to: { x: m.x + offset.x, y: m.y + offset.y },
        attackId: m.attackId, delay: this.firstDelay + index * this.delayStep };
    });
    const cachedAtk = this.u.s.atk;
    this.released = true;
    for (const m of this.marks) this.b.removeBuff(m.target, m.buff);
    this.marks = [];
    for (const h of this.hooks) this.b.off(h); this.hooks = [];
    this.emitted = plans.map(plan => {
      const parent = { ...plan, cachedAtk, bornAt: this.b.time, child: null };
      // Original emitted parents/children are not managed by the owner and do
      // not stop when its source becomes invalid. Do not bind timers to u.
      parent.timer = this.b.after(Math.min(plan.delay, this.parentLifetime), () => {
        // Expiry precedes an equal/later first period in this local contract.
        // No-module casts reach every ordinary mark well before ten seconds.
        if (plan.delay >= this.parentLifetime) { parent.expired = true; return; }
        parent.child = this.b.addProjectile({ from: plan, to: plan.to, source: this.u,
          flightTime: this.childLifetime, maxAge: this.childLifetime, visual: 'grenade',
          data: { arkpediaTrackedVisual: true, lemuenBombardment: this.u.id },
          onHit: ({ x, y }) => this.links.s3Impact(x, y, cachedAtk, plan.attackId, this.selected) });
      }, { holdsBattle: true });
      return parent;
    });
    return this.emitted;
  }
  install() {
    if (this.hooks.length || this.stopped || this.released) return;
    this.hooks.push(this.b.on('tick', () => this.sync()));
    this.hooks.push(this.b.on('death', ({ unit }) => { if (unit === this.u) this.stop(); }));
  }
  stop() {
    if (this.stopped) return;
    for (const entry of this.marks) this.b.removeBuff(entry.target, entry.buff);
    this.marks = []; this.stopped = true;
    for (const h of this.hooks) this.b.off(h); this.hooks = [];
    // Already emitted parents/children continue with their cached damage.
  }
}
