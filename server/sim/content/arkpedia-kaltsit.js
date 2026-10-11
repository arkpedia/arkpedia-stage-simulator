// SPDX-License-Identifier: GPL-3.0-or-later
// Original owner/token graphs, byte bindings and dispatcher limits are retained
// together in data/arkpedia-kaltsit-prefabs.json.
import evidence from '../../../data/arkpedia-kaltsit-prefabs.json' with { type: 'json' };
import { bodyInKeys } from '../body.js';
import { absoluteRangeKeys } from '../targeting.js';
import { applyHpLoss, makeDamageInfo } from '../damage.js';

const OWNER = 'char_003_kalts', TOKEN = 'token_10002_kalts_mon3tr';
const live = u => u?.alive && u.deployed && !u.hidden;
const own = (u, t) => t?.ownerUnit === u && t.defId === TOKEN;
const ownedTokens = (b, u) => b.allyUnits.filter(t => own(u, t) && t.alive && t.deployed);
const validToken = (b, u) => ownedTokens(b, u)[0];
const tokenModel = evidence.models[TOKEN];
const ownerModel = u => evidence.models[OWNER][['UP', 'LEFT'].includes(u.dir) ? 'Back' : 'Front'];
const rate = u => Math.min(1, u.s.aspd / 100);
const tokenMode = u => u.mem.kaltsitMode ?? 0;
const clip = u => ['Attack', 'Skill', 'Skill_2'][tokenMode(u)];
const selectable = (b, u, t) => live(t) && !t.s.flags.untargetable && b.allySelectable(t, u);
const healable = (b, u, t) => selectable(b, u, t) && t.kind !== 'device'
  && !(t.s.flags.noHeal || t.profile?.noHeal)
  && (!t.s.flags.healFree || own(u, t));

function healTargets(b, u) {
  const targets = b.allyUnits.filter(t => healable(b, u, t)
    && bodyInKeys(t, u.rangeKeySet) && t.hp < t.s.maxHp - .01);
  // Source postFilter64 is not the generic low-HP selector. Original talent
  // explicitly prioritizes the source and its own Mon3tr before other allies.
  targets.sort((a, z) => Number(!(a === u || own(u, a))) - Number(!(z === u || own(u, z)))
    || a.hpRatio - z.hpRatio || a.deploySeq - z.deploySeq);
  return targets.slice(0, 1);
}

function setMode(t, mode) {
  if (tokenMode(t) === mode) return;
  t.mem.kaltsitMode = mode;
  t.mem.kaltsitAttackEpoch = (t.mem.kaltsitAttackEpoch ?? 0) + 1;
  t.profile.maxTargetsByBlock = mode === 1;
  t.profile.dmgType = mode === 2 ? 'true' : 'phys';
  t.profile.isSkill = mode > 0;
}

function finishTrueMode(b, t, applyPenalty) {
  const active = t.mem.kaltsitTrueMode;
  if (!active) return;
  t.mem.kaltsitTrueMode = null;
  const missedKill = !!t.findBuff('kalts_s_3[no_kill_mark]');
  b.removeBuff(t, 'kalts_s_3[ratio_atk]');
  b.removeBuff(t, 'kalts_s_3[no_kill_mark]');
  if (!applyPenalty || !live(t) || !missedKill) return;
  const amount = t.s.maxHp * active.hpRatio;
  // This native DamageViaMaxHpRatio is PURE/NORMAL, not HPLOSS. It skips the
  // modifier path, yet remains a received attack with ignoreForSp:false. Shared
  // fatal/undeadable safeguards remain explicit limits of this direct path.
  applyHpLoss(b, t, t, amount, makeDamageInfo({ amount, type: 'true',
    isAttack: true, isSkill: true, canDodge: false, noSp: false,
    applyWay: 'none', tags: ['kalts_s_3:finish'] }));
}

function syncToken(b, u, t, { suppressPenalty = false } = {}) {
  if (!t.alive || !t.deployed) return;
  const eligible = live(u) && selectable(b, u, t);
  const inRange = eligible && bodyInKeys(t, u.rangeKeySet);
  if (inRange) b.removeBuff(t, 'kalts_t_1[def_zero]');
  else if (!t.findBuff('kalts_t_1[def_zero]'))
    b.addBuff(t, { key: 'kalts_t_1[def_zero]', source: u, mods: { defMul: 0 } });

  const selected = u.skill?.active && eligible ? Number(u.skill.id.at(-1)) : 0;
  const bb = u.skill?.bb ?? {};
  const s1 = selected === 1 && inRange;
  if (s1) {
    if (!t.findBuff('kalts_s_1[token_eff]'))
      b.addBuff(t, { key: 'kalts_s_1[token_eff]', source: u, mods: { defPct: bb['attack@def'] } });
  } else b.removeBuff(t, 'kalts_s_1[token_eff]');
  if (selected === 2) {
    if (!t.findBuff('kalts_s_2[token_eff]'))
      b.addBuff(t, { key: 'kalts_s_2[token_eff]', source: u, mods: { atkPct: bb['attack@atk'] } });
  } else b.removeBuff(t, 'kalts_s_2[token_eff]');

  if (selected === 3) {
    if (!t.findBuff('kalts_s_3[token_eff]'))
      b.addBuff(t, { key: 'kalts_s_3[token_eff]', source: u, mods: { defPct: bb['attack@def'] } });
    if (!t.mem.kaltsitTrueMode) {
      t.mem.kaltsitTrueMode = { owner: u, activation: u.skill.activations,
        duration: u.skill.duration, hpRatio: bb['attack@hp_ratio'], next: b.time + 1 };
      b.addBuff(t, { key: 'kalts_s_3[no_kill_mark]', source: u });
      b.addBuff(t, { key: 'kalts_s_3[ratio_atk]', source: u, mods: { atkPct: bb['attack@atk'] } });
    } else if (b.time >= t.mem.kaltsitTrueMode.next - 1e-9) {
      const active = t.mem.kaltsitTrueMode;
      active.next += 1;
      const remaining = Math.max(0, u.skill.duration - (b.time - u.skill.lastStart));
      b.addBuff(t, { key: 'kalts_s_3[ratio_atk]', source: u,
        mods: { atkPct: bb['attack@atk'] * remaining / active.duration } });
    }
  } else {
    b.removeBuff(t, 'kalts_s_3[token_eff]');
    finishTrueMode(b, t, !suppressPenalty);
  }
  setMode(t, selected === 2 ? 1 : selected === 3 ? 2 : 0);
}

function syncOwner(b, u, options) {
  for (const t of ownedTokens(b, u)) syncToken(b, u, t, options);
}

function checkBinding(b, u) {
  if (!live(u) || u.skill.id === 'skchr_kalts_1') return;
  if (validToken(b, u)) { b.removeBuff(u, 'kalts_s_2_3[clear]'); return; }
  if (u.skill.active) u.skill.end('token-removed');
  u.skill.sp = 0; u.skill.charges = 0;
  if (!u.findBuff('kalts_s_2_3[clear]'))
    b.addBuff(u, { key: 'kalts_s_2_3[clear]', flags: { noSp: true } });
}

export function customizeKaltsitKit({ battle: b, id, def, unit: u, kit }) {
  if (id !== OWNER) return;
  kit.install = null;
  kit.trait = { attack: 'ranged', dmgType: 'heal', projectile: 'none',
    maxTargets: 1, hitAllBlocked: false, hits: 1, install: null,
    retargetOnRelease: true, interruptOnSkillChange: true, attackVisual: 'Attack',
    windup: (_b, unit) => ownerModel(unit).hits.Attack[0] / rate(unit),
    acquireTargets: healTargets, healProjectileSpeed: 5,
    heal: { mode: 'single',
      ignoreHealFree: (_b, owner, target) => own(owner, target) && healable(_b, owner, target),
      scaleForTarget: (_b, owner, target) => healable(_b, owner, target) ? 1 : 0 },
  };
  const s = def.skill, first = s.id.endsWith('_1'), second = s.id.endsWith('_2');
  kit.skill = { id: s.id, name: s.name, kind: 'duration', duration: s.duration,
    canActivate: () => u.canAct && !u.s.flags.disarm && (first || !!validToken(b, u)),
    mods: first ? { defPct: s.bb.def } : second ? { aspd: s.bb.attack_speed } : {},
    onStart: () => syncOwner(b, u), onTick: () => syncOwner(b, u),
    onEnd: ({ reason }) => syncOwner(b, u, { suppressPenalty: reason === 'death' || !live(u) }),
  };
  u.mem.summonSkillSync = () => syncOwner(b, u);
}

export function installKaltsit({ battle: b, unit: u, def }) {
  if (def.charId !== OWNER) return;
  b.every(b.dt, () => syncOwner(b, u), { owner: u });
  // Native SP condition explicitly delays the first check by .1s. Membership
  // changes do not restart this owner clock; every failed check clears SP.
  b.every(.1, () => checkBinding(b, u), { owner: u });
  b.on('deploy', ({ unit }) => {
    if (unit === u) {
      // Native kalts_t_1[charge] charges one original card at owner birth.
      // Shared stockLimit1 deliberately begins empty until this exact hook.
      const state = b.regularSummons?.get(`summon:${OWNER}`);
      if (state?.owner === u) state.stock = Math.min(1, def.talents[0].bb.cnt);
    }
    if (live(u)) syncOwner(b, u);
  }, { owner: u });
  b.on('hit', ctx => {
    if (ctx.target !== u || !live(u) || !u.skill.active || u.skill.id !== 'skchr_kalts_1'
      || ctx.dmg.cancel) return;
    const succeeds = b.rng() < u.skill.bb.prob;
    if (succeeds && ctx.dmg.type === 'phys') ctx.dmg.cancel = true;
  }, { owner: u });
}

function deathBlast(b, t, reason) {
  const talent = t.def.talents[1];
  if (reason !== 'killed' || !talent?.bb.value || !talent.rangeGrid?.length) return;
  const keys = absoluteRangeKeys(talent.rangeGrid, t.tileR, t.tileC, t.dir);
  // No Movement/event is serialized. The explicit lifetime1/end reach is a
  // bounded arrival clock; it is not claimed to recover initial-reached C#.
  b.after(1, () => {
    for (const e of b.enemiesInKeys(keys, t, { canHitFly: true })) {
      b.dealDamage(t, e, { amount: talent.bb.value, type: 'true', canDodge: false,
        isAttack: true, isSkill: false, isSplash: true, applyWay: 'none',
        tags: ['kalts_t_2:death'] });
      if (live(e)) b.applyStatus(e, 'stun', { source: t, duration: talent.bb.stun });
    }
  }); // emitted native projectile is not managed by the removed source
}

/** Root summon factory calls this only for the reviewed original token record.
 * Root retains shared placement, card cost/stock/slots and UI ownership. */
export function createKaltsitMon3tr(b, state, row, col, dir) {
  if (state.record.id !== TOKEN || !state.record.talents[0])
    throw Error('Missing reviewed Mon3tr source');
  const owner = state.owner;
  // Shared legacy abnormal:['healFree'] also sets global noHeal. This exact
  // source token instead holds explicit HealFree, bypassable only by its owner.
  const raw = { ...state.record, abnormal: [] };
  const kit = { skill: null,
    trait: { attack: 'melee', dmgType: 'phys', projectile: 'none', canHitFly: false,
      maxTargets: 1, hitAllBlocked: false, hits: 1, install: null,
      retargetOnRelease: true, attackEpoch: (_b, t) => t.mem.kaltsitAttackEpoch ?? 0,
      windup: (_b, t) => tokenModel.hits[clip(t)][0] / rate(t),
      attackVisual: (_b, t) => clip(t) },
    install: (battle, t) => {
      t.mem.skillOwner = owner;
      battle.addBuff(t, { key: 'mon3tr_c_healfree', flags: { healFree: true },
        persist: true, allowDead: true });
      battle.on('kill', ({ killer, victim }) => {
        if (killer === t && victim.side === 'enemy') battle.removeBuff(t, 'kalts_s_3[no_kill_mark]');
      }, { owner: t });
      battle.on('deploy', ({ unit }) => { if (unit === t) syncToken(battle, owner, t); }, { owner: t });
      battle.on('death', ({ unit, reason }) => {
        if (unit !== t) return;
        t.mem.kaltsitTrueMode = null;
        state.stock = Math.min(1, state.stock + 1);
        state.readyAt = battle.time + state.record.stats.respawnTime;
        deathBlast(battle, t, reason);
      }, { owner: t });
    },
  };
  return b.spawnToken(owner, TOKEN, row, col, { dir, def: raw, kit });
}
