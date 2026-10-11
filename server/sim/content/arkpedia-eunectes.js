// SPDX-License-Identifier: GPL-3.0-or-later
// Original graphs and explicit transformation dispatch bounds are retained in
// data/arkpedia-eunectes-prefabs.json. No native frame-parity claim is made.
import evidence from '../../../data/arkpedia-eunectes-prefabs.json' with { type: 'json' };
import { isHpLoss } from '../damage.js';

const ID = 'char_416_zumama', SECOND = 'skchr_zumama_2', THIRD = 'skchr_zumama_3';
const live = u => u?.alive && u.deployed && !u.hidden;
const third = u => u.skill?.active && u.skill.id === THIRD;
const model = u => evidence.models[ID][third(u) || u.dir !== 'UP' ? 'Front' : 'Back'];
const rate = u => u.s.aspd / 100;
const blocked = u => u.blocking.filter(e => live(e) && e.blockedBy === u);
const stunKey = u => `eunectes:blocked:${u.id}`;

function syncBlock(b, u) {
  if (!live(u)) return;
  const holding = blocked(u).length > 0;
  if (holding) b.removeBuff(u, 'eunectes:sp-stopped');
  else if (!u.findBuff('eunectes:sp-stopped'))
    b.addBuff(u, { key: 'eunectes:sp-stopped', flags: { noSp: true } });
  const victims = u.skill.active && u.skill.id === SECOND ? blocked(u) : [];
  const owned = u.mem.eunectesStuns ??= new Map();
  for (const [e, mark] of owned) if (!victims.includes(e) || e.findBuff(stunKey(u)) !== mark) {
    b.removeBuff(e, mark); owned.delete(e);
  }
  for (const e of victims) if (!owned.has(e)
    && b.applyStatus(e, 'stun', { key: stunKey(u), source: u, duration: Infinity }))
    owned.set(e, e.findBuff(stunKey(u)));
}
function clearStuns(b, u) {
  for (const [e, mark] of u.mem.eunectesStuns ?? []) b.removeBuff(e, mark);
  u.mem.eunectesStuns?.clear();
}
function syncBravery(b, u, bb) {
  if (!live(u) || !bb) return;
  if (u.hp / u.s.maxHp <= bb.hp_ratio) {
    u.mem.eunectesScale = 1;
    if (!u.findBuff('eunectes:sanctuary'))
      b.applyStatus(u, 'sanctuary', { key: 'eunectes:sanctuary', source: u,
        duration: Infinity, value: bb.damage_resistance });
  } else {
    u.mem.eunectesScale = bb.atk_scale;
    b.removeBuff(u, 'eunectes:sanctuary');
  }
}
function windup(_b, u) {
  const clip = third(u) ? (u.dir === 'DOWN' ? 'Skill_2_Loop_Down' : 'Skill_2_Loop')
    : u.skill.active && u.skill.id === SECOND ? 'Skill'
    : u.dir === 'DOWN' ? 'Attack_Down' : 'Attack';
  u.mem.eunectesAttackClip = clip;
  return model(u).hits[clip][0] / rate(u);
}
function beginThird(b, u) {
  const state = { seq: u.deploySeq, activation: u.skill.activations };
  u.mem.eunectesTransform = state;
  // The source forces the Front skeleton and gives the stat buff in Hensin,
  // before the sequential SwitchMode ability. Its Begin has no attack event.
  // Local continuation uses the actual clip end; this is a documented bound.
  const duration = evidence.models[ID].Front.durations.Skill_2_Begin;
  b.addBuff(u, { key: 'eunectes:transform', flags: { disarm: true } });
  u.mem.regularFormVisual = { clip: 'Skill_2_Begin', loop: false, speed: 1, forceFront: true };
  u.skill.timeLeft = u.def.skill.duration + duration;
  u.atkCd = 0;
  b.after(duration, () => {
    if (!live(u) || !third(u) || u.mem.eunectesTransform !== state
      || u.deploySeq !== state.seq || u.skill.activations !== state.activation) return;
    u.mem.eunectesTransform = null; b.removeBuff(u, 'eunectes:transform');
    u.mem.regularFormVisual = { clip: 'Skill_2_Idle', attack: 'Skill_2_Loop',
      die: 'Skill_2_Die', loop: true, forceFront: true };
  }, { owner: u });
}
function endThird(b, u, reason) {
  u.mem.eunectesTransform = null; b.removeBuff(u, 'eunectes:transform');
  if (!live(u) || ['death', 'retreat'].includes(reason)) {
    u.mem.regularFormVisual = null; return;
  }
  b.applyStatus(u, 'stun', { key: 'eunectes:exhausted', source: u,
    duration: u.def.skill.bb.stun });
  const seq = u.deploySeq, activation = u.skill.activations;
  u.mem.regularFormVisual = { clip: 'Skill_2_End', loop: false, speed: 1, forceFront: true };
  b.after(evidence.models[ID].Front.durations.Skill_2_End, () => {
    if (live(u) && u.deploySeq === seq && u.skill.activations === activation)
      u.mem.regularFormVisual = null;
  }, { owner: u });
  syncBlock(b, u);
}

export function customizeEunectesKit({ battle: b, id, def, unit: u, kit }) {
  if (id !== ID) return;
  kit.install = null; kit.talents = [];
  kit.trait = { attack: 'melee', projectile: 'none', dmgType: 'phys',
    applyWay: 'melee', canHitFly: false, groundOnly: true, hits: 1, hitsFn: null,
    maxTargets: 1, hitAllBlocked: false, maxTargetsByBlock: false,
    splashRadius: 0, chain: null, dmgMul: null, interruptOnSkillChange: true,
    attackDrivenSkill: true, windup, attackVisual: () => u.mem.eunectesAttackClip,
    canAttack: () => !u.mem.eunectesTransform };
  const s = def.skill, bb = s.bb;
  if (s.id === SECOND) kit.skill = { kind: 'duration',
    mods: { atkPct: bb.atk, batFlat: bb.base_attack_time },
    attack: { maxTargetsByBlock: true, retargetOnRelease: true },
    onStart: () => syncBlock(b, u), onTick: () => syncBlock(b, u),
    onEnd: () => clearStuns(b, u) };
  else if (s.id === THIRD) kit.skill = { kind: 'duration',
    mods: { atkPct: bb.atk, defPct: bb.def, blockCnt: bb.block_cnt,
      hpRegenRatio: bb.hp_recovery_per_sec_by_max_hp_ratio },
    attack: { maxTargetsByBlock: true, retargetOnRelease: true },
    onStart: () => beginThird(b, u), onEnd: ({ reason }) => endThird(b, u, reason) };
  else kit.skill = { kind: 'passive', mods: { atkPct: bb.atk, defPct: bb.def } };
  kit.skill.id = s.id; kit.skill.name = s.name;
}

export function installEunectes({ battle: b, unit: u, def }) {
  if (def.charId !== ID) return;
  const bravery = def.talents.find(t => t.bb.hp_ratio != null)?.bb;
  const resilience = def.talents.find(t => t.bb.sp_recovery_per_sec != null)?.bb;
  // Resilience is an attribute buff. The trait's no-SP gate restricts gifts
  // and natural recovery alike, instead of removing only time-based recovery.
  b.on('deploy', ({ unit }) => {
    if (unit !== u) return;
    if (resilience) b.addBuff(u, { key: 'eunectes:resilience',
      mods: { spRecoveryFlat: resilience.sp_recovery_per_sec } });
    syncBlock(b, u);
  }, { owner: u });
  b.on('blocked', ({ blocker }) => { if (blocker === u) syncBlock(b, u); }, { owner: u });
  b.on('spGain', ctx => {
    if (ctx.unit !== u || ctx.reason === 'init') return;
    if (!blocked(u).length) ctx.amount = 0;
  }, { owner: u });
  b.on('beforeStatus', ctx => {
    if (ctx.target === u && u.mem.eunectesTransform
      && ['stun', 'freeze', 'silence'].includes(ctx.status)) ctx.cancel = true;
  }, { owner: u });
  b.on('hit', ctx => {
    if (ctx.source === u && !isHpLoss(ctx.dmg) && ctx.dmg.type !== 'element')
      ctx.dmg.amount *= u.mem.eunectesScale ?? 1;
  }, { owner: u });
  // Source Peerless Bravery samples at .1s, rather than changing on each hit.
  b.every(.1, () => syncBravery(b, u, bravery), { owner: u });
  b.on('tick', () => syncBlock(b, u), { owner: u });
  b.on('death', ({ unit }) => {
    if (unit !== u) return;
    clearStuns(b, u); u.mem.eunectesTransform = null; u.mem.regularFormVisual = null;
  }, { owner: u });
  syncBlock(b, u);
}
