// SPDX-License-Identifier: GPL-3.0-or-later
// Talulah (enemy_1503_talula). Every number arrives in `p` from the reviewed contract
// (shared/arkpedia/enemy-talulah-features.js). Native modes: Default and HalfState (enraged).
import { sortAllyTargets, canTargetAlly } from '../targeting.js';
import { ALLY_COLLIDER_RADIUS } from '../constants.js';
import { applyBurningBreath } from './arkpedia-burning-breath.js';

const BREATH = 'dragon_fire', RAGE = 'ftrtal_t[rage]', CAST = 'ab:talulahCast';
const live = u => u?.alive && u.deployed !== false && !u.hidden;

export function talulah(p) {
  validate(p);

  // --- Burning Breath: true damage each second rising from `base` to `base + add` over `ramp` s; resisted (duration) ---
  const breathe = (b, e, target, s) => { applyBurningBreath(b, e, target, s, { tag: 'talulahBreath' }); };
  // DragonFire's trigger has no collider: one operator anywhere on the field that is not already burning.
  const breathTarget = (b, e) => sortAllyTargets(e, b.allies().filter(u => live(u) && canTargetAlly(e, u, true) && !u.findBuff(BREATH)))[0] ?? null;
  const coronaTargets = (b, e, s) => b.alliesInRadius(e.x, e.y, s.radius + ALLY_COLLIDER_RADIUS).filter(u => live(u) && canTargetAlly(e, u, true));

  const release = (b, e, a) => {
    const { skill: s, target } = a.cast;
    if (s.kind === 'breath') { if (live(target)) breathe(b, e, target, s); return; }
    for (const u of coronaTargets(b, e, s))
      b.dealDamage(e, u, { amount: e.s.atk * s.scale, type: 'arts', isSkill: true, isSplash: true, applyWay: 'none', tags: ['talulahCorona'] });
  };
  const finish = (b, e, a) => { a.cast = null; e.profile.noAttack = false; e.skillAnimUntil = b.time; b.removeBuff(e, CAST); };
  const enrage = (b, e, a) => {
    a.half = true;
    b.addBuff(e, { key: RAGE, persist: true, visible: true, mods: { defPct: p.half.defPct, resPct: p.half.resPct } });
    // HalfState uses the [Half] skills, each from its own initial cooldown.
    for (const s of p.skills) if (s.half) a.left[s.key] = s.initial;
  };

  return {
    spawn(b, e, a) {
      a.half = false; a.cast = null; a.left = {};
      for (const s of p.skills) if (!s.half) a.left[s.key] = s.initial;
      e.profile.shot = 'none'; e.profile.deferHit = true;
      e.base.rangeRadius = p.radius; e.markDirty?.();
      e.def = { ...e.def, attackAnim: p.ranged.anim };
    },
    attack(c, b, e) {
      const target = c.targets.find(u => u?.alive);
      if (!target) return;
      const attackId = b._attackSeq;
      if (e.blockedBy && target === e.blockedBy) {
        b.dealDamage(e, target, { amount: e.s.atk * p.melee.scale, type: 'true', isAttack: true, attackId, applyWay: 'melee', tags: ['talulahMelee'] });
        return;
      }
      b.addProjectile({ from: e, target, speed: p.ranged.speed, visual: 'enemy', source: e, onHit: h => {
        if (h.target?.alive) b.dealDamage(e, h.target, { amount: e.s.atk * p.ranged.scale, type: 'arts', isAttack: true, attackId,
          applyWay: 'ranged', tags: ['talulahShot'] });
      } });
    },
    tick(b, e, a, dt) {
      if (!e.alive) return;
      if (!a.half && e.hp <= e.s.maxHp * p.half.ratio + 1e-9 && (p.half.ratio >= 1 || e.hp < e.s.maxHp * p.half.ratio)) enrage(b, e, a);
      e.def.attackAnim = e.blockedBy ? p.melee.anim : p.ranged.anim;
      const active = p.skills.filter(s => s.half === a.half);
      for (const s of active) a.left[s.key] -= dt; // cooldowns run from the cast start
      if (a.cast) {
        a.cast.elapsed += dt * e.s.slowDownRate;
        if (!a.cast.released && a.cast.elapsed + 1e-9 >= a.cast.skill.anim.hit) { a.cast.released = true; release(b, e, a); }
        if (a.cast.elapsed + 1e-9 >= a.cast.skill.anim.dur) finish(b, e, a);
        return;
      }
      if (!e.canAct) return;
      // The highest priority ready skill with a target (each trigger needs one); ties go to list order.
      const ready = active.filter(s => a.left[s.key] <= 1e-9).sort((x, y) => y.priority - x.priority);
      for (const s of ready) {
        const target = s.kind === 'breath' ? breathTarget(b, e) : coronaTargets(b, e, s).length ? e : null;
        if (!target) continue;
        a.left[s.key] = s.cooldown;
        a.cast = { skill: s, target, elapsed: 0, released: false };
        e.profile.noAttack = true; e.skillAnimUntil = b.time + s.anim.dur;
        b.addBuff(e, { key: CAST, persist: true, flags: { noMove: true } });
        return;
      }
    },
  };
}

function validate(p) {
  const pos = v => Number.isFinite(v) && v > 0;
  const anim = x => pos(x?.dur) && pos(x.hit) && x.hit <= x.dur;
  const ok = pos(p?.radius) && pos(p.ranged?.scale) && pos(p.ranged.speed) && anim(p.ranged.anim) && pos(p.melee?.scale) && anim(p.melee.anim)
    && p.half?.ratio > 0 && p.half.ratio <= 1 && Number.isFinite(p.half.defPct) && Number.isFinite(p.half.resPct)
    && Array.isArray(p.skills) && p.skills.every(s => typeof s.key === 'string' && Number.isInteger(s.priority) && s.cooldown >= 0 && s.initial >= 0 && anim(s.anim)
      && (s.kind === 'breath' ? pos(s.duration) && s.base >= 0 && s.add >= 0 && pos(s.ramp) : s.kind === 'corona' && pos(s.scale) && pos(s.radius)));
  if (!ok) throw Error('Invalid Talulah parameters');
}
