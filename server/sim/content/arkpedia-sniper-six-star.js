// SPDX-License-Identifier: GPL-3.0-or-later
import { SNIPER_SIX_STAR_OPERATORS } from '../../../shared/arkpedia/sniper-six-star-operators.js';
import evidence from '../../../data/arkpedia-sniper-six-star-prefabs.json' with { type: 'json' };
import { acquireTargets, resolveHit } from '../ai.js';
import { canTargetEnemy } from '../targeting.js';

const SCHWARZ = 'char_340_shwaz';
const live = u => u?.alive && u.deployed && !u.hidden;
const model = u => evidence.originalModels[u.defId][['UP', 'LEFT'].includes(u.dir) ? 'Back' : 'Front'];
const rate = u => u.s.aspd / 100;
const s3 = u => u.skill.active && u.skill.id === 'skchr_shwaz_3';
const loop = u => s3(u) ? 'Skill_Loop' : 'Attack_Loop';

function attackOpening(_b, u) {
  const m = model(u);
  return (m.hits[loop(u)][0] + (!s3(u) && u.mem.schwarzOpening ? m.durations.Attack_Begin : 0)) / rate(u);
}
function visualOpening(_b, u) {
  return !s3(u) && u.mem.schwarzOpening
    ? { begin: 'Attack_Begin', loop: 'Attack_Loop', beginDuration: model(u).durations.Attack_Begin / rate(u) }
    : loop(u);
}
function form(b, u, clip, idle = null) {
  const duration = model(u).durations[clip] / rate(u), seq = u.deploySeq;
  u.mem.regularFormVisual = { clip, loop: false };
  b.addBuff(u, { key: 'schwarz:form', duration, flags: { disarm: true, noSp: true } });
  b.after(duration, () => {
    if (live(u) && u.deploySeq === seq)
      u.mem.regularFormVisual = idle && s3(u) ? { clip: idle, loop: true } : null;
  }, { owner: u });
}
function launch(b, u, p, target, info) {
  u.mem.schwarzOpening = false;
  const t = u.def.talents.find(v => v.bb.prob != null)?.bb;
  const prob = info.isSkill ? u.skill.bb['talent@prob'] ?? t?.prob : t?.prob;
  // The original projectile retains passive buff bindings on its dummy. Carry
  // its talent probability across expiry/withdrawal instead of an owned hook.
  b.addProjectile({ from: u, target, source: u, speed: 10, visual: 'arrow',
    data: { arkpediaTrackedVisual: true }, onHit: ({ target: e, x, y }) => {
      if (!e || !canTargetEnemy(u, e, p)) return;
      const crit = t && b.rng.chance(prob);
      const hit = { ...p, hits: 1, hitsFn: null, chain: null, splashRadius: 0,
        atkScale: (p.atkScale ?? 1) * (crit ? t.atk_scale : 1) };
      // Native ON_CALCULATE_DAMAGE orders Dice, ATK scale, then CreateBuff.
      // Apply DEF before this pipeline's mitigation; E0's zero-duration field
      // never becomes a permanent DEF modifier.
      if (crit && t.defdown_duration > 0) {
        const old = e.findBuff('schwarz:defdown'), value = 1 + t.def;
        if (!old || value <= old.mods.defMul)
          b.addBuff(e, { key: 'schwarz:defdown', source: u, duration: t.defdown_duration,
            mods: { defMul: value } });
      }
      resolveHit(b, u, hit, e, info, x, y);
    } });
}
function crossfire(b, u) {
  const t = u.def.talents.find(v => v.bb.atk != null)?.bb;
  const snipers = b.allyUnits.filter(a => live(a) && a.kind === 'op' && a.def.raw.profession === 'SNIPER');
  const enabled = live(u) && t && snipers.length >= 2;
  for (const a of b.allyUnits) {
    const eligible = enabled && snipers.includes(a) && b.allySelectable(a, u), old = a.findBuff('schwarz:crossfire');
    if (eligible && old?.mods.atkPct !== t.atk)
      b.addBuff(a, { key: 'schwarz:crossfire', source: u, mods: { atkPct: t.atk } });
    else if (!eligible) b.removeBuff(a, 'schwarz:crossfire');
  }
}
export function customizeSniperSixStarKit({ battle: b, id, def, unit: u, kit }) {
  if (!SNIPER_SIX_STAR_OPERATORS[id]) return;
  kit.install = null;
  const s = def.skill, bb = s.bb;
  kit.trait = { attack: 'ranged', dmgType: 'phys', projectile: 'arrow', canHitFly: true,
    priority: 'first', hits: 1, hitsFn: null, maxTargets: 1, maxTargetsByBlock: false,
    hitAllBlocked: false, allInRange: false, splashRadius: 0, chain: null, dmgMul: null,
    attackVisual: visualOpening, windup: attackOpening, launchAttack: launch,
    interruptOnSkillChange: true };
  if (s.id.endsWith('_1')) kit.skill = { kind: 'instant',
    // Native recoverSpIfTargetDead1 refunds only a dead input before emission.
    attack: { atkScale: bb.atk_scale, afterAttack: (_b, unit, targets) => {
      if (targets.length && targets.every(e => !e.alive)) unit.skill.addCharge(1);
    } } };
  else kit.skill = { kind: 'duration', duration: s.duration, attack: {},
    mods: { atkPct: bb.atk, ...(s.id.endsWith('_3') ? { batFlat: bb.base_attack_time } : {}) },
    ...(s.id.endsWith('_3') ? { targeting: { rangeGrid: s.rangeGrid },
      onStart: () => { u.mem.schwarzOpening = true; form(b, u, 'Skill_Begin', 'Skill_Idle'); },
      onEnd: () => { u.mem.schwarzOpening = true; b.removeBuff(u, 'schwarz:form'); form(b, u, 'Skill_End'); } }
      : {}) };
  kit.skill.id = s.id; kit.skill.name = s.name;
}
export function installSniperSixStar({ battle: b, unit: u, def }) {
  if (def.charId !== SCHWARZ) return;
  u.mem.schwarzOpening = true;
  b.on('tick', () => {
    if (!u.canAct || !acquireTargets(b, u, u.profile).length) u.mem.schwarzOpening = true;
    crossfire(b, u);
  }, { owner: u });
  b.on('deploy', () => crossfire(b, u), { owner: u });
  b.on('death', ({ unit }) => {
    if (unit === u) for (const a of b.allyUnits) b.removeBuff(a, 'schwarz:crossfire');
    else crossfire(b, u);
  }, { owner: u });
}
