// SPDX-License-Identifier: GPL-3.0-or-later
import { FIVE_STAR_GUARD_FOURTH_OPERATORS } from '../../../shared/arkpedia/five-star-guard-fourth-operators.js';
import { resolveHit } from '../ai.js';
import { absoluteRangeKeys, canTargetEnemy } from '../targeting.js';
import { bodyInKeys, bodyOnTile } from '../body.js';
import { frontOf } from '../dir.js';
import { applyHpLoss, makeDamageInfo } from '../damage.js';

const live = u => u?.alive && u.deployed && !u.hidden;
const windup = (seconds, cap = Infinity) => (_b, u) => seconds / Math.min(cap, u.s.aspd / 100);
const X4 = [[1, -1], [1, 0], [1, 1], [0, -1], [0, 0], [0, 1], [-1, -1], [-1, 0], [-1, 1]];
const X5 = [[1, 0], [0, -1], [0, 0], [0, 1], [-1, 0]];
// Original RangeToShow for S2_End is 3-2, separate from normal 1-1.
const CHIMES_FINISH_RANGE = [[0, 0], [0, 1], [0, 2], [0, 3]];
const allyEligible = a => live(a) && a.kind !== 'device'
  && !a.s.flags.isolated && !a.s.flags.untargetable && !a.s.flags.healFree;
const meleeCapable = a => ['MELEE', 'ALL', 'BOTH'].includes(a.def.raw?.position)
  || a.def.raw?.deployableTiles?.includes('ground');
const inCombat = (u, e) => e.blockedBy === u || bodyOnTile(e, u.tileR, u.tileC)
  || bodyOnTile(e, ...frontOf(u.tileR, u.tileC, u.dir));
function setMods(b, u, key, source, mods) {
  const buff = u.findBuff(key);
  if (!mods) { if (buff) b.removeBuff(u, buff); }
  else if (!buff || JSON.stringify(buff.mods) !== JSON.stringify(mods)) b.addBuff(u, { key, source, mods });
}
function cutHp(b, u, amount, nonlethal, tag) {
  const floor = nonlethal ? Math.min(1, u.s.maxHp) : 0;
  applyHpLoss(b, u, u, Math.min(amount, Math.max(0, u.hp - floor)),
    makeDamageInfo({ type: 'true', canDodge: false, noSp: true, tags: [tag] }));
}

function bryophytaStart(b, u, s) {
  const keys = new Set(absoluteRangeKeys(X4, u.tileR, u.tileC, u.dir));
  const target = b.allyUnits.filter(a => a !== u && allyEligible(a) && meleeCapable(a) && bodyInKeys(a, keys))
    .sort((a, c) => c.s.blockCnt - a.s.blockCnt)[0] ?? u;
  u.mem.bryophytaTarget = target;
  b.addBuff(target, { key: `bryophyta:skill:${u.id}`, source: u, mods: { defPct: s.bb.def } });
}
function bryophytaEnd(b, u, s, reason) {
  if (u.mem.bryophytaTarget) b.removeBuff(u.mem.bryophytaTarget, `bryophyta:skill:${u.id}`);
  u.mem.bryophytaTarget = null;
  if (reason === 'duration' && live(u)) b.applyStatus(u, 'stun', { source: u, duration: s.bb.stun });
}

function morganLaunch(b, u, p, target, info) {
  if (info.isSkill && u.skill.id === 'skchr_morgan_1')
    cutHp(b, u, u.hp * u.skill.bb['attack@hp_ratio'], false, 'morgan:s1-cut');
  u.mem.morganSync?.();
  if (u.alive) resolveHit(b, u, p, target, info, target.x, target.y);
}
function morganShield(b, u, s) {
  cutHp(b, u, u.s.maxHp * s.bb['morgan_s_2.hp_ratio'], true, 'morgan:s2-cut');
  const total = u.s.maxHp * s.bb.hp_ratio, duration = s.bb.shield_duration;
  b.addBuff(u, { key: 'morgan:barrier', source: u, visible: true, shield: total,
    duration, interval: 1, onTick: ({ buff, unit }) => {
      buff.shield = Math.max(0, buff.shield - total / duration); unit.markDirty();
      if (buff.shield <= 1e-9) b.removeBuff(unit, buff);
    } });
}

function dagdaLaunch(b, u, p, target, info) {
  const counter = u.mem.dagdaCounter;
  const profile = counter ? { ...p, atkScale: u.skill.bb['attack@defensive_atk_scale'], hits: 1, isSkill: true } : p;
  resolveHit(b, u, profile, target, { ...info, isSkill: counter || info.isSkill }, target.x, target.y);
  if (counter) u.mem.dagdaCounter = false;
}

function letoLaunch(b, u, p, target, info) {
  const combat = inCombat(u, target);
  const full = u.skill.active && u.skill.id === 'skchr_leto_2';
  const profile = { ...p, dmgMul: null, applyWay: combat ? 'melee' : 'ranged',
    atkScale: (p.atkScale ?? 1) * (combat || full ? 1 : .8) };
  if (combat) resolveHit(b, u, profile, target, info, target.x, target.y);
  else b.addProjectile({ from: u, source: u, target, speed: 10, visual: 'bolt',
    data: { arkpediaTrackedVisual: true }, onHit: c => resolveHit(b, u, profile, c.target, info, c.x, c.y) });
}
function letoStart(b, u) {
  // The source TriggerSkill checks the recipient's ready state; no SP is granted.
  for (const a of b.allyUnits) if (a !== u && allyEligible(a) && a.tags.has('student')
    && a.canAct && !a.s.flags.silence && a.skill.ready && !a.skill.active) a.skill.activate('leto');
}

function chimesStart(b, u, s) {
  const cap = s.bb.maxcnt;
  u.mem.chimesCasting = true;
  u.mem.regularFormVisual = { clip: 'Skill_Idle', loop: true };
  b.addBuff(u, { key: 'chimes:charge', source: u, interval: 1,
    mods: { atkPct: s.bb.atk / cap },
    data: { count: 1 }, onTick: ({ buff, unit }) => {
      buff.data.count = Math.min(cap, buff.data.count + 1);
      buff.mods.atkPct = s.bb.atk * buff.data.count / cap; unit.markDirty();
    } });
  b.applyStatus(u, 'sanctuary', { key: 'chimes:sanctuary', source: u, value: s.bb.damage_resistance });
}
function chimesEnd(b, u, s, reason) {
  u.mem.chimesCasting = false;
  const clear = () => {
    b.removeBuff(u, 'chimes:charge'); b.removeBuff(u, 'chimes:ending'); b.removeBuff(u, 'chimes:sanctuary');
    u.mem.regularFormVisual = null; u.mem.chimesEnding = null;
  };
  if (!['duration', 'manual'].includes(reason) || !live(u) || !u.canAct) { clear(); return; }
  const token = {}, seq = u.deploySeq;
  u.mem.chimesEnding = token;
  u.mem.regularFormVisual = { clip: 'Skill_End', loop: false };
  b.addBuff(u, { key: 'chimes:ending', source: u, flags: { disarm: true, noSp: true } });
  const controlEpoch = u.attackControlEpoch;
  const valid = () => live(u) && u.canAct && u.deploySeq === seq && u.mem.chimesEnding === token
    && u.attackControlEpoch === controlEpoch;
  const watch = b.every(b.dt, () => { if (!valid()) { watch.cancel(); clear(); } }, { owner: u });
  b._ev(['atk', u.id, u.id, 'none', { animation: 'Skill_End', windup: .5 }]);
  b.after(.5, () => {
    if (!valid()) return;
    const keys = absoluteRangeKeys(CHIMES_FINISH_RANGE, u.tileR, u.tileC, u.dir);
    const targets = b.enemiesInKeys(keys, u, { canHitFly: false });
    for (const e of targets) {
      b.dealDamage(u, e, { amount: u.s.atk * s.bb['attack@atk_scale'], type: 'phys',
        isSkill: true, isAttack: true, applyWay: 'melee', tags: ['chimes:finisher'] });
      if (e.alive) b.applyStatus(e, 'stun', { source: u, duration: s.bb['attack@stun'] });
    }
  }, { owner: u });
  b.after(1.7, () => { watch.cancel(); if (u.mem.chimesEnding === token) clear(); }, { owner: u });
}

export function customizeFiveStarGuardFourthKit({ id, def, unit, kit }) {
  if (!FIVE_STAR_GUARD_FOURTH_OPERATORS[id]) return;
  kit.install = null;
  const s = def.skill, bb = s.bb;
  kit.trait = { install: null, attack: 'melee', projectile: 'none', dmgType: 'phys', hits: 1,
    hitsFn: null, maxTargets: 1, hitAllBlocked: false, canHitFly: false, dmgMul: null, attackVisual: 'Attack' };
  const timed = mods => ({ id: s.id, name: s.name, kind: 'duration', duration: s.duration, mods });
  const instant = { id: s.id, name: s.name, kind: 'instant' };
  if (id === 'char_4106_bryota') {
    kit.trait.windup = windup(.433);
    kit.skill = s.id === 'skchr_bryota_1' ? { ...instant, attack: { atkScale: bb.atk_scale, attackVisual: 'Skill' } }
      : { ...timed({ atkPct: bb.atk }), onStart: ({ battle, unit }) => bryophytaStart(battle, unit, s),
        onEnd: ({ battle, unit, reason }) => bryophytaEnd(battle, unit, s, reason) };
  } else if (id === 'char_154_morgan') {
    Object.assign(kit.trait, { windup: windup(.433, 1.3), launchAttack: morganLaunch });
    kit.skill = { ...timed({}), attack: { atkScale: bb['attack@atk_scale'],
      windup: windup(s.id === 'skchr_morgan_2' ? .567 : .433, 1.3),
      attackVisual: s.id === 'skchr_morgan_2' ? 'Skill_2' : 'Skill_1' },
      ...(s.id === 'skchr_morgan_2' ? { activateOnDeploy: true, trigger: 'NEVER',
        onStart: ({ battle, unit }) => morganShield(battle, unit, s) } : {}) };
  } else if (id === 'char_157_dagda') {
    Object.assign(kit.trait, { launchAttack: dagdaLaunch,
      attackEpoch: (_b, u) => u.mem.dagdaAttackEpoch ?? 0,
      windup: (_b, u) => (u.mem.dagdaCounter ? .1 : .167) / Math.min(u.mem.dagdaCounter ? Infinity : 1, u.s.aspd / 100),
      attackVisual: (_b, u) => u.mem.dagdaCounter ? 'Skill1' : 'Attack' });
    kit.skill = s.id === 'skchr_dagda_1' ? { id: s.id, name: s.name, kind: 'toggle', trigger: 'SP_FULL' }
      : { ...timed({ atkPct: bb.atk }), attack: { hits: 2, windup: windup(.2, 1), attackVisual: 'Skill2' } };
  } else if (id === 'char_194_leto') {
    Object.assign(kit.trait, { attack: 'ranged', projectile: 'bolt', canHitFly: true,
      dmgMul: null, launchAttack: letoLaunch, windup: (_b, u, targets) => {
        u.mem.letoCombat = inCombat(u, targets[0]);
        return (u.skill.active && u.skill.id === 'skchr_leto_2' || u.mem.letoCombat ? .467 : .333) / (u.s.aspd / 100);
      }, attackVisual: (_b, u) => u.mem.letoCombat ? 'Combat' : 'Attack' });
    kit.skill = s.id === 'skchr_leto_2' ? { ...timed({ atkPct: bb.atk }),
      attack: { maxTargets: bb['attack@max_target'], attackVisual: 'Skill_2' },
      onStart: ({ battle, unit }) => letoStart(battle, unit) }
      : timed({ atkPct: bb.atk, aspd: bb.attack_speed });
  } else {
    Object.assign(kit.trait, { maxTargetsByBlock: true, windup: windup(.567), interruptOnSkillChange: true });
    kit.skill = s.id === 'skchr_chimes_2' ? { ...timed({}), flags: { disarm: true }, manualCancel: true,
      onStart: ({ battle, unit }) => {
        chimesStart(battle, unit, s); unit.mem.chimesChargeControlEpoch = unit.attackControlEpoch;
      },
      onTick: ({ unit, skill }) => {
        if (!unit.canAct || unit.attackControlEpoch !== unit.mem.chimesChargeControlEpoch) skill.end('control');
      },
      onEnd: ({ battle, unit, reason }) => chimesEnd(battle, unit, s, reason) }
      : timed({ atkPct: bb.atk });
  }
}

export function installFiveStarGuardFourth({ battle: b, unit: u, def }) {
  const id = def.charId, t = def.talents[0];
  if (!FIVE_STAR_GUARD_FOURTH_OPERATORS[id]) return;
  if (id === 'char_4106_bryota') {
    b.on('hit', ({ source, target, dmg }) => {
      if (source === u && target.side === 'enemy' && dmg.isAttack && target.blockedBy !== u)
        dmg.amount *= def.traitBb.atk_scale;
    }, { owner: u });
    if (t) {
      const key = `bryophyta:aura:${u.id}`;
      const sync = () => {
        const keys = new Set(absoluteRangeKeys(X4, u.tileR, u.tileC, u.dir));
        const blocked = u.blocking.some(e => e.alive && e.blockedBy === u);
        for (const a of b.allyUnits) setMods(b, a, key, u,
          live(u) && (blocked ? a === u : a !== u && allyEligible(a) && meleeCapable(a) && bodyInKeys(a, keys))
            ? { defPct: t.bb[blocked ? 'bryota_t_self.def' : 'bryota_t_ally.def'] } : null);
      };
      b.on('tick', sync, { owner: u }); b.on('deploy', sync, { owner: u }); b.on('death', sync, { owner: u });
    }
  } else if (id === 'char_154_morgan' && t) {
    const sync = () => setMods(b, u, 'morgan:tenacity', u, live(u) ? { atkPct: t.bb.min_atk
      * Math.min(1, Math.max(0, (1 - u.hpRatio) / (1 - t.bb.min_hp_ratio))) } : null);
    u.mem.morganSync = sync;
    b.on('deploy', sync, { owner: u }); b.on('tick', sync, { owner: u });
    b.on('damaged', ({ target }) => { if (target === u) sync(); }, { owner: u });
  } else if (id === 'char_157_dagda') {
    if (def.talents[1] && b.mapTags?.includes('main_11')) {
      const bb = def.talents[1].bb;
      b.addBuff(u, { key: 'dagda:home-ground', persist: true, allowDead: true, mods: { hpPct: bb.max_hp } });
      b.on('damaged', ({ source, target, amount }) => {
        if (source === u && target.side === 'enemy' && amount > 0 && live(u))
          b.heal(u, u, amount * bb.heal_scale, { self: true });
      }, { owner: u });
    }
    if (t) {
      let bonus = t.bb.atk_scale;
      b.on('kill', ({ victim }) => {
        if (!live(u) || victim.side !== 'enemy') return;
        const keys = new Set(absoluteRangeKeys(X5, Math.floor(victim.y + .5), Math.floor(victim.x + .5), 'RIGHT'));
        if (b.allyUnits.some(a => live(a) && a.tags.has('glasgow') && bodyInKeys(a, keys)))
          bonus = Math.min(t.bb.atk_up_max_value, bonus + t.bb.atk_up_each_time);
      }, { owner: u });
      b.on('hit', ({ source, target, dmg }) => {
        const prob = u.skill.active && u.skill.id === 'skchr_dagda_2' ? u.skill.bb['talent@prob'] : t.bb.prob;
        if (source === u && target.side === 'enemy' && dmg.isAttack && b.rng() < prob) dmg.amount *= bonus;
      }, { owner: u });
    }
    if (u.skill.id === 'skchr_dagda_1') b.on('hit', ({ target, source, dmg }) => {
      if (target !== u || source === u || dmg.type !== 'phys' || !u.skill.active || !live(u)) return;
      dmg.mul *= 1 - u.skill.bb.damage_resistance;
      u.skill.end('guarded'); u.mem.dagdaCounter = true;
      u.mem.dagdaAttackEpoch = (u.mem.dagdaAttackEpoch ?? 0) + 1; u.atkCd = 0;
    }, { owner: u });
  } else if (id === 'char_194_leto' && t) {
    const key = `leto:team-speed:${u.id}`;
    const sync = () => {
      for (const a of b.allyUnits) setMods(b, a, key, u,
        live(u) && u.skill.active && allyEligible(a) && a.tags.has('student') ? { aspd: t.bb.attack_speed } : null);
    };
    for (const event of ['deploy', 'skillStart', 'skillEnd', 'death', 'tick']) b.on(event, sync, { owner: u });
  } else if (id === 'char_4083_chimes' && t) {
    const sync = () => {
      if (!live(u) || u.hpRatio <= .5) b.removeBuff(u, 'chimes:vigor');
      else if (!u.findBuff('chimes:vigor')) b.addBuff(u, { key: 'chimes:vigor', source: u,
        status: 'vigor', data: { value: t.bb.atk }, mods: { atkPct: t.bb.atk } });
    };
    b.on('deploy', sync, { owner: u }); b.on('tick', sync, { owner: u });
    b.on('damaged', ({ target }) => { if (target === u) sync(); }, { owner: u });
  }
}
