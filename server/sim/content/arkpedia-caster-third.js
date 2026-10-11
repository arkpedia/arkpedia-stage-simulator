// SPDX-License-Identifier: GPL-3.0-or-later
import { CASTER_THIRD_OPERATORS } from '../../../shared/arkpedia/caster-third-operators.js';
import evidence from '../../../data/arkpedia-caster-third-prefabs.json' with { type: 'json' };
import { resolveHit } from '../ai.js';
import { canTargetEnemy, sortEnemyTargets, tileKeyOf } from '../targeting.js';
import { bodyInKeys } from '../body.js';
import { COLS } from '../constants.js';

const DUSK = 'char_2015_dusk', LOGOS = 'char_4133_logos', TOKEN = 'token_10015_dusk_drgn';
const live = u => u?.alive && u.deployed;
const plain = p => ({ ...p, hits: 1, hitsFn: null, chain: null, splashRadius: 0, dmgMul: null });
const model = u => evidence.models[u.defId][['UP', 'LEFT'].includes(u.dir) ? 'Back' : 'Front'];
const rate = (u, cap = 1) => Math.min(cap, u.s.aspd / 100);
const windup = clip => (_b, u) => model(u).hits[typeof clip === 'function' ? clip(u) : clip][0] / rate(u);
const form = (u, clip, loop = false) => { u.mem.regularFormVisual = clip ? { clip, loop } : null; };
function entrance(b, u, clip, idle) {
  const seq = u.deploySeq, activation = u.skill.activations, duration = model(u).durations[clip];
  form(u, clip); b.addBuff(u, { key: 'caster-third:entrance', duration, flags: { disarm: true } });
  b.after(duration, () => {
    if (live(u) && u.deploySeq === seq && u.skill.active && u.skill.activations === activation) form(u, idle, true);
  }, { owner: u });
}
function formEnd(b, u, clip) {
  if (!live(u)) { form(u, null); return; }
  const seq = u.deploySeq, activation = u.skill.activations;
  form(u, clip);
  b.after(model(u).durations[clip], () => {
    if (live(u) && u.deploySeq === seq && !u.skill.active && u.skill.activations === activation) form(u, null);
  }, { owner: u });
}
const logosS2Clip = (u, suffix) => `Skill_${u.dir === 'DOWN' ? 'Down_2' : '2'}_${suffix}`;

function duskStack(b, u) {
  const t = u.def.talents.find(t => t.bb.max_stack_cnt != null)?.bb;
  if (!t || !live(u)) return;
  u.mem.duskStacks = Math.min(t.max_stack_cnt, u.mem.duskStacks + 1);
  b.addBuff(u, { key: 'dusk:sublimity', source: u, mods: { atkPct: t.atk * u.mem.duskStacks } });
}
function freelingRecord(b, u) {
  const source = b.data.raw.tokens[TOKEN];
  if (!source) throw Error('Missing reviewed Dusk token source');
  const build = u.def.raw.arkpedia, phase = source.phases[build.elite];
  const low = phase.attributesKeyFrames[0], high = phase.attributesKeyFrames.at(-1);
  const ratio = (build.level - low.level) / (high.level - low.level || 1);
  const stats = Object.fromEntries(Object.entries(low.data).filter(([, value]) => typeof value === 'number')
    .map(([k, v]) => [k, v + ((high.data[k] ?? v) - v) * ratio]));
  for (const k of ['maxHp', 'atk', 'def']) stats[k] = Math.round(stats[k]);
  return { id: TOKEN, name: source.name, profession: source.profession, subProfessionId: source.subProfessionId,
    position: source.position, stats, rangeGrid: phase.rangeGrid, talents: [], skill: null,
    avatar: source.avatar, arkpedia: { ...build } };
}
function refreshFreeling(b, t, duration) {
  b.addBuff(t, { key: 'token_dusk[withdraw]', source: t.ownerUnit, duration,
    flags: { healFree: true }, onExpire: () => { if (live(t)) b.kill(t); } });
}
function summonFreeling(b, u, target) {
  const t2 = u.def.talents.find(t => t.bb['attack@tokenduration'] != null)?.bb;
  if (!t2 || !live(u) || !target?.alive) return;
  const key = tileKeyOf(target), r = Math.floor(key / COLS), c = key % COLS;
  if (key < 0 || !b.grid.inRect(r, c) || !['MELEE', 'ALL'].includes(b.grid.tile(r, c).build) || b.downOn(r, c)) return;
  const occupied = b.allyUnits.find(a => live(a) && a.tileR === r && a.tileC === c);
  if (occupied) {
    if (occupied.defId === TOKEN && occupied.ownerUnit === u) {
      // Native overlay bypasses the token's ordinary allied-healing restriction.
      b.heal(u, occupied, occupied.s.maxHp, { ignoreHealFree: true });
      refreshFreeling(b, occupied, t2['attack@tokenduration']);
    }
    return;
  }
  const t = b.spawnToken(u, TOKEN, r, c, { def: freelingRecord(b, u), dir: 'RIGHT',
    kit: { skill: null, trait: { attack: 'melee', dmgType: 'arts', projectile: 'none', canHitFly: false,
      maxTargets: 1, allInRange: false, rangeAoe: false, hits: 1, hitsFn: null, splashRadius: 0, chain: null,
      windup: (_battle, token) => evidence.tokenModel.hits.Attack[0] / (token.s.aspd / 100), attackVisual: 'Attack' },
      install: (battle, token) => {
        token.deploymentSlotCost = 0;
        battle.addBuff(token, { key: 'dusk:birth', allowDead: true,
          duration: evidence.tokenModel.durations.Start, flags: { disarm: true } });
      } },
  });
  if (!t) return;
  u.mem.freelings.add(t); refreshFreeling(b, t, t2['attack@tokenduration']);
}
function duskLaunch(b, u, p, target, info) {
  if (!target || !canTargetEnemy(u, target, p)) return;
  const s3 = info.isSkill && u.skill.id === 'skchr_dusk_3';
  if (s3 || u.mem.duskFirstAttack) {
    u.mem.duskFirstAttack = false; summonFreeling(b, u, target);
  }
  const s2 = info.isSkill && u.skill.id === 'skchr_dusk_2';
  const victims = s2 ? b.enemiesInKeys(u.rangeKeys, u, p)
    : b.enemiesInRadius(target.x, target.y, info.isSkill ? 1.7 : 1.1).filter(e => canTargetEnemy(u, e, p));
  const hit = { ...plain(p), ...(info.isSkill && u.skill.id === 'skchr_dusk_1' ? { atkScale: u.skill.bb.atk_scale } : {}) };
  for (const e of victims) resolveHit(b, u, hit, e, info, e.x, e.y);
}

function ensureLogosMarkObserver(b, e) {
  if (e.mem.logosMarkObserver) return;
  e.mem.logosMarkObserver = true;
  b.on('hit', ({ target, dmg }) => {
    if (target !== e || dmg.type !== 'arts') return;
    const core = e.findBuff('logos_t_2[core]');
    if (core) dmg.amount += core.data.atkAddition;
  }, { owner: e });
}
function logosDamage(b, u, e, amount, info, { projectile = false, applyWay = 'ranged', tags = [] } = {}) {
  const talent = u.def.talents.find(t => t.bb.atk_addition != null)?.bb;
  let hook;
  if (talent) {
    ensureLogosMarkObserver(b, e);
    hook = b.on('hit', ({ source, target, dmg }) => {
      if (source !== u || target !== e || dmg.attackId !== info.attackId || !dmg.tags.includes('logos:owned-hit')) return;
      const old = e.findBuff('logos_t_2[core]'), chosen = old?.data.atkAddition > talent.atk_addition ? old.data : {
        atkAddition: talent.atk_addition, resFlat: talent.magic_resistance };
      b.addBuff(e, { key: 'logos_t_2[core]', source: u, duration: talent.duration,
        data: chosen, mods: { resFlat: chosen.resFlat } });
    }, { priority: 1 });
  }
  try {
    return b.dealDamage(u, e, { amount, type: 'arts', isAttack: true, isSkill: info.isSkill,
      isProjectile: projectile, attackId: info.attackId, applyWay,
      tags: ['logos:owned-hit', ...tags] });
  } finally { if (hook) b.off(hook); }
}
function logosTalentShot(b, u, info) {
  const t = u.def.talents.find(t => t.bb.prob != null)?.bb;
  if (!t || !live(u) || !b.rng.chance(t.prob)) return;
  const target = b.rng.pick(b.enemiesInKeys(u.rangeKeys, u, { canHitFly: true }));
  if (!target) return;
  const amount = u.s.atk * u.s.atkScaleMul * t.atk_scale;
  const point = { x: u.x, y: u.y }, delay = b.rng() * .30000001192092896;
  // Native randomDelayToBorn is retained as a seeded [0, .3] birth delay.
  // Its exact Unity random distribution/dispatch is not recovered. The emitted
  // ability survives owner removal, so this pending birth is not owner-cancelled.
  b.after(delay, () => b.addProjectile({ from: point, target, source: u, speed: 8, maxAge: 10, visual: 'orb', data: { arkpediaTrackedVisual: true },
    onHit: ({ target: e }) => {
      if (!e || !canTargetEnemy(u, e, { canHitFly: true })) return;
      if (t.sluggish > 0) b.applyStatus(e, 'sluggish', { source: u, duration: t.sluggish });
      logosDamage(b, u, e, amount, info, { projectile: true, applyWay: 'none', tags: ['logos:lexical'] });
    } }));
}
function logosLaunch(b, u, p, target, info) {
  if (!target || !canTargetEnemy(u, target, p)) return;
  logosTalentShot(b, u, info);
  b.addProjectile({ from: u, target, source: u, speed: info.isSkill && u.skill.id === 'skchr_logos_3' ? 8 : 10,
    maxAge: 10, visual: 'bolt', data: { arkpediaTrackedVisual: true },
    onHit: ({ target: e }) => {
      if (e && canTargetEnemy(u, e, p)) logosDamage(b, u, e, u.s.atk * u.s.atkScaleMul, info, { projectile: true });
    } });
}
function logosExecute(b, u, e) {
  if (!live(u) || !u.skill.active || u.skill.id !== 'skchr_logos_1'
      || !bodyInKeys(e, new Set(u.rangeKeys)) || !canTargetEnemy(u, e, { canHitFly: true })) return;
  const bb = u.skill.bb;
  if (!(e.hp < u.s.atk * bb['attack@kill_atk_scale'])) return;
  const savedHp = e.hp, point = { x: e.x, y: e.y }, info = { isSkill: true, attackId: ++b._attackSeq };
  // Preserve the native NoSourceDamage amount through the ordinary-stage
  // shield/fatal/HP-floor pipeline; instantKillLike cancellation masks remain
  // unrecovered and are explicitly recorded rather than bypassed with kill().
  b.dealDamage(u, e, { amount: bb['attack@kill_damage'], type: 'true', sourceless: true,
    canDodge: false, isAttack: true, isSkill: true, attackId: info.attackId, tags: ['logos:execution'] });
  if (e.alive) return;
  logosTalentShot(b, u, info);
  const target = b.rng.pick(b.enemiesInKeys(u.rangeKeys, u, { canHitFly: true }));
  if (target) b.addProjectile({ from: point, target, source: u, speed: 3, maxAge: 10, visual: 'orb',
    data: { arkpediaTrackedVisual: true }, onHit: ({ target: victim }) => {
      if (victim && canTargetEnemy(u, victim, { canHitFly: true }))
        logosDamage(b, u, victim, savedHp, info, { projectile: true, applyWay: 'none', tags: ['logos:execution-transfer'] });
    } });
}
function syncLogosExecution(b, u) {
  const active = live(u) && u.skill.active && u.skill.id === 'skchr_logos_1', key = `logos:execution:${u.id}`;
  for (const e of b.enemies) {
    const eligible = active && canTargetEnemy(u, e, { canHitFly: true }) && bodyInKeys(e, new Set(u.rangeKeys));
    if (!eligible) b.removeBuff(e, key);
    else if (!e.findBuff(key)) {
      b.addBuff(e, { key, source: u, interval: .1, onTick: () => logosExecute(b, u, e) });
      logosExecute(b, u, e); // Original waitFirstTriggerInterval0.
    }
  }
}
function clearLogosLock(b, u) {
  if (u.mem.logosTarget) b.removeBuff(u.mem.logosTarget, `logos:lock:${u.id}`);
  u.mem.logosTarget = null; u.mem.logosStacks = 0; u.mem.logosCooldown = 0;
}
function logosChannel(b, u, dt) {
  if (!live(u) || !u.skill.active || u.skill.id !== 'skchr_logos_2') { clearLogosLock(b, u); return; }
  if (u.mem.logosControlEpoch !== u.attackControlEpoch || !u.canAct || u.s.flags.disarm) {
    clearLogosLock(b, u); u.mem.logosControlEpoch = u.attackControlEpoch;
    if (!u.canAct || u.s.flags.disarm) return;
  }
  const candidates = b.enemiesInKeys(u.rangeKeys, u, { canHitFly: true });
  let target = u.mem.logosTarget;
  if (!candidates.includes(target)) {
    clearLogosLock(b, u); sortEnemyTargets(b, u, candidates); target = candidates[0];
    if (!target) return;
    u.mem.logosTarget = target; u.mem.logosCooldown = .466;
  }
  u.mem.logosCooldown -= dt;
  if (u.mem.logosCooldown > 1e-9) return;
  const bb = u.skill.bb, info = { isSkill: true, attackId: ++b._attackSeq };
  const scale = bb['attack@atk_scale_base'] + bb['attack@atk_scale_delta'] * u.mem.logosStacks;
  logosTalentShot(b, u, info);
  logosDamage(b, u, target, u.s.atk * u.s.atkScaleMul * scale, info, { tags: ['logos:channel'] });
  if (target.alive) {
    u.mem.logosStacks = Math.min(bb['attack@max_stack_cnt'], u.mem.logosStacks + 1);
    b.addBuff(target, { key: `logos:lock:${u.id}`, source: u,
      mods: { moveMul: 1 + bb['attack@move_speed'] * u.mem.logosStacks }, data: { count: u.mem.logosStacks } });
  }
  u.mem.logosCooldown = bb['attack@cooldown'];
  u.stats.attacks++; b.emit('attack', { attacker: u, targets: [target], isSkill: true });
}
function logosProjectileInRange(u, p, keys = u.rangeKeys) {
  if (p.source?.side !== 'enemy') return false;
  const r = Math.round(p.y), c = Math.round(p.x);
  return keys.includes(r * COLS + c);
}
function stopLogosAura(b, u) {
  u.mem.logosAura?.cancel(); u.mem.logosAura = null; u.mem.logosEndingRange = null;
  b.removeBuff(u, 'logos:projectile-aura-atk');
}
function endLogosS3(b, u, reason) {
  if (!live(u) || !u.canAct || u.s.flags.disarm || reason === 'death') { stopLogosAura(b, u); form(u, null); return; }
  const keys = u.rangeKeys.slice(), seq = u.deploySeq, duration = model(u).durations.Skill_3_End;
  const event = model(u).hits.Skill_3_End[0], key = 'logos:ending';
  u.mem.logosEndingRange = keys;
  form(u, 'Skill_3_End'); b.addBuff(u, { key, duration, flags: { disarm: true, noSp: true } });
  const epoch = u.attackControlEpoch;
  const valid = () => live(u) && u.deploySeq === seq && u.canAct && u.attackControlEpoch === epoch;
  const timer = b.every(b.dt, () => { if (!valid()) { stopLogosAura(b, u); timer.cancel(); } }, { owner: u });
  b.after(event, () => {
    timer.cancel();
    if (valid()) b.removeProjectiles(p => logosProjectileInRange(u, p, keys));
    stopLogosAura(b, u);
  }, { owner: u });
  b.after(duration, () => { timer.cancel(); stopLogosAura(b, u); b.removeBuff(u, key); if (u.deploySeq === seq) form(u, null); }, { owner: u });
}

export function customizeCasterThirdKit({ battle: b, id, def, unit: u, kit }) {
  if (!CASTER_THIRD_OPERATORS[id]) return;
  kit.install = null;
  kit.trait = { attack: 'ranged', dmgType: 'arts', projectile: 'none', canHitFly: true,
    hits: 1, hitsFn: null, dmgMul: null, chain: null, splashRadius: 0, maxTargets: 1,
    rangeAoe: false, allInRange: false, interruptOnSkillChange: true, install: null };
  const s = def.skill, bb = s.bb, third = s.id.endsWith('_3'), first = s.id.endsWith('_1');
  if (id === DUSK) {
    Object.assign(kit.trait, { launchAttack: duskLaunch, attackVisual: 'Attack', windup: windup('Attack') });
    if (first) kit.skill = { kind: 'charges', charges: bb.cnt, trigger: { rule: 'DEFAULT' }, attack: {} };
    else kit.skill = { kind: 'duration', duration: s.duration,
      mods: third ? { atkPct: bb.atk, batPct: bb.base_attack_time } : { atkPct: bb.atk, aspd: bb.attack_speed },
      targeting: { rangeGrid: s.rangeGrid },
      attack: third ? { attackVisual: 'Skill3_Attack', windup: windup('Skill3_Attack'),
        acquireTargets: (battle, unit, p) => {
          const list = battle.enemiesInKeys(unit.rangeKeys, unit, p);
          sortEnemyTargets(battle, unit, list);
          list.sort((a, z) => Number(!!a.blockedBy) - Number(!!z.blockedBy)); return list.slice(0, 1);
        } } : { attackVisual: 'Skill2_Loop', windup: (_battle, unit) => .5 / rate(unit, Infinity), retargetOnRelease: true },
      onStart: () => { if (!third) entrance(b, u, 'Skill2_Begin', 'Skill2_Loop'); },
      onEnd: () => { if (!third) formEnd(b, u, 'Skill2_End'); else form(u, null); } };
  } else {
    Object.assign(kit.trait, { launchAttack: logosLaunch, attackVisual: 'Attack_1', windup: windup('Attack_1'),
      retargetOnRelease: true });
    if (first) kit.skill = { kind: 'toggle', mods: { atkPct: bb.atk }, targeting: { rangeGrid: s.rangeGrid },
      attack: { attackVisual: 'Skill_1_Attack', windup: windup('Skill_1_Attack') },
      onStart: () => { entrance(b, u, 'Skill_1_Begin', 'Skill_1_Idle'); syncLogosExecution(b, u); },
      onEnd: () => { syncLogosExecution(b, u); form(u, null); } };
    else if (third) kit.skill = { kind: 'duration', duration: s.duration,
      targeting: { rangeGrid: s.rangeGrid, maxTargets: bb['attack@max_target'] },
      attack: { attackVisual: 'Skill_3_Attack', windup: windup('Skill_3_Attack') },
      onStart: () => {
        entrance(b, u, 'Skill_3_Begin', 'Skill_3_Idle');
        b.addBuff(u, { key: 'logos:projectile-aura-atk', source: u, mods: { atkPct: bb.atk } });
        u.mem.logosAura = b.registerProjectileSpeedAura({ owner: u, scale: bb.projectile_move_scale,
          contains: p => logosProjectileInRange(u, p, u.mem.logosEndingRange ?? u.rangeKeys) });
      }, onEnd: ({ reason }) => endLogosS3(b, u, reason) };
    else kit.skill = { kind: 'duration', duration: s.duration, mods: { resFlat: bb.magic_resistance },
      attack: { noAttack: true }, onStart: () => {
        clearLogosLock(b, u); entrance(b, u, logosS2Clip(u, 'Begin'), logosS2Clip(u, 'Loop'));
        u.mem.logosControlEpoch = u.attackControlEpoch;
      }, onEnd: () => { clearLogosLock(b, u); formEnd(b, u, logosS2Clip(u, 'End')); } };
  }
}
export function installCasterThird({ battle: b, unit: u, def }) {
  if (!CASTER_THIRD_OPERATORS[def.charId]) return;
  if (def.charId === DUSK) {
    u.mem.duskStacks = 0; u.mem.freelings = new Set();
    u.mem.duskFirstAttack = !!def.talents.find(t => t.bb['attack@tokenduration'] != null);
    b.on('kill', ({ killer, victim }) => {
      if (victim.side === 'enemy' && (killer === u || killer?.ownerUnit === u && killer.defId === TOKEN)) duskStack(b, u);
    }, { owner: u });
    b.on('hit', ({ source, target, dmg }) => {
      if (source === u && u.skill.active && u.skill.id === 'skchr_dusk_2'
          && target.hpRatio < u.skill.bb.hp_ratio) dmg.mul *= u.skill.bb.damage_scale;
    }, { owner: u });
  } else {
    u.mem.logosTarget = null; u.mem.logosStacks = 0; u.mem.logosCooldown = 0;
    u.mem.logosControlEpoch = u.attackControlEpoch;
    b.on('tick', ({ dt }) => { syncLogosExecution(b, u); logosChannel(b, u, dt ?? b.dt); }, { owner: u });
    b.on('death', ({ unit }) => { if (unit === u) {
      clearLogosLock(b, u); stopLogosAura(b, u); syncLogosExecution(b, u);
    } }, { owner: u });
  }
}
