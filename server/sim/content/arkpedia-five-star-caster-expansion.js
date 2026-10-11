// SPDX-License-Identifier: GPL-3.0-or-later
import { FIVE_STAR_CASTER_EXPANSION_OPERATORS } from '../../../shared/arkpedia/five-star-caster-expansion-operators.js';
import { acquireTargets, effectiveProfile, performAttack, resolveHit } from '../ai.js';
import { absoluteRangeKeys, canTargetEnemy } from '../targeting.js';
import { bodyInKeys } from '../body.js';
import { COLS } from '../constants.js';

const live = u => u.alive && u.deployed;
const plain = p => ({ ...p, hits: 1, hitsFn: null, chain: null, splashRadius: 0, dmgMul: null });
const windup = (seconds, cap = Infinity) => (_b, u) => seconds / Math.min(cap, u.s.aspd / 100);
function fly(b, u, target, profile, info, onHit = null) {
  return b.addProjectile({ from: u, target, speed: 10, source: u,
    visual: profile.projectile || 'bolt', data: { arkpediaTrackedVisual: true },
    onHit: ({ target, x, y }) => {
      if (!target || !canTargetEnemy(u, target, profile)) return;
      if (onHit) onHit(target); else resolveHit(b, u, profile, target, info, x, y);
    } });
}
function mysticLaunch(b, u, prof, target, info) {
  const p = { ...plain(prof), canTarget: null }, stored = u.trait.stored;
  u.trait.stored = 0; u.trait.storeAcc = 0;
  fly(b, u, target, p, info);
  const iris = u.def.charId === 'char_338_iris';
  const talent = u.def.talents[0]?.bb.atk_scale ?? 1;
  // Iris references the same separate Charge ability in both modes. Harmonie
  // has a feedData charge group with a distinct ability for each mode.
  const storedScale = iris ? talent : p.atkScale ?? 1;
  for (let n = 0; n < stored; n++) fly(b, u, target,
    { ...p, atkScale: storedScale, projectile: 'orb' }, info);
}
function irisSleep(b, u, prof, target, info) {
  const bb = u.skill.bb, p = { ...plain(prof), canTarget: null };
  fly(b, u, target, p, info, t => {
    const key = `iris:sleep:${u.id}`;
    if (!b.applyStatus(t, 'sleep', { key, source: u, duration: bb.sleep })) return;
    const buff = t.findBuff(key);
    let finished = false;
    const explode = () => {
      if (finished || !t.alive || !t.deployed) return;
      finished = true;
      // Original wake projectile immediately reaches the target and checks its
      // radius .8 collider once at the end of its .01s lifetime.
      const point = { x: t.x, y: t.y };
      b.addProjectile({ from: point, to: point, flightTime: .01, source: u,
        visual: 'orb', data: { arkpediaTrackedVisual: true }, onHit: () => {
          for (const e of b.enemiesInRadius(point.x, point.y, .8))
            if (canTargetEnemy(u, e, { canHitFly: true }))
              resolveHit(b, u, { ...p, atkScale: bb.atk_scale }, e,
                { ...info, isSkill: true }, e.x, e.y);
        } });
    };
    buff.onExpire = explode;
    buff.onRemove = explode; // original ON_BUFF_FINISH, including a dispel.
  });
}
function directArea(b, u, prof, target, info) {
  const p = plain(prof);
  for (const e of b.enemiesInRadius(target.x, target.y, 1.1))
    if (canTargetEnemy(u, e, p)) resolveHit(b, u, p, e, info, e.x, e.y);
}
function immediateCast(b, u, lock) {
  u.mem.casterCastUntil = b.time + lock;
  u.atkCd = Math.max(u.atkCd, lock);
  const p = effectiveProfile(u), targets = acquireTargets(b, u, p);
  if (targets.length) performAttack(b, u, p, targets);
  else u.skill.end('instant');
}
function syncLeonhardt(b, u) {
  const talent = u.def.talents[0]?.bb;
  if (!talent || !live(u)) return;
  const base = new Set(absoluteRangeKeys(u.rangeGrid, u.tileR, u.tileC, u.dir, u.s.rangeExtend));
  const count = b.enemies.filter(e => e.alive && e.deployed && (
    bodyInKeys(e, base) || u.skill.active && u.skill.def.id === 'skchr_lionhd_2'
      && bodyInKeys(e, u.rangeKeySet) && canTargetEnemy(u, e, { canHitFly: true })
  )).length;
  b.addBuff(u, { key: 'leonhardt:talent', source: u,
    mods: { atkPct: talent.atk * Math.min(talent.max_valid_stack_cnt, count) } });
}
function startHarmoniePool(b, u) {
  u.mem.harmoniePool?.stop();
  const bb = u.skill.bb, owned = new Map(), key = `harmonie:pool:${u.id}`;
  const tick = dt => {
    if (!live(u) || !u.skill.active) { stop(); return; }
    // The slow validator has a target-free exception whose numeric flag is
    // not yet mapped. Until it is mapped, do not bypass hidden/untargetable.
    const active = new Set(b.enemiesInKeys(u.rangeKeys, u, { groundOnly: true }));
    for (const [target] of owned) if (!active.has(target)) {
      b.removeBuff(target, key); owned.delete(target);
    }
    for (const target of active) {
      let state = owned.get(target);
      if (!state) {
        state = { cooldown: 0 }; owned.set(target, state);
        b.addBuff(target, { key, source: u, mods: { moveMul: 1 + bb.move_speed } });
      } else state.cooldown -= dt;
      if (state.cooldown <= 1e-9) {
        b.dealDamage(u, target, { amount: bb.damage_value, type: 'arts', isSkill: true,
          tags: ['dot', 'harmonie:pool'], applyWay: 'none' });
        state.cooldown += 1;
      }
    }
  };
  const stop = () => {
    b.off(timer); for (const [target] of owned) b.removeBuff(target, key); owned.clear();
    if (u.mem.harmoniePool?.stop === stop) u.mem.harmoniePool = null;
  };
  const timer = b.on('tick', ({ dt }) => tick(dt), { owner: u });
  u.mem.harmoniePool = { stop }; tick(0);
}
function ramp(u, state, target) {
  const bb = u.def.traitBb;
  if (state.targetId !== target.id) { state.targetId = target.id; state.scale = bb.init_atk_scale; }
  else state.scale = Math.min(bb.max_atk_scale, state.scale + bb.delta_atk_scale);
  return state.scale;
}
function kjeraLaunch(b, u, prof, target, info) {
  const p = plain(prof);
  fly(b, u, target, p, info);
  if (!prof.isSkill || u.skill.def.id !== 'skchr_kjera_2') {
    fly(b, u, target, { ...p, projectile: 'drone', atkScale: ramp(u, u.trait.funnel, target) }, info);
    return;
  }
  for (let slot = 0; slot < 1 + u.skill.bb['attack@cnt']; slot++) {
    if (u.mem.kjeraDrones[slot]) continue;
    const seq = u.deploySeq, activation = u.skill.activations;
    const state = u.mem.kjeraDrones[slot] = { target,
      targetId: null, scale: 0, cooldown: .6 * 100 / u.s.aspd };
    const stop = () => {
      b.off(timer); if (u.mem.kjeraDrones[slot] === state) u.mem.kjeraDrones[slot] = null;
    };
    const valid = () => live(u) && u.deploySeq === seq && u.skill.active
      && u.skill.activations === activation && target.alive && target.deployed;
    const timer = b.on('tick', ({ dt }) => {
      if (!valid()) { stop(); return; }
      state.cooldown = Math.max(0, state.cooldown - dt);
      if (state.cooldown > 1e-9 || !canTargetEnemy(u, target, p)) return;
      const hit = { ...p, projectile: 'drone', atkScale: ramp(u, state, target) };
      b._ev(['atk', u.id, target.id, 'drone']);
      resolveHit(b, u, hit, target, info, target.x, target.y);
      state.cooldown = u.s.interval;
    }, { owner: u });
    state.stop = stop;
  }
}

export function customizeFiveStarCasterExpansionKit({ battle: b, unit: u, id, def, kit }) {
  if (!FIVE_STAR_CASTER_EXPANSION_OPERATORS[id] || !def.skill) return;
  kit.install = null;
  const s = def.skill, bb = s.bb;
  const duration = mods => ({ id: s.id, name: s.name, kind: 'duration', duration: s.duration, mods });
  kit.trait = { attack: 'ranged', dmgType: 'arts', projectile: 'bolt', canHitFly: true,
    hits: 1, hitsFn: null, dmgMul: null, splashRadius: 0, chain: null,
    maxTargets: 1, allInRange: false, install: null, attackVisual: 'Attack' };
  if (id === 'char_338_iris' || id === 'char_297_hamoni') {
    const iris = id === 'char_338_iris', first = s.id.endsWith('_1');
    Object.assign(kit.trait, { launchAttack: mysticLaunch, interruptOnSkillChange: true,
      windup: (_b, u) => (iris ? .533 : u.trait.stored ? .6 : .667) / Math.min(1, u.s.aspd / 100) });
    if (first) kit.skill = { ...duration({ batMul: bb.base_attack_time }),
      targeting: { rangeGrid: s.rangeGrid }, attack: { atkScale: bb['attack@atk_scale'],
        attackVisual: iris ? 'Attack' : 'Skill_1_Loop', retargetOnRelease: !iris,
        windup: iris ? (_b, u) => .533 / Math.max(u.s.aspd / 100, 1.667 / u.s.interval) : .4 } };
    else if (iris) kit.skill = { id: s.id, name: s.name, kind: 'instant',
      targeting: { maxTargets: bb.max_target }, attack: { launchAttack: irisSleep, atkScale: 0,
        attackVisual: 'Skill_2', windup: windup(.367, 1) },
      onStart: ({ battle, unit }) => immediateCast(battle, unit, .8) };
    else kit.skill = { ...duration({ batMul: bb.base_attack_time }),
      attack: { canTarget: (_u, target) => !!target.blockedBy, attackVisual: 'Skill_2',
        windup: (_b, u) => (u.trait.stored ? .6 : .667) / Math.min(1, u.s.aspd / 100) },
      onStart: ({ battle, unit }) => startHarmoniePool(battle, unit),
      onEnd: ({ unit }) => unit.mem.harmoniePool?.stop() };
  } else if (id === 'char_489_serum') {
    Object.assign(kit.trait, { projectile: 'none', allInRange: true,
      retargetOnRelease: true, windup: windup(.667, 1), interruptOnSkillChange: s.id.endsWith('_2') });
    kit.skill = s.id.endsWith('_2')
      ? { ...duration({ atkPct: bb.atk }), manualCancel: true, attack: {
        attackVisual: 'Skill_Loop', windup: windup(.733, 1),
        onEachHit: ({ battle, unit, target }) => {
          if (target.alive) battle.applyStatus(target, 'silence', { source: unit, duration: bb['attack@silence'] });
        } } }
      : { ...duration({ atkPct: bb.atk }), onEnd: ({ battle, unit, reason }) => {
        if (reason === 'duration') battle.applyStatus(unit, 'stun', { source: unit, duration: bb.stun });
      } };
  } else if (id === 'char_373_lionhd') {
    Object.assign(kit.trait, { launchAttack: directArea, splashRadius: 1.1, windup: windup(.333, 1) });
    kit.skill = s.id.endsWith('_2') ? { id: s.id, name: s.name, kind: 'charges',
      targeting: { rangeGrid: s.rangeGrid, allInRange: true },
      attack: { launchAttack: null, projectile: 'none', splashRadius: 0, atkScale: bb.atk_scale,
        attackVisual: 'Skill', windup: windup(.3),
        onEachHit: ({ battle, unit, target }) => {
          if (target.alive) battle.applyStrongest(target, 'leonhardt:res-down', {
            duration: bb.duration, value: bb.magic_resistance, source: unit,
            mods: value => ({ resMul: 1 + value }) });
      } }, onStart: ({ battle, unit }) => { syncLeonhardt(battle, unit); immediateCast(battle, unit, 1.067); },
      onEnd: ({ battle, unit }) => syncLeonhardt(battle, unit) } : duration({ atkPct: bb.atk });
  } else {
    Object.assign(kit.trait, { launchAttack: kjeraLaunch, windup: windup(.4, 1),
      interruptOnSkillChange: s.id.endsWith('_2') });
    kit.skill = s.id.endsWith('_2') ? { ...duration({ atkPct: bb.atk }), attack: {
      attackVisual: 'Skill_Loop', windup: windup(.367), onEachHit: ({ battle, unit, target }) => {
        if (target.alive && battle.rng.chance(bb['attack@prob']))
          battle.applyStatus(target, 'cold', { source: unit, duration: bb['attack@cold'] });
      } }, onEnd: ({ unit }) => {
        for (const state of unit.mem.kjeraDrones || []) state?.stop();
      } } : duration({ atkPct: bb.atk });
  }
  kit.skill.canActivate = () => u.canAct && !u.s.flags.silence && !(u.mem.casterCastUntil > b.time + 1e-9);
}

export function installFiveStarCasterExpansion({ battle: b, unit: u, def }) {
  if (!FIVE_STAR_CASTER_EXPANSION_OPERATORS[def.charId]) return;
  const id = def.charId, talent = def.talents[0]?.bb;
  if (id === 'char_338_iris' || id === 'char_297_hamoni') {
    u.trait.stored = 0; u.trait.storeAcc = 0;
    b.on('beforeAttack', ({ attacker, profile, isSkill }) => {
      if (attacker === u && !isSkill) profile.attackVisual = u.trait.stored ? 'Attack_Charge' : 'Attack';
    }, { owner: u });
    b.on('tick', ({ dt }) => {
      if (!u.canAct || u.s.flags.disarm) return;
      if (acquireTargets(b, u, effectiveProfile(u)).length) { u.trait.storeAcc = 0; return; }
      if (u.trait.stored >= def.traitBb.times) return;
      u.trait.storeAcc += dt;
      if (u.trait.storeAcc + 1e-9 >= u.s.interval) {
        u.trait.storeAcc -= u.s.interval; u.trait.stored++;
      }
    }, { owner: u });
    if (id === 'char_297_hamoni' && talent) b.on('hit', ({ source, target, dmg }) => {
      if (source === u && dmg.isAttack && target.blockedBy) dmg.amount *= talent.atk_scale;
    }, { owner: u });
  } else if (id === 'char_489_serum' && talent) {
    u.trait.serumLastAttack = b.time;
    b.on('attack', ({ attacker }) => {
      if (attacker !== u) return;
      u.trait.serumLastAttack = b.time; b.removeBuff(u, 'corroserum:sp');
    }, { owner: u });
    b.on('tick', () => {
      if (!live(u)) return;
      if (b.time - u.trait.serumLastAttack + 1e-9 >= talent.delay) {
        if (!u.findBuff('corroserum:sp')) b.addBuff(u, { key: 'corroserum:sp', source: u,
          mods: { spRecoveryFlat: talent.sp_recovery_per_sec } });
      } else b.removeBuff(u, 'corroserum:sp');
    }, { owner: u });
  } else if (id === 'char_373_lionhd' && talent) b.on('tick', () => syncLeonhardt(b, u), { owner: u });
  else if (id === 'char_4013_kjera') {
    u.trait.funnel = { targetId: null, scale: def.traitBb.init_atk_scale };
    u.mem.kjeraDrones = [];
    if (talent) b.on('deploy', ({ unit }) => {
      if (unit !== u) return;
      const count = u.rangeKeys.filter(key => b.grid.tile(Math.floor(key / COLS), key % COLS).height === 'LOW').length;
      b.addBuff(u, { key: 'kjera:talent', source: u,
        mods: { atkPct: count >= talent.cnt ? talent['kjera_t_1[high].atk'] : talent.atk } });
    }, { owner: u });
  }
}
