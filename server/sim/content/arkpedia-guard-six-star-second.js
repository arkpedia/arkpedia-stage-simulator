// SPDX-License-Identifier: GPL-3.0-or-later
import { GUARD_SIX_STAR_SECOND_OPERATORS } from '../../../shared/arkpedia/guard-six-star-second-operators.js';
import evidence from '../../../data/arkpedia-guard-six-star-second-prefabs.json' with { type: 'json' };
import { resolveHit } from '../ai.js';
import { absoluteRangeKeys, canTargetEnemy } from '../targeting.js';
import { bodyInKeys } from '../body.js';

const MOUNTAIN = 'char_264_f12yin', PALLAS = 'char_485_pallas';
const live = u => u?.alive && u.deployed && !u.hidden;
const model = u => evidence.originalModels[u.defId][['UP', 'LEFT'].includes(u.dir) ? 'Back' : 'Front'];
const speed = (u, cap = Infinity) => Math.min(cap, u.s.aspd / 100);
const one = p => ({ ...p, hits: 1, hitsFn: null, chain: null, splashRadius: 0 });
const keys = (u, id) => new Set(absoluteRangeKeys(evidence.ranges[id], u.tileR, u.tileC, u.dir));
function mods(b, target, source, key, value, extra = {}) {
  const old = target.findBuff(key);
  if (!value) { if (old) b.removeBuff(target, old); }
  else if (!old || JSON.stringify(old.mods) !== JSON.stringify(value)) b.addBuff(target, { key, source, mods: value, ...extra });
}
function vigor(b, target, source, key, value) {
  mods(b, target, source, key, value > 0 ? { atkPct: value } : null,
    { status: 'vigor', data: { value } });
}
function startForm(b, u, begin, idle) {
  const seq = u.deploySeq, activation = u.skill.activations, duration = model(u).durations[begin];
  u.mem.regularFormVisual = { clip: begin, loop: false };
  b.addBuff(u, { key: 'guard-six-second:begin', source: u, duration, flags: { disarm: true } });
  b.after(duration, () => {
    if (live(u) && u.deploySeq === seq && u.skill.active && u.skill.activations === activation)
      u.mem.regularFormVisual = { clip: idle, loop: true };
  }, { owner: u });
}
function endForm(b, u, end, reason) {
  b.removeBuff(u, 'guard-six-second:begin');
  if (!live(u) || ['death', 'retreat'].includes(reason)) { u.mem.regularFormVisual = null; return; }
  const seq = u.deploySeq, duration = model(u).durations[end];
  u.mem.regularFormVisual = { clip: end, loop: false };
  b.addBuff(u, { key: 'guard-six-second:end', source: u, duration, flags: { disarm: true } });
  b.after(duration, () => { if (u.deploySeq === seq && !u.skill.active) u.mem.regularFormVisual = null; }, { owner: u });
}
function secondStrike(b, u, p, target, info, delay, release) {
  const seq = u.deploySeq, activation = u.skill.activations;
  const controlEpoch = u.attackControlEpoch;
  let interrupted = false;
  const valid = () => live(u) && u.deploySeq === seq && u.skill.activations === activation
    && u.attackControlEpoch === controlEpoch && u.canAct && !u.s.flags.disarm;
  const monitor = b.every(b.dt, () => { if (!valid()) interrupted = true; }, { owner: u });
  b.after(delay, () => {
    monitor.cancel();
    if (!interrupted && valid() && canTargetEnemy(u, target, p)) release();
  }, { owner: u });
}
function mountainClip(_b, u) {
  // Both source variant clips share the same release frame. Exact native
  // selectMethod0 variant ordering remains a documented visual limitation.
  u.mem.mountainA = !u.mem.mountainA;
  u.mem.mountainClip = u.mem.mountainA ? 'Attack_A' : 'Attack_B';
  return model(u).hits[u.mem.mountainClip][0] / speed(u);
}
function mountainHit(b, u, p, target, info, critical) {
  const t = u.def.talents.find(t => t.bb.atk_scale != null)?.bb;
  if (critical && t && target.alive) b.addBuff(target, { key: 'mountain:weaken', source: u,
    duration: t.duration, mods: { atkMul: 1 + t.atk } });
  resolveHit(b, u, { ...one(p), atkScale: (p.atkScale ?? 1) * (critical && t ? t.atk_scale : 1) },
    target, info, target.x, target.y);
}
function mountainLaunch(b, u, p, target, info) {
  const t = u.def.talents.find(t => t.bb.atk_scale != null)?.bb;
  const s3 = info.isSkill && u.skill.id === 'skchr_f12yin_3';
  if (u.mem.mountainRoll?.attackId !== info.attackId) u.mem.mountainRoll = { attackId: info.attackId,
    critical: !!t && b.rng() < (s3 ? u.def.skill.bb['talent@prob'] : t.prob) };
  const critical = u.mem.mountainRoll.critical;
  mountainHit(b, u, p, target, info, critical);
  if (!s3) return;
  const delta = (model(u).hits.Skill_3_Loop[1] - model(u).hits.Skill_3_Loop[0]) / speed(u);
  secondStrike(b, u, p, target, info, delta, () => {
    mountainHit(b, u, p, target, info, critical);
    // Original onlyFeedActiveBuffToLastOne=true: first punch never pushes.
    if (target.alive) b.push(target, u.def.skill.bb['attack@force'], { from: u });
  });
}
function pallasClip(u, mode = 0) {
  const base = mode === 2 ? 'Skill_03_Loop' : mode === 1 ? 'Skill_02' : 'Attack';
  return u.dir === 'DOWN' ? `${base}_Down` : base;
}
function pallasLaunch(b, u, p, target, info) {
  const s1 = info.isSkill && u.skill.id === 'skchr_pallas_1';
  if (info.isSkill && u.skill.id === 'skchr_pallas_2' && b.rng() < u.def.skill.bb['attack@buff_prob'])
    b.applyStatus(target, 'stun', { source: u, duration: u.def.skill.bb['attack@stun'] });
  resolveHit(b, u, one(p), target, info, target.x, target.y);
  if (s1) secondStrike(b, u, p, target, info, .1 / speed(u), () => {
    resolveHit(b, u, one(p), target, info, target.x, target.y);
  });
}
function pallasRecipient(b, u) {
  const front = keys(u, '1-1');
  // The original professionMask639 dispatcher is not executable-recovered.
  // Global text limits the forward recipient to a melee operator; require a
  // ground-capable actual operator and the original LOWLAND root tile.
  return b.allyUnits.find(a => a !== u && live(a) && a.kind === 'op' && a.def.position !== 'RANGED'
    && b.allySelectable(a, u) && bodyInKeys(a, front) && b.grid.tile(a.tileR, a.tileC)?.height === 'LOW');
}
function syncPallas(b, u) {
  const t = u.def.talents.find(t => t.bb['peak_performance.hp_ratio'] != null)?.bb;
  const active = live(u) && u.skill.active && u.skill.id === 'skchr_pallas_3';
  const recipient = active ? pallasRecipient(b, u) ?? u : null, bb = u.def.skill.bb;
  for (const a of b.allyUnits) {
    const talent = live(u) && t && live(a) && a.kind === 'op' && a.tags.has('minos')
      && !a.s.flags.untargetable && b.allySelectable(a, u)
      && a.hpRatio > t['peak_performance.hp_ratio'];
    vigor(b, a, u, `pallas:talent:${u.id}`, talent ? t['peak_performance.atk'] : 0);
    const chosen = a === recipient;
    mods(b, a, u, `pallas:aid:${u.id}`, chosen ? { defPct: bb['attack@def'], blockCnt: bb['attack@block_cnt'] } : null);
    vigor(b, a, u, `pallas:skill-vigor:${u.id}`, chosen && a.hpRatio > bb['attack@peak_performance.hp_ratio']
      ? bb['attack@peak_performance.atk'] : 0);
  }
}
function healPallas(b, u, value) {
  const area = keys(u, '1-1');
  for (const a of b.allyUnits) if (live(a) && a.kind !== 'device' && bodyInKeys(a, area)
    && b.allySelectable(a, u) && !a.s.flags.healFree && (a === u || !(a.s.flags.noHeal || a.profile?.noHeal)))
    b.heal(u, a, value, { ignoreHealFree: true });
}

export function customizeGuardSixStarSecondKit({ battle: b, id, def, unit: u, kit }) {
  if (!GUARD_SIX_STAR_SECOND_OPERATORS[id]) return;
  kit.install = null;
  const s = def.skill, bb = s.bb;
  kit.trait = { attack: 'melee', projectile: 'none', dmgType: 'phys', canHitFly: false,
    hits: 1, hitsFn: null, chain: null, splashRadius: 0, maxTargets: 1,
    maxTargetsByBlock: false, hitAllBlocked: false, allInRange: false, rangeAoe: false,
    dmgMul: null, install: null, interruptOnSkillChange: true };
  const refund = (_battle, unit, targets, context) => {
    const inputs = context?.inputTargets ?? targets;
    if (!targets.some(e => e.alive) && inputs.length && inputs.every(e => !e.alive))
      unit.skill.addCharge(1);
  };
  if (id === MOUNTAIN) {
    Object.assign(kit.trait, { windup: mountainClip, attackVisual: (_battle, unit) => unit.mem.mountainClip,
      launchAttack: mountainLaunch });
    if (s.id.endsWith('_1')) kit.skill = { kind: 'instant', targeting: { maxTargets: bb.max_target },
      attack: { atkScale: bb.atk_scale, attackVisual: 'Skill', afterAttack: refund,
        windup: (_battle, unit) => model(unit).hits.Skill[0] / speed(unit) } };
    else if (s.id.endsWith('_2')) kit.skill = { kind: 'toggle', manualCancel: true,
      mods: { atkPct: bb.atk, defMul: 1 + bb.def, blockCnt: bb.block_cnt,
        hpRegenRatio: bb.hp_recovery_per_sec_by_max_hp_ratio },
      targeting: { rangeGrid: s.rangeGrid },
      attack: { maxTargetsByBlock: true, allowZeroBlockTargetLimit: false,
        attackVisual: 'Skill_2_Loop', windup: (_battle, unit) => model(unit).hits.Skill_2_Loop[0] / speed(unit) },
      onStart: () => { u.mem.regularFormVisual = { clip: 'Skill_2_Idle', loop: true }; },
      onEnd: ({ reason }) => endForm(b, u, 'Skill_2_End', reason) };
    else kit.skill = { kind: 'duration', duration: s.duration, mods: { atkPct: bb.atk, batPct: bb.base_attack_time },
      targeting: { rangeGrid: s.rangeGrid, maxTargets: bb['attack@max_target'] },
      attack: { attackVisual: 'Skill_3_Loop', retargetOnRelease: true,
        windup: (_battle, unit) => model(unit).hits.Skill_3_Loop[0] / speed(unit) },
      onStart: () => startForm(b, u, 'Skill_3_Begin', 'Skill_3_Idle'),
      onEnd: ({ reason }) => endForm(b, u, 'Skill_3_End', reason) };
  } else {
    Object.assign(kit.trait, { dmgMul: (_battle, unit, target) => target.blockedBy === unit ? 1 : def.traitBb.atk_scale,
      attackVisual: (_battle, unit) => pallasClip(unit), launchAttack: pallasLaunch,
      windup: (_battle, unit) => model(unit).hits[pallasClip(unit)][0] / speed(unit, 1) });
    if (s.id.endsWith('_1')) kit.skill = { kind: 'instant', attack: { atkScale: bb.atk_scale,
      retargetOnRelease: true, afterAttack: refund,
      windup: (_battle, unit) => model(unit).hits[pallasClip(unit)][0] / speed(unit) } };
    else if (s.id.endsWith('_2')) kit.skill = { kind: 'duration', duration: s.duration,
      mods: { atkPct: bb.atk, rangeExtend: bb.ability_range_forward_extend },
      attack: { attackVisual: (_battle, unit) => pallasClip(unit, 1),
        windup: (_battle, unit) => model(unit).hits[pallasClip(unit, 1)][0] / speed(unit, 1) },
      onStart: () => b._refreshRange(u) };
    else kit.skill = { kind: 'duration', duration: s.duration, mods: { atkPct: bb.atk },
      targeting: { maxTargets: bb['attack@max_target'] },
      attack: { attackVisual: (_battle, unit) => pallasClip(unit, 2),
        windup: (_battle, unit) => model(unit).hits[pallasClip(unit, 2)][0] / speed(unit, 1) },
      onStart: () => { startForm(b, u, 'Skill_03_Begin', 'Skill_03_Idle'); syncPallas(b, u); },
      onEnd: ({ reason }) => { syncPallas(b, u); endForm(b, u, 'Skill_03_End', reason); } };
  }
  kit.skill.id = s.id; kit.skill.name = s.name;
}
export function installGuardSixStarSecond({ battle: b, unit: u, def }) {
  if (!GUARD_SIX_STAR_SECOND_OPERATORS[def.charId]) return;
  if (def.charId === MOUNTAIN) {
    const t = def.talents.find(t => t.bb.def != null)?.bb;
    if (t) b.addBuff(u, { key: 'mountain:constitution', source: u, persist: true, allowDead: true,
      mods: { defPct: t.def, dodgePhys: t.prob } });
  } else {
    const sync = () => syncPallas(b, u);
    for (const event of ['tick', 'deploy', 'death', 'skillStart', 'skillEnd']) b.on(event, sync, { owner: u });
    b.on('damaged', ({ source, target, dmg }) => {
      if (target === u) sync();
      const t = def.talents.find(t => t.bb.value != null)?.bb;
      if (t && source === u && target.side === 'enemy' && dmg.isAttack && live(u)) healPallas(b, u, t.value);
    }, { owner: u });
    sync();
  }
}
