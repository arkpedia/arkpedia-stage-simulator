// SPDX-License-Identifier: GPL-3.0-or-later
import { FARTOOTH_OPERATORS } from '../../../shared/arkpedia/fartooth-operators.js';
import evidence from '../../../data/arkpedia-fartooth-prefabs.json' with { type: 'json' };
import { acquireTargets, effectiveProfile, resolveHit } from '../ai.js';
import { absoluteRangeKeys, canTargetEnemy, sortEnemyTargets } from '../targeting.js';
import { bodyInKeys } from '../body.js';
import { COLS, ROWS } from '../constants.js';
import { isHpLoss } from '../damage.js';

const live = u => u?.alive && u.deployed && !u.hidden;
const model = u => evidence.models[u.defId][['UP', 'LEFT'].includes(u.dir) ? 'Back' : 'Front'];
const rate = u => u.base.bat / u.s.interval;
const isS3 = p => p.fartoothMode === 3;
const attackClip = (u, p) => isS3(p) ? 'Skill3_Loop'
  : u.dir === 'DOWN' && model(u).hits.Attack_Down_Loop ? 'Attack_Down_Loop' : 'Attack_Loop';
const attackBegin = clip => clip.replace('_Loop', '_Begin');
const plain = p => ({ ...p, hits: 1, hitsFn: null, chain: null, splashRadius: 0, dmgMul: null });

// The original S2 range component is specialized; the Global description
// establishes its union of ordinary range and enemies blocked anywhere.
function blockedRange(b, u, p) {
  const candidates = b.enemies.filter(e => canTargetEnemy(u, e, p)
    && (bodyInKeys(e, u.rangeKeySet) || e.blockedBy?.alive && e.blockedBy.deployed));
  sortEnemyTargets(b, u, candidates, 'lowDef');
  return candidates.slice(0, Math.max(1, 1 + Math.floor(u.s.maxTargets)));
}

function windup(b, u, _targets, p) {
  const clip = attackClip(u, p), playback = rate(u);
  const begin = !isS3(p) && !u.mem.fartoothBegun;
  u.mem.fartoothAttackVisual = begin
    ? { begin: attackBegin(clip), loop: clip,
      beginDuration: model(u).durations[attackBegin(clip)] / playback }
    : clip;
  return (model(u).hits[clip][0]
    + (begin ? model(u).durations[attackBegin(clip)] : 0)) / playback;
}

function launch(b, u, p, target, info) {
  if (!canTargetEnemy(u, target, p)) return;
  u.mem.fartoothBegun = true;
  // Preserve the emitted skill ability's passive contract independently of
  // source retirement; the native dummy-copy dispatcher itself is unrecovered.
  const ignoreDodge = info.isSkill && u.def.talents.some(t => t.bb.taunt_level != null);
  const outsideScale = isS3(p) ? u.def.skill.bb.damage_scale : 1;
  const normal = absoluteRangeKeys(evidence.ranges['3-9'], u.tileR, u.tileC, u.dir);
  return b.addProjectile({ from: u, target, source: u, speed: 14, maxAge: 10,
    visual: 'arrow', data: { arkpediaTrackedVisual: true },
    onHit: ({ target: e, x, y }) => {
      if (!e || !canTargetEnemy(u, e, p)) return;
      const remove = b.on('hit', ctx => {
        if (ctx.source !== u || ctx.target !== e || ctx.dmg.attackId !== info.attackId) return;
        if (ignoreDodge && ctx.dmg.type === 'phys') ctx.dmg.canDodge = false;
        if (outsideScale !== 1 && !bodyInKeys(e, new Set(normal))) ctx.dmg.mul *= outsideScale;
      });
      try { resolveHit(b, u, plain(p), e, info, x, y); }
      finally { b.off(remove); }
    } });
}

export function customizeFartoothKit({ battle: b, id, def, unit: u, kit }) {
  if (!FARTOOTH_OPERATORS[id]) return;
  kit.install = null;
  const timed = p => (battle, unit, targets) => windup(battle, unit, targets, p);
  const visual = (_battle, unit) => unit.mem.fartoothAttackVisual;
  kit.trait = { attack: 'ranged', dmgType: 'phys', projectile: 'none', canHitFly: true,
    priority: 'lowDef', maxTargets: 1, maxTargetsByBlock: false,
    hitAllBlocked: false, allInRange: false, rangeAoe: false, splashRadius: 0,
    hits: 1, hitsFn: null, chain: null, dmgMul: null, install: null,
    retargetOnRelease: true, interruptOnSkillChange: true,
    launchAttack: launch, attackVisual: visual, windup: timed({ fartoothMode: 0 }) };
  const s = def.skill, bb = s.bb, mode = s.id === 'skchr_fartth_3' ? 3
    : s.id === 'skchr_fartth_2' ? 2 : 1;
  const talent = def.talents.find(t => t.bb.taunt_level != null)?.bb;
  const mods = { ...(bb.atk != null ? { atkPct: bb.atk } : {}),
    ...(bb.attack_speed != null ? { aspd: bb.attack_speed } : {}),
    ...(talent ? { taunt: talent.taunt_level } : {}) };
  kit.skill = { id: s.id, name: s.name, kind: 'duration', duration: s.duration, mods,
    ...(mode === 3 ? { targeting: { rangeGrid: Array.from({ length: Math.max(COLS, ROWS) },
      (_, col) => [0, col]), noRangeExtend: true }, } : {}),
    attack: { fartoothMode: mode, windup: timed({ fartoothMode: mode }),
      ...(mode === 2 ? { acquireTargets: blockedRange } : {}) },
    onStart: () => {
      u.mem.fartoothBegun = false;
      if (mode !== 3) return;
      const duration = model(u).durations.Skill3_Begin / rate(u);
      b.addBuff(u, { key: `fartooth:begin:${u.id}`, source: u,
        duration, flags: { disarm: true } });
      u.skillAnimUntil = b.time + duration;
      u.mem.regularFormVisual = { clip: 'Skill3_Begin', loop: false };
      const activation = u.skill.activations, seq = u.deploySeq;
      b.after(duration, () => {
        if (live(u) && u.deploySeq === seq && u.skill.active
          && u.skill.activations === activation)
          u.mem.regularFormVisual = { clip: 'Skill3_Idle', loop: true };
      }, { owner: u });
    },
    onEnd: () => {
      u.mem.fartoothBegun = false;
      if (mode !== 3) return;
      const duration = model(u).durations.Skill3_End / rate(u);
      u.skillAnimUntil = b.time + duration;
      u.mem.regularFormVisual = { clip: 'Skill3_End', loop: false };
      const activation = u.skill.activations, seq = u.deploySeq;
      b.after(duration, () => {
        if (live(u) && u.deploySeq === seq && !u.skill.active
          && u.skill.activations === activation) u.mem.regularFormVisual = null;
      }, { owner: u });
    } };
}

export function installFartooth({ battle: b, unit: u, def }) {
  if (!FARTOOTH_OPERATORS[def.charId]) return;
  b.on('tick', () => {
    if (live(u) && !acquireTargets(b, u, effectiveProfile(u)).length)
      u.mem.fartoothBegun = false;
  }, { owner: u });
  const concentration = def.talents.find(t => t.bb.delay != null)?.bb;
  if (!concentration) return;
  let readyAt = b.time + concentration.delay;
  const key = `fartooth:concentration:${u.id}`;
  b.on('damaged', ({ target, dmg }) => {
    // Original checker listens to applied damage modifiers, not actual HP
    // loss. An accepted shielded receipt resets the clock; HP loss does not.
    if (target !== u || !live(u) || isHpLoss(dmg)) return;
    readyAt = b.time + concentration.delay;
    b.removeBuff(u, key);
  }, { owner: u });
  b.on('tick', () => {
    if (live(u) && b.time + 1e-9 >= readyAt && !u.findBuff(key))
      b.addBuff(u, { key, source: u, mods: { atkPct: concentration.atk } });
  }, { owner: u });
}
