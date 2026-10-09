// SPDX-License-Identifier: GPL-3.0-or-later
// Native graphs, all ranks, talent candidates and original clips are retained
// in the evidence file. Fixed-block overflow, aura blast origins and the S2
// animation-free dispatcher are explicit local mappings, not recovered C#.
import evidence from '../../../data/arkpedia-lin-prefabs.json' with { type: 'json' };
import { absoluteRangeKeys, canTargetEnemy } from '../targeting.js';
import { bodyInKeys } from '../body.js';
const ID = 'char_4080_lin', air = { canHitFly: true };
const live = u => u?.alive && u.deployed;
const mode = u => u.skill.active ? Number(u.skill.id.at(-1)) : 0;
const talent = u => u.def.talents.find(t => t.bb.value != null)?.bb;
const model = u => evidence.models[ID][['UP', 'LEFT'].includes(u.dir) ? 'Back' : 'Front'];
const key = u => `lin:barrier:${u.id}`;
const idle = k => k === 2 ? 'Skill_2_Loop' : k ? `Skill_${k}_Idle` : 'Idle';

function syncTrait(b, u) {
  if (!live(u) || mode(u)) b.removeBuff(u, 'lin:phalanx');
  else if (!u.findBuff('lin:phalanx')) b.addBuff(u, { key: 'lin:phalanx', source: u,
    mods: { defPct: u.def.traitBb.def, resFlat: u.def.traitBb.magic_resistance } });
}
function grant(b, u, recipient) {
  const old = u.mem.linBarriers.get(recipient);
  if (old?.seq === recipient.deploySeq) return old;
  const state = { seq: recipient.deploySeq, reformAt: 0 };
  u.mem.linBarriers.set(recipient, state);
  b.addBuff(recipient, { key: key(u), source: u, data: state });
  return state;
}
function removeAllies(b, u) {
  for (const a of u.mem.linBarriers.keys()) if (a !== u) {
    b.removeBuff(a, key(u)); u.mem.linBarriers.delete(a);
  }
}
function syncBarriers(b, u) {
  if (!live(u) || !talent(u)) return;
  grant(b, u, u);
  for (const [a, state] of u.mem.linBarriers) if (!live(a) || a.deploySeq !== state.seq) {
    b.removeBuff(a, key(u)); u.mem.linBarriers.delete(a);
  }
  if (mode(u) !== 2) { removeAllies(b, u); return; }
  // Original aura: no removal on range exit, removal on ability detach.
  const keys = new Set(u.rangeKeys);
  for (const a of b.allyUnits) if (a !== u && live(a) && !a.hidden
    && a.kind !== 'device' && !['TOKEN', 'TRAP'].includes(a.def.profession)
    && !a.s.flags.isolated && bodyInKeys(a, keys)) grant(b, u, a);
}
function blast(b, u, recipient, { expanded = false } = {}) {
  const t = talent(u); if (!t || !live(u) || !live(recipient)) return;
  const keys = expanded ? u.rangeKeys
    : absoluteRangeKeys(evidence.tables.ranges['x-1'].grids.map(p => [p.row, p.col]),
      recipient.tileR, recipient.tileC, 'RIGHT');
  const victims = b.enemiesInKeys(keys, u, air);
  // Native ON_BUFF_START stun precedes ON_BUFF_LATE_ENABLE Arts damage.
  for (const e of victims) b.applyStatus(e, 'stun', { source: u, duration: t.stun });
  for (const e of victims) if (canTargetEnemy(u, e, air)) b.dealDamage(u, e, {
    amount: u.s.atk * u.s.atkScaleMul * t.atk_scale, type: 'arts', applyWay: 'none',
    isAttack: false, isSkill: mode(u) === 3, tags: ['lin:shatter'] });
}
function transition(b, u, begin) {
  syncTrait(b, u); syncBarriers(b, u);
  if (!live(u)) { u.mem.linTransition = null; u.mem.regularFormVisual = null; return; }
  const k = Number(u.skill.id.at(-1)), name = `Skill_${k}_${begin ? 'Begin' : 'End'}`;
  const state = {}, seq = u.deploySeq;
  u.mem.linTransition = state; u.mem.regularFormVisual = { clip: name, loop: false };
  u.atkCd = 0;
  b.after(model(u).durations[name], () => {
    if (!live(u) || u.deploySeq !== seq || u.mem.linTransition !== state) return;
    u.mem.linTransition = null;
    u.mem.regularFormVisual = { clip: idle(mode(u)), loop: true };
  }, { owner: u });
}
function release(b, u, _p, e, info) {
  if (!mode(u) || !canTargetEnemy(u, e, air)) return;
  if (mode(u) === 1) b.applyStatus(e, 'sluggish', {
    source: u, duration: u.skill.bb['attack@sluggish'] });
  // Keep the native INPUT victim set; each selected enemy receives one hit.
  const wasAlive = e.alive;
  b.dealDamage(u, e, { amount: u.s.atk * u.s.atkScaleMul, type: 'arts',
    applyWay: 'melee', isAttack: true, isSkill: true, attackId: info.attackId, tags: ['lin:attack'] });
  if (mode(u) !== 3 || !wasAlive || e.alive) return;
  const state = u.mem.linBarriers.get(u), seq = u.deploySeq, activation = u.skill.activations;
  // Original kill-triggered refresh buff lasts .2s. A ready barrier produces a
  // blast; an already broken one is restored, without a second blast.
  b.after(.20000000298023224, () => {
    if (!live(u) || u.deploySeq !== seq || mode(u) !== 3 || u.skill.activations !== activation
      || u.mem.linBarriers.get(u) !== state || !state) return;
    if (b.time + 1e-9 < state.reformAt) state.reformAt = 0;
    else blast(b, u, u, { expanded: true });
  }, { owner: u });
}
export function customizeLinKit({ battle: b, id, def, unit: u, kit }) {
  if (id !== ID) return;
  kit.install = null; kit.talents = [];
  kit.trait = { install: null, attack: 'melee', dmgType: 'arts', projectile: 'none',
    ...air, noAttackUnlessSkill: true, maxTargets: 1, hits: 1, hitsFn: null,
    dmgMul: null, splashRadius: 0, chain: null, allInRange: true,
    interruptOnSkillChange: true, launchAttack: release,
    canAttack: () => !u.mem.linTransition,
    attackVisual: () => mode(u) === 1 ? 'Skill_1_Loop' : mode(u) === 3
      ? `Skill_3_Attack_${['A', 'B', 'C'][Math.floor(b.rng() * 3)]}` : 'none',
    windup: () => mode(u) === 2 ? 0 : model(u).hits[mode(u) === 1 ? 'Skill_1_Loop' : 'Skill_3_Attack_A'][0]
      / Math.min(1, u.s.aspd / 100) };
  const s = def.skill, k = Number(s.id.at(-1));
  kit.skill = { kind: k === 1 ? 'toggle' : 'duration', duration: s.duration,
    manualCancel: k !== 2, attack: {},
    mods: k === 1 ? { atkPct: s.bb.atk, batFlat: s.bb.base_attack_time }
      : k === 2 ? { aspd: s.bb.attack_speed, taunt: s.bb.taunt_level } : { atkPct: s.bb.atk },
    targeting: s.rangeGrid ? { rangeGrid: s.rangeGrid } : {},
    canActivate: () => !u.mem.linTransition,
    canManualCancel: () => !u.mem.linTransition,
    onStart: () => transition(b, u, true), onEnd: () => transition(b, u, false) };
}
export function installLin({ battle: b, unit: u, def }) {
  if (def.charId !== ID) return;
  u.mem.linBarriers = new Map(); u.mem.linTransition = null;
  const reset = () => {
    for (const a of u.mem.linBarriers.keys()) b.removeBuff(a, key(u));
    u.mem.linBarriers.clear(); u.mem.linTransition = null; u.mem.regularFormVisual = null;
    syncTrait(b, u); syncBarriers(b, u);
  };
  b.on('deploy', ({ unit }) => { if (unit === u) reset(); else syncBarriers(b, u); }, { owner: u });
  for (const event of ['death', 'retreat']) b.on(event, ({ unit }) => {
    if (unit === u) reset(); else if (u.mem.linBarriers.has(unit)) {
      b.removeBuff(unit, key(u)); u.mem.linBarriers.delete(unit);
    }
  }, { owner: u });
  b.on('tick', () => syncBarriers(b, u), { owner: u });
  b.on('damageFinal', ctx => {
    const t = talent(u), state = u.mem.linBarriers.get(ctx.target);
    if (!t || !live(u) || !state || !live(ctx.target) || ctx.target.deploySeq !== state.seq
      || b.time + 1e-9 < state.reformAt || ctx.dmg.cancel) return;
    const threshold = t.value * (ctx.target === u && mode(u) === 3 ? u.skill.bb.talent_scale : 1);
    // Fixed, per-instance resistance, never a cumulative shield HP pool.
    // Source dynamic<0 uses strict overflow; equality remains protected.
    const overflow = ctx.amount - threshold;
    ctx.amount = Math.max(0, overflow);
    if (overflow > 1e-9) {
      state.reformAt = b.time + t.interval;
      blast(b, u, ctx.target, { expanded: ctx.target === u && mode(u) === 3 });
    }
  }, { owner: u, priority: 1000 });
  b.on('damaged', ({ target, dmg }) => {
    const t2 = def.talents.find(t => t.bb.prob != null)?.bb;
    if (target !== u || !t2 || !live(u) || !dmg || dmg.noSp || dmg.type === 'element'
      || dmg.tags.includes('hpLoss') || u.skill.active || u.s.flags.noSp) return;
    if (b.rng() < t2.prob) u.skill.gainSp(t2.sp, 'lin:shrouded-strength');
  }, { owner: u });
}
