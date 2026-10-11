// SPDX-License-Identifier: GPL-3.0-or-later
// Original native graphs and explicitly bounded dispatcher interpretations are
// preserved together in data/arkpedia-blacknight-prefabs.json.
import evidence from '../../../data/arkpedia-blacknight-prefabs.json' with { type: 'json' };
import { absoluteRangeKeys, canTargetEnemy, sortEnemyTargets } from '../targeting.js';
import { bodyInKeys } from '../body.js';
import { resolveHit } from '../ai.js';

const ID = 'char_476_blkngt', TOKEN = 'token_10021_blkngt_hypnos';
const live = u => u?.alive && u.deployed && !u.hidden;
const present = u => u?.alive && u.deployed;
const owned = (b, u) => b.allyUnits.filter(t => t.ownerUnit === u && t.defId === TOKEN && present(t));
const model = u => evidence.models[ID][['UP', 'LEFT'].includes(u.dir) ? 'Back' : 'Front'];
const tokenModel = evidence.models[TOKEN];
const rate = (u, cap = 1) => Math.min(cap, u.base.bat / u.s.interval);
const keys = (u, id) => absoluteRangeKeys(evidence.ranges[id].grids.map(p => [p.row, p.col]), u.tileR, u.tileC, 'RIGHT');
const INACTIVE = 'blkngt:inactive', BLOCK = 'blkngt_hypnos_t_1[block_cnt]';
const SLEEP = 'blkngt_hypnos_s_1[sleep]', HEAL = 'blkngt_hypnos_s_1[heal]';
const RAGE = 'blkngt_hypnos_s_1[rage]', AREA = 'blkngt_hypnos_s_2[atk_scale]';
const enemyProfile = { canHitFly: false, hitSleep: true };

function candidates(b, t) {
  const list = b.enemies.filter(e => canTargetEnemy(t, e, enemyProfile)
    && (bodyInKeys(e, keys(t, 'x-5')) || e.blockedBy === t));
  sortEnemyTargets(b, t, list);
  // Source postFilter29 / SLEEPING exception gives sleeping priority. The
  // numeric filter dispatcher and block-vs-special priority remain bounded.
  list.sort((a, z) => Number(!!z.s.flags.sleep) - Number(!!a.s.flags.sleep));
  return list;
}
function setMode(b, t, mode) {
  t.mem.blacknightMode = mode; t.mem.blacknightModeEpoch++;
  t.atkCd = 0;
  if (mode === 0) return;
  if (mode === 2) t.mem.regularFormVisual = { clip: 'Skill_Loop', loop: true, attack: null, die: 'Die_1' };
  else t.mem.regularFormVisual = { clip: 'Idle_1', loop: true, attack: mode === 3 ? 'Skill_2' : 'Attack', die: 'Die_1' };
}
function clearCast(b, u, cast) {
  if (u.mem.blacknightCast !== cast) return;
  u.mem.blacknightCast = null; u.mem.regularFormVisual = null; b.removeBuff(u, 'blkngt:cast');
}
function sleepPoint(b, t, bb, duration) {
  if (t.mem.blacknightMode === 0 || t.mem.blacknightMode === 'warming') return;
  b.removeBuff(t, RAGE);
  b.addBuff(t, { key: HEAL, source: t.ownerUnit, duration,
    mods: { hpRegenRatio: bb.hp_recovery_per_sec_by_max_hp_ratio } });
  b.addBuff(t, { key: SLEEP, source: t.ownerUnit, data: { ...bb },
    onRemove: () => b.removeBuff(t, HEAL) });
  // Native mode2 has no invulnerable/SLEEPING flag: it keeps blocking and can
  // take damage. The separate INFINITY wrapper survives the 10-second regen.
  setMode(b, t, 2);
}
function areaPoint(b, t, bb) {
  const duration = bb['blkngt_s_2.duration'];
  for (const e of b.enemies) {
    // Purpose0 WALK sleep pulse includes existing sleepers, not attack-specific
    // immunity; default target-free and hidden restrictions stay scoped.
    if (live(e) && !e.isFlying && !e.s.flags.untargetable && bodyInKeys(e, keys(t, 'x-5')))
      b.applyStatus(e, 'sleep', { key: `blkngt:sleep:${t.id}`, source: t, duration });
  }
  b.addBuff(t, { key: AREA, source: t.ownerUnit, duration,
    data: { atkScale: bb['blkngt_s_2.atk_scale'] },
    onExpire: () => {
      if (present(t) && t.mem.blacknightMode !== 0 && t.mem.blacknightMode !== 'warming') setMode(b, t, 1);
    } });
  if (t.mem.blacknightMode !== 0 && t.mem.blacknightMode !== 'warming') setMode(b, t, 3);
}
function command(b, u, s, first) {
  const clip = first ? 'Skill_1' : 'Skill_2', cast = {}, seq = u.deploySeq, activation = u.skill.activations;
  const release = model(u).hits[clip][0], tail = model(u).durations[clip];
  u.mem.blacknightCast = cast; u.mem.regularFormVisual = { clip, loop: false };
  b.addBuff(u, { key: 'blkngt:cast', duration: tail, flags: { disarm: true, noSp: true } });
  const epoch = u.attackControlEpoch; // capture after the cast's own disarm
  const valid = () => live(u) && u.canAct && u.deploySeq === seq && u.skill.activations === activation
    && u.attackControlEpoch === epoch && u.mem.blacknightCast === cast;
  const watch = b.every(b.dt, () => { if (!valid()) { clearCast(b, u, cast); watch.cancel(); } }, { owner: u });
  b.after(release, () => {
    if (!valid()) return;
    b.addDp(u.ownerId, s.bb.cost);
    for (const t of owned(b, u)) first ? sleepPoint(b, t, s.bb, s.duration) : areaPoint(b, t, s.bb);
  }, { owner: u });
  b.after(tail, () => { watch.cancel(); clearCast(b, u, cast); }, { owner: u });
}

export function customizeBlacknightKit({ battle: b, id, def, unit: u, kit }) {
  if (id !== ID) return;
  kit.install = null;
  kit.trait = { attack: 'ranged', dmgType: 'phys', projectile: 'arrow', projectileSpeed: 10,
    canHitFly: true, maxTargets: 1, hits: 1, hitAllBlocked: false, install: null,
    retargetOnRelease: true, attackVisual: 'Attack',
    windup: (_b, a) => model(a).hits.Attack[0] / rate(a, 2),
    launchAttack: (battle, a, profile, target, info) => {
      if (!canTargetEnemy(a, target, profile)) return;
      // Native unmanaged flight/stopWhenSourceInvalid0 remains independent of
      // the owner's later control or removal. The shared projectile system
      // preserves the launched target object/deployment identity; no extra
      // ability INPUT snapshot or range check is invented at impact.
      battle.addProjectile({ from: a, target, source: a, speed: 10, maxAge: 5,
        visual: 'arrow', data: { arkpediaTrackedVisual: true },
        onHit: ({ target: e }) => {
          if (e && canTargetEnemy(a, e, profile)) resolveHit(battle, a, profile, e,
            { ...info, isProjectile: true }, e.x, e.y);
        } });
    } };
  const s = def.skill, first = s.id === 'skchr_blkngt_1';
  kit.skill = { id: s.id, name: s.name, kind: first ? 'duration' : 'instant', duration: s.duration,
    canActivate: () => !u.mem.blacknightCast,
    onStart: () => command(b, u, s, first) };
}
export function installBlacknight({ battle: b, unit: u, def }) {
  if (def.charId !== ID) return;
  b.on('deploy', ({ unit }) => {
    if (unit !== u) return;
    const state = b.regularSummons?.get(`summon:${ID}`);
    if (state?.owner !== u || def.talents[0]?.bb.cnt !== 1) throw Error('Missing Blacknight born stock source');
    state.stock = 1;
  }, { owner: u });
  b.on('hit', ctx => {
    // Native ON_CALCULATE_DAMAGE has CheckBlockedBySourceToken and no IsAttack
    // filter. Only this owner's damage to enemies blocked by its actual token
    // receives the source ATK scale before DEF.
    if (ctx.source === u && ctx.target.blockedBy?.ownerUnit === u
      && ctx.target.blockedBy.defId === TOKEN) ctx.dmg.amount *= def.traitBb.atk_scale;
  }, { owner: u });
  b.on('death', ({ unit }) => { if (unit === u) clearCast(b, u, u.mem.blacknightCast); }, { owner: u });
}

export function createSlumberfoot(b, state, row, col) {
  if (state.record.id !== TOKEN || !(state.record.talents[0]?.bb.interval > 0)
    || state.record.talents[0].bb.block_cnt !== 1) throw Error('Missing reviewed Slumberfoot source');
  const profile = { attack: 'melee', dmgType: 'phys', projectile: 'none', canHitFly: false,
    maxTargets: 1, hitAllBlocked: false, hits: 1, install: null, hitSleep: true,
    canAttack: (_b, t) => t.mem.blacknightMode === 1 || t.mem.blacknightMode === 3,
    acquireTargets: (battle, t) => candidates(battle, t).slice(0, 1),
    retargetOnRelease: false,
    attackEpoch: (_b, t) => t.mem.blacknightModeEpoch,
    attackVisual: (_b, t) => t.mem.blacknightMode === 3 ? 'Skill_2' : 'Attack',
    windup: (battle, t, inputs) => {
      const input = inputs[0], mode = t.mem.blacknightMode;
      const targets = mode === 3 ? battle.enemies.filter(e => canTargetEnemy(t, e, enemyProfile)
        && Math.hypot(e.x - input.x, e.y - input.y) <= evidence.runtimeTiming.areaRadius + 1e-9) : [];
      if (mode === 3 && !targets.includes(input)) targets.push(input);
      const attackId = battle._attackSeq;
      t.mem.blacknightAttacks.set(attackId, { mode, x: input.x, y: input.y,
        targets: targets.map(e => ({ unit: e, seq: e.deploySeq })) });
      // Canceled attacks never reach launchAttack; bound their retained metadata
      // independently so repeated interrupted attacks cannot leak target refs.
      battle.after(.5 / rate(t) + battle.dt, () => t.mem.blacknightAttacks.delete(attackId), { owner: t });
      return .5 / rate(t);
    },
    launchAttack: (battle, t, _p, input, info) => {
      const shot = t.mem.blacknightAttacks.get(info.attackId);
      if (!shot) return;
      if (shot.mode === 3) {
        // Source INPUT1 fixes recipients at startup. source3 is represented by
        // this explicitly bounded input-position circle, never a token-centered
        // splash or CAST0 reacquisition. Current legal deployment is checked.
        for (const { unit: e, seq } of shot.targets) if (e.deploySeq === seq && canTargetEnemy(t, e, enemyProfile))
          resolveHit(battle, t, { attack: 'melee', dmgType: 'arts', projectile: 'none', hitSleep: true,
            canHitFly: false, hits: 1 }, e, { ...info, isSkill: true }, e.x, e.y);
      } else {
        // Ordinary native CAST0 reacquires the sleeping-priority first victim at
        // its .5 event, rather than carrying the initial trigger INPUT forever.
        const e = candidates(battle, t)[0];
        if (e) resolveHit(battle, t, { attack: 'melee', dmgType: 'phys', projectile: 'none', hitSleep: true,
          canHitFly: false, hits: 1 }, e, info, e.x, e.y);
      }
      t.mem.blacknightAttacks.delete(info.attackId);
    } };
  const t = b.spawnToken(state.owner, TOKEN, row, col, { dir: 'RIGHT', def: state.record,
    kit: { skill: null, trait: profile,
      install: (battle, token) => battle.addBuff(token, { key: 'hypnos_healfree',
        flags: { healFree: true }, persist: true, allowDead: true }) } });
  if (!t) return null;
  t.deploymentSlotCost = 0; t.mem.regularSummonCard = state.key;
  t.mem.blacknightMode = 0; t.mem.blacknightModeEpoch = 0; t.mem.blacknightGeneration = 0;
  t.mem.blacknightAttacks = new Map();
  const inactive = () => b.addBuff(t, { key: INACTIVE, flags: { invulnerable: true, untargetable: true,
    isolated: true, noHeal: true, noSp: true, disarm: true }, mods: { blockCntMul: 0 } });
  const activate = () => {
    if (!present(t) || !present(state.owner)) return;
    b.removeBuff(t, INACTIVE); t.hp = t.s.maxHp;
    b.addBuff(t, { key: BLOCK, mods: { blockCnt: state.record.talents[0].bb.block_cnt } });
    setMode(b, t, t.findBuff(AREA) ? 3 : 1);
  };
  const warm = () => {
    if (!present(t) || !present(state.owner)) return;
    const generation = ++t.mem.blacknightGeneration;
    t.mem.blacknightMode = 'warming'; t.mem.blacknightModeEpoch++;
    t.mem.blacknightReadyAt = b.time + 1;
    t.mem.regularFormVisual = { clip: 'Start', loop: false, die: 'Die_2' };
    b.after(1, () => { if (generation === t.mem.blacknightGeneration) activate(); }, { owner: t });
  };
  const rest = () => {
    if (!present(t) || t.mem.blacknightMode === 0 || t.mem.blacknightMode === 'warming') return;
    const generation = ++t.mem.blacknightGeneration;
    t.mem.blacknightMode = 0; t.mem.blacknightModeEpoch++;
    t.hp = 1; t.mem.blacknightAttacks.clear();
    for (const buff of t.buffs.slice()) if (!buff.persist && ![AREA, RAGE].includes(buff.key)) b.removeBuff(t, buff);
    b.releaseBlocked(t); inactive();
    t.mem.regularFormVisual = { clip: 'Die_1', loop: false, die: 'Die_2' };
    t.mem.blacknightReadyAt = b.time + state.record.talents[0].bb.interval + 1;
    b.after(tokenModel.durations.Die_1, () => {
      if (present(t) && generation === t.mem.blacknightGeneration)
        t.mem.regularFormVisual = { clip: 'Idle_2', loop: true, die: 'Die_2' };
    }, { owner: t });
    b.after(state.record.talents[0].bb.interval, () => {
      if (present(t) && generation === t.mem.blacknightGeneration) warm();
    }, { owner: t });
  };
  // Narrow reuse of the regular tactical-point retreat contract. The callback
  // is our native persistent rest, never the Beanstalk factory or skill logic.
  t.mem.metalCrabRest = rest;
  b.on('fatal', ctx => {
    if (ctx.unit === t && t.mem.blacknightMode !== 0 && t.mem.blacknightMode !== 'warming') {
      ctx.prevented = true; rest();
    }
  }, { owner: t });
  b.on('hit', ctx => {
    if (ctx.source === t && ctx.target.s.flags.sleep && t.findBuff(AREA))
      ctx.dmg.amount *= t.findBuff(AREA).data.atkScale;
  }, { owner: t });
  b.on('damageFinal', ctx => {
    const asleep = t.findBuff(SLEEP);
    if (ctx.target !== t || !asleep || !(ctx.amount > 0)) return;
    const survivable = ctx.amount <= t.hp + 1e-9;
    b.removeBuff(t, SLEEP); // also ends the independent regen source
    if (!survivable || t.mem.blacknightMode === 0 || t.mem.blacknightMode === 'warming') return;
    setMode(b, t, 1);
    b.addBuff(t, { key: RAGE, source: t.ownerUnit,
      duration: asleep.data['blkngt_hypnos_s_1[rage].duration'],
      mods: { atkPct: asleep.data['blkngt_hypnos_s_1[rage].atk'],
        aspd: t.base.aspd * asleep.data['blkngt_hypnos_s_1[rage].attack_speed'] } });
  }, { owner: t });
  inactive(); warm();
  return t;
}
