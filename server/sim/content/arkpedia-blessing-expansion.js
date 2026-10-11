// SPDX-License-Identifier: GPL-3.0-or-later
import { BLESSING_EXPANSION_OPERATORS } from '../../../shared/arkpedia/blessing-expansion-operators.js';
import evidence from '../../../data/arkpedia-blessing-expansion-prefabs.json' with { type: 'json' };
import { bodyInKeys } from '../body.js';
import { aggregateMods } from '../buffs.js';
import { canTargetEnemy } from '../targeting.js';
import { resolveHit } from '../ai.js';

const DEER = 'char_4019_ncdeer', XING = 'char_4172_xingzh';
const live = a => a?.alive && a.deployed && !a.hidden;
const model = u => evidence.models[u.defId][['UP', 'LEFT'].includes(u.dir) ? 'Back' : 'Front'];
const rate = (u, cap = 1) => Math.min(cap, u.s.aspd / 100);
const timed = (clip, cap = 1) => (_b, u) => model(u).hits[clip][0] / rate(u, cap);
const auraAlly = (b, u, a) => live(a) && a.kind !== 'device'
  && !a.s.flags.untargetable && b.allySelectable(a, u);
const healable = (b, u, a) => auraAlly(b, u, a) && !a.s.flags.healFree
  && (a === u || !(a.s.flags.noHeal || a.profile?.noHeal));
function heals(b, u, count = 1, all = false) {
  return b.allyUnits.filter(a => healable(b, u, a) && bodyInKeys(a, u.rangeKeySet)
    && (all || a.hp < a.s.maxHp - .01)).sort((a, c) => a.hpRatio - c.hpRatio || a.deploySeq - c.deploySeq)
    .slice(0, count + Math.max(0, Math.floor(u.s.maxTargets)));
}
function healProjectile(b, u, a, speed, scale) {
  b.addProjectile({ from: u, target: a, source: u, speed, visual: 'heal',
    data: { arkpediaTrackedVisual: true }, onHit: ({ target }) => {
      if (healable(b, u, target)) b.heal(u, target, u.s.atk * scale);
    } });
}
function transition(b, u, begin, idle, attack) {
  const seq = u.deploySeq, act = u.skill.activations;
  u.mem.regularFormVisual = { clip: begin, loop: false };
  b.addBuff(u, { key: 'blessing-expansion:begin', duration: model(u).durations[begin], flags: { disarm: true } });
  b.after(model(u).durations[begin], () => {
    if (live(u) && u.deploySeq === seq && u.skill.active && u.skill.activations === act)
      u.mem.regularFormVisual = { clip: idle, loop: true, attack };
  }, { owner: u });
}
function endTransition(b, u, end, reason) {
  b.removeBuff(u, 'blessing-expansion:begin');
  if (!live(u) || reason === 'death') { u.mem.regularFormVisual = null; return; }
  const seq = u.deploySeq, act = u.skill.activations;
  u.mem.regularFormVisual = { clip: end, loop: false };
  b.addBuff(u, { key: 'blessing-expansion:end', duration: model(u).durations[end], flags: { disarm: true } });
  b.after(model(u).durations[end], () => {
    if (u.deploySeq === seq && u.skill.activations === act) u.mem.regularFormVisual = null;
  }, { owner: u });
}
function xingCast(b, u, s) {
  const targets = heals(b, u, Infinity, true), seq = u.deploySeq, act = u.skill.activations;
  const total = model(u).durations.Skill_1 / rate(u), release = model(u).hits.Skill_1[0] / rate(u);
  u.mem.regularFormVisual = { clip: 'Skill_1', loop: false };
  b.addBuff(u, { key: 'xingzhu:cast', duration: total, flags: { disarm: true, noSp: true } });
  const controlEpoch = u.attackControlEpoch;
  let cancelled = false;
  const valid = () => !cancelled && live(u) && u.deploySeq === seq && u.skill.activations === act
    && u.canAct && u.attackControlEpoch === controlEpoch;
  const stop = () => {
    cancelled = true;
    if (u.deploySeq === seq && u.skill.activations === act) {
      b.removeBuff(u, 'xingzhu:cast'); u.mem.regularFormVisual = null;
    }
  };
  const watch = b.every(b.dt, () => { if (!valid()) { stop(); watch.cancel(); } }, { owner: u });
  b.after(release, () => {
    watch.cancel(); if (!valid()) { stop(); return; }
    for (const a of targets) if (healable(b, u, a)) healProjectile(b, u, a, 99, s.bb.heal_scale);
  }, { owner: u });
  b.after(total, () => {
    if (u.deploySeq === seq && u.skill.activations === act) {
      b.removeBuff(u, 'xingzhu:cast'); u.mem.regularFormVisual = null;
    }
  }, { owner: u });
}

export function customizeBlessingExpansionKit({ battle: b, id, def, unit: u, kit }) {
  if (!BLESSING_EXPANSION_OPERATORS[id]) return;
  kit.install = null;
  const s = def.skill, bb = s.bb, first = s.id.endsWith('_1');
  kit.trait = { attack: 'ranged', dmgType: 'arts', projectile: 'none', heal: null,
    canHitFly: true, maxTargets: 1, attackVisual: 'Attack', windup: timed('Attack'),
    interruptOnSkillChange: true, install: null,
    acquireTargets: (battle, unit, profile) => profile.dmgType === 'heal'
      ? heals(battle, unit, id === XING ? bb['attack@max_target'] : 1) : null,
    launchAttack: (battle, unit, profile, target, info) => {
      if (profile.dmgType === 'heal') {
        if (id === DEER) { if (healable(battle, unit, target)) battle.heal(unit, target, unit.s.atk * def.traitBb.heal_scale); }
        else healProjectile(battle, unit, target, 10, def.traitBb.heal_scale);
      } else battle.addProjectile({ from: unit, target, source: unit, speed: id === DEER ? 8 : 10,
        visual: 'orb', data: { arkpediaTrackedVisual: true }, onHit: ({ target: a }) => {
          if (canTargetEnemy(unit, a, profile)) resolveHit(battle, unit, profile, a, info, a.x, a.y);
        } });
    } };
  if (id === DEER) kit.skill = { kind: 'duration', duration: s.duration,
    mods: first ? { atkPct: bb.atk } : { aspd: bb.attack_speed },
    attack: { attackVisual: 'Skill_Loop', windup: timed('Skill_Loop', Infinity) },
    onStart: () => { u.profile.dmgType = 'heal'; transition(b, u, 'Skill_Begin', 'Skill_Idle', 'Skill_Loop'); syncDeer(b, u, def); },
    onEnd: ({ reason }) => { u.profile.dmgType = 'arts'; endTransition(b, u, 'Skill_End', reason); syncDeer(b, u, def); } };
  else kit.skill = first ? { kind: 'instant', canActivate: () => !u.findBuff('xingzhu:cast') && heals(b, u, Infinity, true).length > 0,
    onStart: () => xingCast(b, u, s) }
    : { kind: 'duration', duration: s.duration, mods: { aspd: bb.attack_speed },
      attack: { attackVisual: 'Skill_2_Loop', windup: timed('Skill_2_Loop') },
      onStart: () => {
        u.profile.dmgType = 'heal'; transition(b, u, 'Skill_2_Begin', 'Skill_2_Idle', 'Skill_2_Loop'); syncXingRecovery(b, u);
        u.mem.xingRecoveryPoll = b.every(.5, () => syncXingRecovery(b, u), { owner: u });
      }, onEnd: ({ reason }) => {
        u.profile.dmgType = 'arts'; u.mem.xingRecoveryPoll?.cancel(); u.mem.xingRecoveryPoll = null;
        syncXingRecovery(b, u); endTransition(b, u, 'Skill_2_End', reason);
      } };
  kit.skill.id = s.id; kit.skill.name = s.name;
}

function syncDeer(b, u, def) {
  const t = def.talents[0]?.bb, key = `ncdeer:sanctuary:${u.id}`, checkerKey = `ncdeer:checker:${u.id}`;
  const threshold = u.skill.active && u.skill.id === 'skchr_ncdeer_2' ? def.skill.bb['talent@hp_ratio'] : t?.hp_ratio;
  for (const a of b.allyUnits) {
    if (!t || !live(u) || !auraAlly(b, u, a) || !bodyInKeys(a, u.rangeKeySet)) {
      b.removeBuff(a, checkerKey); b.removeBuff(a, key); continue;
    }
    let checker = a.findBuff(checkerKey);
    if (!checker) checker = b.addBuff(a, { key: checkerKey, source: u, interval: .1,
      data: { threshold }, onTick: ({ buff }) => {
        if (!live(u) || !auraAlly(b, u, a) || !bodyInKeys(a, u.rangeKeySet) || a.hpRatio > buff.data.threshold) {
          b.removeBuff(a, key); return;
        }
        if (!a.findBuff(key)) b.applyStatus(a, 'sanctuary', { key, source: u, value: t.damage_resistance });
      } });
    checker.data.threshold = threshold;
  }
}
function syncXingMarks(b, u, def) {
  const mark = `xingzh_t_1[mark]:${u.id}`, protection = `xingzhu:sanctuary:${u.id}`, t = def.talents[0]?.bb;
  const eligible = a => t && live(u) && a !== u && a.kind === 'op' && auraAlly(b, u, a) && bodyInKeys(a, u.rangeKeySet);
  const chosen = (u.mem.xingMarked ?? []).filter(eligible);
  for (const a of b.allyUnits.filter(eligible).sort((a, c) => a.deploySeq - c.deploySeq))
    if (chosen.length < 2 && !chosen.includes(a)) chosen.push(a);
  u.mem.xingMarked = chosen;
  for (const a of b.allyUnits) {
    if (!chosen.includes(a)) { b.removeBuff(a, mark); b.removeBuff(a, protection); }
    else {
      if (!a.findBuff(mark)) b.addBuff(a, { key: mark, source: u });
      if (!a.findBuff(protection)) b.applyStatus(a, 'sanctuary', { key: protection, source: u, value: t.damage_resistance });
    }
  }
}
function syncXingRecovery(b, u) {
  const key = `xingzhu:recovery:${u.id}`, mark = `xingzh_t_1[mark]:${u.id}`, bb = u.def.skill.bb;
  for (const a of b.allyUnits) {
    const eligible = live(u) && u.skill.active && u.skill.id === 'skchr_xingzh_2'
      && a.findBuff(mark)?.source === u && auraAlly(b, u, a);
    if (!eligible) b.removeBuff(a, key);
    else if (!a.findBuff(key)) b.addBuff(a, { key, source: u, interval: bb['attack@xingzh_s_2[heal].interval'],
      onTick: () => {
        if (!live(u) || !u.skill.active || !auraAlly(b, u, a) || a.findBuff(mark)?.source !== u) return;
        const multiplier = aggregateMods(a.buffs).mul.hpRegenMul ?? 1;
        b.heal(u, a, u.s.atk * bb['attack@xingzh_s_2[heal].atk_to_hp_recovery_ratio'] * multiplier, { self: true, regen: true });
      } });
  }
}
export function installBlessingExpansion({ battle: b, unit: u, def }) {
  if (!BLESSING_EXPANSION_OPERATORS[def.charId]) return;
  if (def.charId === DEER) {
    for (const ev of ['deploy', 'death', 'tick', 'skillStart', 'skillEnd']) b.on(ev, () => syncDeer(b, u, def), { owner: u });
    b.on('damageFinal', ctx => {
      if (ctx.target === u && live(u) && u.skill.active && u.skill.id === 'skchr_ncdeer_2'
        && ctx.dmg.type === 'phys' && ctx.dmg.applyWay === 'ranged' && ctx.amount > 0
        && b.rng.chance(def.skill.bb.prob)) ctx.amount = 0;
    }, { owner: u });
  } else {
    for (const ev of ['deploy', 'death', 'tick']) b.on(ev, () => {
      syncXingMarks(b, u, def);
      // Source owned marks detach immediately; newly eligible recipients are
      // discovered only by the separate native half-second global controller.
      for (const a of b.allyUnits) if (!live(u) || !a.findBuff(`xingzh_t_1[mark]:${u.id}`))
        b.removeBuff(a, `xingzhu:recovery:${u.id}`);
    }, { owner: u });
  }
}
