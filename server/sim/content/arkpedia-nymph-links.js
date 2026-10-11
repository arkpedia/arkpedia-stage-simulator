// SPDX-License-Identifier: GPL-3.0-or-later
// Damage/talent links. The cast controller must supply accepted
// projectile births; this module does not choose either original S2 event.
import evidence from '../../../data/arkpedia-nymph-prefabs.json' with { type: 'json' };
import { bodyInKeys } from '../body.js';
import { canTargetEnemy } from '../targeting.js';

export const NYMPH_ID = 'char_4146_nymph';
const alive = u => u?.alive && u.deployed && !u.hidden && !u._removing;
const plain = Object.freeze({ canHitFly: true, dmgType: 'arts', attack: 'ranged' });
const splash = Object.freeze({ ...plain, ignoreCamouflage: true });
const bb = rows => Object.fromEntries(rows.map(r => [r.key, r.value]));
const talent = (u, key) => u.def.talents.find(t => t.bb[key] != null)?.bb;
const dark = e => alive(e) && (e.burstPending?.apoptosis || !!e.findBuff('apoptosisBurst'));
const key = (u, suffix) => `nymph:${u.id}:${suffix}`;

/** A source-owned listener and DoT clock. Higher-priority S2 replaces the
 * lower coefficient and triggers immediately; equal/weaker applications keep
 * the current clock. This is an explicit local override contract, not decoded
 * compiled buff ordering. */
export class NymphCombatLinks {
  constructor(b, u) {
    if (u.def.charId !== NYMPH_ID) throw Error('Nymph links require Nymph source data');
    this.b = b; this.u = u; this.entries = new Map(); this.listeners = new Map();
    this.stacks = 0; this.stopped = false; this.hooks = [];
    this.t1 = talent(u, 'element_atk_scale'); this.t2 = talent(u, 'max_stack_cnt');
    this.listenerDelay = evidence.templates.nymph_t_1.eventToActions.ON_BEFORE_TARGET_APPLY_MODIFIER
      .find(n => n._buff)._buff.triggerInterval;
    if (this.listenerDelay !== .10000000149011612) throw Error('Unreviewed listener interval');
    this.hooks.push(b.on('outputDamage', ctx => {
      if (!this.t1 || !this.live || ctx.source !== u || ctx.target.side !== 'enemy'
        || !['phys', 'arts', 'true', 'elemental'].includes(ctx.dmg.type)
        || ctx.dmg.tags.includes('hpLoss') || this.entries.has(ctx.target)) return;
      this.listen(ctx.target);
    }));
    this.hooks.push(b.on('elementBurst', ({ target, element }) => {
      if (!this.t2 || !this.live || element !== 'apoptosis' || target.side !== 'enemy'
        || !bodyInKeys(target, u.rangeKeySet) || !canTargetEnemy(u, target, splash)) return;
      this.stacks = Math.min(this.t2.max_stack_cnt, this.stacks + 1);
      b.removeBuff(u, key(u, 'atk'));
      b.addBuff(u, { key: key(u, 'atk'), source: u, mods: { atkPct: this.stacks * this.t2.atk } });
    }));
    this.hooks.push(b.on('tick', () => this.tick()));
    this.hooks.push(b.on('death', ({ unit }) => { if (unit === u) this.stop(); }));
  }
  get live() { return !this.stopped && alive(this.u); }
  listen(e) {
    if (!this.live || !this.t1 || !alive(e) || this.entries.has(e) || this.listeners.has(e)) return false;
    this.listeners.set(e, this.b.time + this.listenerDelay); return true;
  }
  remove(e) {
    this.entries.delete(e); this.listeners.delete(e);
    this.b.removeBuff(e, key(this.u, 'dot'));
  }
  dot(e, coefficient) {
    if (!this.live || !this.t1 || !dark(e) || !(coefficient > 0)) return false;
    const old = this.entries.get(e);
    if (old && old.coefficient >= coefficient) return false;
    const entry = { coefficient, next: this.b.time + 1 };
    this.entries.set(e, entry); this.listeners.delete(e);
    this.b.removeBuff(e, key(this.u, 'dot'));
    this.b.addBuff(e, { key: key(this.u, 'dot'), source: this.u,
      onRemove: () => { if (this.entries.get(e) === entry) this.entries.delete(e); } });
    this.pulse(e, entry); return true;
  }
  pulse(e, entry) {
    if (!this.live || !dark(e) || this.entries.get(e) !== entry) return;
    this.b.dealDamage(this.u, e, { amount: this.u.s.atk * entry.coefficient,
      type: 'elemental', canDodge: false, isAttack: false,
      tags: ['nymph:dot'] });
  }
  tick() {
    if (!this.live) { this.stop(); return; }
    for (const [e, due] of this.listeners) if (this.b.time + 1e-9 >= due) {
      this.listeners.delete(e);
      if (dark(e)) this.dot(e, this.t1.element_atk_scale);
    }
    for (const [e, entry] of this.entries) {
      // Cleanup precedes output if the native burst has expired or was removed.
      if (!dark(e) || !e.findBuff(key(this.u, 'dot'))) { this.remove(e); continue; }
      if (this.b.time + 1e-9 >= entry.next) {
        entry.next += 1; this.pulse(e, entry);
      }
    }
  }
  stop() {
    if (this.stopped) return;
    this.stopped = true;
    this.b.projectiles.remove(p => p.data?.nymphS2Owner === this.u.id);
    for (const e of [...this.entries.keys()]) this.remove(e);
    this.listeners.clear(); this.b.removeBuff(this.u, key(this.u, 'atk'));
    for (const h of this.hooks) this.b.off(h);
    this.hooks = [];
  }
  elemental(e, amount, tag, attackId) {
    return this.b.dealDamage(this.u, e, { amount, type: 'elemental',
      canDodge: false, isAttack: false, isSkill: true, attackId, tags: [`nymph:${tag}`] });
  }
  injury(e, amount, tag, attackId) {
    return this.b.dealDamage(this.u, e, { amount, type: 'element', element: 'apoptosis',
      canDodge: false, isAttack: false, isSkill: true, attackId, tags: [`nymph:${tag}`] });
  }
  arts(e, scale, tag, attackId, ratio = 0) {
    const b = this.b, u = this.u;
    let accepted = null;
    const h = b.on('calculatedDamage', ctx => {
      if (ctx.source === u && ctx.target === e && ctx.dmg.attackId === attackId
        && ctx.dmg.tags.includes(`nymph:${tag}`)) accepted = ctx.amount;
    });
    try {
      b.dealDamage(u, e, { amount: u.s.atk * scale, type: 'arts', applyWay: 'ranged',
        canDodge: true, isAttack: true, isSkill: tag !== 'normal', attackId, tags: [`nymph:${tag}`] });
    } finally { b.off(h); }
    // Retain the accepted calculated amount even through shields/overkill.
    // Dead recipients still reject injury in the engine's element pipeline.
    if (accepted != null && ratio > 0) this.injury(e, accepted * ratio, `${tag}:injury`, attackId);
    return accepted;
  }
  normalImpact(e, attackId) {
    if (!alive(e) || !canTargetEnemy(this.u, e, plain)) return false;
    this.arts(e, 1, 'normal', attackId); return true;
  }
  s1Impact(e, attackId, selected) {
    if (!alive(e) || !canTargetEnemy(this.u, e, plain)) return false;
    this.arts(e, 1, 's1', attackId, selected['attack@ep_damage_ratio']);
    // The attached S1 extra branch checks whether the source skill is still
    // affecting it, independently of the projectile's original birth mode.
    if (this.live && this.u.skill.active && this.u.skill.id === 'skchr_nymph_1' && dark(e))
      this.elemental(e, this.u.s.atk * selected['attack@extra_ep_damage_scale'], 's1:extra', attackId);
    return true;
  }
  s3Impact(e, attackId, selected) {
    if (!alive(e) || !canTargetEnemy(this.u, e, plain)) return false;
    if (dark(e)) {
      this.arts(e, selected['attack@magic_atk_scale'], 's3:arts', attackId);
      this.elemental(e, this.u.s.atk * selected['attack@split_atk_scale'], 's3:elemental', attackId);
    } else this.arts(e, 1, 's3', attackId);
    return true;
  }
  s2Direct(e, attackId, selected) {
    if (!this.live || !alive(e) || !canTargetEnemy(this.u, e, plain)) return false;
    const accepted = this.arts(e, selected.atk_scale, 's2:direct', attackId, selected.ep_damage_ratio);
    // The native trace buff lists Fear first and marks it missable. Here the
    // accepted damage receipt gates Fear; native same-frame ordering is open.
    if (accepted != null && alive(e)) this.b.applyStatus(e, 'fear',
      { duration: selected.fear, source: this.u, sourceStatusResistable: true });
    if (alive(e)) this.dot(e, selected.element_atk_scale);
    return true;
  }
  s2Stop(x, y, attackId, selected) {
    if (!this.live) return [];
    const targets = this.b.enemiesInRadius(x, y, selected.projectile_range, true)
      .filter(e => canTargetEnemy(this.u, e, splash));
    for (const e of targets) {
      this.arts(e, selected.atk_scale, 's2:splash', attackId, selected.ep_damage_ratio);
      if (alive(e)) this.dot(e, selected.element_atk_scale);
    }
    return targets;
  }
  launchAttack(e, attackId, mode, selected = this.u.def.skill.bb) {
    if (!this.live || !alive(e) || !canTargetEnemy(this.u, e, plain)) return false;
    if (![0, 1, 3].includes(mode)) throw Error('Nymph attack mode requires a separate S2 cast');
    this.b.addProjectile({ from: this.u, source: this.u, target: e,
      speed: 10, maxAge: 10, visual: 'orb', data: { arkpediaTrackedVisual: true },
      onHit: ({ target }) => {
        if (!target) return;
        if (mode === 1) this.s1Impact(target, attackId, selected);
        else if (mode === 3) this.s3Impact(target, attackId, selected);
        else this.normalImpact(target, attackId);
      } });
    return true;
  }
  /** Called only after an accepted S2 birth. The caller supplies the original
   * selected destination when the trace target has become invalid. Native
   * double-event consumption and hitNumType2 ordering remain controller gates. */
  launchS2({ target, point, attackId, selected = this.u.def.skill.bb }) {
    if (!this.live) return false;
    const valid = alive(target) && canTargetEnemy(this.u, target, plain);
    if (!valid && (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y))) return false;
    const components = evidence.projectiles.projectile_chr_nymph_s2
      .flatMap(row => row.components.map(c => c.data));
    const motion = components.find(d => d._speed != null);
    const root = components.find(d => d._actionController);
    if (root._stopWhenSourceInvalid !== 1 || root._lifeTime !== 20
      || motion._speed !== 10 || motion._forceReachedWhenTimeup !== 0)
      throw Error('Unreviewed Nymph S2 projectile lifetime');
    this.b.addProjectile({ from: this.u, source: this.u,
      target: valid ? target : null, to: valid ? null : point,
      hitDead: true, expireInPlace: true, speed: motion._speed, maxAge: root._lifeTime,
      visual: 'orb', data: { arkpediaTrackedVisual: true, nymphS2Owner: this.u.id },
      onHit: ({ target: reached, projectile, x, y }) => {
        if (!this.live || Math.hypot(projectile.tx - x, projectile.ty - y) > 1e-6) return;
        if (reached) this.s2Direct(reached, attackId, selected);
        // Clear the trace at arrival: later movement/Fear cannot move the stop
        // centre. The shared scheduler callback checks source lifetime again.
        this.b.after(motion._delayAfterReached, () => this.s2Stop(x, y, attackId, selected));
      } });
    return true;
  }
}

export function selectedNymphBlackboard(skill, rank) {
  if (![1, 2, 3].includes(skill) || !Number.isInteger(rank) || rank < 1 || rank > 10)
    throw Error('Invalid Nymph source skill/rank');
  return bb(evidence.tables.skills[`skchr_nymph_${skill}`].levels[rank - 1].blackboard);
}
