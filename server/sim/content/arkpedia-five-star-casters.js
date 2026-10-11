// SPDX-License-Identifier: GPL-3.0-or-later
import { FIVE_STAR_CASTER_OPERATORS } from '../../../shared/arkpedia/five-star-caster-operators.js';
import { resolveHit } from '../ai.js';
import { canTargetEnemy } from '../targeting.js';

const single = p => ({ ...p, hits: 1, hitsFn: null, chain: null, splashRadius: 0, dmgMul: null });
const cappedWindup = (seconds, cap = 1) => (_b, u) => seconds / Math.min(cap, u.s.aspd / 100);
function fly(b, u, target, profile, info, speed, options = {}) {
  return b.addProjectile({ from: u, target, speed, source: u,
    visual: profile.projectile || 'bolt', data: { arkpediaTrackedVisual: true }, ...options,
    onHit: ({ target, x, y }) => {
      if (target && canTargetEnemy(u, target, profile) || !target && profile.splashRadius > 0)
        resolveHit(b, u, profile, target, info, x, y);
    } });
}
function funnelScale(u, target) {
  const bb = u.def.traitBb;
  if (u.trait.funnelTarget !== target.id) {
    u.trait.funnelTarget = target.id; u.trait.funnelScale = bb.init_atk_scale;
  } else u.trait.funnelScale = Math.min(bb.max_atk_scale, u.trait.funnelScale + bb.delta_atk_scale);
  return u.trait.funnelScale;
}
function minimalLaunch(b, u, prof, target, info) {
  const p = single(prof), second = prof.isSkill && u.skill.def.id === 'skchr_malist_2';
  const release = () => {
    if (!canTargetEnemy(u, target, p)) return;
    fly(b, u, target, p, info, 10);
    fly(b, u, target, { ...p, projectile: 'drone', atkScale: (p.atkScale ?? 1) * funnelScale(u, target) }, info, 10);
  };
  release();
  if (!second) return;
  // Original Skill_2 attack events are .333 and .533 seconds. Action feeds
  // are not restricted to the first release; see the evidence's dispatch caveat.
  const seq = u.deploySeq, controlEpoch = u.attackControlEpoch;
  let cancelled = false;
  const valid = () => u.canAct && !u.s.flags.disarm && u.deploySeq === seq
    && u.attackControlEpoch === controlEpoch;
  const monitor = b.every(b.dt, () => { if (!valid()) cancelled = true; }, { owner: u });
  b.after(.2 * 100 / u.s.aspd, () => {
    monitor.cancel();
    if (!cancelled && valid()) release();
  }, { owner: u });
}
function amiyaLaunch(b, u, prof, target, info) {
  const second = prof.isSkill && u.skill.def.id === 'skchr_amiya_2';
  if (!second) {
    fly(b, u, target, single(prof), info, 10,
      prof.dmgType === 'true' ? {} : { flightTime: .15 });
    return;
  }
  const p = single(prof), seq = u.deploySeq, activation = u.skill.activations,
    controlEpoch = u.attackControlEpoch;
  const valid = () => u.canAct && !u.s.flags.disarm && u.deploySeq === seq
    && u.skill.active && u.skill.activations === activation && u.attackControlEpoch === controlEpoch;
  let cancelled = false, left = u.skill.bb['attack@times'];
  const shoot = () => {
    if (cancelled || !valid()) return;
    // Each bullet uses the original random single-target selector at cast time.
    const targets = b.enemiesInKeys(u.rangeKeys, u, p);
    if (targets.length) fly(b, u, b.rng.pick(targets), p, info, 10, { flightTime: .15 });
  };
  const monitor = b.every(b.dt, () => { if (!valid()) cancelled = true; }, { owner: u });
  shoot(); left--;
  for (let i = 1; i < u.skill.bb['attack@times']; i++) b.after(i * .1, () => {
    shoot(); if (--left === 0) monitor.cancel();
  }, { owner: u });
  if (!left) monitor.cancel();
}
function skyfireLaunch(b, u, prof, target, info) {
  if (!prof.isSkill || u.skill.def.id !== 'skchr_skfire_2') {
    // The original normal ability is a direct area attack, with no projectile.
    const p = single(prof);
    for (const e of b.enemiesInRadius(target.x, target.y, 1.1))
      if (canTargetEnemy(u, e, p)) resolveHit(b, u, p, e, info, e.x, e.y);
    return;
  }
  // The meteor's controller neither follows nor updates its target. Its
  // lifetime is 1.5s and it only checks collision when that lifetime ends.
  const point = { x: target.x, y: target.y }, p = single(prof);
  b.addProjectile({ from: { x: point.x, y: point.y - 3 }, to: point,
    speed: 2, flightTime: 1.5, source: u, visual: 'orb',
    data: { arkpediaTrackedVisual: true }, onHit: () => {
      for (const e of b.enemiesInRadius(point.x, point.y, 1.7)) {
        if (canTargetEnemy(u, e, p)) resolveHit(b, u, p, e, info, e.x, e.y);
      }
    } });
}
function chainLaunch(b, u, prof, target, info) {
  const halo = u.def.charId === 'char_135_halo';
  const s1 = halo && prof.isSkill && u.skill.def.id === 'skchr_halo_1';
  const count = s1 ? u.skill.bb['chain.max_target']
    : u.def.traitBb[halo ? 'attack@chain.max_target' : 'attack@max_target'];
  const falloff = !halo && prof.isSkill && u.skill.def.id === 'skchr_leizi_2' ? 1 : .85;
  const slow = s1 ? u.skill.bb.sluggish : u.def.traitBb['attack@sluggish'];
  const p = single(prof), pending = u.mem.chainProjectiles;
  let projectile;
  projectile = b.addProjectile({ from: u, target, speed: halo ? 8 : 15, source: u,
    visual: 'chain', data: { arkpediaTrackedVisual: true }, onHit: ctx => {
      pending.delete(projectile);
      if (!ctx.target || !canTargetEnemy(u, ctx.target, p)) return;
      const seen = new Set(); let hit = ctx.target;
      for (let index = 0; index < count && hit; index++) {
        seen.add(hit.id);
        resolveHit(b, u, { ...p, atkScale: (p.atkScale ?? 1) * Math.pow(falloff, index) }, hit, info, hit.x, hit.y);
        if (hit.alive) b.applyStatus(hit, 'sluggish', { source: u, duration: slow });
        const previous = hit;
        const next = b.enemiesInRadius(previous.x, previous.y, 1.7)
          .filter(e => !seen.has(e.id) && canTargetEnemy(u, e, p))
          .sort((a, z) => Math.hypot(a.x - previous.x, a.y - previous.y)
            - Math.hypot(z.x - previous.x, z.y - previous.y) || a.spawnSeq - z.spawnSeq)[0];
        if (next && index + 1 < count) b._ev(['atk', previous.id, next.id, 'chain']);
        hit = next;
      }
    } });
  // Astgenne S1 is the source exception to waitForProjectileInvalid.
  if (!s1) pending.add(projectile);
}

export function customizeFiveStarCasterKit({ id, def, kit }) {
  if (!FIVE_STAR_CASTER_OPERATORS[id] || !def.skill) return;
  const skill = def.skill, bb = skill.bb;
  kit.install = null;
  const duration = mods => ({ id: skill.id, name: skill.name, kind: 'duration', duration: skill.duration, mods });
  const ranged = { attack: 'ranged', dmgType: 'arts', projectile: 'bolt', hits: 1,
    hitsFn: null, dmgMul: null, chain: null, maxTargets: 1, canHitFly: true,
    attackVisual: 'Attack', interruptOnSkillChange: true };
  if (id === 'char_4054_malist') {
    kit.trait = { ...ranged, install: null, launchAttack: minimalLaunch,
      windup: (_b, u) => .433 * 100 / u.s.aspd };
    kit.skill = skill.id === 'skchr_malist_2'
      ? { id: skill.id, name: skill.name, kind: 'charges',
        attack: { atkScale: bb.atk_scale, attackVisual: 'Skill_2', windup: (_b, u) => .333 * 100 / u.s.aspd } }
      : duration({ atkPct: bb.atk, aspd: bb.attack_speed });
  } else if (id === 'char_002_amiya') {
    kit.trait = { ...ranged, launchAttack: amiyaLaunch, windup: .483 };
    if (skill.id === 'skchr_amiya_2') kit.skill = { ...duration(null), trigger: 'SP_FULL',
      attack: { atkScale: bb['attack@atk_scale'], windup: .667, attackVisual: 'Skill_2' },
      onEnd: ({ battle, unit, reason }) => {
        if (reason === 'duration') battle.applyStatus(unit, 'stun', { source: unit, duration: bb.stun });
      } };
    else if (skill.id === 'skchr_amiya_3') kit.skill = {
      ...duration({ atkPct: bb.atk, hpPct: bb.max_hp }), targeting: { rangeGrid: skill.rangeGrid },
      attack: { dmgType: 'true', windup: .867, attackVisual: 'Skill1' },
      onEnd: ({ battle, unit, reason }) => {
        if (reason === 'duration' && unit.alive) battle.retreat(unit, { reason: 'skill', permanent: true });
      } };
    else kit.skill = duration({ aspd: bb.attack_speed });
  } else if (id === 'char_166_skfire') {
    kit.trait = { ...ranged, splashRadius: 1.1, launchAttack: skyfireLaunch,
      windup: cappedWindup(.667) };
    kit.skill = skill.id === 'skchr_skfire_2'
      ? { ...duration({ batPct: bb.base_attack_time }), attack: {
        atkScale: bb['attack@atk_scale'], splashRadius: 0, windup: .333, attackVisual: 'Skill',
        onEachHit: ({ battle, unit, target }) => {
          if (target.alive) battle.applyStatus(target, 'stun', { source: unit, duration: bb['attack@stun'] });
        } } }
      : duration({ atkPct: bb.atk });
  } else {
    const halo = id === 'char_135_halo';
    kit.trait = { ...ranged, splashRadius: 0, launchAttack: chainLaunch,
      canAttack: (_b, u) => !u.mem.chainProjectiles.size,
      windup: cappedWindup(halo ? .733 : .333, halo ? 1 : 1.2) };
    if (halo && skill.id === 'skchr_halo_1') kit.skill = { id: skill.id, name: skill.name, kind: 'charges',
      targeting: { maxTargets: bb.max_target },
      attack: { atkScale: bb.atk_scale, attackVisual: 'Skill_1' } };
    else kit.skill = { ...duration({ atkPct: bb.atk }), attack: {},
      ...(halo ? { targeting: { maxTargets: bb['attack@max_target'], rangeGrid: skill.rangeGrid },
        attack: { attackVisual: 'Skill_2_Loop' } } : {}) };
  }
}

export function installFiveStarCaster({ battle: b, unit: u, def }) {
  const id = def.charId;
  if (!FIVE_STAR_CASTER_OPERATORS[id]) return;
  const talent = def.talents.find(t => Object.keys(t.bb).length)?.bb;
  if (id === 'char_4054_malist') {
    u.trait.funnelTarget = null; u.trait.funnelScale = def.traitBb.init_atk_scale;
    if (talent) b.on('hit', ctx => {
      if (ctx.source === u && ctx.dmg.isAttack && b.rng.chance(talent.prob)) ctx.dmg.amount *= talent.atk_scale;
    }, { owner: u });
  } else if (id === 'char_002_amiya') {
    if (!talent) return;
    b.on('damaged', ({ source, target }) => {
      if (source === u && target.side === 'enemy' && target.hp > 0)
        u.skill.gainSp(talent['amiya_t_1[atk].sp'], 'talent');
    }, { owner: u });
    b.on('kill', ({ killer, victim }) => {
      if (killer === u && victim.side === 'enemy') u.skill.gainSp(talent['amiya_t_1[kill].sp'], 'talent');
    }, { owner: u });
  } else if (id === 'char_166_skfire') {
    if (!talent) return;
    b.on('hit', ctx => {
      if (u.alive && u.deployed && ctx.target.side === 'enemy' && ctx.target.blockedBy
        && ctx.dmg.type === 'arts') ctx.dmg.mul *= talent.damage_scale;
    }, { owner: u });
  } else {
    u.mem.chainProjectiles = new Set();
    b.on('tick', () => {
      for (const p of u.mem.chainProjectiles) if (!b.projectiles.list.includes(p)) u.mem.chainProjectiles.delete(p);
    }, { owner: u });
    if (!talent) return;
    if (id === 'char_306_leizi') b.on('hit', ctx => {
      if (ctx.source === u && ctx.dmg.isAttack && !ctx.target.blockedBy) ctx.dmg.amount *= talent.atk_scale;
    }, { owner: u });
    else b.every(talent.interval, () => {
      const count = u.trait.astgenneStacks = Math.min(talent.max_stack_cnt, (u.trait.astgenneStacks || 0) + 1);
      b.addBuff(u, { key: 'arkpedia:astgenne:aspd', source: u, mods: { aspd: count * talent.attack_speed } });
    }, { owner: u });
  }
}
