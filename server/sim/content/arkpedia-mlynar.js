// SPDX-License-Identifier: GPL-3.0-or-later
import { MLYNAR_OPERATORS } from '../../../shared/arkpedia/mlynar-operators.js';
import evidence from '../../../data/arkpedia-mlynar-prefabs.json' with { type: 'json' };
import { resolveHit } from '../ai.js';
import { absoluteRangeKeys, canTargetEnemy } from '../targeting.js';
import { bodyInKeys } from '../body.js';
import { isHpLoss } from '../damage.js';

const ID = 'char_4064_mlynar';
const live = u => u?.alive && u.deployed && !u.hidden;
const third = u => u.skill.active && u.skill.id === 'skchr_mlynar_3';
const second = u => u.skill.active && u.skill.id === 'skchr_mlynar_2';
const model = u => evidence.originalModels[ID][['UP', 'LEFT'].includes(u.dir) ? 'Back' : 'Front'];
const number = u => Number(u.skill.id.at(-1));
const plain = p => ({ ...p, hits: 1, hitsFn: null, splashRadius: 0, chain: null, dmgMul: null });
function setRamp(b, u, pct) {
  b.removeBuff(u, 'mlynar:ramp');
  if (pct) b.addBuff(u, { key: 'mlynar:ramp', source: u, mods: { atkPct: pct } });
}
function form(b, u, ending = false) {
  const seq = u.deploySeq, token = {}, n = number(u);
  u.mem.mlynarForm = token;
  const clip = `Skill_${n}_${ending ? 'End' : 'Start'}`, duration = model(u).durations[clip];
  u.mem.regularFormVisual = { clip, loop: false };
  b.addBuff(u, { key: 'mlynar:form', source: u, duration, flags: { disarm: true, noSp: true } });
  b.after(duration, () => {
    if (live(u) && u.deploySeq === seq && u.mem.mlynarForm === token)
      u.mem.regularFormVisual = ending ? null : { clip: `Skill_${n}_Idle`, loop: true };
  }, { owner: u });
}
function start(b, u) {
  b.removeBuff(u, 'mlynar:idle-block');
  u.mem.mlynarKilled = false; u.mem.mlynarKillsThisFamily = 0;
  if (third(u)) {
    // The source separately captures the trait-count modifier then clears its
    // old stacks. Official trait_up and an independent calculator bind the
    // doubled coefficient; native preprocessing remains explicitly scoped.
    u.mem.mlynarCapturedPct = u.def.traitBb.atk * u.skill.bb.trait_up
      * Math.max(1, u.mem.mlynarStacks) / u.def.traitBb.max_stack_cnt;
    u.mem.mlynarStacks = 0;
    setRamp(b, u, u.mem.mlynarCapturedPct);
  }
  form(b, u);
  b._refreshRange(u);
}
function end(b, u, reason) {
  const retain = second(u) || u.skill.id === 'skchr_mlynar_2';
  if (!(retain && u.mem.mlynarKilled)) u.mem.mlynarStacks = 0;
  u.mem.mlynarCapturedPct = 0; u.mem.mlynarKillsThisFamily = 0;
  setRamp(b, u, u.def.traitBb.atk * u.mem.mlynarStacks / u.def.traitBb.max_stack_cnt);
  b.removeBuff(u, 'mlynar:form'); u.mem.mlynarForm = null;
  if (live(u)) b.addBuff(u, { key: 'mlynar:idle-block', source: u, mods: { blockCntMul: 0 } });
  if (live(u) && !['death', 'retreat'].includes(reason)) form(b, u, true);
  else u.mem.regularFormVisual = null;
}
function launch(b, u, p, target, info) {
  if (!canTargetEnemy(u, target, p)) return;
  const seq = u.deploySeq, act = u.skill.activations, epoch = u.attackControlEpoch;
  resolveHit(b, u, plain(p), target, info, target.x, target.y);
  if (!second(u)) return;
  const delta = (model(u).hits.Skill_2_Loop[1] - model(u).hits.Skill_2_Loop[0]) * 100 / u.s.aspd;
  b.after(delta, () => {
    if (!live(u) || u.deploySeq !== seq || u.skill.activations !== act || !second(u)
      || !u.canAct || u.attackControlEpoch !== epoch || !canTargetEnemy(u, target, p)) return;
    resolveHit(b, u, plain(p), target, info, target.x, target.y);
  }, { owner: u });
}
function afterFamily(b, u) {
  if (!third(u) || !u.mem.mlynarKillsThisFamily) return;
  u.mem.mlynarCapturedPct = Math.max(0,
    u.mem.mlynarCapturedPct + u.skill.bb.per_kill_reduce * u.mem.mlynarKillsThisFamily);
  u.mem.mlynarKillsThisFamily = 0;
  setRamp(b, u, u.mem.mlynarCapturedPct);
}
function enemyCount(b, u) {
  const keys = absoluteRangeKeys(evidence.ranges['x-4'], u.tileR, u.tileC, u.dir);
  // CheckHasEnemyInRange has no damage-purpose/target-free validator. Keep
  // born enemies of either motion, including unavailable attack targets.
  return b.enemies.filter(e => live(e) && bodyInKeys(e, keys)).length;
}
function syncTalent(b, u, bb) {
  if (!live(u) || !bb) return;
  const high = enemyCount(b, u) >= bb.cnt;
  u.mem.mlynarScale = high ? bb.atk_scale_up : bb.atk_scale_base;
  const key = 'mlynar:sanctuary';
  if (high) {
    if (!u.findBuff(key)) b.applyStatus(u, 'sanctuary', {
      key, source: u, value: bb.damage_resistance, includePure: true });
  } else b.removeBuff(u, key);
}
function syncReflect(b, u, bb) {
  const key = `mlynar:inverse:${u.id}`;
  for (const a of b.allyUnits) {
    // Native ALL/639/kazimierz ignores both target-free gates. This is a
    // non-healing aura; allied isolation, HealFree/noHeal do not remove it.
    const allowed = bb && live(u) && live(a) && a.kind === 'op' && a.tags.has('kazimierz');
    if (allowed) { if (!a.findBuff(key)) b.addBuff(a, { key, source: u }); }
    else b.removeBuff(a, key);
  }
}
export function customizeMlynarKit({ battle: b, id, def, unit: u, kit }) {
  if (!MLYNAR_OPERATORS[id]) return;
  kit.install = null;
  kit.trait = { attack: 'melee', dmgType: 'phys', projectile: 'none', canHitFly: false,
    noAttackUnlessSkill: true, maxTargets: 1, maxTargetsByBlock: false, hitAllBlocked: false,
    hits: 1, hitsFn: null, chain: null, splashRadius: 0, allInRange: false, rangeAoe: false,
    dmgMul: null, install: null, retargetOnRelease: true, interruptOnSkillChange: true,
    launchAttack: launch, windup: (_b, unit) => model(unit).hits[`Skill_${number(unit)}_Loop`][0]
      * 100 / unit.s.aspd, attackVisual: (_b, unit) => `Skill_${number(unit)}_Loop` };
  const s = def.skill, bb = s.bb, is3 = s.id === 'skchr_mlynar_3';
  kit.skill = { id: s.id, name: s.name, kind: 'duration', duration: s.duration,
    manualCancel: s.id === 'skchr_mlynar_2',
    ...(s.rangeGrid ? { targeting: { rangeGrid: s.rangeGrid } } : {}),
    mods: s.id === 'skchr_mlynar_1' ? { defPct: bb.def }
      : s.id === 'skchr_mlynar_2' ? { batFlat: bb.base_attack_time } : {},
    attack: { atkScale: bb['attack@atk_scale'], canHitFly: is3,
      maxTargets: is3 ? bb['attack@max_target'] : 1,
      tags: [`mlynar:s${s.id.at(-1)}`], afterAttack: (_battle, unit) => afterFamily(b, unit) },
    onStart: () => start(b, u), onEnd: ({ reason }) => end(b, u, reason) };
}
export function installMlynar({ battle: b, unit: u, def }) {
  if (!MLYNAR_OPERATORS[def.charId]) return;
  u.mem.mlynarStacks = 0; u.mem.mlynarKilled = false; u.mem.mlynarCapturedPct = 0;
  const t1 = def.talents.find(t => t.bb.atk_scale_base != null)?.bb;
  const t2 = def.talents.find(t => t.bb.taunt_level != null)?.bb;
  u.mem.mlynarScale = t1?.atk_scale_base ?? 1;
  if (t2) b.addBuff(u, { key: 'mlynar:taunt', source: u, persist: true,
    allowDead: true, mods: { taunt: t2.taunt_level } });
  b.on('deploy', ({ unit }) => {
    if (unit !== u) return;
    // Native permanent abilities attach on owner birth. In particular, the
    // idle Block0 must be installed after _deploy makes the unit alive.
    b.addBuff(u, { key: 'mlynar:idle-block', source: u, mods: { blockCntMul: 0 } });
    b.every(1, () => {
      if (!live(u) || u.skill.active) return;
      u.mem.mlynarStacks = Math.min(def.traitBb.max_stack_cnt, u.mem.mlynarStacks + 1);
      setRamp(b, u, def.traitBb.atk * u.mem.mlynarStacks / def.traitBb.max_stack_cnt);
    }, { owner: u });
    // The first high-count poll is .05 after birth, not an immediate poll.
    if (t1) b.after(.05, () => {
      syncTalent(b, u, t1); b.every(.2, () => syncTalent(b, u, t1), { owner: u });
    }, { owner: u });
    if (t2) {
      syncReflect(b, u, t2);
      b.every(.2, () => syncReflect(b, u, t2), { owner: u });
    }
  }, { owner: u });
  const lethalAbility = new WeakMap();
  b.on('damaged', ({ source, target, dmg }) => {
    // The shared kill event intentionally has no DamageInfo. Only the exact
    // lethal main-ability receipt establishes these source ability-name gates.
    if (source !== u || !u.skill.active || target.side !== 'enemy'
      || (target.bossPool ? target.bossPool.hp : target.hp) > 0) return;
    if (second(u) && dmg.tags.includes('mlynar:s2')) lethalAbility.set(target, 2);
    if (third(u) && dmg.tags.includes('mlynar:s3')) lethalAbility.set(target, 3);
  }, { owner: u });
  b.on('kill', ({ killer, victim }) => {
    const ability = lethalAbility.get(victim);
    lethalAbility.delete(victim);
    if (killer !== u || !u.skill.active) return;
    if (ability === 2 && second(u)) u.mem.mlynarKilled = true;
    if (ability === 3 && third(u)) u.mem.mlynarKillsThisFamily++;
  }, { owner: u });
  b.on('hit', ({ source, target, dmg }) => {
    if (!live(u) || isHpLoss(dmg) || dmg.type === 'element') return;
    if (source === u && dmg.isAttack && !dmg.tags.includes('mlynar:inverse'))
      dmg.amount *= u.mem.mlynarScale;
    if (t2 && source?.side === 'enemy' && source.alive
      && target.findBuff(`mlynar:inverse:${u.id}`))
      b.dealDamage(u, source, { amount: u.s.atk * t2.atk_scale,
        type: 'true', applyWay: 'none', canDodge: false, tags: ['mlynar:inverse'] });
    // InverseDamage explicitly emits native NORMAL while skipSourceEvent
    // prevents Wanderer/source attack callbacks. It still reaches the enemy's
    // target-side NORMAL aura; its ADDITION rider never recursively qualifies.
    if (third(u) && target.side === 'enemy' && source?.tags.has('kazimierz')
      && (dmg.isAttack || dmg.tags.includes('mlynar:inverse')) && bodyInKeys(target, u.rangeKeySet)
      && canTargetEnemy(u, target, { canHitFly: true }))
      b.dealDamage(u, target, { amount: u.s.atk * u.skill.bb.atk_scale,
        type: 'true', applyWay: 'none', canDodge: false, isSkill: true, tags: ['mlynar:rider'] });
  }, { owner: u });
  const clear = () => { for (const a of b.allyUnits) b.removeBuff(a, `mlynar:inverse:${u.id}`); };
  b.on('retreat', ({ unit }) => { if (unit === u) clear(); }, { owner: u });
  b.on('death', ({ unit }) => { if (unit === u) clear(); }, { owner: u });
}
