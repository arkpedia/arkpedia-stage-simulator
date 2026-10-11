// SPDX-License-Identifier: GPL-3.0-or-later
import { GUARD_SIX_STAR_THIRD_OPERATORS } from '../../../shared/arkpedia/guard-six-star-third-operators.js';
import evidence from '../../../data/arkpedia-guard-six-star-third-prefabs.json' with { type: 'json' };
import { resolveHit } from '../ai.js';
import { absoluteRangeKeys, canTargetEnemy, sortEnemyTargets } from '../targeting.js';
import { bodyInKeys } from '../body.js';

const VIVIANA = 'char_4098_vvana';
const live = u => u?.alive && u.deployed && !u.hidden;
const elite = e => ['ELITE', 'BOSS'].includes(e.def.rank);
const model = u => evidence.originalModels[u.defId][['UP', 'LEFT'].includes(u.dir) ? 'Back' : 'Front'];
const rate = (u, cap = Infinity) => Math.min(cap, u.s.aspd / 100);
const range = (u, id) => absoluteRangeKeys(evidence.ranges[id], u.tileR, u.tileC, u.dir);
const plain = p => ({ ...p, hits: 1, hitsFn: null, chain: null, splashRadius: 0 });
function ownedMods(b, u, key, value, extra = {}) {
  const old = u.findBuff(key);
  if (!value) { if (old) b.removeBuff(u, old); }
  else if (!old || JSON.stringify(old.mods) !== JSON.stringify(value)) b.addBuff(u, { key, source: u, mods: value, ...extra });
}
function vivianaClip(u) {
  if (u.skill.active) {
    if (u.skill.id === 'skchr_vvana_1' && u.mem.vivianaCharged) return 'Skill_1_Attack';
    if (u.skill.id === 'skchr_vvana_2') return 'Skill_2_Loop';
    if (u.skill.id === 'skchr_vvana_3') return u.mem.vivianaEnhanced ? 'Skill_3_Attack_B'
      : u.dir === 'DOWN' ? 'Skill_Down_3_Attack_A' : 'Skill_3_Attack_A';
  }
  return u.dir === 'DOWN' ? 'Attack_Down' : 'Attack';
}
function formStart(b, u, begin, idle) {
  const seq = u.deploySeq, activation = u.skill.activations, duration = model(u).durations[begin];
  u.mem.regularFormVisual = { clip: begin, loop: false };
  b.addBuff(u, { key: 'viviana:begin', source: u, duration, flags: { disarm: true } });
  b.after(duration, () => {
    if (live(u) && u.deploySeq === seq && u.skill.active && u.skill.activations === activation)
      u.mem.regularFormVisual = { clip: idle, loop: true };
  }, { owner: u });
}
function formEnd(b, u, end, reason) {
  b.removeBuff(u, 'viviana:begin');
  if (!live(u) || ['death', 'retreat'].includes(reason)) { u.mem.regularFormVisual = null; return; }
  const seq = u.deploySeq, duration = model(u).durations[end];
  u.mem.regularFormVisual = { clip: end, loop: false };
  b.addBuff(u, { key: 'viviana:end', source: u, duration, flags: { disarm: true } });
  b.after(duration, () => { if (u.deploySeq === seq && !u.skill.active) u.mem.regularFormVisual = null; }, { owner: u });
}
function syncCharge(b, u) {
  if (u.skill.id !== 'skchr_vvana_1') return;
  const full = live(u) && (u.skill.pending ? u.mem.vivianaCharged : u.skill.charges === 2);
  const grid = full ? evidence.ranges['3-2'] : u.mem.vivianaBaseRange;
  if (grid && u.rangeGrid !== grid) { u.rangeGrid = grid; b.refreshRange(u); }
  if (!u.skill.active) u.mem.regularFormVisual = full ? { clip: 'Skill_1_Idle', loop: true } : null;
}
function syncTalent(b, u) {
  const t = u.def.talents.find(t => t.bb.damage_scale_m != null)?.bb;
  const eligible = t && live(u) && b.enemies.some(e => live(e) && elite(e)
    && !e.s.flags.untargetable && bodyInKeys(e, u.rangeKeys));
  const scale = eligible ? t.super_scale : 1;
  ownedMods(b, u, 'viviana:candlelight-arts', t && live(u) ? { artsDealtMul: 1 + t.damage_scale_m * scale } : null);
  ownedMods(b, u, 'viviana:candlelight-resistance', t && live(u) ? {
    physTakenMul: 1 - t.damage_resistance_pm * scale,
    artsTakenMul: 1 - t.damage_resistance_pm * scale,
  } : null, { status: 'sanctuary', data: { value: t ? t.damage_resistance_pm * scale : 0 } });
}
function cleanupSteal(b, u) {
  for (const e of u.mem.vivianaStealTargets) b.removeBuff(e, `viviana:steal:${u.id}`);
  u.mem.vivianaStealTargets.clear(); u.mem.vivianaStolen = 0;
  b.removeBuff(u, 'viviana:steal-owner');
}
function stealSpeed(b, u, target) {
  const bb = u.def.skill.bb, amount = Math.min(bb['attack@steal_atk_speed'],
    Math.max(0, bb['attack@steal_atk_speed_max'] - u.mem.vivianaStolen));
  if (!(amount > 0)) return;
  u.mem.vivianaStolen += amount; u.mem.vivianaStealTargets.add(target);
  const key = `viviana:steal:${u.id}`, prior = -(target.findBuff(key)?.mods.aspd ?? 0);
  b.addBuff(target, { key, source: u, tags: ['steal-victim'], mods: { aspd: -(prior + amount) } });
  ownedMods(b, u, 'viviana:steal-owner', { aspd: u.mem.vivianaStolen });
}
function vivianaTargets(b, u, p) {
  const sourceKeys = u.skill.id === 'skchr_vvana_1' && (u.skill.pending ? u.mem.vivianaCharged : u.skill.charges === 2)
    ? range(u, '3-2') : u.rangeKeys;
  const list = b.enemiesInKeys(sourceKeys, u, p);
  for (const e of b.blockedTargets(u, p)) if (!list.includes(e)) list.push(e);
  if (u.skill.active && u.skill.id === 'skchr_vvana_3') {
    const high = list.filter(elite), low = list.filter(e => !elite(e));
    sortEnemyTargets(b, u, high); sortEnemyTargets(b, u, low);
    return [...high, ...low].slice(0, 1);
  }
  sortEnemyTargets(b, u, list);
  const cap = u.skill.active && u.skill.id === 'skchr_vvana_2' ? Math.max(1, Math.floor(u.s.blockCnt)) : 1;
  return list.slice(0, cap);
}
function vivianaLaunch(b, u, p, target, info) {
  if (!canTargetEnemy(u, target, p)) return;
  const bb = u.def.skill.bb;
  let hits = 1, scale = p.atkScale ?? 1, stealing = false;
  if (info.isSkill && u.skill.id === 'skchr_vvana_1') {
    hits = u.mem.vivianaCharged ? 3 : 2; scale = bb.atk_scale;
  } else if (info.isSkill && u.skill.id === 'skchr_vvana_2') {
    if (u.mem.vivianaRoll?.attackId !== info.attackId) u.mem.vivianaRoll = {
      attackId: info.attackId, twice: b.rng() < bb['attack@prob_twice'] };
    if (u.mem.vivianaRoll.twice) { hits = 2; scale = bb['attack@atk_scale_twice']; stealing = true; }
  } else if (info.isSkill && u.skill.id === 'skchr_vvana_3') hits = u.mem.vivianaEnhanced ? 3 : 2;
  // Original waitAttackEventForAllAttacks=false/triggerDelta=0: full separately
  // mitigated strikes share the single release event, unlike event-separated kits.
  for (let index = 0; index < hits && target.alive; index++) {
    if (stealing) stealSpeed(b, u, target);
    resolveHit(b, u, { ...plain(p), atkScale: scale }, target, info, target.x, target.y);
  }
}
export function customizeGuardSixStarThirdKit({ battle: b, id, def, unit: u, kit }) {
  if (!GUARD_SIX_STAR_THIRD_OPERATORS[id]) return;
  kit.install = null; const s = def.skill, bb = s.bb;
  kit.trait = { attack: 'melee', dmgType: 'arts', projectile: 'none', hits: 1, hitsFn: null,
    chain: null, splashRadius: 0, maxTargets: 1, maxTargetsByBlock: false, allInRange: false,
    hitAllBlocked: false, canHitFly: false, retargetOnRelease: true, interruptOnSkillChange: true,
    install: null, launchAttack: vivianaLaunch, acquireTargets: vivianaTargets,
    attackVisual: (_b, unit) => vivianaClip(unit), windup: (_b, unit) => {
      const clip = vivianaClip(unit), cap = unit.skill.active && unit.skill.id === 'skchr_vvana_3' ? 1 : Infinity;
      return model(unit).hits[clip][0] / rate(unit, cap);
    }, afterAttack: (_b, unit, targets, metadata) => {
      if (s.id !== 'skchr_vvana_1') return;
      if (!targets.some(e => e.alive) && metadata.inputTargets.every(e => !e.alive)) {
        // The source recoverSpIfTargetDead flag precedes any output. A target
        // killed by the emitted strike is not a cancelled input.
        if (unit.mem.vivianaEmittedAttackId !== metadata.attackId) unit.skill.addCharge(unit.mem.vivianaSpentCharges);
      }
      syncCharge(b, unit);
    } };
  if (s.id === 'skchr_vvana_1') {
    const launch = kit.trait.launchAttack;
    kit.trait.launchAttack = (battle, unit, p, target, info) => {
      if (canTargetEnemy(unit, target, p)) unit.mem.vivianaEmittedAttackId = info.attackId;
      launch(battle, unit, p, target, info);
    };
    kit.skill = { kind: 'charges', charges: 2, trigger: { rule: 'DEFAULT' }, attack: {},
      onStart: () => {
        u.mem.vivianaCharged = u.skill.charges >= 1;
        u.mem.vivianaSpentCharges = u.mem.vivianaCharged ? 2 : 1;
        // ON_SKILL_START is on the full-charge mode buff. Only that mode
        // clears all stored SP; an ordinary one-charge cast keeps partial SP.
        if (u.mem.vivianaCharged) { u.skill.charges = 0; u.skill.sp = 0; }
        syncCharge(b, u); syncTalent(b, u);
      }, onEnd: () => { u.mem.vivianaCharged = false; syncCharge(b, u); syncTalent(b, u); } };
  } else if (s.id === 'skchr_vvana_2') kit.skill = { kind: 'duration', duration: s.duration,
    mods: { atkPct: bb.atk, defPct: bb.def, blockCnt: bb.block_cnt }, attack: {},
    onStart: () => { cleanupSteal(b, u); formStart(b, u, 'Skill_2_Begin', 'Skill_2_Idle'); syncTalent(b, u); },
    onEnd: ({ reason }) => { cleanupSteal(b, u); formEnd(b, u, 'Skill_2_End', reason); syncTalent(b, u); } };
  else kit.skill = { kind: 'duration', duration: s.duration,
    mods: { batFlat: bb.base_attack_time, atkPct: bb.atk, defPct: bb.def, resFlat: bb.magic_resistance }, attack: {},
    onStart: () => {
      u.mem.vivianaEnhanced = u.skill.activations > 1;
      u.skill.timeLeft = u.mem.vivianaEnhanced ? bb.enhance_duration : bb.duration_plus;
      if (u.mem.vivianaEnhanced) { u.skill.spec.targeting = { rangeGrid: evidence.ranges['3-2'] }; b._refreshRange(u); }
      else { u.skill.spec.targeting = null; b._refreshRange(u); }
      const letter = u.mem.vivianaEnhanced ? 'B' : 'A';
      formStart(b, u, `Skill_3_Begin_${letter}`, `Skill_3_Idle_${letter}`); syncTalent(b, u);
    }, onEnd: ({ reason }) => {
      formEnd(b, u, `Skill_3_End_${u.mem.vivianaEnhanced ? 'B' : 'A'}`, reason); syncTalent(b, u);
    } };
  kit.skill.id = s.id; kit.skill.name = s.name;
}
export function installGuardSixStarThird({ battle: b, unit: u, def }) {
  if (def.charId !== VIVIANA) return;
  u.mem.vivianaBaseRange = u.rangeGrid;
  u.mem.vivianaStealTargets = new Set(); u.mem.vivianaStolen = 0;
  const sync = () => { syncCharge(b, u); syncTalent(b, u);
    for (const e of u.mem.vivianaStealTargets) if (!live(e) || e.s.flags.untargetable)
      b.removeBuff(e, `viviana:steal:${u.id}`);
  };
  for (const event of ['tick', 'deploy', 'death', 'skillStart', 'skillEnd']) b.on(event, sync, { owner: u });
  b.on('damaged', ({ source, target, type }) => {
    const t = def.talents.find(t => t.bb.prob != null)?.bb;
    if (source !== u || target.side !== 'enemy' || !elite(target) || !live(u) || !t
      || type === 'element' || u.findBuff('viviana:nova')) return;
    const chance = t.prob * (u.skill.active && u.skill.id === 'skchr_vvana_3' ? def.skill.bb.talent_scale : 1);
    if (b.rng() < chance) b.addBuff(u, { key: 'viviana:nova', source: u, shieldHits: 1,
      shieldApplyWays: ['melee'], shieldSourceSides: ['enemy'] });
  }, { owner: u });
  sync();
}
