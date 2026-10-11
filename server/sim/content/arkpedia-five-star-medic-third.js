// SPDX-License-Identifier: GPL-3.0-or-later
import { FIVE_STAR_MEDIC_THIRD_OPERATORS } from '../../../shared/arkpedia/five-star-medic-third-operators.js';
import evidence from '../../../data/arkpedia-five-star-medic-third-prefabs.json' with { type: 'json' };
import { absoluteRangeKeys, canTargetEnemy, sortEnemyTargets } from '../targeting.js';
import { bodyInKeys } from '../body.js';
import { RESIST_STATUSES } from '../buffs.js';
import { isHpLoss } from '../damage.js';
import { registerBerryProtection } from './arkpedia-five-star-medic-second.js';

const live = a => a?.alive && a.deployed && !a.hidden;
const model = u => evidence.models[u.defId][['UP', 'LEFT'].includes(u.dir) ? 'Back' : 'Front'];
const grid = key => evidence.rangeTable[key].grids.map(p => [p.row, p.col]);
const rate = (u, cap = 1) => Math.min(cap, u.s.aspd / 100);
const timed = (clip, cap = 1) => (_b, u) => model(u).hits[clip][0] / rate(u, cap);
const ep = a => Math.max(...Object.values(a.elem));
const epRatio = a => ep(a) / a.gaugeMax;
const auraAlly = (b, a, u) => live(a) && a.kind !== 'device' && !a.s.flags.untargetable && b.allySelectable(a, u);
const healable = (b, a, u) => auraAlly(b, a, u) && !a.s.flags.healFree
  && (a === u || !(a.s.flags.noHeal || a.profile?.noHeal));
// The native CheckContainsStatusResistableBuff dispatcher is unrecovered.
// Actual registered control statuses are used, rather than arbitrary ATK debuffs
// or a caster's own unresistable mode lock.
const abnormal = a => a.buffs.some(x => RESIST_STATUSES.has(x.status)) || (a.findBuff('palsy')?.stacks ?? 0) > 0;
function allies(b, u, { injured = true, elemental = false, count = 1, priority = false, ground = false, operator = false } = {}) {
  const out = b.allyUnits.filter(a => healable(b, a, u) && bodyInKeys(a, u.rangeKeySet)
    && (!ground || !a.isFlying) && (!operator || a.kind === 'op')
    && (!injured || a.hp < a.s.maxHp - .01 || elemental && ep(a) > 0));
  out.sort((a, c) => priority === 'ep' ? ep(c) - ep(a) || a.hpRatio - c.hpRatio || a.deploySeq - c.deploySeq
    : priority === 'abnormal' ? Number(abnormal(c)) - Number(abnormal(a)) || a.hpRatio - c.hpRatio || a.deploySeq - c.deploySeq
    : a.hpRatio - c.hpRatio || a.deploySeq - c.deploySeq);
  return out.slice(0, count + Math.max(0, Math.floor(u.s.maxTargets)));
}
function flight(b, u, target, speed, fn, from = u) {
  b.addProjectile({ from, target, speed, source: u, visual: 'orb', data: { arkpediaTrackedVisual: true },
    onHit: ({ target: a }) => { if (healable(b, a, u)) fn(a); } });
}
function form(b, u, begin, loop, end) {
  const seq = u.deploySeq, act = u.skill.activations;
  u.mem.regularFormVisual = { clip: begin, loop: false };
  b.after(model(u).durations[begin], () => {
    if (live(u) && u.deploySeq === seq && u.skill.active && u.skill.activations === act)
      u.mem.regularFormVisual = { clip: loop, loop: true };
  }, { owner: u });
  return ({ reason } = {}) => {
    if (!live(u) || reason === 'death' || !end) { u.mem.regularFormVisual = null; return; }
    u.mem.regularFormVisual = { clip: end, loop: false };
    b.after(model(u).durations[end], () => {
      if (u.deploySeq === seq && u.skill.activations === act) u.mem.regularFormVisual = null;
    }, { owner: u });
  };
}
function nowellHeal(b, u, a, amount, periodic = false) {
  const talent = u.def.talents[0]?.bb;
  const inner = new Set(absoluteRangeKeys(grid('2-3'), u.tileR, u.tileC, u.dir));
  const far = !periodic && !bodyInKeys(a, inner) ? u.def.traitBb.heal_scale : 1;
  b.heal(u, a, amount * far * (talent && abnormal(a) ? talent.heal_scale_up : 1));
}
function nowellCast(b, u) {
  const s = u.def.skill, seq = u.deploySeq, act = u.skill.activations, duration = model(u).durations.Skill_2 / rate(u);
  const targets = allies(b, u, { injured: false, priority: 'abnormal', count: s.bb.max_target, operator: true });
  const key = 'nowell:cast'; let interrupted = false;
  u.mem.regularFormVisual = { clip: 'Skill_2', loop: false };
  b.addBuff(u, { key, duration, flags: { disarm: true, noSp: true } });
  const controlEpoch = u.attackControlEpoch;
  const valid = () => !interrupted && live(u) && u.deploySeq === seq && u.skill.activations === act
    && u.attackControlEpoch === controlEpoch && u.canAct;
  const stop = () => {
    interrupted = true;
    if (u.deploySeq === seq && u.skill.activations === act) {
      b.removeBuff(u, key); u.mem.regularFormVisual = null;
    }
  };
  const watch = b.every(b.dt, () => { if (!valid()) { stop(); watch.cancel(); } }, { owner: u });
  b.after(model(u).hits.Skill_2[0] / rate(u), () => {
    watch.cancel(); if (!valid()) { stop(); return; }
    const atk = u.s.atk;
    for (const a of targets) if (healable(b, a, u)) {
      b.applyStatus(a, 'resist', { key: `nowell:resist:${u.id}`, source: u,
        duration: s.bb['status_resistance[limit]'], value: s.bb.one_minus_status_resistance });
      const pulse = () => { if (healable(b, a, u)) nowellHeal(b, u, a, atk * s.bb.heal_scale, true); };
      // Source waitFirstTriggerInterval0: first periodic pulse is immediate;
      // the separate immediately_heal action has its explicit zero coefficient.
      b.addBuff(a, { key: `nowell:recovery:${u.id}`, source: u, duration: s.bb['status_resistance[limit]'],
        interval: s.bb.interval, onTick: ({ buff }) => { if (buff.timeLeft > s.bb.interval - 1e-9) pulse(); } });
      pulse();
    }
  }, { owner: u });
  b.after(duration, () => {
    if (u.deploySeq === seq && u.skill.activations === act) { b.removeBuff(u, key); u.mem.regularFormVisual = null; }
  }, { owner: u });
}
function papyrusShield(b, u, a, scale) {
  if (a.kind !== 'op') return; // original IsCharacter, not devices/tokens
  const key = 'papyrs:barrier', t = u.def.talents[0].bb, amount = u.s.atk * t['attack@scale'] * scale;
  const old = a.findBuff(key);
  b.addBuff(a, { key, source: u, shield: Math.max(amount, old?.shield ?? 0), duration: t['attack@shield_duration'] });
}
function papyrusChain(b, u, a, prof) {
  const def = u.def, second = prof.isSkill && def.skill.id === 'skchr_papyrs_2';
  const count = def.traitBb['attack@chain.max_target'] + (second ? def.skill.bb['attack@chain.extra_value'] : 0);
  const visited = new Set(), scale = prof.isSkill && !second ? def.skill.bb.shield_scale_skill : 1;
  const bounce = (from, next, i) => flight(b, u, next, 10, target => {
    visited.add(target);
    b.heal(u, target, u.s.atk * (prof.healScale ?? 1) * def.traitBb['attack@chain.atk_scale'] ** i);
    papyrusShield(b, u, target, scale);
    if (i + 1 >= count) return;
    const keys = new Set(absoluteRangeKeys(grid('x-4'), target.tileR, target.tileC, 'RIGHT'));
    const nexts = b.injuredAlliesInKeys(keys, u).filter(x => !visited.has(x) && healable(b, x, u));
    if (nexts[0]) bounce({ x: target.x, y: target.y }, nexts[0], i + 1);
  }, from);
  bounce(u, a, 0);
}
const papyrusCandidate = (b, u) => allies(b, u, { injured: false, ground: true, count: Infinity })
  .filter(a => a !== u && a.kind === 'op' && !a.findBuff('trap_skzwyx[undeadable]'))
  .sort((a, c) => c.s.maxHp - a.s.maxHp || a.deploySeq - c.deploySeq)[0];
function hibiscusEnemies(b, u, count) {
  const out = b.enemiesInKeys(u.rangeKeys, u, { canHitFly: true }); sortEnemyTargets(b, u, out);
  return out.slice(0, count);
}
function hibiscusLink(b, u) {
  const bb = u.def.skill.bb, targets = hibiscusEnemies(b, u, bb.max_target);
  const seq = u.deploySeq, act = u.skill.activations, keys = targets.map(t => `hbisc2:link:${u.id}:${t.id}`);
  let cancelled = false, endForm = form(b, u, 'Skill_1_Begin', 'Skill_1_Loop', 'Skill_1_End');
  u.mem.hibiscusLink = { targets, keys, endForm };
  const controlEpoch = u.attackControlEpoch; // skill disarm has already been attached
  const valid = () => !cancelled && live(u) && u.deploySeq === seq && u.skill.active && u.skill.activations === act;
  const pendingValid = () => valid() && u.canAct && u.attackControlEpoch === controlEpoch;
  const stop = () => { cancelled = true;
    if (u.deploySeq === seq && u.skill.activations === act && u.skill.active) u.skill.end('interrupt'); };
  const watch = b.every(b.dt, () => { if (!pendingValid()) { stop(); watch.cancel(); } }, { owner: u });
  b.after(.167, () => {
    watch.cancel(); if (!pendingValid()) { stop(); return; }
    const hit = () => {
      if (!valid()) return;
      for (const [i, e] of targets.entries()) if (live(e)) {
        if (!e.findBuff(keys[i])) b.addBuff(e, { key: keys[i], source: u, mods: { moveMul: 1 + bb.move_speed } });
        b.dealDamage(u, e, { amount: u.s.atk * bb.atk_scale, type: 'arts', isSkill: true,
          applyWay: 'ranged', isProjectile: true, tags: ['hbisc2:link'] });
      }
      // Original stopIfTargetDisappeared0 keeps an emitted link through
      // temporary disappearance; hidden hit eligibility is a separate check.
      if (!targets.some(e => e?.alive && e.deployed) && u.skill.active) u.skill.end('targets-dead');
    };
    hit(); if (valid()) u.mem.hibiscusLink.timer = b.every(1, hit, { owner: u });
  }, { owner: u });
}
function roseSources(b, u, def) {
  const sources = b._arkpediaRoseSalt ??= new Map(); sources.set(u.id, { u, def });
  if (sources.size > 1) return;
  const candidates = a => [...sources.values()].filter(x => live(x.u) && auraAlly(b, a, x.u)
    && a.kind === 'op' && bodyInKeys(a, x.u.rangeKeySet));
  b.on('heal', ctx => {
    if (ctx.opts.regen) return;
    const best = candidates(ctx.target).sort((a, c) => c.def.talents[0].bb.heal_scale - a.def.talents[0].bb.heal_scale)[0];
    if (best) ctx.amount *= best.def.talents[0].bb.heal_scale;
  });
  b.on('damageFinal', ctx => {
    if (!['phys', 'arts'].includes(ctx.dmg.type) || isHpLoss(ctx.dmg) || !(ctx.amount > 0)) return;
    const best = candidates(ctx.target).filter(x => x.u.skill.active && x.u.skill.id === 'skchr_rosesa_2')
      .sort((a, c) => a.def.skill.bb['attack@damage_scale'] - c.def.skill.bb['attack@damage_scale'])[0];
    if (!best) return;
    const bb = best.def.skill.bb, removed = ctx.amount * (1 - bb['attack@damage_scale']);
    ctx.amount -= removed;
    b.addBuff(ctx.target, { key: `rosesa:bleed:${++b._attackSeq}`, source: best.u,
      duration: bb['attack@final_duration'], interval: bb['attack@interval'],
      onTick: ({ unit }) => b.loseHp(unit, removed * bb['attack@interval'] / bb['attack@final_duration'],
        { source: best.u, tags: ['rosesa:bleed'] }) });
  });
}

export function customizeFiveStarMedicThirdKit({ battle: b, id, def, unit: u, kit }) {
  if (!FIVE_STAR_MEDIC_THIRD_OPERATORS[id]) return;
  kit.install = null;
  const s = def.skill, bb = s.bb, first = s.id === FIVE_STAR_MEDIC_THIRD_OPERATORS[id].skillIds[0];
  if (id === 'char_1024_hbisc2') {
    kit.trait = { attack: 'ranged', dmgType: 'arts', heal: null, canHitFly: true, maxTargets: 1,
      projectile: 'none', attackVisual: 'Attack', windup: timed('Attack', Infinity), install: null,
      launchAttack: (battle, unit, p, target, info) => battle.addProjectile({ from: unit, target,
        speed: 10, source: unit, visual: 'orb', data: { arkpediaTrackedVisual: true }, onHit: ({ target: e }) => {
          if (canTargetEnemy(unit, e, p)) battle.dealDamage(unit, e, { amount: unit.s.atk, type: 'arts',
            isAttack: true, isSkill: p.isSkill, applyWay: 'ranged', isProjectile: true, attackId: info.attackId });
        } }) };
    kit.skill = first ? { kind: 'duration', duration: s.duration, mods: { atkPct: bb.atk } }
      : { kind: 'duration', duration: s.duration, flags: { disarm: true },
        canActivate: () => u.canAct && !u.s.flags.disarm && hibiscusEnemies(b, u, bb.max_target).length > 0,
        onStart: () => hibiscusLink(b, u), onEnd: ctx => {
          const link = u.mem.hibiscusLink;
          if (link) { link.timer?.cancel(); for (const [i, e] of link.targets.entries()) b.removeBuff(e, link.keys[i]); link.endForm(ctx); }
          u.mem.hibiscusLink = null;
          if (live(u)) b.addBuff(u, { key: 'hbisc2:end', duration: .333, flags: { disarm: true, noSp: true } });
        } };
    return;
  }
  const cap = id === 'char_4114_harold' ? Infinity : 1;
  kit.trait = { attack: 'ranged', dmgType: 'heal', heal: null, projectile: 'none', canHitFly: true,
    maxTargets: 1, attackVisual: 'Attack', windup: timed('Attack', cap), install: null, interruptOnSkillChange: true,
    acquireTargets: (battle, unit) => allies(battle, unit, { elemental: id === 'char_4114_harold',
      count: id === 'char_4163_rosesa' ? 3 : 1, ground: id === 'char_4139_papyrs' }),
    launchAttack: (battle, unit, p, target) => {
      if (id === 'char_4139_papyrs') { papyrusChain(battle, unit, target, p); return; }
      const apply = a => {
        if (id === 'char_4173_nowell') { nowellHeal(battle, unit, a, unit.s.atk); return; }
        battle.heal(unit, a, unit.s.atk * (p.healScale ?? 1));
        if (id === 'char_4114_harold') battle.reduceElement(a, unit.s.atk * def.traitBb.ep_heal_ratio
          * (p.isSkill && !first && epRatio(a) > .5 ? bb.trait_scale : 1));
      };
      if (id === 'char_4163_rosesa') apply(target);
      else flight(battle, unit, target, id === 'char_4114_harold' ? 7 : 99, apply);
    } };
  let endForm;
  const formed = () => ({ onStart: () => { endForm = form(b, u, 'Skill_2_Begin', 'Skill_2_Idle', 'Skill_2_End'); },
    onEnd: ctx => endForm?.(ctx) });
  if (id === 'char_4114_harold') kit.skill = first ? { kind: 'duration', duration: s.duration, mods: { atkPct: bb.atk } }
    : { kind: 'duration', duration: s.duration, mods: { aspd: bb.attack_speed },
      attack: { attackVisual: 'Skill_2_Loop', windup: timed('Skill_2_Loop', Infinity),
        acquireTargets: (battle, unit) => allies(battle, unit, { elemental: true, priority: 'ep' }) }, ...formed() };
  else if (id === 'char_4163_rosesa') kit.skill = first ? { kind: 'charges', trigger: { rule: 'DEFAULT', allies: true },
    attack: { healScale: bb.heal_scale, attackVisual: 'Skill_1', windup: timed('Skill_1') } }
    : { kind: 'duration', duration: s.duration, mods: { batFlat: bb.base_attack_time },
      attack: { attackVisual: 'Skill_2_Loop', windup: timed('Skill_2_Loop') }, ...formed() };
  else if (id === 'char_4173_nowell') kit.skill = first ? { kind: 'duration', duration: s.duration,
    mods: { atkPct: bb.atk, aspd: bb.attack_speed },
    attack: { acquireTargets: (battle, unit) => allies(battle, unit, { priority: 'abnormal' }) } }
    : { kind: 'instant', canActivate: () => u.canAct && !u.s.flags.disarm && !u.findBuff('nowell:cast')
      && allies(b, u, { injured: false, priority: 'abnormal', count: Infinity }).some(a => a.kind === 'op'), onStart: () => nowellCast(b, u) };
  else kit.skill = first ? { kind: 'charges', trigger: { rule: 'DEFAULT', allies: true },
    attack: { healScale: bb.heal_scale, attackVisual: 'Skill_1', windup: timed('Skill_1') } }
    : { kind: 'duration', duration: s.duration, mods: { atkPct: bb.atk, batFlat: bb.base_attack_time },
      canActivate: () => u.canAct && !u.s.flags.disarm && !!papyrusCandidate(b, u),
      attack: { attackVisual: 'none', windup: (_battle, unit) => .66 / rate(unit),
        acquireTargets: (battle, unit) => {
          const target = unit.mem.papyrusTarget;
          return healable(battle, target, unit) && target.hp < target.s.maxHp - .01
            && bodyInKeys(target, unit.rangeKeySet) && target.findBuff(`papyrs:locked:${unit.id}`) ? [target] : [];
        } }, onStart: () => {
          u.mem.papyrusTarget = papyrusCandidate(b, u);
          b.addBuff(u.mem.papyrusTarget, { key: `papyrs:locked:${u.id}`, source: u,
            onRemove: () => { if (u.skill.active) u.skill.end('target-lost'); } });
          endForm = form(b, u, 'Skill_2_Begin', 'Skill_2_Loop', null);
        }, onEnd: ctx => {
          if (u.mem.papyrusTarget) b.removeBuff(u.mem.papyrusTarget, `papyrs:locked:${u.id}`);
          u.mem.papyrusTarget = null; endForm?.(ctx);
        } };
  // Custom projectile healing keeps profile.heal null; DEFAULT still needs
  // the explicit heal condition so charged heals fire for injured allies.
  kit.skill.heal = true;
}
export function installFiveStarMedicThird({ battle: b, unit: u, def }) {
  const id = def.charId, talent = def.talents[0]?.bb;
  if (!FIVE_STAR_MEDIC_THIRD_OPERATORS[id]) return;
  if (id === 'char_4114_harold' && talent) {
    const sync = registerBerryProtection(b, u, talent.ep_damage_resistance,
      a => bodyInKeys(a, u.rangeKeySet) && epRatio(a) > .5, () => true);
    b.on('elementHit', sync, { owner: u });
    sync();
  } else if (id === 'char_4163_rosesa') {
    // Installers run before the initial deployment, while the unit is not alive.
    b.addBuff(u, { key: 'rosesa:atk', source: u, mods: { atkPct: talent.atk },
      allowDead: true, persist: true }); roseSources(b, u, def);
  } else if (id === 'char_4139_papyrs') {
    // Unit removal discards nonpersistent buffs without running onRemove.
    // The source target-lost branch must also run on death/withdrawal.
    b.on('death', ({ unit }) => {
      if (unit === u.mem.papyrusTarget && u.skill.active) u.skill.end('target-lost');
    }, { owner: u });
  } else if (id === 'char_1024_hbisc2') {
    if (talent) b.on('hit', ({ source, target, dmg }) => {
      if (source === u && target?.side === 'enemy' && ['phys', 'arts', 'true'].includes(dmg.type) && !isHpLoss(dmg))
        b.applyStatus(target, 'artsFragile', { key: `hbisc2:fragile:${u.id}`, source: u,
          duration: talent['weak[magic][limit]'], value: talent.damage_scale - 1 });
    }, { owner: u });
    b.on('damaged', ({ source, target, amount, dmg }) => {
      if (source !== u || target?.side !== 'enemy' || !live(u) || !(amount > 0)
        || ['element', 'elemental'].includes(dmg.type) || isHpLoss(dmg)) return;
      const recipient = allies(b, u)[0]; if (recipient) b.heal(u, recipient, amount * def.traitBb.scale);
    }, { owner: u });
  }
}
