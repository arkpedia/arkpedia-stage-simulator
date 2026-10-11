// SPDX-License-Identifier: GPL-3.0-or-later
// Returning-projectile links, fed by arkpedia-narant-prefabs.json.
// Native compiled mover/FSM callbacks are unavailable. Explicit web mappings:
// S1 times counts additional bounces, nearest/spawn-order ties and repeat-reset;
// S2 moveAheadSpeed is in world tile units, only the trace victim is hit outbound,
// and a swept native-radius circle hits each eligible victim once on return;
// S3 groups three accepted births and invokes its guarded AoE only on final hand
// arrival. Original curved paths/VFX are retained as metadata, not reproduced.
import evidence from '../../../data/arkpedia-narant-prefabs.json' with { type: 'json' };
import { canTargetEnemy, absoluteRangeKeys, sortEnemyTargets } from '../targeting.js';
import { bodyDist, bodyInKeys, hitRect } from '../body.js';
import { makeDamageInfo } from '../damage.js';
import { dirVec } from '../dir.js';

export const NARANT_ID = 'char_4138_narant';
const live = u => u?.alive && u.deployed && !u.hidden && !u._removing;
const profile = Object.freeze({ canHitFly: true, attack: 'ranged', dmgType: 'phys' });
const flat = rows => Object.fromEntries(rows.map(r => [r.key, r.value]));
export function selectedNarantBlackboard(skill, rank) {
  const source = evidence.tables.skills[`skchr_narant_${skill}`];
  if (!Number.isInteger(skill) || !Number.isInteger(rank) || !source || rank < 1 || rank > 10)
    throw Error('Invalid Narantuya source skill/rank');
  return Object.freeze(flat(source.levels[rank - 1].blackboard));
}
const records = name => evidence.projectiles[name].flatMap(r => r.components.map(c => c.data));
const native = name => {
  const rows = records(name), mover = rows.find(c => '_speed' in c), body = rows.find(c => '_lifeTime' in c);
  if (!mover || !body || mover._comeBack !== 1 || mover._comeBackSpeedScale !== .25)
    throw Error(`Unreviewed Narantuya projectile ${name}`);
  return { name, mover, body };
};
const paths = [native('projectile_chr_narant'), native('projectile_chr_narant_s1'),
  native('projectile_chr_narant_s2'), native('projectile_chr_narant_s3')];
const additional = [native('projectile_chr_narant_s3_1'), native('projectile_chr_narant_s3_2')];
const bounceRadius = records('projectile_chr_narant_s1').find(c => 'm_Radius' in c).m_Radius;
const returnRadius = records('projectile_chr_narant_s2').find(c => 'm_Radius' in c).m_Radius;
const surrounding = evidence.tables.ranges['x-4'].grids.map(p => [p.row, p.col]);

/** First contact of a swept circle with a point or the shared huge-unit body.
 * A rounded rectangle is the union of the body, side strips and corner circles;
 * unlike centre projection alone, this also catches oblique corner contacts. */
export function narantContactTime(target, from, to, radius) {
  if (!target || ![from?.x, from?.y, to?.x, to?.y, radius].every(Number.isFinite) || radius < 0)
    throw Error('Invalid Narantuya swept contact');
  if (bodyDist(target, from.x, from.y) <= radius + 1e-9) return 0;
  const dx = to.x - from.x, dy = to.y - from.y, n = dx * dx + dy * dy;
  if (n === 0) return null;
  const hits = [];
  const circle = (x, y) => {
    const ox = from.x - x, oy = from.y - y, dot = ox * dx + oy * dy;
    const disc = dot * dot - n * (ox * ox + oy * oy - radius * radius);
    if (disc < -1e-9) return;
    const t = (-dot - Math.sqrt(Math.max(0, disc))) / n;
    if (t >= -1e-9 && t <= 1 + 1e-9) hits.push(Math.max(0, Math.min(1, t)));
  };
  const rect = hitRect(target);
  if (!rect) circle(target.x, target.y);
  else {
    if (dx) for (const x of [rect.x0 - radius, rect.x1 + radius]) {
      const t = (x - from.x) / dx, y = from.y + t * dy;
      if (t >= 0 && t <= 1 && y >= rect.y0 && y <= rect.y1) hits.push(t);
    }
    if (dy) for (const y of [rect.y0 - radius, rect.y1 + radius]) {
      const t = (y - from.y) / dy, x = from.x + t * dx;
      if (t >= 0 && t <= 1 && x >= rect.x0 && x <= rect.x1) hits.push(t);
    }
    for (const x of [rect.x0, rect.x1]) for (const y of [rect.y0, rect.y1]) circle(x, y);
  }
  return hits.length ? Math.min(...hits) : null;
}

export class NarantuyaProjectiles {
  constructor(battle, unit) {
    if (unit.def.charId !== NARANT_ID) throw Error('Narantuya projectiles require Narantuya source data');
    this.b = battle; this.u = unit; this.flight = null;
  }
  canAttack() {
    return live(this.u) && (!this.flight || this.flight.complete || this.flight.seq !== this.u.deploySeq);
  }
  legal(target, selecting = false, ignoreCamouflage = false) {
    return live(target) && canTargetEnemy(this.u, target, profile)
      && (!selecting || ignoreCamouflage || !target.s.flags.camou || target.blockedBy);
  }
  impact(target, scale, attackId, tag, { slow = 0, melee = false, deployment = this.u.deploySeq } = {}) {
    if (!this.legal(target)) return false;
    const dmg = makeDamageInfo({ amount: this.u.s.atk * this.u.s.atkScaleMul * scale,
      type: 'phys', applyWay: melee ? 'melee' : 'ranged', isProjectile: !melee,
      canDodge: true, isAttack: true, isSkill: tag !== 'normal', attackId, tags: [`narant:${tag}`] });
    // A born old blade can still deal damage after withdrawal. It cannot
    // trigger talent accumulation belonging to a later owner deployment.
    dmg.narantDeployment = deployment;
    // Database Slow is missable. A calculated receipt exists after hit-rate,
    // dodge and cancellation checks even when shields absorb all HP damage.
    let accepted = false;
    const receipt = slow > 0 ? this.b.on('calculatedDamage', ctx => {
      if (ctx.dmg === dmg) accepted = true;
    }) : null;
    try { this.b.dealDamage(this.u, target, dmg); }
    finally { if (receipt) this.b.off(receipt); }
    if (accepted && live(target)) this.b.applyStatus(target, 'sluggish', { source: this.u, duration: slow });
    return true;
  }
  s3Followup(attackId, bb) {
    const keys = absoluteRangeKeys(surrounding, this.u.tileR, this.u.tileC, this.u.dir);
    const targets = this.b.enemies.filter(e => this.legal(e, true) && bodyInKeys(e, keys));
    sortEnemyTargets(this.b, this.u, targets, null);
    for (const e of targets.slice(0, bb['attack@aoe.max_target']))
      this.impact(e, bb.atk_scale_aoe, attackId, 's3-return', { slow: bb.sluggish, melee: true });
  }
  /** One accepted attack birth; its caller owns attack events, SP and skill
   * phases. Born work is independent of skill expiry/source withdrawal. */
  launch(target, attackId, mode, { rank = this.u.def.raw.arkpedia?.skillRank, input = null } = {}) {
    if (![0, 1, 2, 3].includes(mode)) throw Error('Invalid Narantuya projectile mode');
    const bb = mode ? selectedNarantBlackboard(mode, rank) : null;
    if (input && (![input.x, input.y].every(Number.isFinite) || !Number.isInteger(input.seq)))
      throw Error('Invalid Narantuya captured input');
    const validTarget = this.legal(target, true) && (!input || target.deploySeq === input.seq);
    // S3 explicitly emits at the captured position when the input victim
    // becomes invalid. No other mode inherits this exception, and a later
    // life of the same unit must not receive an old attack's primary hits.
    if (!this.canAttack() || !validTarget && !(mode === 3 && input)) return false;
    const victim = validTarget ? target : null;
    const group = mode === 3 ? [paths[3], ...additional] : [paths[mode]];
    const state = { seq: this.u.deploySeq, born: this.b.time, remaining: group.length,
      complete: false, failed: false, timers: [], projectiles: new Set(), pendingTrace: new Map(),
      origin: { x: this.u.x, y: this.u.y }, mode, attackId };
    this.flight = state;
    state.limit = Math.min(...group.map(g => g.body._lifeTime));
    const current = () => live(this.u) && this.u.deploySeq === state.seq && this.flight === state;
    const remaining = () => Math.max(0, state.born + state.limit - this.b.time);
    const finish = (failed = false) => {
      if (state.complete) return;
      state.failed ||= failed;
      if (!failed && --state.remaining > 0) return;
      state.complete = true;
      for (const timer of state.timers) timer.cancel();
      this.b.projectiles.remove(p => state.projectiles.has(p));
      if (!state.failed && mode === 3 && current() && this.u.skill.active && this.u.skill.id === 'skchr_narant_3')
        this.s3Followup(attackId, bb);
      if (this.flight === state) this.flight = null;
    };
    if (victim) for (const source of group)
      state.pendingTrace.set(source.name, { target: victim, seq: victim.deploySeq, source });
    state.timers.push(this.b.after(state.limit, () => {
      // Native ordinary/S2/S3 bodies retain a final trace hit. Apply it only
      // for a still-unhit original life; expiry does not fabricate hand return.
      for (const { target: e, seq, source } of state.pendingTrace.values())
        if (source.body._alwaysHitTraceTargetInTheEnd === 1 && e.deploySeq === seq && this.legal(e))
          this.impact(e, mode ? bb['attack@atk_scale'] : 1, attackId,
            mode ? `s${mode}` : 'normal', { slow: mode === 2 ? bb['attack@sluggish'] : 0, deployment: state.seq });
      finish(true);
    }));
    const add = (spec, source) => {
      if (state.complete || remaining() <= 1e-9) return false;
      const p = this.b.addProjectile({ ...spec, source: this.u, maxAge: remaining(), hitDead: true,
        data: { arkpediaTrackedVisual: true, narantVariant: source.name, narantMode: mode,
          narantCurveHeight: source.mover._curveHeight ?? 0,
          narantClockwiseOffset: source.mover._clockwiseOffset ?? 0 } });
      state.projectiles.add(p); return p;
    };
    const delay = (seconds, fn) => {
      if (!state.complete) state.timers.push(this.b.after(seconds, () => { if (!state.complete) fn(); }));
    };
    const hand = (from, source) => {
      const hit = new Set();
      add({ from, ...(current() ? { target: this.u } : { to: state.origin }),
        speed: source.mover._speed * source.mover._comeBackSpeedScale,
        expireInPlace: true, visual: 'boomerangReturn',
        onMove: mode === 2 ? ({ previous, x, y }) => {
          const contacts = this.b.enemies.filter(e => !hit.has(e) && this.legal(e, true, true))
            .map(e => ({ e, t: narantContactTime(e, previous, { x, y }, returnRadius) }))
            .filter(c => c.t !== null).sort((a, z) => a.t - z.t || a.e.spawnSeq - z.e.spawnSeq);
          for (const { e } of contacts) {
            hit.add(e); this.impact(e, bb['attack@atk_scale_comeback'], attackId, 's2-return', { deployment: state.seq });
          }
        } : null,
        onHit: ({ x, y }) => {
          const home = current() ? this.u : state.origin;
          finish(Math.hypot(x - home.x, y - home.y) > 1e-6);
        } }, source);
    };
    const recentlyHit = new Map(), everHit = new Set();
    let bounces = mode === 1 ? bb['attack@times'] : 0;
    const outward = (victim, from, source, speed) => add({ from,
      ...(victim ? { target: victim } : { to: { x: input.x, y: input.y } }), speed,
      visual: 'boomerang', expireInPlace: mode === 1,
      onHit: ({ target: e, x, y }) => {
        if (state.complete) return;
        const point = { x, y };
        if (remaining() <= 1e-9) { finish(true); return; }
        if (this.legal(e)) {
          this.impact(e, mode ? bb['attack@atk_scale'] : 1, attackId,
            mode ? `s${mode}` : 'normal', { slow: mode === 2 ? bb['attack@sluggish'] : 0, deployment: state.seq });
          recentlyHit.set(e, this.b.time); everHit.add(e);
        }
        state.pendingTrace.delete(source.name);
        if (mode === 1 && bounces > 0) {
          const next = this.b.enemiesInRadius(x, y, bounceRadius)
            .filter(a => a !== e && a !== victim && this.legal(a, true))
            .sort((a, z) => Number(everHit.has(a)) - Number(everHit.has(z))
              || bodyDist(a, x, y) - bodyDist(z, x, y) || a.spawnSeq - z.spawnSeq);
          let choice = next.find(a => !recentlyHit.has(a)
            || this.b.time - recentlyHit.get(a) >= source.body._keepAlreadyHitTime);
          if (!choice && next.length) { recentlyHit.clear(); choice = next[0]; }
          if (choice) { bounces--; outward(choice, point, source, source.mover._speedAfterFirstReach); return; }
        }
        if (mode === 2) {
          const dx = x - state.origin.x, dy = y - state.origin.y, n = Math.hypot(dx, dy);
          const [dr, dc] = dirVec(this.u.dir), duration = bb['attack@move_ahead_time'];
          const distance = source.mover._moveAheadSpeed * duration;
          const to = { x: x + (n ? dx / n : dc) * distance, y: y + (n ? dy / n : dr) * distance };
          add({ from: point, to, flightTime: duration, speed: source.mover._moveAheadSpeed,
            expireInPlace: true, visual: 'boomerang', onHit: ({ x, y }) => hand({ x, y }, source) }, source);
        } else delay(source.mover._delayTime ?? source.mover._delayAfterReached, () => hand(point, source));
      } }, source);
    for (const source of group) outward(victim, state.origin, source, source.mover._speed);
    return state;
  }
}
