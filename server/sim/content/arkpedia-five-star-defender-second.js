// SPDX-License-Identifier: GPL-3.0-or-later
// Exact pinned components/templates and remaining native dispatch limits live in
// data/arkpedia-five-star-defender-second-prefabs.json.
import { FIVE_STAR_DEFENDER_SECOND_OPERATORS } from '../../../shared/arkpedia/five-star-defender-second-operators.js';
import evidence from '../../../data/arkpedia-five-star-defender-second-prefabs.json' with { type: 'json' };
import { absoluteRangeKeys, canTargetEnemy } from '../targeting.js';
import { bodyInKeys } from '../body.js';

const NEARL = 'char_148_nearl', HUNG = 'char_226_hmau', BASS = 'char_4109_baslin', CZERNY = 'char_4047_pianst';
const live = u => u?.alive && u.deployed && !u.hidden;
const model = (u, front = false) => evidence.originalModels[u.defId][front || !['UP', 'LEFT'].includes(u.dir) ? 'Front' : 'Back'];
const rate = (u, cap = Infinity) => Math.min(cap, u.s.aspd / 100);
const keys = (u, range) => new Set(absoluteRangeKeys(evidence.ranges[range], u.tileR, u.tileC, u.dir));
const eligible = (b, a, u) => live(a) && a.kind !== 'device' && b.allySelectable(a, u);
const healable = (b, a, u) => eligible(b, a, u) && !a.s.flags.untargetable && !a.s.flags.healFree
  && (a === u || !(a.s.flags.noHeal || a.profile?.noHeal));
const buffKey = u => `defender-second:cast:${u.id}`;
function mods(b, u, key, value, source = u) {
  const old = u.findBuff(key);
  if (!value) b.removeBuff(u, key);
  else if (!old || old.source !== source || JSON.stringify(old.mods) !== JSON.stringify(value))
    b.addBuff(u, { key, source, mods: value });
}
// A cast remains cancelled even if brief control ends before its original event.
function cast(b, u, delay, duration, clip, release, { front = false, requireActive = false } = {}) {
  const seq = u.deploySeq, activation = u.skill.activations;
  const token = {}; u.mem.defenderSecondCast = token;
  let interrupted = false;
  const valid = () => !interrupted && u.mem.defenderSecondCast === token && live(u)
    && u.deploySeq === seq && u.skill.activations === activation && u.canAct && (!requireActive || u.skill.active);
  u.mem.regularFormVisual = { clip, loop: false, forceFront: front };
  b.addBuff(u, { key: buffKey(u), source: u, duration, flags: { disarm: true, noSp: true } });
  const stop = () => {
    interrupted = true;
    if (u.mem.defenderSecondCast !== token || u.deploySeq !== seq) return;
    b.removeBuff(u, buffKey(u)); u.mem.regularFormVisual = null;
  };
  const watch = b.every(b.dt, () => { if (!valid()) { stop(); watch.cancel(); } }, { owner: u });
  b.after(delay, () => { if (valid()) release(); else stop(); watch.cancel(); }, { owner: u });
  b.after(duration, () => {
    if (u.mem.defenderSecondCast === token && u.deploySeq === seq) {
      b.removeBuff(u, buffKey(u)); u.mem.regularFormVisual = null;
    }
  }, { owner: u });
}
function healingTargets(b, u, half = false) {
  return b.injuredAlliesInKeys([...keys(u, 'x-4')], u)
    .filter(a => healable(b, a, u) && (!half || a.hpRatio <= .5 + 1e-9)).slice(0, 1);
}
function launchHeal(b, u, target, scale, projectile = false, onHeal = null) {
  const hit = () => {
    if (!healable(b, target, u)) return;
    // Native Hung uses live ATK (_useCachedAtkOnly 0). This also retains the
    // recipient healing modifiers and source outgoing-heal talent pipeline.
    b.heal(u, target, u.s.atk * scale);
    onHeal?.(target);
  };
  if (!projectile) hit();
  else b.addProjectile({ from: u, source: u, target, speed: 15, visual: 'heal',
    data: { arkpediaTrackedVisual: true }, onHit: hit });
}
function firstAid(b, u, s) {
  const half = u.defId !== HUNG, target = healingTargets(b, u, half)[0];
  if (!target) return;
  const clip = u.defId === BASS ? 'Skill_1' : 'Skill', front = u.defId === NEARL;
  const cap = u.defId === NEARL ? Infinity : 1;
  const speed = rate(u, cap), sourceModel = model(u, front);
  cast(b, u, sourceModel.hits[clip][0] / speed, sourceModel.durations[clip] / speed, clip, () => {
    if (!live(target)) { u.skill.setSpTotal(u.skill.spTotal + u.skill.spCost); return; }
    launchHeal(b, u, target, s.bb.heal_scale, u.defId === HUNG);
  }, { front });
}
function syncNearl(b, u, def) {
  const talent = def.talents[0];
  for (const a of b.allyUnits) {
    const enabled = talent && live(u) && eligible(b, a, u) && (def.raw.arkpedia.elite >= 2
      ? !a.s.flags.untargetable : a === u);
    mods(b, a, `nearl:healing:${u.id}`, enabled ? { healingDealtMul: talent.bb.heal_scale } : null, u);
  }
}
function syncBass(b, u, def) {
  const t = def.talents[0]?.bb;
  if (!live(u) || !t) return;
  // Original checker professionMask 639 and square-distance <= 2 correspond
  // to the eight surrounding operator tiles, without a heal-target filter.
  const near = b.allyUnits.some(a => a !== u && live(a) && a.kind === 'op'
    && Math.abs(a.tileR - u.tileR) <= 1 && Math.abs(a.tileC - u.tileC) <= 1);
  mods(b, u, 'bassline:RES', { resFlat: t['baslin_t[self].magic_resistance']
    + (near ? t['baslin_t[ally].magic_resistance'] : 0) });
}
function bassBarrier(b, u, target, scale) {
  const amount = u.s.atk * scale, old = target.findBuff('baslin_s2[shield]');
  // The literal source check compares remaining dynamic values, never adds.
  if (old && old.shield >= amount) return;
  b.addBuff(target, { key: 'baslin_s2[shield]', source: u, shield: amount, shieldTypes: ['arts'] });
}
function finishBass(b, u) {
  const area = keys(u, 'x-4');
  // Source finish selector ignores target/heal/ally-target-free. It only
  // clears this shared key in source x-4, including self and other sources.
  for (const a of b.allyUnits) if (live(a) && a.kind !== 'device' && bodyInKeys(a, area))
    b.removeBuff(a, 'baslin_s2[shield]');
}
function bassForm(b, u) {
  const seq = u.deploySeq, activation = u.skill.activations, begin = model(u).durations.Skill_2_Begin;
  u.mem.regularFormVisual = { clip: 'Skill_2_Begin', loop: false };
  b.addBuff(u, { key: 'bassline:begin', source: u, duration: begin, flags: { disarm: true } });
  b.after(begin, () => {
    if (live(u) && u.deploySeq === seq && u.skill.active && u.skill.activations === activation)
      u.mem.regularFormVisual = { clip: 'Skill_2_Idle', loop: true };
  }, { owner: u });
}
function finishBassForm(b, u, reason) {
  finishBass(b, u); b.removeBuff(u, 'bassline:begin');
  if (!live(u) || reason === 'death') { u.mem.regularFormVisual = null; return; }
  const seq = u.deploySeq, duration = model(u).durations.Skill_2_End;
  u.mem.regularFormVisual = { clip: 'Skill_2_End', loop: false };
  b.addBuff(u, { key: 'bassline:end', source: u, duration, flags: { disarm: true } });
  b.after(duration, () => { if (u.deploySeq === seq) u.mem.regularFormVisual = null; }, { owner: u });
}
function czernyFinal(b, u, s) {
  if (!live(u) || !u.canAct || !u.skill.active) return;
  u.mem.czernyFinishing = true;
  // FinalAttack explicitly does not wait for OnAttack: native predelay .5,
  // source animation event .533 is retained only as presentation evidence.
  cast(b, u, .5, model(u).durations.Skill_2_End, 'Skill_2_End', () => {
    for (const e of b.enemiesInKeys([...keys(u, 'x-1')], u, { canHitFly: true }))
      if (canTargetEnemy(u, e, { canHitFly: true })) b.dealDamage(u, e, {
        amount: u.s.atk * s.bb.atk_scale, type: 'arts', isAttack: true, isSkill: true, applyWay: 'melee', tags: ['czerny:final'] });
  }, { requireActive: true });
}
export function customizeFiveStarDefenderSecondKit({ battle: b, id, def, unit: u, kit }) {
  if (!FIVE_STAR_DEFENDER_SECOND_OPERATORS[id]) return;
  kit.install = null;
  const s = def.skill, bb = s.bb, first = s.id === FIVE_STAR_DEFENDER_SECOND_OPERATORS[id].skillIds[0];
  kit.trait = { attack: 'melee', dmgType: 'phys', projectile: 'none', canHitFly: false,
    maxTargets: 1, hitAllBlocked: false, attackVisual: 'Attack', interruptOnSkillChange: true,
    windup: (_battle, unit) => model(unit).hits.Attack[0] / rate(unit, id === NEARL ? 2 : id === HUNG ? 1 : Infinity) };
  if (id !== CZERNY) {
    if (first) kit.skill = { kind: 'charges', charges: bb.ct ?? 1, trigger: 'SP_FULL',
      canActivate: () => !u.findBuff(buffKey(u)) && u.canAct && healingTargets(b, u, id !== HUNG).length > 0,
      onStart: () => firstAid(b, u, s) };
    else {
      const clip = id === BASS ? 'Skill_2_Loop' : 'Skill', front = id === NEARL;
      kit.skill = { kind: 'duration', duration: s.duration, heal: true,
        mods: { atkPct: bb.atk, ...(id === HUNG ? { defPct: bb.def } : {}),
          ...(id === NEARL ? { batPct: bb.base_attack_time } : { batFlat: bb.base_attack_time }) },
        targeting: { rangeGrid: s.rangeGrid },
        attack: { dmgType: 'heal', healScale: 1, heal: { mode: 'single', count: 1 }, maxTargets: 1,
          attackVisual: clip, windup: (_battle, unit) => model(unit, front).hits[clip][0] / rate(unit, 1),
          healProjectileSpeed: id === HUNG ? 15 : 0,
          afterHeal: id === BASS ? (_battle, unit, target) => {
            if (healable(b, target, unit)) bassBarrier(b, unit, target, bb['attack@scale']);
          } : null },
        onStart: () => { if (id === BASS) bassForm(b, u); if (id === NEARL) u.mem.regularAttackFacing = 'Front'; },
        onEnd: ({ reason }) => { if (id === BASS) finishBassForm(b, u, reason); if (id === NEARL) u.mem.regularAttackFacing = null; } };
    }
  } else if (first) kit.skill = { kind: 'duration', duration: s.duration,
    mods: { atkPct: bb.atk, resMul: 1 + bb.magic_resistance }, attack: { dmgType: 'arts' } };
  else kit.skill = { kind: 'duration', duration: s.duration, mods: { hpPct: bb.max_hp, taunt: bb.taunt_level },
    attack: { dmgType: 'arts', attackVisual: 'Skill_2_Attack' },
    onStart: () => {
      u.mem.czernyFinishing = false; u.mem.czernyStacks = 0;
      const seq = u.deploySeq, activation = u.skill.activations;
      u.mem.czernyFinalTimer = b.after(bb.interval, () => {
        if (live(u) && u.deploySeq === seq && u.skill.active && u.skill.activations === activation)
          czernyFinal(b, u, s);
      }, { owner: u });
    }, onEnd: () => { u.mem.czernyFinalTimer?.cancel(); b.removeBuff(u, 'czerny:attack-stacks'); u.mem.czernyStacks = 0; } };
  kit.skill.id = s.id; kit.skill.name = s.name;
}
export function installFiveStarDefenderSecond({ battle: b, unit: u, def }) {
  const id = def.charId, talent = def.talents[0]?.bb;
  if (!FIVE_STAR_DEFENDER_SECOND_OPERATORS[id]) return;
  if (id === NEARL) {
    const sync = () => syncNearl(b, u, def);
    b.on('tick', sync, { owner: u }); b.on('deploy', sync, { owner: u }); b.on('death', sync, { owner: u });
  } else if (id === HUNG) {
    b.on('deploy', ({ unit }) => { if (unit === u && talent) mods(b, u, 'hung:DEF', { defPct: talent.def }); }, { owner: u });
    b.on('heal', ctx => {
      if (ctx.source !== u || !live(u)) return;
      if (talent && bodyInKeys(ctx.target, keys(u, 'b-1'))
        && b.grid.tile(ctx.target.tileR, ctx.target.tileC).build === 'RANGED') ctx.amount *= talent.heal_scale;
      if (u.skill.active && u.skill.id === 'skchr_hmau_2') ctx.target.skill?.gainSp(def.skill.bb.sp, 'hung:heal');
    }, { owner: u });
  } else if (id === BASS) {
    const sync = () => syncBass(b, u, def);
    b.on('tick', sync, { owner: u }); b.on('deploy', sync, { owner: u }); b.on('death', () => {
      sync(); if (live(u)) return; finishBass(b, u);
    }, { owner: u });
  } else {
    b.on('deploy', ({ unit }) => { if (unit === u && talent) mods(b, u, 'czerny:RES', { resFlat: talent.magic_resistance }); }, { owner: u });
    b.on('hit', ({ source, target, dmg }) => {
      if (target !== u || !live(u) || !dmg.isAttack || !['phys', 'arts', 'true'].includes(dmg.type)
        || dmg.tags?.includes('hpLoss')) return;
      // Source NORMAL/SPLASH filters deliberately do not filter cancelled
      // modifiers. These are attack receipts, not positive HP-damage events.
      if (talent && dmg.type === 'arts' && source?.alive && source.side === 'enemy')
        b.dealDamage(u, source, { amount: u.s.atk * talent.atk_scale, type: 'arts', isAttack: true,
          applyWay: 'none', tags: ['czerny:counter'] });
      if (u.skill.active && u.skill.id === 'skchr_pianst_2') {
        u.mem.czernyStacks = Math.min(def.skill.bb.max_stack_cnt, (u.mem.czernyStacks ?? 0) + 1);
        mods(b, u, 'czerny:attack-stacks', { atkPct: def.skill.bb.atk * u.mem.czernyStacks });
      }
    }, { owner: u });
  }
}
