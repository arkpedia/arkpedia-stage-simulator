// SPDX-License-Identifier: GPL-3.0-or-later
import evidence from '../../../data/arkpedia-lessing-prefabs.json' with { type: 'json' };
import { resolveHit } from '../ai.js';
import { canTargetEnemy, sortEnemyTargets } from '../targeting.js';

const ID = 'char_4011_lessng';
const live = u => u?.alive && u.deployed && !u.hidden;
const model = u => evidence.models[ID][u.dir === 'UP' ? 'Back' : 'Front'];
const rate = u => Math.min(1, u.base.bat / u.s.interval);
const mode = u => u.skill?.active ? u.skill.id.at(-1) : '0';
const antiFlags = buff => !!(buff.flags?.stun || buff.flags?.cold || buff.flags?.freeze);
// AUTO uses the recovered native mask, not this engine's broader Resist list.
export const lessingResistableBuff = buff => buff.sourceStatusResistable === true
  || (buff.sourceStatusResistable !== false && (antiFlags(buff) || buff.status === 'fear'));
const blocked = e => !!e.blockedBy?.alive && e.blockedBy.deployed;
function clip(u) { return mode(u) === '2' ? 'Skill_2_Loop' : mode(u) === '3' ? 'Skill_3_Loop' : 'Attack'; }
function choose(b, u, p) {
  const targets = b.enemiesInKeys(u.rangeKeys, u, p);
  for (const e of u.blocking) if (!targets.includes(e) && canTargetEnemy(u, e, p)) targets.push(e);
  sortEnemyTargets(b, u, targets);
  const input = u.mem.lessingInput?.[0];
  // Native alwaysIncludeTarget1 retains a legal original input at CAST.
  if (targets.includes(input)) return [input];
  return targets.slice(0, 1);
}
function emitHit(b, u, p, e, info) {
  if (!canTargetEnemy(u, e, p)) return;
  const scale = mode(u) === '3' && blocked(e) ? u.skill.bb['lessng_s3[atk_scale].atk_scale'] : 1;
  resolveHit(b, u, { ...p, atkScale: (p.atkScale ?? 1) * scale }, e, info, e.x, e.y);
  u.mem.lessingEmitted = info.attackId;
}
function launch(b, u, p, e, info) {
  emitHit(b, u, p, e, info);
  if (mode(u) !== '2') return;
  const seq = u.deploySeq, epoch = u.attackControlEpoch, cast = u.skill.activations;
  const delay = (model(u).hits.Skill_2_Loop[1] - model(u).hits.Skill_2_Loop[0]) / rate(u);
  b.after(delay, () => {
    if (live(u) && u.deploySeq === seq && u.attackControlEpoch === epoch
      && u.skill.activations === cast && mode(u) === '2' && u.canAct && !u.s.flags.disarm)
      emitHit(b, u, p, e, info);
  }, { owner: u });
}
function visual(b, u, name, idle) {
  const seq = u.deploySeq, token = {};
  u.mem.lessingVisual = token; u.mem.regularFormVisual = { clip: name, loop: false };
  b.after(model(u).durations[name], () => {
    if (live(u) && u.deploySeq === seq && u.mem.lessingVisual === token)
      u.mem.regularFormVisual = idle ? { clip: idle, loop: true } : null;
  }, { owner: u });
}
function end(b, u, third) {
  u.mem.lessingAnti = false;
  b.removeBuff(u, 'lessing:max-hp'); void u.s;
  if (live(u)) visual(b, u, third ? 'Skill_3_End' : 'Skill_2_End', null);
  else { u.mem.lessingVisual = null; u.mem.regularFormVisual = null; }
}
function thirdStart(b, u) {
  const penalized = u.buffs.some(buff => antiFlags(buff) || lessingResistableBuff(buff));
  // Native node order: conditional fixed Arts → cleanse → derived anti → MAX_HP.
  if (penalized) b.dealDamage(u, u, { amount: u.skill.bb.magical_value, type: 'arts',
    isAttack: true, isSkill: true, noSp: true, applyWay: 'none', tags: ['lessing:self-hit'] });
  if (!live(u)) return;
  for (const buff of u.buffs.slice()) if (antiFlags(buff) || lessingResistableBuff(buff)) b.removeBuff(u, buff.key);
  u.mem.lessingAnti = true;
  b.addBuff(u, { key: 'lessing:max-hp', source: u, mods: { hpPct: u.skill.bb.max_hp } }); void u.s;
  visual(b, u, 'Skill_3_Begin', 'Skill_3_Idle');
}
export function customizeLessingKit({ battle: b, id, def, unit: u, kit }) {
  if (id !== ID) return;
  kit.install = null;
  kit.trait = { attack: 'melee', dmgType: 'phys', applyWay: 'melee', projectile: 'none',
    canHitFly: false, maxTargets: 1, hits: 1, hitsFn: null, maxTargetsByBlock: false,
    hitAllBlocked: false, allInRange: false, rangeAoe: false, chain: null, splashRadius: 0,
    dmgMul: null, install: null, retargetOnRelease: true, interruptOnSkillChange: true,
    launchAttack: launch, acquireTargets: choose, attackVisual: (_b, a) => clip(a),
    afterAttack: (_b, a) => { a.mem.lessingInput = null; },
    windup: (_b, a, targets) => { a.mem.lessingInput = targets;
      return model(a).hits[clip(a)][0] / rate(a); } };
  const s = def.skill;
  if (s.id.endsWith('_1')) kit.skill = { kind: 'instant', attack: { atkScale: s.bb.atk_scale,
    afterAttack: (_b, a, _targets, ctx) => {
      if (a.mem.lessingEmitted !== ctx.attackId && ctx.inputTargets.length
        && ctx.inputTargets.every(e => !e.alive)) a.skill.addCharge(1);
      a.mem.lessingInput = null;
    } } };
  else if (s.id.endsWith('_2')) kit.skill = { kind: 'duration', trigger: 'NEVER', duration: s.duration,
    hideInactiveHud: true,
    mods: { atkPct: s.bb.atk }, onStart: () => visual(b, u, 'Start_2', 'Skill_2_Idle'),
    onEnd: () => end(b, u, false) };
  else kit.skill = { kind: 'duration', duration: s.duration, allowAbnormalCast: true,
    canActivate: () => live(u) && !u.s.flags.silence,
    onStart: () => thirdStart(b, u), onEnd: () => end(b, u, true) };
  kit.skill.id = s.id; kit.skill.name = s.name;
}
export function installLessing({ battle: b, unit: u, def }) {
  if (def.charId !== ID) return;
  const t1 = def.talents.find(t => t.bb.damage_resistance != null)?.bb;
  const t2 = def.talents.find(t => t.bb.add_atk_duration != null)?.bb;
  b.on('beforeStatus', ctx => {
    if (ctx.target === u && live(u) && u.mem.lessingAnti && ctx.sourceStatusResistable === true)
      ctx.cancel = true;
  }, { owner: u });
  b.on('beforeBuff', ctx => {
    if (ctx.unit === u && live(u) && u.mem.lessingAnti
      && (antiFlags(ctx.buff) || lessingResistableBuff(ctx.buff))) ctx.cancel = true;
  }, { owner: u });
  b.on('hit', ctx => {
    if (ctx.target !== u || !live(u) || !t1 || ctx.dmg.cancel
      || !['phys', 'arts'].includes(ctx.dmg.type) || !u.blocking.some(blocked)
      || ctx.source?.blockedBy === u) return;
    const reduction = t1.damage_resistance * (mode(u) === '2' ? u.skill.bb.talent_scale : 1);
    ctx.dmg.mul *= Math.max(0, 1 - reduction);
  }, { owner: u });
  b.on('damaged', ctx => {
    if (ctx.target === u && live(u) && t2 && !ctx.dmg.tags?.includes('hpLoss'))
      b.addBuff(u, { key: 'lessing:talent-atk', source: u, duration: t2.add_atk_duration,
        refresh: 'extend', mods: { atkPct: t2.atk } });
  }, { owner: u });
  b.on('deploy', ({ unit }) => { if (unit === u) {
    u.mem.lessingAnti = false; u.mem.lessingEmitted = null;
    if (def.skill.id.endsWith('_2')) u.skill.activate('deploy', { free: true });
  } }, { owner: u });
  for (const event of ['death', 'retreat']) b.on(event, ({ unit }) => { if (unit === u) {
    u.mem.lessingAnti = false; u.mem.lessingVisual = null; u.mem.regularFormVisual = null;
    b.removeBuff(u, 'lessing:max-hp'); b.removeBuff(u, 'lessing:talent-atk');
  } }, { owner: u });
}
