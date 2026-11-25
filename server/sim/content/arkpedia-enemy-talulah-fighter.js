// SPDX-License-Identifier: GPL-3.0-or-later
// Talulah, the Fighter (enemy_3002_ftrtal) and the Patrol Captains' neutral-mark shots (enemy_1107_uoffcr, _2).
// Every number arrives in `p` from the reviewed contract (shared/arkpedia/enemy-talulah-fighter-features.js).
// The Fighter is a neutral unit (the runtime plan's side 'neutral'): operators never select her, she holds neither a
// wave nor the battle, and the generic enemy attack (which looks for operators) is off. She attacks hostile enemies
// herself, exits without cost and takes `lifeOnDeath` life points when killed.
import { canTargetEnemy } from '../targeting.js';
import { applyBurningBreath, BURNING_BREATH } from './arkpedia-burning-breath.js';

const RAGE = 'ftrtal_t_halfhp[up]', CAST = 'ab:talulahFighterCast', SHOT_CAST = 'ab:neutralShotCast';
const live = u => u?.alive && u.deployed !== false && !u.hidden;
const dist2 = (a, u) => (u.x - a.x) ** 2 + (u.y - a.y) ** 2;
const byDistance = e => (x, y) => dist2(e, x) - dist2(e, y) || String(x.id).localeCompare(String(y.id));

export function talulahFighter(p) {
  validateFighter(p);
  // Her selectors: hostile enemies (ground and air), not untargetable, never a placed enemy-side object (tap_roadblock).
  const hostiles = (b, e, radius, extra = null) => b.enemiesInRadius(e.x, e.y, radius)
    .filter(u => u !== e && live(u) && u.side === 'enemy' && !u.mem?.stageUnitDevice
      && canTargetEnemy(e, u, { canHitFly: true }) && (!extra || extra(u)))
    .sort(byDistance(e));
  const shoot = (b, e, target) => b.addProjectile({ from: e, target, speed: p.shot.speed, visual: 'enemy', source: e, onHit: h => {
    if (h.target?.alive) b.dealDamage(e, h.target, { amount: e.s.atk * p.shot.scale, type: 'arts', isAttack: true,
      applyWay: 'ranged', tags: ['talulahFighterShot'] });
  } });
  const release = (b, e, a) => {
    const { skill: s, target } = a.cast;
    if (s.kind === 'breath') { if (live(target)) applyBurningBreath(b, e, target, s, { tag: 'talulahFighterBreath' }); return; }
    for (const u of hostiles(b, e, s.radius))
      b.dealDamage(e, u, { amount: e.s.atk * s.scale, type: 'arts', isSkill: true, isSplash: true, applyWay: 'none', tags: ['talulahFighterCorona'] });
  };
  const stand = (b, e, dur) => b.addBuff(e, { key: CAST, duration: dur, refresh: 'replace', flags: { noMove: true } });
  const enrage = (b, e, a) => {
    a.half = true;
    b.addBuff(e, { key: RAGE, persist: true, visible: true, mods: { defPct: p.half.defPct, resPct: p.half.resPct } });
    for (const s of p.skills) if (s.half) a.left[s.key] = s.initial;
  };
  return {
    spawn(b, e, a) {
      a.half = false; a.cast = null; a.shot = null; a.shotCd = 0; a.left = {};
      for (const s of p.skills) if (!s.half) a.left[s.key] = s.initial;
      // The generic enemy attack selects operators; she never attacks them.
      e.profile.noAttack = true; e.profile.neutralExit = true;
      e.base.rangeRadius = p.radius; e.markDirty?.();
      // NeutralTag: mark_neutral[effect] (BLOCK_FREE, sleep immune), for life.
      b.addBuff(e, { key: p.mark, persist: true, flags: { unblockable: true } });
      e.def = { ...e.def, immune: new Set([...(e.def.immune ?? []), 'sleep']) };
    },
    tick(b, e, a, dt) {
      if (!e.alive) return;
      if (!a.half && e.hp < e.s.maxHp * p.half.ratio) enrage(b, e, a);
      const active = p.skills.filter(s => s.half === a.half);
      for (const s of active) a.left[s.key] -= dt;
      a.shotCd -= dt;
      if (a.cast) {
        a.cast.elapsed += dt * e.s.slowDownRate;
        if (!a.cast.released && a.cast.elapsed + 1e-9 >= a.cast.skill.anim.hit) { a.cast.released = true; release(b, e, a); }
        if (a.cast.elapsed + 1e-9 >= a.cast.skill.anim.dur) { a.cast = null; b.removeBuff(e, CAST); }
        return;
      }
      if (a.shot) {
        a.shot.elapsed += dt * e.s.slowDownRate;
        if (!a.shot.released && a.shot.elapsed + 1e-9 >= p.shot.anim.hit) { a.shot.released = true; if (live(a.shot.target)) shoot(b, e, a.shot.target); }
        if (a.shot.elapsed + 1e-9 >= p.shot.anim.dur) { a.shot = null; b.removeBuff(e, CAST); }
        return;
      }
      if (!e.canAct || e.s.flags.disarm) return;
      // Skills first (highest priority, then list order), each needing its own target.
      for (const s of active.filter(s => a.left[s.key] <= 1e-9).sort((x, y) => y.priority - x.priority)) {
        const target = s.kind === 'breath' ? hostiles(b, e, p.radius, u => !u.findBuff(BURNING_BREATH))[0] ?? null
          : hostiles(b, e, s.radius).length ? e : null;
        if (!target) continue;
        a.left[s.key] = s.cooldown;
        a.cast = { skill: s, target, elapsed: 0, released: false };
        stand(b, e, s.anim.dur); e.skillAnimUntil = b.time + s.anim.dur;
        return;
      }
      if (a.shotCd > 1e-9) return;
      const target = hostiles(b, e, p.radius)[0];
      if (!target) return;
      a.shotCd = e.s.interval;
      a.shot = { target, elapsed: 0, released: false };
      b._ev(['atk', e.id, target.id, 'none']);
      stand(b, e, p.shot.anim.dur);
    },
    death(c, b, e) {
      // upeople_t: ON_OWNER_KILLED → ModifyLifePoint(dead.value). An exit is not a kill.
      if (c.reason === 'killed' && typeof b.life === 'number') b.life += p.lifeOnDeath;
    },
  };
}

/** The Patrol Captain's ranged mode: while unblocked, one ground unit carrying the neutral mark within its radius. */
export function neutralShot(p) {
  validateShot(p);
  return {
    spawn(b, e, a) { a.shot = null; },
    tick(b, e, a, dt) {
      if (!e.alive) return;
      if (a.shot) {
        a.shot.elapsed += dt * e.s.slowDownRate;
        const t = a.shot.target;
        if (!a.shot.released && a.shot.elapsed + 1e-9 >= p.anim.hit) {
          a.shot.released = true;
          if (live(t)) b.addProjectile({ from: e, target: t, speed: p.speed, visual: 'enemy', source: e, onHit: h => {
            if (h.target?.alive) b.dealDamage(e, h.target, { amount: e.s.atk * p.scale, type: 'phys', isAttack: true, applyWay: 'ranged', tags: ['neutralShot'] });
          } });
        }
        if (a.shot.elapsed + 1e-9 >= p.anim.dur) { a.shot = null; b.removeBuff(e, SHOT_CAST); }
        return;
      }
      if (e.blockedBy || !e.canAct || e.s.flags.disarm || e.atkCd > 1e-9) return;
      const r2 = p.radius * p.radius + 1e-9;
      const target = b.neutralUnits.filter(u => live(u) && !u.isFlying && u.findBuff(p.mark) && dist2(e, u) <= r2).sort(byDistance(e))[0];
      if (!target) return;
      e.atkCd = e.s.interval;
      a.shot = { target, elapsed: 0, released: false };
      b._ev(['atk', e.id, target.id, 'none']);
      b.addBuff(e, { key: SHOT_CAST, duration: p.anim.dur, refresh: 'replace', flags: { noMove: true } });
    },
  };
}

const pos = v => Number.isFinite(v) && v > 0;
const anim = x => pos(x?.dur) && pos(x.hit) && x.hit <= x.dur;
function validateFighter(p) {
  const ok = pos(p?.radius) && pos(p.shot?.scale) && pos(p.shot.speed) && anim(p.shot.anim)
    && p.half?.ratio > 0 && p.half.ratio < 1 && Number.isFinite(p.half.defPct) && Number.isFinite(p.half.resPct)
    && Number.isFinite(p.lifeOnDeath) && p.lifeOnDeath < 0 && typeof p.mark === 'string'
    && Array.isArray(p.skills) && p.skills.every(s => typeof s.key === 'string' && Number.isInteger(s.priority) && s.cooldown >= 0 && s.initial >= 0 && anim(s.anim)
      && (s.kind === 'breath' ? pos(s.duration) && s.base >= 0 && s.add >= 0 && pos(s.ramp) : s.kind === 'corona' && pos(s.scale) && pos(s.radius)));
  if (!ok) throw Error('Invalid Talulah, the Fighter parameters');
}
function validateShot(p) {
  if (!(pos(p?.radius) && pos(p.scale) && pos(p.speed) && anim(p.anim) && typeof p.mark === 'string')) throw Error('Invalid neutral shot parameters');
}
