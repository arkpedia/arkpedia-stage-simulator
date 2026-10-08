// SPDX-License-Identifier: GPL-3.0-or-later
// Source contracts and native-dispatch boundaries: data/arkpedia-surfer-prefabs.json.
import evidence from '../../../data/arkpedia-surfer-prefabs.json' with { type: 'json' };
import { resolveHit } from '../ai.js';
import { canTargetEnemy } from '../targeting.js';

const ID = 'char_4052_surfer', SECOND = 'skchr_surfer_2';
const live = u => u?.alive && u.deployed && !u.hidden;
const model = u => evidence.models[ID][u.dir === 'UP' ? 'Back' : 'Front'];
const second = u => u.skill?.active && u.skill.id === SECOND;
const clip = (u, targets) => `${second(u) ? 'Skill_2_' : ''}${targets.some(e => e.blockedBy === u) ? 'Combat' : 'Attack'}`;
const victimKey = u => `surfer:def-victim:${u.id}`;

function clearSteal(b, u) {
  for (const e of u.mem.surferVictims.keys()) b.removeBuff(e, victimKey(u));
  u.mem.surferVictims.clear(); u.mem.surferStolen = 0;
  b.removeBuff(u, 'surfer:def-owner');
}

function steal(b, u, e) {
  const bb = u.def.skill.bb;
  const amount = Math.min(bb.def_steal, Math.max(0, bb.def_steal_max - u.mem.surferStolen));
  if (!(amount > 0)) return;
  // Selected flat transfer; do not use the victim's DEF as an owner-wide cap.
  // Native low-DEF/cancellation dispatch remains an explicit fidelity limit.
  const total = (u.mem.surferVictims.get(e) ?? 0) + amount;
  u.mem.surferVictims.set(e, total); u.mem.surferStolen += amount;
  b.addBuff(e, { key: victimKey(u), source: u, mods: { defFlat: -total } });
  b.addBuff(u, { key: 'surfer:def-owner', source: u, mods: { defFlat: u.mem.surferStolen } });
}

function form(b, u, begin, idle) {
  const state = { seq: u.deploySeq, activation: u.skill.activations };
  u.mem.surferForm = state;
  const duration = model(u).durations[begin];
  u.mem.regularFormVisual = { clip: begin, loop: false };
  b.addBuff(u, { key: 'surfer:transition', duration, flags: { disarm: true } });
  b.after(duration, () => {
    if (live(u) && u.mem.surferForm === state)
      u.mem.regularFormVisual = idle ? { clip: idle, loop: true } : null;
  }, { owner: u });
}

function launch(b, u, p, e, info) {
  if (!canTargetEnemy(u, e, p)) return;
  const hit = { ...p, applyWay: e.blockedBy === u ? 'melee' : 'ranged', tags: ['surfer:attack'] };
  if (e.blockedBy === u) resolveHit(b, u, hit, e, info, e.x, e.y);
  else b.addProjectile({ from: u, target: e, source: u, speed: 10, maxAge: 10,
    visual: 'arrow', data: { arkpediaTrackedVisual: true }, onHit: ({ target, x, y }) => {
      if (target && canTargetEnemy(u, target, p)) resolveHit(b, u, hit, target, info, x, y);
    } });
}

export function customizeSurferKit({ battle: b, id, def, unit: u, kit }) {
  if (id !== ID) return;
  kit.install = null; kit.talents = [];
  kit.trait = { install: null, attack: 'ranged', projectile: 'none', dmgType: 'phys',
    canHitFly: true, maxTargets: 1, hits: 1, hitsFn: null, allInRange: false,
    hitAllBlocked: false, maxTargetsByBlock: false, splashRadius: 0, chain: null, dmgMul: null,
    retargetOnRelease: false, interruptOnSkillChange: true, launchAttack: launch,
    windup: (_b, a, targets) => model(a).hits[clip(a, targets)][0] / (a.s.aspd / 100),
    attackVisual: (_b, a, targets) => clip(a, targets) };
  const s = def.skill;
  kit.skill = { id: s.id, name: s.name, kind: 'duration', duration: s.duration,
    mods: { atkPct: s.bb.atk, aspd: s.bb.attack_speed } };
  if (s.id === SECOND) Object.assign(kit.skill, {
    onStart: () => { clearSteal(b, u); form(b, u, 'Skill_2_Begin', 'Skill_2_Idle'); },
    onEnd: ({ reason }) => {
      clearSteal(b, u); b.removeBuff(u, 'surfer:transition'); u.mem.surferForm = null;
      if (live(u) && ['duration', 'manual'].includes(reason)) form(b, u, 'Skill_2_End', null);
      else u.mem.regularFormVisual = null;
    },
  });
  else Object.assign(kit.skill, { activateOnDeploy: true, spType: 'none', trigger: 'NEVER',
    isExhausted: () => u.skill?.activations >= 1 });
}

export function installSurfer({ battle: b, unit: u, def }) {
  if (def.charId !== ID) return;
  u.mem.surferVictims = new Map(); u.mem.surferStolen = 0;
  b.on('deploy', ({ unit }) => {
    if (unit !== u) return;
    const cost = def.talents[0]?.bb.cost ?? 0;
    const adjacent = b.allyUnits.some(a => a !== u && live(a) && a.kind === 'op'
      && Math.abs(a.tileR - u.tileR) + Math.abs(a.tileC - u.tileC) === 1);
    if (cost && !adjacent) b.addDp(u.ownerId, cost);
  }, { owner: u });
  // Native ON_BEFORE_TARGET_APPLY_MODIFIER: apply the stolen DEF before the
  // same hit's mitigation. The local pre-mitigation hook is a bounded bridge.
  b.on('hit', ({ source, target, dmg }) => {
    if (source === u && live(u) && second(u) && live(target) && target.side === 'enemy'
      && dmg.isAttack && dmg.tags.includes('surfer:attack') && !dmg.cancel) steal(b, u, target);
  }, { owner: u });
  // OUTPUT_DAMAGE is bridged to accepted damage, including fully shielded or
  // zero-HP-loss hits. A miss, canceled modifier or empty swing grants no DP.
  b.on('damaged', ({ source, target, dmg }) => {
    if (source === u && live(u) && u.skill.active && target.side === 'enemy'
      && dmg?.isAttack && dmg.tags.includes('surfer:attack')) b.addDp(u.ownerId, def.skill.bb.cost);
  }, { owner: u });
  b.on('tick', () => {
    for (const e of u.mem.surferVictims.keys()) if (!live(e) || e.s.flags.untargetable)
      b.removeBuff(e, victimKey(u)); // Native retains the owner's gain/cap usage.
  }, { owner: u });
}
