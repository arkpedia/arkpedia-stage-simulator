// SPDX-License-Identifier: GPL-3.0-or-later
// Source bindings and unrecovered native dispatch bounds are retained in
// data/arkpedia-defender-third-prefabs.json.
import { DEFENDER_THIRD_OPERATORS } from '../../../shared/arkpedia/defender-third-operators.js';
import evidence from '../../../data/arkpedia-defender-third-prefabs.json' with { type: 'json' };
import { absoluteRangeKeys, canTargetEnemy } from '../targeting.js';
import { bodyInKeys } from '../body.js';

const LISK = 'char_107_liskam', VULCAN = 'char_163_hpsts', AURORA = 'char_422_aurora', HOSHI = 'char_136_hsguma';
const live = u => u?.alive && u.deployed && !u.hidden;
const model = (u, front = false) => evidence.originalModels[u.defId][front || !['UP', 'LEFT'].includes(u.dir) ? 'Front' : 'Back'];
const speed = (u, cap = Infinity) => Math.min(cap, u.s.aspd / 100);
const timing = (clip, cap = Infinity, front = false) => (_b, u) => model(u, front).hits[clip][0] / speed(u, cap);
const keys = (u, range) => new Set(absoluteRangeKeys(evidence.ranges[range], u.tileR, u.tileC, u.dir));
function mods(b, u, key, value, source = u, flags = null) {
  const old = u.findBuff(key);
  if (!value && !flags) b.removeBuff(u, key);
  else if (!old || old.source !== source || JSON.stringify(old.mods) !== JSON.stringify(value)
    || JSON.stringify(old.flags) !== JSON.stringify(flags)) b.addBuff(u, { key, source, mods: value, flags });
}
function beginForm(b, u, begin, idle) {
  const seq = u.deploySeq, activation = u.skill.activations, duration = model(u).durations[begin];
  u.mem.regularFormVisual = { clip: begin, loop: false };
  b.addBuff(u, { key: 'defender-third:begin', source: u, duration, flags: { disarm: true } });
  b.after(duration, () => {
    if (live(u) && u.deploySeq === seq && u.skill.active && u.skill.activations === activation)
      u.mem.regularFormVisual = { clip: idle, loop: true };
  }, { owner: u });
}
function endForm(b, u, end, reason) {
  b.removeBuff(u, 'defender-third:begin');
  if (!live(u) || reason === 'death' || reason === 'retreat') { u.mem.regularFormVisual = null; return; }
  const seq = u.deploySeq, duration = model(u).durations[end];
  u.mem.regularFormVisual = { clip: end, loop: false };
  b.addBuff(u, { key: 'defender-third:end', source: u, duration, flags: { disarm: true } });
  b.after(duration, () => { if (u.deploySeq === seq) u.mem.regularFormVisual = null; }, { owner: u });
}
function syncAurora(b, u, def) {
  if (!live(u)) return;
  // Native source gives the unblocked state SP_MODIFY_STOPPED, so grants stop
  // too. Do not substitute a zero natural-recovery rate alone.
  mods(b, u, 'aurora:unblocked-sp', null, u, u.blocking.some(e => e.alive && e.blockedBy === u) ? null : { noSp: true });
  const t = def.talents[0]?.bb;
  const resting = t && !u.skill.active && u.skill.spTotal <= u.skill.spCost * t.sp_ratio + 1e-9;
  mods(b, u, 'aurora:rest', resting ? { hpRegenRatio: t.hp_recovery_per_sec_by_max_hp_ratio } : null,
    u, resting ? { disarm: true } : null);
}
function syncHoshi(b, u, def) {
  const t = def.talents[1]?.bb;
  for (const a of b.allyUnits) {
    // Original validator ignores general target-free, but explicitly retains
    // ally-target-free; friendly stealth/untargetability do not drop the aura.
    const eligible = t && live(u) && live(a) && a.kind === 'op'
      && a.def.profession === 'TANK' && b.allySelectable(a, u);
    mods(b, a, `hoshiguma:defenders:${u.id}`, eligible ? { defPct: t.def } : null, u);
  }
}
function liskOpening(b, u) {
  const first = !u.mem.liskarmOpened;
  u.mem.liskarmFirstVisual = first; u.mem.liskarmOpened = true;
  return (model(u).hits.Attack_Loop[0] + (first ? model(u).durations.Attack_Begin : 0)) / speed(u, 2);
}
function hoshSaw(b, u) {
  const seq = u.deploySeq, activation = u.skill.activations;
  const valid = () => live(u) && u.deploySeq === seq && u.skill.active && u.skill.activations === activation;
  const loop = () => {
    if (!valid() || !u.canAct) return;
    // The original uncapped selector stays in its inherited 1-1 range; it does
    // not append blocked enemies behind/outside it.
    const victims = b.enemiesInKeys([...keys(u, '1-1')], u, { canHitFly: false });
    const attackId = ++b._attackSeq;
    for (const e of victims) if (canTargetEnemy(u, e, { canHitFly: false })) {
      b._ev(['atk', u.id, e.id, 'none', { animation: 'Skill', projectile: 'none' }]);
      b.dealDamage(u, e, { amount: u.s.atk, type: 'phys', isAttack: true, isSkill: true,
        attackId, applyWay: 'melee', tags: ['hoshiguma:saw'] });
    }
    if (victims.length) { u.stats.attacks++; b.emit('attack', { attacker: u, targets: victims, isSkill: true }); }
  };
  u.mem.regularFormVisual = { clip: 'Skill_Begin', loop: false };
  b.after(model(u).durations.Skill_Begin, () => {
    if (valid()) u.mem.regularFormVisual = { clip: 'Skill', loop: true };
  }, { owner: u });
  // Exact source non-event predelay .4, triggerDelta1 and independent calculator
  // sec contract establish fixed one-second pulses. Native pause/restart FSM
  // details remain scoped; control skips a pulse without accumulating backlog.
  u.mem.hoshSawFirst = b.after(.4, () => {
    if (!valid()) return;
    loop(); u.mem.hoshSawLoop = b.every(1, loop, { owner: u });
  }, { owner: u });
}
export function customizeDefenderThirdKit({ battle: b, id, def, unit: u, kit }) {
  if (!DEFENDER_THIRD_OPERATORS[id]) return;
  const s = def.skill, bb = s.bb, n = DEFENDER_THIRD_OPERATORS[id].skillIds.indexOf(s.id);
  kit.install = null;
  kit.trait = { attack: id === LISK ? 'ranged' : 'melee', dmgType: 'phys', projectile: 'none',
    canHitFly: id === LISK, maxTargets: 1, hitAllBlocked: false, interruptOnSkillChange: true,
    attackVisual: 'Attack', windup: timing('Attack', id === VULCAN ? 1 : id === HOSHI ? 2 : Infinity) };
  if (id === LISK) {
    kit.trait.windup = liskOpening;
    kit.trait.attackVisual = (_battle, unit) => unit.mem.liskarmFirstVisual
      ? { begin: 'Attack_Begin', loop: 'Attack_Loop', beginDuration: model(unit).durations.Attack_Begin / speed(unit, 2) }
      : 'Attack_Loop';
    if (n === 0) kit.skill = { kind: 'instant', trigger: 'SP_FULL', onStart: () => {
      b.addBuff(u, { key: 'liskarm:charged-defense', source: u, duration: bb.duration, mods: { defPct: bb.def } });
      b.addBuff(u, { key: 'liskarm:block-once', source: u, duration: bb.duration, shieldHits: 1, visible: true });
    } };
    else kit.skill = { kind: 'duration', duration: s.duration, mods: { atkPct: bb.atk, batPct: bb.base_attack_time },
      targeting: { maxTargets: bb['attack@max_target'] },
      attack: { dmgType: 'arts', maxTargets: bb['attack@max_target'], retargetOnRelease: true,
        attackVisual: 'Skill', windup: (_battle, unit) => .3333 / speed(unit, 2),
        onEachHit: ({ target }) => { if (target.alive && b.rng() < bb['attack@buff_prob'])
          b.applyStatus(target, 'stun', { duration: bb['attack@stun'], source: u }); } },
      onStart: () => { u.mem.liskarmOpened = false; }, onEnd: ({ reason }) => {
        u.mem.liskarmOpened = false;
        if (reason === 'duration' && live(u)) b.applyStatus(u, 'stun', { duration: bb.stun, source: u });
      } };
  } else if (id === VULCAN) {
    kit.trait.noHeal = true;
    const t = def.talents[0]?.bb;
    kit.skill = { kind: 'duration', duration: s.duration,
      mods: { blockCnt: bb.block_cnt, ...(n === 0 ? { defPct: bb.def,
        hpRegenRatio: bb.hp_recovery_per_sec_by_max_hp_ratio + (t?.hp_recovery_per_sec_by_max_hp_ratio ?? 0) }
        : { atkPct: bb.atk, batFlat: bb.base_attack_time, hpRegenRatio: t?.hp_recovery_per_sec_by_max_hp_ratio ?? 0 }) } };
    if (n === 1) {
      kit.skill.attack = { maxTargetsByBlock: true, hitAllBlocked: false, windup: timing('Skill', 1.1, true), attackVisual: 'Skill' };
      kit.skill.onStart = () => { u.mem.regularAttackFacing = 'Front'; };
      kit.skill.onAttack = () => b.heal(u, u, u.s.maxHp * bb.hp_ratio, { self: true, ignoreHealFree: true });
      kit.skill.onEnd = () => { u.mem.regularAttackFacing = null; };
    }
  } else if (id === AURORA) {
    const ending = ({ reason }) => {
      b.removeBuff(u, 'aurora:resist');
      endForm(b, u, n === 0 ? 'Skill_End' : 'Skill_2_End', reason);
      if (n === 0 && reason === 'duration' && live(u)) b.applyStatus(u, 'stun', { duration: bb.stun, source: u });
      syncAurora(b, u, def);
    };
    if (n === 0) kit.skill = { kind: 'duration', duration: s.duration, mods: { defPct: bb.def, blockCnt: bb.block_cnt },
      attack: { attackVisual: 'Skill_Loop', windup: timing('Skill_Loop') },
      onStart: () => { b.removeBuff(u, 'aurora:rest'); b.applyStatus(u, 'resist', { key: 'aurora:resist',
        duration: 30, value: -bb.one_minus_status_resistance, source: u }); beginForm(b, u, 'Skill_Begin', 'Skill_Idle'); }, onEnd: ending };
    else kit.skill = { kind: 'ammo', ammo: 9, manualCancel: true,
      mods: { atkPct: bb.atk, batPct: bb.base_attack_time },
      attack: { attackVisual: 'Skill_2_Loop', windup: timing('Skill_2_Loop', 1),
        onEachHit: ({ target }) => { if (target.alive && !target.s.flags.freeze)
          b.applyStatus(target, 'cold', { duration: bb['attack@cold'], source: u }); } },
      onStart: () => { b.removeBuff(u, 'aurora:rest'); beginForm(b, u, 'Skill_2_Begin', 'Skill_2_Idle'); }, onEnd: ending };
  } else if (n === 0) kit.skill = { kind: 'duration', duration: s.duration, mods: { atkPct: bb.atk, defPct: bb.def } };
  else if (n === 1) kit.skill = { kind: 'passive', mods: { defPct: bb.def } };
  else kit.skill = { kind: 'duration', duration: s.duration, mods: { atkPct: bb.atk, defPct: bb.def },
    attack: { noAttack: true }, onStart: () => hoshSaw(b, u), onEnd: ({ reason }) => {
      u.mem.hoshSawFirst?.cancel(); u.mem.hoshSawLoop?.cancel(); endForm(b, u, 'Skill_End', reason);
    } };
  kit.skill.id = s.id; kit.skill.name = s.name;
}
export function installDefenderThird({ battle: b, unit: u, def }) {
  const id = def.charId;
  if (!DEFENDER_THIRD_OPERATORS[id]) return;
  if (id === LISK) {
    const t = def.talents[0]?.bb, res = def.talents[1]?.bb;
    b.on('deploy', ({ unit }) => { if (unit === u) { u.mem.liskarmOpened = false;
      if (res) mods(b, u, 'liskarm:RES', { resFlat: res.magic_resistance }); } }, { owner: u });
    b.on('tick', () => { if (!live(u) || !u.canAct || !b.enemiesInKeys(u.rangeKeys, u, u.profile).length)
      u.mem.liskarmOpened = false; }, { owner: u });
    if (t) b.on('hit', ({ target, dmg }) => {
      if (target !== u || !live(u) || !dmg.isAttack || dmg.tags?.includes('hpLoss')) return;
      const area = keys(u, 'x-5');
      const candidates = b.allyUnits.filter(a => a !== u && live(a) && a.kind !== 'device'
        && b.allySelectable(a, u) && bodyInKeys(a, area));
      u.skill.gainSp(t.sp, 'liskarm:talent');
      if (candidates.length) candidates[b.rng.int(candidates.length)].skill?.gainSp(t.sp, 'liskarm:talent');
    }, { owner: u });
  } else if (id === VULCAN) {
    const t = def.talents[0]?.bb;
    if (t) b.on('hit', ({ source, target, dmg }) => {
      if (target !== u || !live(u) || !u.skill.active || !dmg.canDodge || dmg.type !== 'phys' || dmg.applyWay !== 'melee') return;
      if (b.rng() < t.prob) { dmg.cancel = true; b.fx('dodge', { x: u.x, y: u.y, id: u.id }); b.emit('dodge', { source, target, dmg }); }
    }, { owner: u });
  } else if (id === AURORA) {
    const sync = () => syncAurora(b, u, def);
    b.on('deploy', sync, { owner: u }); b.on('tick', sync, { owner: u }); b.on('death', sync, { owner: u });
    b.on('spGain', ctx => { if (ctx.unit !== u) return;
      if (!u.blocking.some(e => e.alive && e.blockedBy === u) && ctx.reason !== 'init') ctx.amount = 0;
    }, { owner: u });
    b.on('hit', ({ source, target, dmg }) => {
      if (source === u && u.skill.active && u.skill.id === 'skchr_aurora_2' && dmg.isAttack
        && target.s.flags.freeze) dmg.amount *= def.skill.bb.atk_scale;
    }, { owner: u });
  } else {
    const armor = def.talents[0]?.bb, sync = () => syncHoshi(b, u, def);
    b.on('deploy', sync, { owner: u }); b.on('tick', sync, { owner: u }); b.on('death', sync, { owner: u });
    b.on('hit', ({ source, target, dmg }) => {
      if (target !== u || !live(u) || dmg.tags?.includes('hpLoss') || dmg.type === 'element') return;
      // InverseDamage explicitly retains cancelled receipts, and emits its
      // own NORMAL Physical output even when the incoming source was a skill.
      if (u.skill.active && u.skill.id === 'skchr_hsguma_2' && source?.alive && source.side === 'enemy')
        b.dealDamage(u, source, { amount: u.s.atk * def.skill.bb.atk_scale, type: 'phys', isAttack: true,
          applyWay: 'none', tags: ['hoshiguma:thorns'] });
      if (armor && b.rng() < armor.prob) {
        // A block leaves a zero-damage receipt (including defensive SP),
        // unlike Evade/cancel. HP loss and elemental gauge never enter it.
        dmg.mul = 0; b.fx('shield', { x: u.x, y: u.y, id: u.id });
      }
    }, { owner: u });
  }
}
