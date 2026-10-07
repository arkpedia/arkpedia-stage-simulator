// SPDX-License-Identifier: GPL-3.0-or-later
import { GUARD_SIX_STAR_OPERATORS } from '../../../shared/arkpedia/guard-six-star-operators.js';
import evidence from '../../../data/arkpedia-guard-six-star-prefabs.json' with { type: 'json' };
import { acquireTargets, resolveHit } from '../ai.js';
import { canTargetEnemy } from '../targeting.js';
import { bodyInKeys } from '../body.js';

const SKADI = 'char_263_skadi', SILVER = 'char_172_svrash', HELL = 'char_188_helage';
const live = u => u?.alive && u.deployed && !u.hidden;
const model = u => evidence.originalModels[u.defId][['UP', 'LEFT'].includes(u.dir) ? 'Back' : 'Front'];
const rate = (u, cap = Infinity) => Math.min(cap, u.s.aspd / 100);
const one = p => ({ ...p, hits: 1, hitsFn: null, chain: null, splashRadius: 0, dmgMul: null });
function mods(b, u, key, value) {
  if (!value) { b.removeBuff(u, key); return; }
  if (JSON.stringify(u.findBuff(key)?.mods) !== JSON.stringify(value)) b.addBuff(u, { key, mods: value });
}

/** Native deck effects apply from selected cards, including bench and support. */
export function installGuardSixStarSquad({ battle: b, records }) {
  const hunter = records[SKADI]?.talents.find(t => t.bb.atk != null)?.bb;
  const leader = records[SILVER]?.talents.find(t => t.bb.respawn_time != null)?.bb;
  if (!hunter && !leader) return;
  b.on('deploy', ({ unit: u }) => {
    if (u.side !== 'ally' || u.kind !== 'op') return;
    if (hunter && records[u.defId]?.tags.includes('abyssal'))
      b.addBuff(u, { key: 'skadi:deck', mods: { atkPct: hunter.atk } });
    if (leader) b.addBuff(u, { key: 'silverash:deck', mods: { redeployMul: 1 + leader.respawn_time } });
  });
}

function openingWindup(begin, loop, memKey) {
  return (_b, u) => {
    const m = model(u), opening = !!u.mem[memKey];
    u.mem.guardSixOpeningVisual = opening;
    u.mem[memKey] = false;
    return (m.hits[loop][0] + (opening ? m.durations[begin] : 0)) / rate(u);
  };
}
function openingVisual(begin, loop) {
  return (_b, u) => u.mem.guardSixOpeningVisual
    ? { begin, loop, beginDuration: model(u).durations[begin] / rate(u) } : loop;
}
const silverCombat = (u, targets) => targets?.some(e => e.blockedBy === u);
function silverClip(u, targets) {
  if (u.skill.active && u.skill.id === 'skchr_svrash_3') return 'Skill';
  if (u.skill.active && u.skill.id === 'skchr_svrash_2' || silverCombat(u, targets))
    return u.dir === 'DOWN' ? 'Combat_Down' : 'Combat';
  return 'Attack';
}
function silverLaunch(b, u, p, target, info) {
  const s1 = info.isSkill && u.skill.id === 'skchr_svrash_1';
  const s3 = info.isSkill && u.skill.id === 'skchr_svrash_3';
  const melee = !s1 && (s3 || u.skill.active && u.skill.id === 'skchr_svrash_2' || target.blockedBy === u);
  const hit = { ...one(p), applyWay: melee ? 'melee' : 'ranged',
    atkScale: (p.atkScale ?? 1) * (melee || s1 ? 1 : .8) };
  if (melee) resolveHit(b, u, hit, target, info, target.x, target.y);
  else b.addProjectile({ from: u, target, source: u, flightTime: .22, visual: 'bolt',
    data: { arkpediaTrackedVisual: true }, onHit: ({ target: e, x, y }) => {
      if (e && canTargetEnemy(u, e, p)) resolveHit(b, u, hit, e, info, x, y);
    } });
}
function revealSilver(b, u) {
  const key = `silverash:reveal:${u.id}`;
  for (const e of b.enemies) {
    const eligible = live(u) && u.def.raw.arkpedia.elite >= 2 && live(e) && bodyInKeys(e, u.rangeKeys);
    if (eligible) {
      if (!e.findBuff(key)) b.addBuff(e, { key, source: u, flags: { reveal: true } });
    } else b.removeBuff(e, key);
  }
}
function doubleHell(b, u, p, target, info) {
  resolveHit(b, u, one(p), target, info, target.x, target.y);
  const seq = u.deploySeq, activation = u.skill.activations, clip = p.attackVisual;
  const delta = (model(u).hits[clip][1] - model(u).hits[clip][0]) / rate(u);
  let interrupted = false;
  const valid = () => live(u) && u.deploySeq === seq && u.skill.activations === activation
    && u.canAct && !u.s.flags.disarm;
  const watch = b.every(b.dt, () => { if (!valid()) interrupted = true; }, { owner: u });
  b.after(delta, () => {
    watch.cancel();
    if (!interrupted && valid() && canTargetEnemy(u, target, p))
      resolveHit(b, u, one(p), target, info, target.x, target.y);
  }, { owner: u });
}
function syncHell(b, u) {
  const t = u.def.talents.find(t => t.bb.min_attack_speed != null)?.bb;
  if (!live(u) || !t) mods(b, u, 'hellagur:tenacity', null);
  else mods(b, u, 'hellagur:tenacity', { aspd: t.min_attack_speed
    * Math.max(0, Math.min(1, (1 - u.hpRatio) / (1 - t.min_hp_ratio))) });
}
function syncHellRest(b, u) {
  const t = u.def.talents.find(t => t.bb.hp_recovery_per_sec != null)?.bb;
  const unblocked = live(u) && !u.blocking.some(e => e.alive && e.blockedBy === u);
  mods(b, u, 'hellagur:rest', unblocked && t ? { hpRegen: t.hp_recovery_per_sec } : null);
}

export function customizeGuardSixStarKit({ battle: b, id, def, unit: u, kit }) {
  if (!GUARD_SIX_STAR_OPERATORS[id]) return;
  kit.install = null;
  const s = def.skill, bb = s.bb;
  const timed = value => ({ kind: 'duration', duration: s.duration, mods: value });
  kit.trait = { attack: 'melee', projectile: 'none', dmgType: 'phys', hits: 1, hitsFn: null,
    dmgMul: null, maxTargets: 1, hitAllBlocked: false, allInRange: false, rangeAoe: false,
    canHitFly: false, install: null, interruptOnSkillChange: true };
  if (id === SKADI) {
    Object.assign(kit.trait, { windup: openingWindup('Attack_Begin', 'Attack', 'skadiOpening'),
      attackVisual: openingVisual('Attack_Begin', 'Attack') });
    kit.skill = s.id === 'skchr_skadi_2'
      ? { kind: 'duration', duration: bb.duration, activateOnDeploy: true, spType: 'none',
        trigger: 'NEVER', isExhausted: () => u.skill?.activations >= 1, mods: { atkPct: bb.atk },
        onStart: () => { u.mem.skadiOpening = true; } }
      : { ...timed({ atkPct: bb.atk, ...(s.id === 'skchr_skadi_3' ? { defPct: bb.def, hpPct: bb.max_hp }
        : { aspd: bb.attack_speed }) }), onStart: () => { u.mem.skadiOpening = true; } };
  } else if (id === SILVER) {
    Object.assign(kit.trait, { attack: 'ranged', projectile: 'bolt', canHitFly: true,
      launchAttack: silverLaunch, attackVisual: (_b, unit, targets) => silverClip(unit, targets),
      windup: (_b, unit, targets) => model(unit).hits[silverClip(unit, targets)][0] / rate(unit, 1.1) });
    if (s.id.endsWith('_1')) kit.skill = { kind: 'instant', attack: { atkScale: bb.atk_scale,
      attackVisual: 'Attack', windup: (_b, unit) => model(unit).hits.Attack[0] / rate(unit),
      // The original skill explicitly refunds a target that dies before firing;
      // a projectile already emitted does not restore the consumed charge.
      afterAttack: (_b, unit, targets) => {
        if (targets.length && targets.every(e => !e.alive)) unit.skill.addCharge(1);
      } } };
    else if (s.id.endsWith('_2')) kit.skill = { kind: 'toggle', manualCancel: true,
      mods: { defPct: bb.def, hpRegenRatio: bb.hp_recovery_per_sec_by_max_hp_ratio },
      targeting: { rangeGrid: s.rangeGrid, canHitFly: false },
      onStart: () => revealSilver(b, u), onEnd: () => {
        // onEnd runs before the ordinary skill range is restored.
        b.after(0, () => revealSilver(b, u));
      } };
    else kit.skill = { ...timed({ atkPct: bb.atk, defMul: 1 + bb.def }),
      targeting: { rangeGrid: s.rangeGrid, maxTargets: bb['attack@max_target'] },
      onStart: () => revealSilver(b, u), onEnd: () => { b.after(0, () => revealSilver(b, u)); } };
  } else {
    Object.assign(kit.trait, { noHeal: true, selfHeal: null, retargetOnRelease: true,
      attackVisual: 'Attack', windup: (_b, unit) => model(unit).hits.Attack[0] / rate(unit) });
    if (s.id.endsWith('_1')) kit.skill = { kind: 'instant', attack: { atkScale: bb.atk_scale,
      launchAttack: doubleHell, attackVisual: 'Skill', windup: (_b, unit) => model(unit).hits.Skill[0] / rate(unit) } };
    else if (s.id.endsWith('_2')) kit.skill = { ...timed({ atkPct: bb.atk, dodgePhys: bb.prob }),
      attack: { launchAttack: doubleHell, attackVisual: 'Skill_2',
        windup: (_b, unit) => model(unit).hits.Skill_2[0] / rate(unit) } };
    else kit.skill = { ...timed({ atkPct: bb.atk, rangeExtend: bb.ability_range_forward_extend }),
      targeting: { maxTargets: bb['attack@max_target'] },
      attack: { windup: openingWindup('Skill_3_Begin', 'Skill_3_Loop', 'hellOpening'),
        attackVisual: openingVisual('Skill_3_Begin', 'Skill_3_Loop') },
      onStart: () => { u.mem.hellOpening = true; b._refreshRange(u); } };
  }
  kit.skill.id = s.id; kit.skill.name = s.name;
}
export function installGuardSixStar({ battle: b, unit: u, def }) {
  if (!GUARD_SIX_STAR_OPERATORS[def.charId]) return;
  if (def.charId === SKADI) {
    u.mem.skadiOpening = true;
    b.on('tick', () => {
      if (!u.canAct || !acquireTargets(b, u, u.profile).length) u.mem.skadiOpening = true;
    }, { owner: u });
  } else if (def.charId === SILVER) {
    b.on('tick', () => revealSilver(b, u), { owner: u });
    b.on('deploy', ({ unit }) => { if (unit === u) revealSilver(b, u); }, { owner: u });
    b.on('death', ({ unit }) => { if (unit === u) {
      for (const e of b.enemies) b.removeBuff(e, `silverash:reveal:${u.id}`);
    } }, { owner: u });
  } else {
    u.mem.hellOpening = true;
    syncHell(b, u); b.every(.25, () => syncHell(b, u), { owner: u });
    b.on('damaged', ({ source, target, dmg }) => {
      if (source === u && target.side === 'enemy' && dmg.isAttack && live(u))
        b.heal(u, u, def.traitBb.value, { self: true, ignoreHealFree: true });
    }, { owner: u });
    b.on('deploy', ({ unit }) => { if (unit === u) { syncHell(b, u); syncHellRest(b, u); } }, { owner: u });
    b.on('tick', () => {
      syncHellRest(b, u);
      if (!u.canAct || !acquireTargets(b, u, u.profile).length) u.mem.hellOpening = true;
    }, { owner: u });
  }
}
