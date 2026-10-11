// SPDX-License-Identifier: GPL-3.0-or-later
import evidence from '../../../data/arkpedia-nian-prefabs.json' with { type: 'json' };
import { acquireTargets, resolveHit } from '../ai.js';
import { canTargetEnemy, absoluteRangeKeys } from '../targeting.js';
import { bodyInKeys } from '../body.js';
import { isHpLoss } from '../damage.js';
const ID = 'char_2014_nian';
const live = u => u?.alive && u.deployed && !u.hidden;
const model = u => evidence.models[ID][['UP', 'LEFT'].includes(u.dir) ? 'Back' : 'Front'];
const skill = (u, n) => u.skill.active && u.skill.id === `skchr_nian_${n}`;
const rate = u => Math.min(skill(u, 3) ? 1 : 2, u.base.bat / u.s.interval);
/** A named contribution in the existing additive HP bucket, including bench and
 * support. Source deck selector4 is DEFENDER (normalized record profession TANK); no token or placement aura is used. */
export function prepareNianSquad(records) {
  const pct = Math.max(0, ...Object.values(records).filter(r => r.charId === ID)
    .flatMap(r => r.talents.filter(t => t.bb.max_hp != null).map(t => t.bb.max_hp)));
  for (const r of Object.values(records)) {
    const old = r.arkpedia.nianSquadHpPct ?? 0;
    const next = r.profession === 'TANK' ? pct : 0;
    if (old === next) continue;
    r.arkpedia.modifiers.hpPct = (r.arkpedia.modifiers.hpPct ?? 0) + next - old;
    r.arkpedia.nianSquadHpPct = next;
  }
}
function windup(b, u) {
  if (['Attack_End', 'Skill_2_End'].includes(u.mem.regularFormVisual?.clip)) u.mem.regularFormVisual = null;
  const name = skill(u, 3) ? 'Skill_2_Loop' : 'Attack_Loop';
  const opening = !skill(u, 3) && !u.mem.nianEngaged;
  u.mem.nianOpening = opening; u.mem.nianClip = name;
  u.mem.nianBeginDuration = opening ? model(u).durations.Attack_Begin / rate(u) : 0;
  u.mem.nianEngaged = true;
  u.mem.nianAnimationEnd = b.time + u.mem.nianBeginDuration + model(u).durations[name] / rate(u);
  return u.mem.nianBeginDuration + model(u).hits[name][0] / rate(u);
}
function visual(_b, u) {
  return u.mem.nianOpening ? { begin: 'Attack_Begin', loop: u.mem.nianClip,
    beginDuration: u.mem.nianBeginDuration } : u.mem.nianClip;
}
function launch(b, u, p, e, info) {
  if (!canTargetEnemy(u, e, p)) return;
  // Source switch_mode (S1) does not restart FSM. A retained pending release
  // evaluates the current ordinary/Arts mode, rather than its cached profile.
  resolveHit(b, u, { ...p, dmgType: skill(u, 1) ? 'arts' : 'phys' }, e,
    { ...info, isSkill: skill(u, 1) || skill(u, 3) }, e.x, e.y);
}
function syncAura(b) {
  for (const a of b.allyUnits) {
    let producer;
    for (const u of b.nianAuraProducers ?? []) {
      const legal = live(u) && skill(u, 3) && live(a) && a !== u && a.kind === 'op'
        && !a.s.flags.untargetable && b.allySelectable(a, u)
        && bodyInKeys(a, absoluteRangeKeys(evidence.ranges['x-2'], u.tileR, u.tileC, 'RIGHT'));
      if (legal && (!producer || u.skill.bb['nian_s_3[ally].def'] > producer.skill.bb['nian_s_3[ally].def'])) producer = u;
    }
    const statKey = 'nian_s_3[ally]', resistKey = 'nian:status-resistance';
    const old = a.findBuff(statKey), resist = a.findBuff(resistKey);
    if (!producer) { b.removeBuff(a, statKey); b.removeBuff(a, resistKey); continue; }
    const bb = producer.skill.bb, defPct = bb['nian_s_3[ally].def'];
    if (old?.source !== producer || old?.mods.defPct !== defPct)
      b.addBuff(a, { key: statKey, source: producer,
        mods: { defPct, blockCnt: bb['nian_s_3[ally].block_cnt'] } });
    if (resist?.source !== producer || resist?.data.value !== -bb.one_minus_status_resistance)
      b.applyStatus(a, 'resist', { key: resistKey, source: producer,
        value: -bb.one_minus_status_resistance });
  }
}
export function customizeNianKit({ battle: b, id, def, unit: u, kit }) {
  if (id !== ID) return;
  kit.install = null; kit.talents = [];
  kit.trait = { attack: 'melee', dmgType: 'phys', projectile: 'none', canHitFly: false,
    maxTargets: 1, maxTargetsByBlock: false, hitAllBlocked: false, allInRange: false,
    hits: 1, hitsFn: null, splashRadius: 0, chain: null, dmgMul: null,
    retargetOnRelease: true, windup, attackVisual: visual, launchAttack: launch,
    attackEpoch: (_b, unit) => unit.mem.nianModeEpoch ?? 0 };
  const s = def.skill, bb = s.bb, n = Number(s.id.at(-1));
  kit.skill = { id: s.id, name: s.name, kind: 'duration', duration: s.duration,
    mods: n === 1 ? { atkPct: bb.atk, defPct: bb.def }
      : n === 2 ? { defPct: bb.def, blockCnt: bb.block_cnt }
      : { atkPct: bb['nian_s_3[self].atk'], blockCnt: bb['nian_s_3[self].block_cnt'] },
    attack: n === 2 ? { noAttack: true } : {},
    flags: n === 2 ? { disarm: true } : {},
    onStart: () => {
      if (n !== 1) { u.mem.nianModeEpoch = (u.mem.nianModeEpoch ?? 0) + 1; u.mem.nianEngaged = false; }
      if (n === 3) {
        const activation = u.skill.activations, seq = u.deploySeq;
        u.mem.regularFormVisual = { clip: 'Skill_2_Begin', loop: false };
        const duration = model(u).durations.Skill_2_Begin;
        b.addBuff(u, { key: 'nian:s3-begin', source: u, duration, flags: { disarm: true } });
        b.after(duration, () => {
          if (live(u) && skill(u, 3) && u.skill.activations === activation && u.deploySeq === seq)
            u.mem.regularFormVisual = { clip: 'Skill_2_Idle', loop: true };
        }, { owner: u });
        syncAura(b);
      }
    },
    onEnd: () => {
      if (n !== 1) { u.mem.nianModeEpoch = (u.mem.nianModeEpoch ?? 0) + 1; u.mem.nianEngaged = false; }
      b.removeBuff(u, 'nian:s3-begin');
      u.mem.regularFormVisual = n === 3 ? { clip: 'Skill_2_End', loop: false } : null;
      if (n === 3) {
        syncAura(b);
        const seq = u.deploySeq, activation = u.skill.activations;
        b.after(model(u).durations.Skill_2_End, () => {
          if (u.deploySeq === seq && u.skill.activations === activation && !skill(u, 3)
            && u.mem.regularFormVisual?.clip === 'Skill_2_End') u.mem.regularFormVisual = null;
        }, { owner: u });
      }
    } };
}
export function installNian({ battle: b, unit: u, def }) {
  if (def.charId !== ID) return;
  u.mem.nianEngaged = false; u.mem.nianModeEpoch = 0;
  b.nianAuraProducers ??= new Set(); b.nianAuraProducers.add(u);
  const t = def.talents.find(t => t.bb.times != null)?.bb;
  b.on('deploy', ({ unit }) => {
    if (unit === u && t) b.addBuff(u, { key: 'nian_t_2', source: u, shieldHits: t.times });
    syncAura(b);
  }, { owner: u });
  b.on('hit', ({ source, target, dmg }) => {
    if (target !== u || !live(u) || !skill(u, 2) || source?.side !== 'enemy'
      || !source.alive || isHpLoss(dmg) || dmg.type === 'element') return;
    // Literal inverse_damage[magic] has NORMAL/hasSource1/skipSourceEvent0,
    // filterModifierCancelled0. Pre-receipt is a scoped native-event mapping;
    // no arbitrary IsAttack predicate or source-less counter is introduced.
    b.dealDamage(u, source, { amount: u.s.atk * u.skill.bb.atk_scale,
      type: 'arts', applyWay: 'none', isAttack: true, isSkill: true,
      canDodge: false, attackId: ++b._attackSeq, tags: ['nian:inverse'] });
    if (canTargetEnemy(u, source, { canHitFly: true }))
      b.applyStatus(source, 'silence', { source: u, duration: u.skill.bb.silence });
  }, { owner: u });
  b.on('tick', () => {
    syncAura(b);
    if (u.mem.nianEngaged && !skill(u, 2) && !skill(u, 3)
      && b.time >= u.mem.nianAnimationEnd && !acquireTargets(b, u, u.profile).length) {
      u.mem.nianEngaged = false;
      u.mem.regularFormVisual = { clip: 'Attack_End', loop: false };
      const seq = u.deploySeq;
      b.after(model(u).durations.Attack_End / rate(u), () => {
        if (u.deploySeq === seq && !u.mem.nianEngaged && u.mem.regularFormVisual?.clip === 'Attack_End')
          u.mem.regularFormVisual = null;
      }, { owner: u });
    }
  }, { owner: u });
  b.on('death', ({ unit }) => {
    if (unit !== u) return;
    b.nianAuraProducers.delete(u); syncAura(b);
  }, { owner: u });
}
