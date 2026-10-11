// SPDX-License-Identifier: GPL-3.0-or-later
import evidence from '../../../data/arkpedia-penance-prefabs.json' with { type: 'json' };
import { resolveHit } from '../ai.js';
import { canTargetEnemy, sortEnemyTargets, absoluteRangeKeys } from '../targeting.js';
const ID = 'char_4065_judge';
const live = u => u?.alive && u.deployed && !u.hidden;
const first = u => u.skill.id.endsWith('_1');
const second = u => u.skill.active && u.skill.id.endsWith('_2');
const third = u => u.skill.active && u.skill.id.endsWith('_3');
const charged = u => first(u) && (u.mem.penanceCharged || !u.skill.pending && u.skill.charges >= 2);
const model = u => evidence.models[ID][u.dir === 'UP' ? 'Back' : 'Front'];
const rate = u => Math.min(1, u.base.bat / u.s.interval);
const clip = u => charged(u) ? 'Skill_1_Attack' : third(u) ? 'Skill_3_Attack' : 'Attack';
const shieldKey = 'penance:barrier';
function gainBarrier(b, u, ratio) {
  const t = u.def.talents.find(t => t.bb.max_hp_ratio != null)?.bb;
  if (!live(u) || !t || !(ratio > 0)) return;
  const old = u.findBuff(shieldKey), current = old?.shield ?? 0, cap = u.s.maxHp * t.max_hp_ratio;
  // Source dynamic pool is never re-scaled or trimmed by an external maxHP
  // change. Gains re-read the cap, and do nothing if already at/above it.
  if (current >= cap) return;
  const value = Math.min(cap, current + u.s.maxHp * ratio * (second(u) ? 1 + u.skill.bb.shield_scale : 1));
  if (old) { old.shield = value; u.markDirty(); }
  else b.addBuff(u, { key: shieldKey, source: u, shield: value, visible: true });
}
function form(b, u, start, idle, front = false) {
  const token = {}, seq = u.deploySeq;
  u.mem.penanceVisual = token;
  u.mem.regularFormVisual = { clip: start, loop: false, ...(front ? { forceFront: true } : {}) };
  b.after(evidence.models[ID][front ? 'Front' : u.dir === 'UP' ? 'Back' : 'Front'].durations[start], () => {
    if (live(u) && u.deploySeq === seq && u.mem.penanceVisual === token)
      u.mem.regularFormVisual = idle ? { clip: idle, loop: true, ...(front ? { forceFront: true } : {}) } : null;
  }, { owner: u });
}
function s2Start(b, u) {
  const seq = u.deploySeq, cast = u.skill.activations;
  b.applyStatus(u, 'sanctuary', { source: u, key: 'penance:s2', value: u.skill.bb.damage_resistance,
    duration: u.skill.duration });
  form(b, u, 'Skill_2_Begin', 'Skill_2_Loop', true);
  const pulse = () => {
    if (!live(u) || u.deploySeq !== seq || u.skill.activations !== cast || !second(u)) return;
    const keys = absoluteRangeKeys(evidence.tables.ranges['x-4'].grids.map(p => [p.row, p.col]), u.tileR, u.tileC, u.dir);
    for (const e of b.enemiesInKeys(keys, u, { canHitFly: false }))
      b.dealDamage(u, e, { amount: u.s.atk * u.skill.bb.atk_scale, type: 'arts',
        isAttack: true, isSkill: true, isSplash: true, applyWay: 'none', tags: ['penance:s2'] });
    b.after(1, pulse, { owner: u });
  };
  b.after(.8999999761581421, pulse, { owner: u });
}
function select(b, u, p) {
  const targets = b.enemiesInKeys(u.rangeKeys, u, p);
  for (const e of u.blocking) if (!targets.includes(e) && canTargetEnemy(u, e, p)) targets.push(e);
  sortEnemyTargets(b, u, targets);
  const input = u.mem.penanceInput?.[0];
  return targets.includes(input) ? [input] : targets.slice(0, 1);
}
function launch(b, u, p, e, info) {
  if (!canTargetEnemy(u, e, p)) return;
  u.mem.penanceEmitted = info.attackId;
  if (info.isSkill && first(u)) {
    // Native active buff first: Stun and separate Arts rider. It suppresses
    // source calculate-damage dispatch, so charged multiplier is not copied.
    if (u.mem.penanceCharged) b.applyStatus(e, 'stun', { source: u, duration: u.skill.bb.stun });
    b.dealDamage(u, e, { amount: u.s.atk * u.skill.bb.atk_scale_2, type: 'arts',
      isAttack: true, isSkill: true, applyWay: 'none', attackId: info.attackId, tags: ['penance:s1-extra'] });
  }
  if (e.alive) resolveHit(b, u, { ...p, atkScale: u.mem.penanceCharged
    ? (p.atkScale ?? 1) * u.skill.bb['judge_s_1_enhance_checker.atk_scale'] : p.atkScale }, e, info, e.x, e.y);
}
export function customizePenanceKit({ battle: b, id, def, unit: u, kit }) {
  if (id !== ID) return;
  kit.install = null;
  kit.trait = { attack: 'melee', dmgType: 'phys', applyWay: 'melee', projectile: 'none',
    noHeal: true, selfHeal: null, canHitFly: false, maxTargets: 1, hits: 1, hitsFn: null,
    maxTargetsByBlock: false, hitAllBlocked: false, allInRange: false, rangeAoe: false,
    dmgMul: null, chain: null, splashRadius: 0, install: null,
    retargetOnRelease: true, interruptOnSkillChange: true, acquireTargets: select, launchAttack: launch,
    windup: (_b, a, targets) => { a.mem.penanceInput = targets; return model(a).hits[clip(a)][0] / rate(a); },
    attackVisual: (_b, a) => clip(a), afterAttack: (_b, a) => { a.mem.penanceInput = null; } };
  const s = def.skill;
  if (s.id.endsWith('_1')) kit.skill = { kind: 'instant', attack: {
    afterAttack: (_b, a, _targets, ctx) => {
      if (a.mem.penanceEmitted !== ctx.attackId && ctx.inputTargets.length
        && ctx.inputTargets.every(e => !e.alive)) a.skill.addCharge(1);
      a.mem.penanceInput = null;
    },
  },
    onStart: () => {
      u.mem.penanceCharged = u.skill.charges >= 1;
      u.skill.charges = 0; u.skill.sp = 0;
      b.addBuff(u, { key: 'penance:s1-lock', flags: { noSp: true } });
    },
    onEnd: () => { u.mem.penanceCharged = false; b.removeBuff(u, 'penance:s1-lock'); },
  };
  else if (s.id.endsWith('_2')) kit.skill = { kind: 'duration', trigger: 'NEVER',
    flags: { disarm: true }, onStart: () => s2Start(b, u),
    onEnd: () => { b.removeBuff(u, 'penance:s2');
      if (live(u)) form(b, u, 'Skill_2_End', null, true); },
  };
  else kit.skill = { kind: 'duration', trigger: 'NEVER', attack: {}, mods: { atkPct: s.bb.atk,
    batFlat: s.bb.base_attack_time, taunt: s.bb.taunt_level },
    onStart: () => { gainBarrier(b, u, s.bb.hp_ratio); form(b, u, 'Skill_3_Begin', 'Skill_3_Idle'); },
    onEnd: () => { if (live(u)) form(b, u, 'Skill_3_End', null); },
  };
  kit.skill.id = s.id; kit.skill.name = s.name;
}
export function installPenance({ battle: b, unit: u, def }) {
  if (def.charId !== ID) return;
  const t = def.talents.find(t => t.bb.max_hp_ratio != null)?.bb;
  const reflect = def.talents.find(t => t.bb.atk_scale != null)?.bb.atk_scale;
  b.on('deploy', ({ unit }) => { if (unit === u) {
    u.mem.penanceCharged = false; u.mem.penanceInput = null;
    gainBarrier(b, u, t.born_hp_ratio);
  } }, { owner: u });
  b.on('kill', ({ killer, victim }) => { if (killer === u && victim.side === 'enemy') gainBarrier(b, u, t.kill_hp_ratio); }, { owner: u });
  b.on('damaged', ctx => {
    if (ctx.target !== u || !live(u) || !reflect || ctx.source?.side !== 'enemy'
      || !live(ctx.source) || !(u.findBuff(shieldKey)?.shield > 0)
      || ctx.dmg.type === 'element' || ctx.dmg.tags?.includes('hpLoss')) return;
    b.dealDamage(u, ctx.source, { amount: u.s.atk * reflect * (u.mem.penanceCharged
      ? u.skill.bb['judge_s_1_enhance_checker.atk_scale'] : 1), type: 'arts',
      isAttack: true, applyWay: 'none', tags: ['reflect', 'penance:reflect'] });
  }, { owner: u });
  b.on('tick', () => {
    if (!live(u) || !first(u)) return;
    if (u.skill.pending && (!u.canAct || u.s.flags.disarm)) u.skill.end('interrupted');
    if (u.skill.pending) return;
    if (u.skill.charges >= 2 && !u.mem.penanceChargePose) {
      u.mem.penanceChargePose = true; form(b, u, 'Skill_1_Begin', 'Skill_1_Idle');
    } else if (u.skill.charges < 2 && u.mem.penanceChargePose) {
      u.mem.penanceChargePose = false; u.mem.penanceVisual = null; u.mem.regularFormVisual = null;
    }
  }, { owner: u });
  for (const event of ['retreat', 'death']) b.on(event, ({ unit }) => { if (unit === u) {
    u.mem.penanceCharged = false; u.mem.penanceChargePose = false; u.mem.penanceVisual = null;
    u.mem.regularFormVisual = null; b.removeBuff(u, shieldKey); b.removeBuff(u, 'penance:s1-lock');
    b.removeBuff(u, 'penance:s2');
  } }, { owner: u });
}
