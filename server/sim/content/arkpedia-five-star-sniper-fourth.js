// SPDX-License-Identifier: GPL-3.0-or-later
import { FIVE_STAR_SNIPER_FOURTH_OPERATORS } from '../../../shared/arkpedia/five-star-sniper-fourth-operators.js';
import evidence from '../../../data/arkpedia-five-star-sniper-fourth-prefabs.json' with { type: 'json' };
import { resolveHit } from '../ai.js';
import { absoluteRangeKeys, canTargetEnemy, sortEnemyTargets } from '../targeting.js';
import { bodyInKeys } from '../body.js';

const EX = 'char_279_excu', AO = 'char_346_aosta', ER = 'char_4043_erato';
const live = u => u?.alive && u.deployed;
const model = u => evidence.models[u.def.charId][['UP', 'LEFT'].includes(u.dir) ? 'Back' : 'Front'];
const plain = p => ({ ...p, hits: 1, hitsFn: null, chain: null, splashRadius: 0, dmgMul: null });
const rate = u => u.def.charId === EX ? u.base.bat / u.s.interval : Math.min(1, u.s.aspd / 100);
const second = u => u.skill.active && u.skill.id.endsWith('_2');
const loop = u => u.def.charId === EX ? 'Skill_Right_Loop' : u.def.charId === AO ? 'Skill' : 'Skill_2_Loop';
const clip = u => second(u) ? loop(u) : u.def.charId === EX && u.dir === 'DOWN'
  ? 'Attack_Down' : u.def.charId === EX && u.dir === 'UP' ? 'Attack_Up' : 'Attack';
function frontKeys(u) {
  return new Set(absoluteRangeKeys(evidence.ranges['1-3'], u.tileR, u.tileC, u.dir));
}
function spreadWave(b, u, p, info) {
  const front = frontKeys(u), whole = u.def.charId === EX && u.skill.active && u.skill.id.endsWith('_1');
  for (const e of b.enemiesInKeys(u.rangeKeys, u, p)) {
    if (u.def.charId === AO) {
      if (second(u)) b.applyStatus(e, 'bind', { source: u, duration: u.skill.bb['attack@frozen_duration'] });
      attachAostaBleed(b, u, e);
    }
    const scale = whole || bodyInKeys(e, front) ? u.def.traitBb.atk_scale : 1;
    resolveHit(b, u, { ...plain(p), atkScale: (p.atkScale ?? 1) * scale }, e, info, e.x, e.y);
  }
}
function spreadLaunch(b, u, p, _target, info) {
  spreadWave(b, u, p, info);
  if (u.def.charId !== EX || !info.isSkill || !u.skill.id.endsWith('_2')) return;
  u.mem.executorBegun = true;
  const events = model(u).hits.Skill_Right_Loop, delay = (events[1] - events[0]) / rate(u);
  const seq = u.deploySeq, activation = u.skill.activations;
  let cancelled = false;
  // Remember even brief control between the two source animation events.
  const watcher = b.on('tick', () => {
    if (!live(u) || u.deploySeq !== seq || !u.canAct || !second(u) || u.skill.activations !== activation)
      cancelled = true;
  }, { owner: u });
  b.after(delay, () => {
    b.off(watcher);
    if (!cancelled && live(u) && u.deploySeq === seq && u.canAct && second(u)
      && u.skill.activations === activation) spreadWave(b, u, p, info);
  }, { owner: u });
}
function attachAostaBleed(b, u, e) {
  const t = u.def.talents[0]?.bb;
  if (!t) return;
  const amount = u.s.atk * t.atk_scale * (second(u) ? u.skill.bb.talent_scale : 1);
  let buff = e.findBuff('aosta:bleed');
  if (buff) {
    // Source EXTEND/takeSnapshotWhenExtend1 refreshes the snapshot/lifetime,
    // not the existing one-second trigger's phase.
    buff.timeLeft = t.duration; buff.duration = t.duration;
    buff.data.amount = amount; buff.data.source = u; buff.source = u;
    return;
  }
  buff = b.addBuff(e, { key: 'aosta:bleed', source: u, duration: t.duration,
    data: { amount, source: u }, interval: 1,
    onTick: ({ buff: current }) => {
      if (!live(e) || e.blockedBy) return;
      b.dealDamage(current.data.source, e, { amount: current.data.amount, type: 'arts',
        isAttack: false, isSkill: false, applyWay: 'none', tags: ['dot', 'aosta:bleed'] });
    } });
}
function eratoTargets(b, u, p) {
  const list = sortEnemyTargets(b, u, b.enemiesInKeys(u.rangeKeys, u, p), 'heaviest');
  if (second(u)) list.sort((a, z) => Number(!!z.s.flags.sleep) - Number(!!a.s.flags.sleep));
  return list.slice(0, 1);
}
function eratoLaunch(b, u, p, target, info) {
  const penetration = u.def.talents[0]?.bb.def_penetrate ?? 0;
  let projectile;
  projectile = b.addProjectile({ from: u, target, speed: 30, source: u, visual: 'arrow',
    data: { arkpediaTrackedVisual: true }, onHit: ({ target: e, x, y }) => {
      u.mem.eratoProjectiles.delete(projectile);
      if (!e || !canTargetEnemy(u, e, p)) return;
      // This is a retained native active-buff ordering interpretation, not
      // recovered C# dispatch: source S1 Sleep precedes same-hit calculation.
      if (info.isSkill && u.skill.id.endsWith('_1'))
        b.applyStatus(e, 'sleep', { source: u, duration: u.skill.bb.sleep });
      // Native attachPassiveBuffsOnDummy1 retains the selected talent on the
      // emitted ability, including when its original caster has withdrawn.
      // Scope calculation to this synchronous impact, not the owner lifetime.
      const hook = b.on('hit', ({ source, target: victim, dmg }) => {
        if (source === u && victim === e && dmg.isAttack
          && dmg.attackId === (info.attackId ?? 0) && e.s.flags.sleep)
          dmg.defIgnorePct += penetration;
      });
      try { resolveHit(b, u, plain(p), e, info, x, y); }
      finally { b.off(hook); }
    } });
  u.mem.eratoProjectiles.add(projectile);
}
function startErato(b, u) {
  const name = 'Skill_2_Begin', duration = model(u).durations[name] / rate(u), seq = u.deploySeq;
  u.mem.regularFormVisual = { clip: name, loop: false };
  b.addBuff(u, { key: 'erato:begin', duration, flags: { disarm: true } });
  b.after(duration, () => {
    if (live(u) && u.deploySeq === seq && second(u)) u.mem.regularFormVisual = { clip: 'Skill_2_Idle', loop: true };
  }, { owner: u });
}

export function customizeFiveStarSniperFourthKit({ battle: b, unit: u, id, def, kit }) {
  if (!FIVE_STAR_SNIPER_FOURTH_OPERATORS[id]) return;
  kit.install = null; const s = def.skill, bb = s.bb;
  kit.trait = { attack: 'ranged', dmgType: 'phys', projectile: 'none', canHitFly: true,
    priority: id === ER ? 'heaviest' : 'first', hits: 1, hitsFn: null, dmgMul: null,
    splashRadius: 0, chain: null, maxTargets: 1, allInRange: false, rangeAoe: false,
    retargetOnRelease: id !== ER, interruptOnSkillChange: true, install: null,
    attackVisual: (_b, unit) => id === EX && second(unit) && !unit.mem.executorBegun
      ? { begin: 'Skill_Right_Begin', loop: 'Skill_Right_Loop',
        beginDuration: model(unit).durations.Skill_Right_Begin / rate(unit) }
      : clip(unit),
    windup: (_b, unit) => {
      const name = clip(unit), event = model(unit).hits[name][0];
      const first = id === EX && second(unit) && !unit.mem.executorBegun;
      return (event + (first ? model(unit).durations.Skill_Right_Begin : 0)) / rate(unit);
    }, launchAttack: id === ER ? eratoLaunch : spreadLaunch };
  if (id === ER) {
    Object.assign(kit.trait, { hitSleep: true, acquireTargets: eratoTargets,
      canAttack: (_b, unit) => !unit.mem.eratoProjectiles.size });
    if (s.id.endsWith('_1')) kit.skill = { kind: 'charges', trigger: { rule: 'DEFAULT' },
      attack: { atkScale: bb.atk_scale, attackVisual: 'Skill_1',
        windup: (_b, unit) => model(unit).hits.Skill_1[0] / rate(unit),
        // Source recoverSpIfTargetDead1: refund a dead input before emission,
        // not a target killed after an already released projectile.
        afterAttack: (_b, unit, targets) => {
          if (targets.length && targets.every(e => !e.alive)) unit.skill.addCharge(1);
        } } };
    else kit.skill = { kind: 'duration', duration: s.duration, attack: {}, mods: { atkPct: bb.atk, aspd: bb.attack_speed },
      onStart: () => startErato(b, u), onEnd: () => { u.mem.regularFormVisual = null; b.removeBuff(u, 'erato:begin'); } };
  } else if (id === EX) {
    kit.skill = { kind: 'duration', duration: s.duration, attack: {},
      mods: s.id.endsWith('_1') ? { atkPct: bb.atk } : { batFlat: bb.base_attack_time },
      onStart: () => { u.mem.executorBegun = false; } };
  } else kit.skill = { kind: 'duration', duration: s.duration, attack: {},
    mods: s.id === 'skchr_aosta_2' ? { atkPct: bb.atk, batPct: bb.base_attack_time }
      : { atkPct: bb.atk, aspd: bb.attack_speed } };
}
export function installFiveStarSniperFourth({ battle: b, unit: u, def }) {
  if (!FIVE_STAR_SNIPER_FOURTH_OPERATORS[def.charId]) return;
  if (def.charId === EX) {
    u.mem.executorBegun = false;
    const t = def.talents[0]?.bb;
    if (t) b.addBuff(u, { key: 'executor:def-ignore', source: u, persist: true, allowDead: true,
      mods: { defIgnoreFlat: t.def_penetrate_fixed } });
  } else if (def.charId === ER) {
    u.mem.eratoProjectiles = new Set();
    b.on('tick', () => {
      for (const p of u.mem.eratoProjectiles) if (!b.projectiles.list.includes(p)) u.mem.eratoProjectiles.delete(p);
    }, { owner: u });
  }
}
