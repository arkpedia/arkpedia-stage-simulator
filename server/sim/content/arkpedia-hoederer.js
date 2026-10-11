// SPDX-License-Identifier: GPL-3.0-or-later
import { HOEDERER_OPERATORS } from '../../../shared/arkpedia/hoederer-operators.js';
import evidence from '../../../data/arkpedia-hoederer-prefabs.json' with { type: 'json' };
import { resolveHit } from '../ai.js';
import { absoluteRangeKeys, canTargetEnemy } from '../targeting.js';
import { bodyInKeys } from '../body.js';
import { applyHpLoss, isHpLoss, makeDamageInfo } from '../damage.js';

const ID = 'char_4088_hodrer';
const live = u => u?.alive && u.deployed && !u.hidden;
const s2 = u => u.mem.hoedererStance === true;
const s3 = u => u.skill.active && u.skill.id === 'skchr_hodrer_3';
const model = u => evidence.originalModels[ID][['UP', 'LEFT'].includes(u.dir) ? 'Back' : 'Front'];
const single = p => ({ ...p, hits: 1, hitsFn: null, splashRadius: 0, chain: null, dmgMul: null });
function clip(u) {
  if (s3(u)) return u.dir === 'DOWN' ? 'Skill_Down_3_Loop' : 'Skill_3_Loop';
  if (s2(u)) return u.mem.hoedererNextA ? 'Skill_2_Loop_A' : 'Skill_2_Loop_B';
  return u.skill.pending ? 'Skill_1' : 'Attack';
}
function sourceWindup(_b, u) {
  // Original mode2 ReplaceAnimation loopType1 selects alternating A/B. Both
  // source events share .767; the native loop dispatcher remains unrecovered.
  u.mem.hoedererAttackClip = clip(u);
  if (s2(u)) u.mem.hoedererNextA = !u.mem.hoedererNextA;
  return model(u).hits[u.mem.hoedererAttackClip][0] / Math.min(1, u.s.aspd / 100);
}
function sourceLaunch(b, u, p, target, info) {
  if (!canTargetEnemy(u, target, p)) return;
  if (info.isSkill && u.skill.id === 'skchr_hodrer_1') u.mem.hoedererEmitted = info.attackId;
  const hit = { ...info, isSkill: info.isSkill || s2(u) };
  // Original activeBuff stun is bound before ON_CALCULATE_DAMAGE, matching
  // the established activeBuff adapter. Exact C# emission order is scoped.
  if (s2(u)) b.applyStatus(target, 'stun', { source: u, duration: u.skill.bb['attack@stun'] });
  else if (s3(u) && b.rng() < u.skill.bb['attack@buff_prob'])
    b.applyStatus(target, 'stun', { source: u, duration: u.skill.bb['attack@stun'] });
  resolveHit(b, u, single(p), target, hit, target.x, target.y);
}
function form(b, u, opening, idle, gate) {
  const duration = model(u).durations[opening], seq = u.deploySeq;
  const token = {}; u.mem.hoedererFormToken = token;
  u.mem.regularFormVisual = { clip: opening, loop: false };
  b.addBuff(u, { key: 'hoederer:form', source: u, duration, flags: { disarm: true, noSp: true } });
  b.after(duration, () => {
    if (live(u) && u.deploySeq === seq && u.mem.hoedererFormToken === token && gate())
      u.mem.regularFormVisual = idle ? { clip: idle, loop: true } : null;
  }, { owner: u });
}
function stance(b, u, bb) {
  u.mem.hoedererStance = !s2(u); u.mem.hoedererNextA = true;
  if (s2(u)) {
    b.addBuff(u, { key: 'hoederer:stance', source: u,
      mods: { batFlat: bb.base_attack_time, blockCnt: bb.block_cnt } });
    form(b, u, 'Skill_2_Begin', 'Skill_2_Idle', () => s2(u));
  } else {
    b.removeBuff(u, 'hoederer:stance');
    form(b, u, 'Skill_2_End', null, () => !s2(u));
  }
}
function syncSanctuary(b, u, t) {
  const key = `hoederer:sanctuary:${u.id}`;
  const keys = t ? absoluteRangeKeys(evidence.ranges['b-1'], u.tileR, u.tileC, u.dir) : [];
  for (const a of b.allyUnits) {
    // Non-healing purposeNONE permits ordinary noHeal/HealFree allies. Native
    // friendly target-free/isolation checks stay independent from heal gates.
    const accepted = t && live(u) && live(a) && a.kind !== 'device'
      && !a.s.flags.untargetable && b.allySelectable(a, u)
      && (a === u || bodyInKeys(a, keys));
    if (accepted) {
      if (a.findBuff(key)?.data.value !== t.damage_resistance)
        b.applyStatus(a, 'sanctuary', { key, source: u, value: t.damage_resistance });
    } else b.removeBuff(a, key);
  }
}
function mark(b, u, e) {
  if (!s3(u) || !live(u) || !live(e) || e.side !== 'enemy' || e.s.flags.invulnerable) return;
  const key = `hoederer:burn:${u.id}`;
  if (e.findBuff(key)) return;
  const damage = u.skill.bb['attack@damage'];
  b.addBuff(e, { key, source: u, interval: 1, onTick: () => {
    // Native NoSourceDamage removes outgoing source modifiers/talents while
    // retaining damage/kill credit. No range/ground/target-free filter exists
    // after attachment; a derived buff stops only with its parent lifetime.
    b.dealDamage(u, e, { amount: damage, type: 'true', sourceless: true,
      canDodge: false, ignoreSelect: true, isAttack: false, isSkill: true,
      tags: ['dot', 'hoederer:burn'] });
  } });
}
function clearMarks(b, u) {
  for (const e of b.enemies) b.removeBuff(e, `hoederer:burn:${u.id}`);
  b.removeBuff(u, 'hoederer:drain');
}
function beginS3(b, u) {
  form(b, u, 'Skill_3_Begin', 'Skill_3_Idle', () => s3(u));
  b.addBuff(u, { key: 'hoederer:drain', source: u, interval: 1,
    onTick: () => {
      if (!s3(u) || !live(u)) return;
      // Original FixedValueDamage PURE skipModifierEvent/ignoreForSp bypasses
      // ordinary shields and damage multipliers; its direct HP bookkeeping
      // remains lethal, unlike a source UNDEADABLE/nonlethal floor.
      applyHpLoss(b, u, u, u.skill.bb['attack@value'],
        makeDamageInfo({ amount: u.skill.bb['attack@value'], type: 'true', canDodge: false,
          noSp: true, tags: ['hpLoss', 'hoederer:drain'] }));
    } });
}
function endS3(b, u, reason) {
  clearMarks(b, u); b.removeBuff(u, 'hoederer:form');
  u.mem.hoedererFormToken = null;
  if (live(u) && !['death', 'retreat'].includes(reason))
    form(b, u, 'Skill_3_End', null, () => !s3(u));
  else u.mem.regularFormVisual = null;
}
export function customizeHoedererKit({ battle: b, id, def, unit: u, kit }) {
  if (!HOEDERER_OPERATORS[id]) return;
  kit.install = null;
  kit.trait = { attack: 'melee', projectile: 'none', dmgType: 'phys', canHitFly: false,
    hits: 1, hitsFn: null, chain: null, splashRadius: 0, maxTargets: 1,
    maxTargetsByBlock: true, allowZeroBlockTargetLimit: false, hitAllBlocked: false,
    allInRange: false, rangeAoe: false, dmgMul: null, install: null,
    retargetOnRelease: true, interruptOnSkillChange: true, launchAttack: sourceLaunch,
    windup: sourceWindup, attackVisual: (_battle, unit) => unit.mem.hoedererAttackClip };
  const s = def.skill, bb = s.bb;
  if (s.id === 'skchr_hodrer_1') kit.skill = { kind: 'instant',
    attack: { atkScale: bb.atk_scale, retargetOnRelease: false,
      afterAttack: (_battle, unit, targets, context) => {
        if (unit.mem.hoedererEmitted !== context.attackId && context.inputTargets.length
          && context.inputTargets.every(e => !e.alive)) unit.skill.addCharge(1);
      } } };
  else if (s.id === 'skchr_hodrer_2') kit.skill = { kind: 'instant', trigger: 'NEVER',
    onStart: () => stance(b, u, bb) };
  else kit.skill = { kind: 'duration', duration: s.duration,
    mods: { hpPct: bb.max_hp, atkPct: bb.atk, rangeExtend: bb.ability_range_forward_extend },
    attack: {}, onStart: () => { b._refreshRange(u); beginS3(b, u); },
    onEnd: ({ reason }) => endS3(b, u, reason) };
  kit.skill.id = s.id; kit.skill.name = s.name;
}
export function installHoederer({ battle: b, unit: u, def }) {
  if (!HOEDERER_OPERATORS[def.charId]) return;
  u.mem.hoedererStance = false; u.mem.hoedererNextA = true;
  const damage = def.talents.find(t => t.bb.atk_scale_2 != null)?.bb;
  const sanctuary = def.talents.find(t => t.bb.damage_resistance != null)?.bb;
  if (def.skill.id === 'skchr_hodrer_2') b.addBuff(u, { key: 'hoederer:passive', source: u,
    persist: true, allowDead: true, mods: { atkPct: def.skill.bb.atk } });
  b.on('hit', ({ source, target, dmg }) => {
    if (source === u && target.side === 'enemy') {
      if (damage && dmg.isAttack)
        dmg.amount *= target.s.flags.stun || target.s.flags.bind ? damage.atk_scale : damage.atk_scale_2;
      if (!isHpLoss(dmg)) mark(b, u, target);
    } else if (target === u && source?.side === 'enemy' && !isHpLoss(dmg)) mark(b, u, source);
  }, { owner: u });
  b.on('beforeAttack', ({ attacker, isSkill }) => {
    if (attacker !== u || !live(u)) return;
    // The native ON_ABILITY_SPELL_ON heal is one attack-family start. Its exact
    // position within the native cast/clip lifecycle is not recovered.
    if (s3(u)) b.heal(u, u, u.s.maxHp * u.skill.bb['attack@hp_ratio'], { self: true });
    else if (isSkill && u.skill.id === 'skchr_hodrer_1' && u.skill.pending)
      b.heal(u, u, u.s.maxHp * u.skill.bb.hp_ratio, { self: true });
  }, { owner: u });
  const sync = () => syncSanctuary(b, u, sanctuary);
  for (const name of ['tick', 'deploy', 'death', 'retreat']) b.on(name, sync, { owner: u });
  const cleanup = ({ unit }) => {
    if (unit !== u) return;
    u.mem.hoedererStance = false; u.mem.hoedererFormToken = null; u.mem.regularFormVisual = null;
    b.removeBuff(u, 'hoederer:stance'); b.removeBuff(u, 'hoederer:form'); clearMarks(b, u); sync();
  };
  b.on('death', cleanup, { owner: u }); b.on('retreat', cleanup, { owner: u });
  sync();
}
