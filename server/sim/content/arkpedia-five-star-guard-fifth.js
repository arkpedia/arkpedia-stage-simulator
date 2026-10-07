// SPDX-License-Identifier: GPL-3.0-or-later
import { FIVE_STAR_GUARD_FIFTH_OPERATORS } from '../../../shared/arkpedia/five-star-guard-fifth-operators.js';
import { resolveHit } from '../ai.js';
import { absoluteRangeKeys, canTargetEnemy } from '../targeting.js';
import { bodyInKeys } from '../body.js';
import { isHpLoss } from '../damage.js';

const live = u => u?.alive && u.deployed && !u.hidden;
const rate = (u, cap = Infinity) => Math.min(cap, u.s.aspd / 100);
const windup = (seconds, cap = Infinity) => (_b, u) => seconds / rate(u, cap);
const neuralBurst = e => !!(e.findBuff('neuralBurst') || e.burstPending?.neural);
function setMods(b, u, key, mods) {
  const buff = u.findBuff(key);
  if (!mods) { if (buff) b.removeBuff(u, buff); }
  else if (!buff || JSON.stringify(buff.mods) !== JSON.stringify(mods)) b.addBuff(u, { key, source: u, mods, allowDead: true });
}
function beginForm(b, u, begin, idle, seconds) {
  const seq = u.deploySeq, activation = u.skill.activations;
  u.mem.regularFormVisual = { clip: begin, loop: false };
  b.addBuff(u, { key: 'guard-fifth:begin', source: u, duration: seconds, flags: { disarm: true } });
  b.after(seconds, () => {
    if (live(u) && u.deploySeq === seq && u.skill.active && u.skill.activations === activation)
      u.mem.regularFormVisual = { clip: idle, loop: true };
  }, { owner: u });
}
function endForm(b, u, clip, seconds, reason) {
  b.removeBuff(u, 'guard-fifth:begin');
  if (!live(u) || !['duration', 'manual'].includes(reason)) { u.mem.regularFormVisual = null; return; }
  const seq = u.deploySeq;
  u.mem.regularFormVisual = { clip, loop: false };
  b.addBuff(u, { key: 'guard-fifth:end', source: u, duration: seconds, flags: { disarm: true } });
  b.after(seconds, () => { if (u.deploySeq === seq) u.mem.regularFormVisual = null; }, { owner: u });
}

function laterHit(b, u, p, target, info, delay, requireActive = false) {
  const seq = u.deploySeq, activation = u.skill.activations;
  let interrupted = false;
  const valid = () => live(u) && u.deploySeq === seq && u.canAct && !u.s.flags.disarm
    && u.skill.activations === activation && (!requireActive || u.skill.active);
  const watch = b.every(b.dt, () => { if (!valid()) interrupted = true; }, { owner: u });
  b.after(delay, () => {
    watch.cancel();
    if (!interrupted && valid() && canTargetEnemy(u, target, p))
      resolveHit(b, u, p, target, info, target.x, target.y);
  }, { owner: u });
}

function reaperLaunch(b, u, p, target, info) {
  const crow = u.def.charId === 'char_421_crow';
  const profile = { ...p, hits: 1, hitsFn: null, splashRadius: 0, chain: null };
  const bonus = crow && info.isSkill && u.skill.id === 'skchr_crow_2'
    && target.hpRatio < u.skill.bb.hp_ratio;
  // Source RecalculateDamage adds the conditional ATK multiplier to the same
  // percentage bucket, separately for each victim, then finishes that buff.
  if (bonus) b.addBuff(u, { key: 'crow:execute', source: u, mods: { atkPct: u.skill.bb['crow_s_2[atk].atk'] } });
  resolveHit(b, u, profile, target, info, target.x, target.y);
  if (bonus) b.removeBuff(u, 'crow:execute');
  if (info.isSkill && u.skill.id.endsWith('_1')) {
    if (crow) laterHit(b, u, profile, target, info, .1 / u.mem.reaperAttackRate);
    else if (canTargetEnemy(u, target, profile)) resolveHit(b, u, profile, target, info, target.x, target.y);
  }
}

function installReaper(b, u, def) {
  const ep = def.charId === 'char_4066_highmo' ? def.talents.find(t => t.bb.value != null)?.bb.value : 0;
  const state = { windowAt: -Infinity, count: 0, queue: 0, timer: null };
  u.mem.reaperHeal = state;
  const consume = () => {
    if (!live(u)) { state.queue = 0; state.timer = null; return; }
    state.queue--;
    b.heal(u, u, def.traitBb.value, { self: true, ignoreHealFree: true });
    if (ep) b.reduceElement(u, ep);
    state.timer = b.after(.12, () => {
      state.timer = null;
      if (state.queue > 0) consume();
    }, { owner: u });
  };
  b.on('damaged', ({ source, target, dmg }) => {
    if (source !== u || !live(u) || target?.side !== 'enemy' || !dmg || isHpLoss(dmg)
      || dmg.type === 'element' || dmg.type === 'elemental' || !dmg.isAttack) return;
    // The original fake-heal buff is limited .05s and bounds its receipts by
    // the current block count. Its separate heal stack ticks at .12s.
    if (b.time - state.windowAt >= .05 - 1e-9) { state.windowAt = b.time; state.count = 0; }
    if (state.count >= Math.max(0, u.s.blockCnt)) return;
    state.count++; state.queue++;
    if (!state.timer) consume();
  }, { owner: u });
  b.on('death', ({ unit }) => {
    if (unit !== u) return;
    state.timer?.cancel(); state.timer = null; state.queue = 0;
  }, { owner: u });
}

function tequilaStart(b, u, s) {
  b.removeBuff(u, 'tequila:idle-block');
  if (s.id === 'skchr_takila_2') {
    // SkillRuntime has spent the first charge. The original judge checks two
    // available charges before consumption, then clears ALL remaining SP.
    const charged = u.skill.charges >= 1;
    u.mem.tequilaCharged = charged;
    u.skill.charges = 0; u.skill.sp = 0;
    u.skill.duration = charged ? s.bb.enhance_duration : s.duration;
    u.skill.timeLeft = u.skill.duration;
    u.skill.spec.attack.maxTargets = charged ? s.bb['attack@plus_max_target'] : 2;
    u.skill.spec.attack.atkScale = s.bb[charged ? 'attack@plus_atk_scale' : 'attack@atk_scale'];
  }
  const n = s.id.endsWith('_1') ? 1 : 2;
  beginForm(b, u, `Skill_${n}_Start`, `Skill_${n}_Idle`, .333);
}
function tequilaEnd(b, u, s, reason) {
  u.mem.tequilaStacks = 0;
  setMods(b, u, 'tequila:ramp', null);
  if (live(u)) setMods(b, u, 'tequila:idle-block', { blockCntMul: 0 });
  const n = s.id.endsWith('_1') ? 1 : 2;
  endForm(b, u, `Skill_${n}_End`, .333, reason);
}

function oddaLaunch(b, u, p, target, info) {
  if (!canTargetEnemy(u, target, p)) return;
  const radius = info.isSkill && u.skill.id === 'skchr_odda_1'
    ? u.skill.bb.ability_range_radius : u.def.traitBb['attack@ability_range_radius'];
  // HammerAttack has independent atk_scale and atk_scale_2 keys; splash
  // excludes the primary and uses its separate trait coefficient.
  const splash = b.enemiesInRadius(target.x, target.y, radius)
    .filter(e => e !== target && canTargetEnemy(u, e, { canHitFly: false }));
  resolveHit(b, u, { ...p, hits: 1, hitsFn: null, splashRadius: 0, chain: null }, target, info, target.x, target.y);
  for (const e of splash) {
    b.dealDamage(u, e, { amount: u.s.atk * u.s.atkScaleMul * u.def.traitBb['attack@atk_scale_2'], type: 'phys',
      isAttack: true, isSkill: info.isSkill, isSplash: true, attackId: info.attackId, applyWay: 'melee', tags: ['odda:splash'] });
    // Original activeBuffsToSplashTarget alone contains this controller.
    if (e.alive && info.isSkill && u.skill.id === 'skchr_odda_2' && e.s.massLevel <= u.skill.bb['attack@value'])
      b.applyStatus(e, 'levitate', { source: u, duration: u.skill.bb['attack@levitate_duration'] });
  }
}

function graceLaunch(b, u, p, target, info) {
  const profile = { ...p, hits: 1, hitsFn: null };
  resolveHit(b, u, profile, target, info, target.x, target.y);
  if (info.isSkill && u.skill.id === 'skchr_graceb_1')
    laterHit(b, u, profile, target, info, (1.1 - .667) / u.mem.graceAttackRate, true);
}
function graceCast(b, u, s) {
  const seq = u.deploySeq, token = {}, speed = rate(u);
  const targets = b.enemiesInKeys(absoluteRangeKeys(s.rangeGrid, u.tileR, u.tileC, u.dir), u, { canHitFly: false })
    .slice(0, s.bb.max_target);
  const finish = () => {
    if (u.mem.graceCast !== token) return;
    u.mem.graceCast = null; u.mem.regularFormVisual = null; b.removeBuff(u, 'graceb:cast');
  };
  u.mem.graceCast = token; u.mem.regularFormVisual = { clip: 'Skill_2', loop: false };
  b.addBuff(u, { key: 'graceb:cast', source: u, flags: { noSp: true, disarm: true } });
  const valid = () => live(u) && u.deploySeq === seq && u.canAct && u.mem.graceCast === token;
  let interrupted = false;
  const watch = b.every(b.dt, () => { if (!valid()) { interrupted = true; watch.cancel(); finish(); } }, { owner: u });
  b._ev(['atk', u.id, targets[0]?.id ?? u.id, 'none', { animation: 'Skill_2', windup: .167 / speed }]);
  const attackId = ++b._attackSeq;
  b.after(.167 / speed, () => {
    if (interrupted || !valid()) return;
    for (const e of targets) for (let i = 0; i < 3 && canTargetEnemy(u, e, { canHitFly: false }); i++)
      b.dealDamage(u, e, { amount: u.s.atk * u.s.atkScaleMul * s.bb.atk_scale,
        type: neuralBurst(e) ? 'elemental' : 'phys', isSkill: true, isAttack: true,
        applyWay: 'melee', attackId, tags: ['graceb:s2'] });
  }, { owner: u });
  b.after(1.367 / speed, () => { watch.cancel(); finish(); }, { owner: u });
}

export function customizeFiveStarGuardFifthKit({ id, def, unit, kit }) {
  if (!FIVE_STAR_GUARD_FIFTH_OPERATORS[id]) return;
  kit.install = null;
  const s = def.skill, bb = s.bb;
  kit.trait = { install: null, attack: 'melee', projectile: 'none', dmgType: 'phys', hits: 1,
    hitsFn: null, maxTargets: 1, hitAllBlocked: false, canHitFly: false, dmgMul: null, splashRadius: 0,
    chain: null, attackVisual: 'Attack' };
  const timed = mods => ({ id: s.id, name: s.name, kind: 'duration', duration: s.duration, mods });
  const instant = { id: s.id, name: s.name, kind: 'instant' };
  if (id === 'char_421_crow' || id === 'char_4066_highmo') {
    const crow = id === 'char_421_crow', cap = crow ? Infinity : 1;
    Object.assign(kit.trait, { noHeal: true, allInRange: true, launchAttack: reaperLaunch,
      interruptOnSkillChange: true, windup: (_b, u) => {
        u.mem.reaperAttackRate = rate(u, cap);
        return .533 / u.mem.reaperAttackRate;
      } });
    kit.skill = s.id.endsWith('_1')
      ? { ...instant, attack: { atkScale: bb.atk_scale, attackVisual: 'Skill_1', windup: (_b, u) => {
        u.mem.reaperAttackRate = rate(u, cap); return .5 / u.mem.reaperAttackRate;
      } } }
      : { ...timed(crow ? { atkPct: bb.atk, batMul: 1 + bb.base_attack_time } : { atkPct: bb.atk, dodgePhys: bb.prob }),
        attack: { attackVisual: 'Skill_2_Attack', windup: windup(crow ? .2 : .333, cap) },
        onStart: ({ battle, unit }) => beginForm(battle, unit, crow ? 'Skill_2_Start' : 'Skill_2_Begin', 'Skill_2_Idle', .333),
        onEnd: ({ battle, unit, reason }) => endForm(battle, unit, 'Skill_2_End', crow ? .333 : .667, reason) };
  } else if (id === 'char_486_takila') {
    Object.assign(kit.trait, { noAttackUnlessSkill: true, noAttack: false, interruptOnSkillChange: true });
    kit.skill = { ...timed(s.id.endsWith('_1') ? { aspd: bb.attack_speed } : {}), trigger: 'NEVER',
      manualCancel: s.id.endsWith('_2'), targeting: s.id.endsWith('_2') ? { rangeGrid: s.rangeGrid } : {},
      attack: { noAttack: false, atkScale: bb['attack@atk_scale'], maxTargets: s.id.endsWith('_2') ? 2 : 1,
        windup: windup(s.id.endsWith('_1') ? .4 : .533), attackVisual: s.id.endsWith('_1') ? 'Skill_1_Loop' : 'Skill_2_Loop' },
      onStart: ({ battle, unit }) => tequilaStart(battle, unit, s),
      onEnd: ({ battle, unit, reason }) => tequilaEnd(battle, unit, s, reason) };
  } else if (id === 'char_4131_odda') {
    Object.assign(kit.trait, { launchAttack: oddaLaunch, retargetOnRelease: true, windup: windup(.667, 1), interruptOnSkillChange: true });
    kit.skill = s.id.endsWith('_1') ? { ...instant, attack: { atkScale: bb.atk_scale, windup: windup(.667), attackVisual: 'Skill_1' } }
      : { ...timed({ atkPct: bb.atk, defPct: bb.def }), attack: { attackVisual: 'Skill_2_Loop' },
        onStart: ({ battle, unit }) => beginForm(battle, unit, 'Skill_2_Begin', 'Skill_2_Idle', .233),
        onEnd: ({ battle, unit, reason }) => endForm(battle, unit, 'Skill_2_End', .167, reason) };
  } else {
    Object.assign(kit.trait, { launchAttack: graceLaunch, windup: windup(.6), interruptOnSkillChange: true });
    kit.skill = s.id.endsWith('_1') ? { ...timed({}), attack: { atkScale: bb['attack@atk_scale'], attackVisual: 'Skill_1_Loop',
      windup: (_b, u) => { u.mem.graceAttackRate = rate(u); return .667 / u.mem.graceAttackRate; } },
      onStart: ({ battle, unit }) => beginForm(battle, unit, 'Skill_1_Begin', 'Skill_1_Idle', .2),
      onEnd: ({ battle, unit, reason }) => endForm(battle, unit, 'Skill_1_End', .267, reason) }
      : { ...instant, trigger: 'NEVER', canActivate: () => !unit.mem.graceCast && unit.canAct,
        onStart: ({ battle, unit }) => graceCast(battle, unit, s) };
  }
  kit.skill.canActivate ??= () => unit.canAct && !unit.s.flags.disarm;
}

export function installFiveStarGuardFifth({ battle: b, unit: u, def }) {
  const id = def.charId;
  if (!FIVE_STAR_GUARD_FIFTH_OPERATORS[id]) return;
  if (id === 'char_421_crow' || id === 'char_4066_highmo') {
    installReaper(b, u, def);
    if (id === 'char_421_crow') {
      const t = def.talents[0]; u.mem.crowKills = 0;
      b.on('kill', ({ killer, victim }) => {
        if (killer !== u || victim.side !== 'enemy' || !live(u)) return;
        u.mem.crowKills = Math.min(t.bb.max_stack_cnt, u.mem.crowKills + 1);
        setMods(b, u, 'crow:groove', { aspd: u.mem.crowKills * t.bb.attack_speed });
      }, { owner: u });
    } else {
      const is3 = def.talents.find(t => t.bb.block_cnt != null);
      if (is3 && b.mapTags.includes('rogue_mizuki'))
        setMods(b, u, 'highmore:is3', { aspd: is3.bb.attack_speed, blockCnt: is3.bb.block_cnt });
      b.on('kill', ({ victim }) => {
        if (!live(u) || !u.skill.active || u.skill.id !== 'skchr_highmo_2' || victim.side !== 'enemy'
          // Original S2 validator is ALL motion with ignoreTargetFree=1.
          // Hidden pre-appearance units are still outside this active aura.
          || !victim.deployed || victim.hidden || !bodyInKeys(victim, new Set(u.rangeKeys))) return;
        b.heal(u, u, u.s.maxHp * u.skill.bb.hp_ratio, { self: true, ignoreHealFree: true });
      }, { owner: u });
    }
  } else if (id === 'char_486_takila') {
    u.mem.tequilaStacks = 0;
    setMods(b, u, 'tequila:idle-block', { blockCntMul: 0 });
    b.every(1, () => {
      if (!live(u) || u.skill.active) return;
      u.mem.tequilaStacks = Math.min(def.traitBb.max_stack_cnt, u.mem.tequilaStacks + 1);
      setMods(b, u, 'tequila:ramp', { atkPct: def.traitBb.atk * u.mem.tequilaStacks / def.traitBb.max_stack_cnt });
    }, { owner: u });
    const t = def.talents[0];
    if (t) b.on('hit', ({ source, target, dmg }) => {
      if (target !== u || !live(u) || u.skill.active || source?.side !== 'enemy' || !source.alive || isHpLoss(dmg)
        || dmg.type === 'element') return;
      b.dealDamage(u, source, { amount: u.s.atk * t.bb.atk_scale, type: 'arts', applyWay: 'none', tags: ['tequila:reflect'] });
    }, { owner: u });
  } else if (id === 'char_4131_odda') {
    const t = def.talents[0]; u.mem.oddaOutputs = 0;
    if (t) b.on('damaged', ({ source, dmg }) => {
      if (source !== u || dmg.type !== 'phys' || isHpLoss(dmg) || !live(u)) return;
      u.mem.oddaOutputs = Math.min(t.bb.count, u.mem.oddaOutputs + 1);
      if (u.mem.oddaOutputs >= t.bb.count) setMods(b, u, 'odda:hammerfall', { atkPct: t.bb.atk });
    }, { owner: u });
  } else {
    const t = def.talents[0];
    if (t) {
      setMods(b, u, 'graceb:mercy', { atkPct: t.bb.atk });
      b.on('kill', ({ killer, victim }) => {
        if (killer === u && victim.side === 'enemy' && neuralBurst(victim) && live(u))
          setMods(b, u, 'graceb:mercy', { atkPct: t.bb.atk_bonus });
      }, { owner: u });
    }
    b.on('damaged', ({ source, target, amount, dmg }) => {
      if (source !== u || !u.skill.active || u.skill.id !== 'skchr_graceb_1' || !dmg.isAttack || !dmg.isSkill
        || dmg.type === 'element' || amount <= 0 || !target.alive) return;
      b.dealDamage(u, target, { amount: amount * u.skill.bb.ep_damage_ratio, type: 'element', element: 'neural',
        canDodge: false, isSkill: true, tags: ['graceb:injury'] });
    }, { owner: u });
  }
}
