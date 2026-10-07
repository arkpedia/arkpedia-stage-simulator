// SPDX-License-Identifier: GPL-3.0-or-later
import { acquireTargets, effectiveProfile, resolveHit } from '../ai.js';
import { canTargetEnemy } from '../targeting.js';

const plain = profile => ({ ...profile, hits: 1, hitsFn: null, chain: null, dmgMul: null });
function projectile(battle, unit, target, profile, info, speed, from = unit, hit = null) {
  return battle.addProjectile({ from, target, speed, source: unit, visual: profile.projectile || 'bolt',
    data: { arkpediaTrackedVisual: true }, onHit: ctx => {
      if (!ctx.target) return;
      resolveHit(battle, unit, profile, ctx.target, info, ctx.x, ctx.y);
      if (hit) hit(ctx.target);
    } });
}
function droneScale(unit, target) {
  const bb = unit.def.traitBb;
  const initial = bb.init_atk_scale ?? .2, increment = bb.delta_atk_scale ?? .15;
  if (unit.trait.funnelTarget !== target.id) {
    unit.trait.funnelTarget = target.id; unit.trait.funnelScale = initial;
  } else unit.trait.funnelScale = Math.min(bb.max_atk_scale ?? 1.1, unit.trait.funnelScale + increment);
  return unit.trait.funnelScale;
}
function droneHit(battle, unit, target, profile, info) {
  const p = { ...plain(profile), atkScale: droneScale(unit, target), projectile: 'drone' };
  resolveHit(battle, unit, p, target, info, target.x, target.y);
}
function clickLaunch(battle, unit, profile, target, info) {
  projectile(battle, unit, target, plain(profile), info, 10);
  if (!profile.isSkill || unit.skill.def.id !== 'skchr_cammou_2') {
    const p = { ...plain(profile), atkScale: droneScale(unit, target), projectile: 'drone' };
    projectile(battle, unit, target, p, info, 10);
    return;
  }
  if (unit.mem.clickDrone) return;
  const seq = unit.deploySeq, activation = unit.skill.activations;
  const state = unit.mem.clickDrone = { target, cooldown: 0, activation };
  const stop = () => { if (unit.mem.clickDrone === state) unit.mem.clickDrone = null; battle.off(timer); };
  const valid = () => unit.alive && unit.deployed && unit.deploySeq === seq
    && unit.skill.active && unit.skill.activations === activation && target.alive;
  const tick = dt => {
    if (!valid()) { stop(); return; }
    // A locked enemy may tunnel or otherwise become untargetable. Missed
    // periods never become a backlog of hits when it reappears.
    state.cooldown = Math.max(0, state.cooldown - dt);
    if (state.cooldown <= 1e-9 && canTargetEnemy(unit, target, profile)) {
      // Source persistent funnel projectile attacks its locked trace target,
      // independently from Click's selector, including beyond her range.
      droneHit(battle, unit, target, profile, info);
      state.cooldown = unit.s.interval;
    }
  };
  const timer = battle.on('tick', ({ dt }) => tick(dt), { owner: unit });
  tick(0); // original controller _waitFirstPeriod=0
}
function indigoLaunch(battle, unit, profile, target, info) {
  const count = 1 + unit.trait.stored;
  unit.trait.stored = 0; unit.trait.storeAcc = 0;
  for (let i = 0; i < count; i++)
    projectile(battle, unit, target, plain(profile), info, 20);
}
function puddingLaunch(battle, unit, profile, target, info) {
  const second = profile.isSkill && unit.skill.def.id === 'skchr_pudd_2';
  if (!second) {
    unit.mem.puddingProjectile = true;
    const p = battle.addProjectile({ from: unit, target, speed: 15, source: unit, visual: 'chain',
      data: { arkpediaTrackedVisual: true }, onHit: ctx => {
        unit.mem.puddingProjectile = false;
        if (ctx.target) resolveHit(battle, unit, profile, ctx.target, info, ctx.x, ctx.y);
      } });
    // A target dying midflight also releases the normal wait-for-projectile cast.
    const timer = battle.on('tick', () => {
      if (!battle.projectiles.list.includes(p)) { unit.mem.puddingProjectile = false; battle.off(timer); }
    }, { owner: unit });
    return;
  }
  const seen = new Set(), p = plain(profile), max = unit.skill.bb['attack@max_target'];
  let bounce = 0;
  const fly = (from, to, speed) => {
    battle.addProjectile({ from, target: to, speed, source: unit, visual: 'chain',
      data: { arkpediaTrackedVisual: true }, onHit: ctx => {
        if (!ctx.target) return;
        const hit = ctx.target; seen.add(hit.id);
        resolveHit(battle, unit, { ...p, atkScale: Math.pow(.85, bounce) }, hit, info, hit.x, hit.y);
        if (hit.alive) battle.applyStatus(hit, 'sluggish', { duration: .5, source: unit });
        if (bounce >= max) return;
        const candidates = battle.enemiesInRadius(ctx.x, ctx.y, 1.7)
          .filter(e => e !== hit && canTargetEnemy(unit, e, p));
        candidates.sort((a, b) => Math.hypot(a.x - ctx.x, a.y - ctx.y)
          - Math.hypot(b.x - ctx.x, b.y - ctx.y) || a.spawnSeq - b.spawnSeq);
        const next = candidates.find(e => !seen.has(e.id)) ?? candidates[0];
        if (!next) return;
        bounce++;
        // Original skill projectile: speed10 then6, min .15s per damage event;
        // repetition is permitted only when no unused nearby target exists.
        const distance = Math.hypot(next.x - ctx.x, next.y - ctx.y);
        const wait = Math.max(0, .15 - distance / 6);
        battle.after(wait, () => fly({ x: ctx.x, y: ctx.y }, next, 6));
      },
    });
  };
  fly(unit, target, 10);
}

export function customizeCasterExpansionKit({ id, def, kit }) {
  if (!['char_328_cammou', 'char_469_indigo', 'char_4004_pudd'].includes(id) || !def.skill) return;
  const skill = def.skill, bb = skill.bb;
  kit.install = null;
  kit.skill = { id: skill.id, name: skill.name, kind: 'duration', duration: skill.duration };
  if (id === 'char_328_cammou') {
    kit.trait = { install: null, dmgMul: null, hitsFn: null, launchAttack: clickLaunch,
      windup: (_b, u) => .567 * 100 / u.s.aspd, attackVisual: 'Attack', interruptOnSkillChange: true };
    kit.skill.mods = { atkPct: bb.atk };
    if (skill.id === 'skchr_cammou_2') {
      kit.skill.targeting = { rangeGrid: skill.rangeGrid };
      kit.skill.attack = { dmgType: 'arts', windup: (_b, u) => .5 * 100 / u.s.aspd,
        attackVisual: 'Skill2_Loop', onEachHit: ({ battle, unit, target }) => {
        if (target.alive && battle.rng.chance(bb['attack@prob']))
          battle.applyStatus(target, 'stun', { duration: bb['attack@stun'], source: unit });
      } };
      kit.skill.onEnd = ({ unit }) => { unit.mem.clickDrone = null; };
    }
  } else if (id === 'char_469_indigo') {
    kit.trait = { install: null, hitsFn: null, launchAttack: indigoLaunch,
      windup: (_b, u) => (u.trait.stored ? 1.167 : .833) * 100 / u.s.aspd,
      attackVisual: 'Attack', interruptOnSkillChange: true };
    kit.skill.mods = { batMul: skill.id === 'skchr_indigo_1' ? 1 + bb.base_attack_time : bb.base_attack_time };
    kit.skill.attack = { dmgType: 'arts', windup: .4, retargetOnRelease: true, interruptOnSkillChange: true, attackVisual: 'Skill_Loop' };
    if (skill.id === 'skchr_indigo_1') {
      kit.skill.attack.atkScale = bb['attack@atk_scale'];
      kit.skill.targeting = { rangeGrid: skill.rangeGrid };
    } else {
      kit.skill.onStart = ({ battle, unit }) => startIndigoAura(battle, unit);
      kit.skill.onEnd = ({ unit }) => unit.mem.indigoAura?.stop();
    }
  } else {
    kit.trait = { launchAttack: puddingLaunch,
      canAttack: (_b, u) => !u.mem.puddingProjectile, windup: (_b, u) => .4 * 100 / u.s.aspd,
      attackVisual: 'Attack', interruptOnSkillChange: true };
    kit.skill.mods = skill.id === 'skchr_pudd_2' ? { atkPct: bb.atk } : { aspd: bb.attack_speed };
    if (skill.id === 'skchr_pudd_2') kit.skill.attack = { dmgType: 'arts', chain: null, hits: 1, attackVisual: 'Skill' };
  }
}

function startIndigoAura(battle, unit) {
  unit.mem.indigoAura?.stop();
  const owned = new Map(), bb = unit.skill.bb;
  const sync = () => {
    const active = new Set(battle.enemiesInKeys(unit.rangeKeys, unit, { canHitFly: true }));
    for (const [target, entry] of owned) if (!active.has(target) || !target.s.flags.bind) {
      entry.cancel(); owned.delete(target);
    }
    for (const target of active) {
      if (!target.s.flags.bind || owned.has(target)) continue;
      // Original aura polls at .2s; a derived damage buff waits its first interval.
      const clock = battle.every(bb['indigo_s_2[damage].interval'], () => {
        if (!unit.skill.active || !target.alive || !target.s.flags.bind
          || !battle.enemiesInKeys(unit.rangeKeys, unit, { canHitFly: true }).includes(target)) return;
        battle.dealDamage(unit, target, { amount: unit.s.atk * bb['indigo_s_2[damage].atk_scale'],
          type: 'arts', isSkill: true, tags: ['indigo:aura'] });
      }, { owner: unit });
      owned.set(target, clock);
    }
  };
  const poll = battle.every(.2, sync, { owner: unit });
  const stop = () => { poll.cancel(); for (const clock of owned.values()) clock.cancel(); owned.clear(); };
  unit.mem.indigoAura = { stop };
}

export function installCasterExpansion({ battle, unit, def }) {
  if (def.charId === 'char_328_cammou') {
    unit.trait.funnelTarget = null; unit.trait.funnelScale = def.traitBb.init_atk_scale ?? .2;
  } else if (def.charId === 'char_469_indigo') {
    unit.trait.stored = 0; unit.trait.storeAcc = 0;
    battle.on('beforeAttack', ctx => {
      if (ctx.attacker === unit && !ctx.isSkill) ctx.profile.attackVisual = unit.trait.stored ? 'Attack_Charge' : 'Attack';
    }, { owner: unit });
    const talent = def.talents[0]?.bb;
    if (talent) {
      unit.profile.canTarget = (_u, target) => !target.s.flags.bind;
      unit.profile.onEachHit = (b, u, target, hit) => {
        const scale = hit.isSkill && def.skill.id === 'skchr_indigo_2' ? def.skill.bb.talent_scale : 1;
        if (target.alive && b.rng.chance(talent.prob * scale))
          b.applyStatus(target, 'bind', { source: u, duration: talent.duration });
      };
    }
    battle.on('tick', ({ dt }) => {
      if (!unit.canAct || unit.s.flags.disarm) return;
      const targets = acquireTargets(battle, unit, effectiveProfile(unit));
      if (targets.length) { unit.trait.storeAcc = 0; return; }
      if (unit.trait.stored >= (def.traitBb.times ?? 3)) return;
      unit.trait.storeAcc += dt;
      if (unit.trait.storeAcc >= unit.s.interval - 1e-9) {
        unit.trait.storeAcc -= unit.s.interval; unit.trait.stored++;
      }
    }, { owner: unit });
    const end = ({ unit: removed }) => { if (removed === unit) unit.mem.indigoAura?.stop(); };
    battle.on('retreat', end, { owner: unit }); battle.on('death', end, { owner: unit });
  }
}
