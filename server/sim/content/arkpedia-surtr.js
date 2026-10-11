// SPDX-License-Identifier: GPL-3.0-or-later
import { SURTR_OPERATORS } from '../../../shared/arkpedia/surtr-operators.js';
import evidence from '../../../data/arkpedia-surtr-prefabs.json' with { type: 'json' };
import { resolveHit } from '../ai.js';
import { applyHpLoss, makeDamageInfo } from '../damage.js';
import { canTargetEnemy, sortEnemyTargets } from '../targeting.js';

const ID = 'char_350_surtr';
const present = u => u?.alive && u.deployed;
const live = u => present(u) && !u.hidden;
const mode = u => u.skill?.active && !u.skill.pending ? u.skill.id : '';
const model = u => evidence.models[ID][['UP', 'LEFT'].includes(u.dir) ? 'Back' : 'Front'];
const rate = (u, cap = Infinity) => Math.min(cap, u.base.bat / u.s.interval);
const clean = p => ({ ...p, hits: 1, hitsFn: null, chain: null, splashRadius: 0, dmgMul: null,
  atkScale: p.atkScale ?? 1, attack: 'melee', applyWay: 'melee', projectile: 'none', dmgType: 'arts' });
function choose(b, u, p) {
  const list = b.enemiesInKeys(u.rangeKeys, u, p);
  for (const e of u.blocking) if (!list.includes(e) && canTargetEnemy(u, e, p)) list.push(e);
  sortEnemyTargets(b, u, list);
  const cap = Math.max(1, p.maxTargets ?? 1);
  if (u.mem.surtrReleaseSelection) {
    // Native SELF/timing0/alwaysIncludeTarget1 is bounded to release-time
    // membership while retaining the original first input if still legal.
    const first = u.mem.surtrInput?.[0];
    if (list.includes(first)) { list.splice(list.indexOf(first), 1); list.unshift(first); }
    u.mem.surtrReleaseSelection = false;
  }
  const targets = list.slice(0, cap);
  u.mem.surtrCastCount = targets.length;
  return targets;
}
function windup(b, u, targets) {
  const third = mode(u) === 'skchr_surtr_3', second = mode(u) === 'skchr_surtr_2';
  u.mem.surtrInput = targets;
  u.mem.surtrCastCount = targets.length;
  u.mem.surtrReleaseSelection = second || third;
  u.mem.surtrClip = third ? 'Skill_3_Loop' : second
    ? u.dir === 'DOWN' ? 'Skill_2_Down' : 'Skill_2' : 'Attack';
  // The official chararts alias Skill_3_Attack→Skill_3_Loop has speed1.3.
  const playback = rate(u, third ? 1 : Infinity) * (third ? 1.3 : 1);
  return model(u).hits[u.mem.surtrClip][0] / playback;
}
function launch(b, u, p, target, info) {
  if (!canTargetEnemy(u, target, p)) return;
  const s1 = info.isSkill && u.skill.id === 'skchr_surtr_1';
  const solo = mode(u) === 'skchr_surtr_2' && u.mem.surtrCastCount === 1;
  let killHook;
  if (s1) killHook = b.on('kill', ({ killer, victim }) => {
    if (killer === u && victim === target) u.skill.gainSp(u.skill.spCost, 'init', true);
  });
  try {
    resolveHit(b, u, { ...clean(p), atkScale: (p.atkScale ?? 1) * (solo
      ? u.skill.bb['attack@surtr_s_2[critical].atk_scale'] : 1) }, target, info, target.x, target.y);
    u.mem.surtrEmitted = info.attackId;
  } finally { if (killHook) b.off(killHook); }
}
function thirdStart(b, u) {
  const token = {}, seq = u.deploySeq;
  u.mem.surtrThird = token;
  const start = b.time, bb = u.skill.bb;
  b._refreshRange(u);
  // Original eventless buff starts the mode/MaxHP effect before its heal.
  b.heal(u, u, u.s.maxHp, { self: true, ignoreHealFree: true });
  u.mem.regularFormVisual = { clip: 'Skill_3_Begin', loop: false };
  b.addBuff(u, { key: 'surtr:begin', source: u, duration: model(u).durations.Skill_3_Begin,
    flags: { disarm: true } });
  b.after(model(u).durations.Skill_3_Begin, () => {
    if (present(u) && u.deploySeq === seq && u.mem.surtrThird === token)
      u.mem.regularFormVisual = { clip: 'Skill_3_Idle', loop: true };
  }, { owner: u });
  u.mem.surtrBleed = b.every(bb.interval, () => {
    if (!present(u) || u.deploySeq !== seq || u.mem.surtrThird !== token) return;
    const fractionPerSecond = bb.hp_ratio * Math.min(1, Math.max(0, b.time - start) / bb.duration);
    // Native PURE/NORMAL skipModifierEvent, not HPLOSS. This bypasses damage
    // shields/dodge/reduction, while the common UNDEADABLE floor still applies.
    applyHpLoss(b, u, u, u.s.maxHp * fractionPerSecond * bb.interval,
      makeDamageInfo({ type: 'true', isAttack: true, isSkill: true, noSp: true,
        tags: ['surtr:bleed'], origin: { kind: 'surtr-bleeding' } }));
  }, { owner: u });
}
function thirdEnd(b, u) {
  u.mem.surtrThird = null;
  u.mem.surtrBleed?.cancel(); u.mem.surtrBleed = null;
  u.mem.regularFormVisual = null;
  b.removeBuff(u, 'surtr:begin');
}
export function customizeSurtrKit({ battle: b, id, def, unit: u, kit }) {
  if (!SURTR_OPERATORS[id]) return;
  kit.install = null;
  kit.trait = { attack: 'melee', applyWay: 'melee', projectile: 'none', dmgType: 'arts',
    hits: 1, hitsFn: null, chain: null, splashRadius: 0, dmgMul: null, maxTargets: 1,
    allInRange: false, rangeAoe: false, hitAllBlocked: false, canHitFly: false,
    install: null, interruptOnSkillChange: true, launchAttack: launch, windup,
    attackVisual: (_b, unit) => unit.mem.surtrClip };
  const s = def.skill, bb = s.bb;
  if (s.id === 'skchr_surtr_1') kit.skill = { kind: 'instant', attack: { atkScale: bb.atk_scale,
    afterAttack: (_battle, unit, targets, context) => {
      if (unit.mem.surtrEmitted !== context.attackId && context.inputTargets.length
        && context.inputTargets.every(e => !e.alive)) unit.skill.addCharge(1);
    } } };
  else if (s.id === 'skchr_surtr_2') kit.skill = { kind: 'duration', duration: s.duration,
    mods: { atkPct: bb.atk, rangeExtend: bb.ability_range_forward_extend },
    targeting: { maxTargets: bb['attack@max_target'] }, attack: { retargetOnRelease: true,
      acquireTargets: choose }, onStart: () => b._refreshRange(u) };
  else kit.skill = { kind: 'toggle', mods: { atkPct: bb.atk, hpFlat: bb.max_hp,
      rangeExtend: bb.ability_range_forward_extend },
    targeting: { maxTargets: bb['attack@max_target'] },
    attack: { retargetOnRelease: true, acquireTargets: choose },
    onStart: () => thirdStart(b, u), onEnd: () => thirdEnd(b, u) };
  kit.skill.id = s.id; kit.skill.name = s.name;
}
export function installSurtr({ battle: b, unit: u, def }) {
  if (!SURTR_OPERATORS[def.charId]) return;
  const res = def.talents.find(t => t.bb.magic_resist_penetrate_fixed != null)?.bb;
  const fatal = def.talents.find(t => t.bb['surtr_t_2[withdraw].interval'] != null)?.bb;
  if (res) b.addBuff(u, { key: 'surtr:res-ignore', source: u, persist: true, allowDead: true,
    mods: { resIgnoreFlat: res.magic_resist_penetrate_fixed } });
  u.mem.surtrFatalUsed = false;
  b.on('fatal', ctx => {
    if (ctx.unit !== u || !fatal || !present(u) || ctx.prevented || u.mem.surtrFatalUsed) return;
    u.mem.surtrFatalUsed = true;
    ctx.prevented = true;
    u.hp = Math.min(1, u.s.maxHp);
    b.addBuff(u, { key: 'surtr:remnant', source: u,
      flags: { undeadable: true, healFree: true, noHeal: true } });
    const seq = u.deploySeq;
    const delay = fatal['surtr_t_2[withdraw].interval'];
    b.after(delay, () => { if (present(u) && u.deploySeq === seq && u.mem.surtrFatalUsed)
      b.kill(u); }, { owner: u });
  }, { owner: u });
  b.on('deploy', ({ unit }) => { if (unit === u) {
    u.mem.surtrFatalUsed = false; u.mem.surtrEmitted = null; u.mem.surtrReleaseSelection = false;
  } }, { owner: u });
  const clear = ({ unit }) => { if (unit === u) {
    thirdEnd(b, u); u.mem.surtrReleaseSelection = false;
  } };
  b.on('death', clear, { owner: u }); b.on('retreat', clear, { owner: u });
}
