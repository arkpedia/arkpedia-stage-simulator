// SPDX-License-Identifier: GPL-3.0-or-later
import { FIVE_STAR_GUARD_THIRD_OPERATORS } from '../../../shared/arkpedia/five-star-guard-third-operators.js';
import { acquireTargets, resolveHit } from '../ai.js';
import { absoluteRangeKeys, canTargetEnemy } from '../targeting.js';
import { bodyInKeys, bodyOnTile } from '../body.js';
import { frontOf } from '../dir.js';

const live = u => u?.alive && u.deployed && !u.hidden;
const scale = (u, cap = Infinity) => Math.min(cap, u.s.aspd / 100);
const windup = (seconds, cap = Infinity) => (_b, u) => seconds / scale(u, cap);
const eligibleAlly = (a, ignoreTargetFree = false) => live(a) && a.kind !== 'device'
  && !a.s.flags.isolated && (ignoreTargetFree || !a.s.flags.untargetable);
const meleeCapable = a => ['MELEE', 'ALL', 'BOTH'].includes(a.def.raw?.position)
  || a.def.raw?.deployableTiles?.includes('ground');
const inCombat = (u, e) => e.blockedBy === u || bodyOnTile(e, u.tileR, u.tileC)
  || bodyOnTile(e, ...frontOf(u.tileR, u.tileC, u.dir));
function beginForm(b, u, begin, loop, seconds) {
  const seq = u.deploySeq, activation = u.skill.activations;
  u.mem.regularFormVisual = { clip: begin, loop: false };
  b.addBuff(u, { key: 'guard:form-begin', source: u, duration: seconds, flags: { disarm: true } });
  b.after(seconds, () => {
    if (live(u) && u.deploySeq === seq && u.skill.active && u.skill.activations === activation)
      u.mem.regularFormVisual = { clip: loop, loop: true };
  }, { owner: u });
}
function endForm(b, u, clip, seconds) {
  b.removeBuff(u, 'guard:form-begin');
  if (!live(u)) { u.mem.regularFormVisual = null; return; }
  const seq = u.deploySeq;
  u.mem.regularFormVisual = { clip, loop: false };
  b.addBuff(u, { key: 'guard:form-end', source: u, duration: seconds, flags: { disarm: true } });
  b.after(seconds, () => { if (u.deploySeq === seq) u.mem.regularFormVisual = null; }, { owner: u });
}

function lordWindup(id, skill = false) {
  return (_b, u, targets) => {
    u.mem.lordCombat = inCombat(u, targets[0]);
    const seconds = skill && id === 'char_294_ayer' ? .5
      : u.mem.lordCombat ? id === 'char_140_whitew' ? .467 : .5
        : skill ? .567 : id === 'char_140_whitew' ? .6 : .667;
    return seconds / scale(u, u.mem.lordCombat && id === 'char_140_whitew' ? 1.1 : 1);
  };
}
function lordLaunch(b, u, p, target, info) {
  const enhanced = info.isSkill;
  // Both Ayerscarpe skill modes have only a ProjectileAttack, even when their
  // target is blocked. Lappland S2 has distinct ranged and Combat abilities.
  const combat = !(enhanced && u.def.charId === 'char_294_ayer') && inCombat(u, target);
  const full = enhanced;
  const profile = { ...p, dmgMul: null, applyWay: combat ? 'melee' : 'ranged',
    atkScale: (p.atkScale ?? 1) * (combat || full ? 1 : .8) };
  if (combat) resolveHit(b, u, profile, target, info, target.x, target.y);
  else b.addProjectile({ from: u, source: u, target, speed: u.def.charId === 'char_140_whitew' && enhanced ? 6 : 10,
    visual: 'bolt', data: { arkpediaTrackedVisual: true },
    onHit: c => resolveHit(b, u, profile, c.target, info, c.x, c.y) });
}

function bibeakLaunch(b, u, p, target, info) {
  const isS1 = info.isSkill && u.skill.id === 'skchr_bibeak_1';
  const deployment = u.deploySeq, activation = u.skill.activations, speed = u.mem.bibeakScale;
  const valid = () => live(u) && u.deploySeq === deployment && u.canAct && !u.s.flags.disarm
    && u.skill.activations === activation;
  if (isS1) {
    // The temporary listener finishes after its first ability cast on a target.
    // Its selector is ground-only and explicitly excludes that primary target.
    const extra = acquireTargets(b, u, { ...u.profile, maxTargets: 999, canHitFly: false })
      .find(e => e !== target);
    if (extra) b.addProjectile({ from: u, source: u, target: extra, speed: 6, visual: 'bolt',
      data: { arkpediaTrackedVisual: true }, onHit: c => resolveHit(b, u,
        { ...p, attack: 'ranged', dmgType: 'arts', atkScale: u.skill.bb['ranged@atk_scale'], hits: 1 },
        c.target, info, c.x, c.y) });
  }
  resolveHit(b, u, { ...p, hits: 1 }, target, info, target.x, target.y);
  let interrupted = false;
  const watch = b.every(b.dt, () => { if (!valid()) interrupted = true; }, { owner: u });
  b.after((.433 - .267) / speed, () => {
    watch.cancel();
    if (!interrupted && valid() && canTargetEnemy(u, target, p))
      resolveHit(b, u, { ...p, hits: 1 }, target, info, target.x, target.y);
  }, { owner: u });
}

function bibeakCast(b, u, s) {
  const token = {}, deployment = u.deploySeq;
  const targets = b.enemiesInKeys(absoluteRangeKeys(s.rangeGrid, u.tileR, u.tileC, u.dir), u, { canHitFly: true })
    .slice(0, s.bb.max_target);
  u.mem.bibeakCast = token;
  u.atkCd = Math.max(u.atkCd, .767);
  const buff = b.addBuff(u, { key: 'bibeak:cast-lock', source: u, flags: { noSp: true } });
  const finish = () => { if (u.mem.bibeakCast === token) { u.mem.bibeakCast = null; b.removeBuff(u, buff); } };
  let interrupted = false;
  const watch = b.every(b.dt, () => {
    if (!live(u) || !u.canAct || u.deploySeq !== deployment || u.mem.bibeakCast !== token) {
      interrupted = true; watch.cancel(); finish();
    }
  }, { owner: u });
  b._ev(['atk', u.id, targets[0]?.id ?? u.id, 'none', { animation: 'Skill', windup: .333 }]);
  // waitForAttackEvent=1: use the original Front Skill OnAttack event. The
  // separate source preDelay=.533 dispatch remains a documented inference.
  b.after(.333, () => {
    if (interrupted || u.mem.bibeakCast !== token || !u.canAct) return;
    for (const e of targets) if (canTargetEnemy(u, e, { canHitFly: true })) {
      b.dealDamage(u, e, { amount: u.s.atk * s.bb.atk_scale, type: 'arts', applyWay: 'melee',
        isSkill: true, isAttack: true, tags: ['bibeak:cast'] });
      if (e.alive) b.applyStatus(e, 'stun', { source: u, duration: s.bb.stun });
    }
  }, { owner: u });
  b.after(.767, () => { watch.cancel(); finish(); }, { owner: u });
}

export function customizeFiveStarGuardThirdKit({ id, def, unit, kit }) {
  if (!FIVE_STAR_GUARD_THIRD_OPERATORS[id]) return;
  kit.install = null;
  const s = def.skill, bb = s.bb;
  kit.trait = { install: null, attack: 'melee', projectile: 'none', dmgType: 'phys', hits: 1,
    hitsFn: null, maxTargets: 1, hitAllBlocked: false, canHitFly: false, attackVisual: 'Attack' };
  const timed = mods => ({ id: s.id, name: s.name, kind: 'duration', duration: s.duration, mods });
  if (id === 'char_140_whitew' || id === 'char_294_ayer') {
    Object.assign(kit.trait, { attack: 'ranged', projectile: 'bolt', canHitFly: true,
      dmgMul: null, windup: lordWindup(id), launchAttack: lordLaunch,
      attackVisual: (_b, u) => u.mem.lordCombat ? 'Combat' : 'Attack' });
    if (id === 'char_140_whitew') kit.skill = s.id === 'skchr_whitew_1'
      ? { ...timed({ atkPct: bb.atk, dodgePhys: bb.prob }), kind: 'toggle', trigger: { rule: 'SP_FULL' } }
      : { ...timed({ atkPct: bb.atk }), trigger: { rule: 'SP_FULL' },
        attack: { dmgType: 'arts', maxTargets: 2, windup: lordWindup(id, true),
          attackVisual: (_b, u) => u.mem.lordCombat ? 'Combat' : 'Skill' } };
    else kit.skill = s.id === 'skchr_ayer_1'
      ? { id: s.id, name: s.name, kind: 'instant', attack: { dmgType: 'arts', atkScale: bb.atk_scale,
        maxTargets: bb.max_target, windup: windup(.767), attackVisual: 'Skill_1',
        onEachHit: ({ battle, unit, target }) => { if (target.alive) battle.applyStatus(target, 'sluggish', { source: unit, duration: bb.sluggish }); } } }
      : { ...timed({}), targeting: { rangeGrid: s.rangeGrid }, attack: { dmgType: 'arts',
        windup: lordWindup(id, true), attackVisual: 'Skill_2_Loop' }, onStart: ({ battle, unit }) => {
        beginForm(battle, unit, 'Skill_2_Begin', 'Skill_2_Idle', .8);
      }, onEnd: ({ battle, unit }) => endForm(battle, unit, 'Skill_2_End', .367) };
  } else if (id === 'char_252_bibeak') {
    Object.assign(kit.trait, { interruptOnSkillChange: true, canAttack: (_b, u) => !u.mem.bibeakCast,
      windup: (_b, u) => { u.mem.bibeakScale = scale(u, 1); return .267 / u.mem.bibeakScale; }, launchAttack: bibeakLaunch });
    kit.skill = s.id === 'skchr_bibeak_1'
      ? { id: s.id, name: s.name, kind: 'instant', attack: { atkScale: bb.atk_scale,
        windup: (_b, u) => { u.mem.bibeakScale = scale(u); return .267 / u.mem.bibeakScale; } } }
      : { id: s.id, name: s.name, kind: 'charges', charges: s.maxCharges,
        canActivate: () => !unit.mem.bibeakCast,
        onStart: ({ battle, unit }) => bibeakCast(battle, unit, s) };
  } else if (id === 'char_265_sophia') {
    const second = s.id === 'skchr_sophia_2';
    Object.assign(kit.trait, { interruptOnSkillChange: second, windup: (_b, u) => {
      const first = !u.mem.sophiaOpen; u.mem.sophiaOpen = true; u.mem.sophiaBegin = first;
      return (first ? .5 + .267 : .267) / scale(u);
    }, attackVisual: (_b, u) => u.mem.sophiaBegin
      ? { begin: 'Attack_Start', loop: 'Attack_Loop', beginDuration: .5 / scale(u) } : 'Attack_Loop' });
    kit.skill = second ? { ...timed({ atkPct: bb.atk, blockCnt: bb.block_cnt,
      rangeExtend: bb.ability_range_forward_extend }), attack: { maxTargetsByBlock: true,
        attackVisual: 'Skill_Loop', windup: windup(.4) },
      onStart: ({ battle, unit }) => beginForm(battle, unit, 'Skill_Begin', 'Skill_Idle', 1),
      onEnd: ({ battle, unit }) => endForm(battle, unit, 'Skill_End', .333) }
      : timed({});
  } else {
    kit.trait.windup = windup(.7, 1.1);
    kit.skill = timed(s.id === 'skchr_swire_2' ? { atkPct: bb.atk } : {});
  }
}

function syncAura(b, u, def) {
  const id = def.charId, talent = def.talents[0], key = `guard:aura:${u.id}`;
  const skilled = u.skill.active, factor = skilled ? u.skill.bb.talent_scale ?? 1 : 1;
  const grid = id === 'char_308_swire' && skilled && u.skill.id === 'skchr_swire_1'
    ? u.skill.def.rangeGrid : talent.rangeGrid;
  const keys = grid ? new Set(absoluteRangeKeys(grid, u.tileR, u.tileC, u.dir)) : null;
  for (const a of b.allyUnits) {
    const eligible = live(u) && eligibleAlly(a, id !== 'char_294_ayer')
      && (id === 'char_294_ayer' || meleeCapable(a))
      && (id !== 'char_308_swire' || a !== u)
      && (!keys || bodyInKeys(a, keys));
    let mods = null;
    if (eligible) {
      if (id === 'char_294_ayer') mods = { aspd: talent.bb.attack_speed };
      else if (id === 'char_308_swire') mods = { atkPct: talent.bb.atk * factor };
      else if (a.s.blockCnt >= 3) mods = { aspd: talent.bb.attack_speed * factor, defPct: talent.bb.def * factor };
      else if (skilled && u.skill.id === 'skchr_sophia_1') mods = {
        aspd: talent.bb['sophia_t_1_less.attack_speed'] * factor, defPct: talent.bb['sophia_t_1_less.def'] * factor };
    }
    const existing = a.findBuff(key);
    if (!mods) { if (existing) b.removeBuff(a, existing); }
    else if (!existing || JSON.stringify(existing.mods) !== JSON.stringify(mods)) b.addBuff(a, { key, source: u, mods });
  }
}

export function installFiveStarGuardThird({ battle: b, unit: u, def }) {
  const id = def.charId, talent = def.talents[0];
  if (!FIVE_STAR_GUARD_THIRD_OPERATORS[id]) return;
  if (id === 'char_140_whitew' && talent) u.profile.onEachHit = (b, u, e) => {
    if (e.alive) b.applyStatus(e, 'silence', { source: u, duration: talent.bb.duration });
  };
  if (id === 'char_252_bibeak' && talent) {
    let stacks = 0;
    b.on('kill', ({ killer, victim }) => {
      if (killer !== u || victim.side !== 'enemy' || !live(u) || stacks >= talent.bb.max_stack_cnt) return;
      b.addBuff(u, { key: 'bibeak:soul-drinker', mods: { aspd: ++stacks * talent.bb.attack_speed } });
    }, { owner: u });
  }
  if (['char_294_ayer', 'char_265_sophia', 'char_308_swire'].includes(id) && talent) {
    const sync = () => syncAura(b, u, def);
    b.on('deploy', sync, { owner: u }); b.on('skillStart', sync, { owner: u }); b.on('skillEnd', sync, { owner: u });
    b.on('death', sync, { owner: u });
    b.every(id === 'char_265_sophia' ? .1 : b.dt, sync, { owner: u });
    if (id === 'char_265_sophia') b.on('tick', () => { if (!u.trait.hadTarget) u.mem.sophiaOpen = false; }, { owner: u });
  }
  if (id === 'char_294_ayer') {
    const launch = u.profile.launchAttack;
    u.profile.launchAttack = (b, u, p, target, info) => {
      if (info.isSkill && u.skill.id === 'skchr_ayer_2') {
        const keys = new Set(absoluteRangeKeys(def.talents[0]?.rangeGrid ?? [[0, 0]], u.tileR, u.tileC, u.dir));
        const hit = new Set();
        for (const a of b.allyUnits) if (eligibleAlly(a) && bodyInKeys(a, keys))
          for (const e of a.blocking) if (!hit.has(e) && e.blockedBy === a && canTargetEnemy(u, e, { canHitFly: true })) {
            hit.add(e); b.dealDamage(u, e, { amount: u.s.atk * u.skill.bb.atk_scale, type: 'arts',
              isAttack: true, isSkill: true, attackId: info.attackId, applyWay: 'melee', tags: ['ayerscarpe:phase-blade'] });
          }
      }
      launch(b, u, p, target, info);
    };
  }
}
