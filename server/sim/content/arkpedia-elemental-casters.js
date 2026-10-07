// SPDX-License-Identifier: GPL-3.0-or-later
import { ELEMENTAL_CASTER_OPERATORS } from '../../../shared/arkpedia/elemental-caster-operators.js';
import evidence from '../../../data/arkpedia-elemental-caster-prefabs.json' with { type: 'json' };
import { acquireTargets, resolveHit } from '../ai.js';
import { canTargetEnemy } from '../targeting.js';
import { bodyInKeys } from '../body.js';

const DIAMANTE = 'char_499_kaitou', WARMY = 'char_4081_warmy';
const live = u => !!(u?.alive && u.deployed);
const model = u => evidence.models[u.defId][['UP', 'LEFT'].includes(u.dir) ? 'Back' : 'Front'];
const playback = u => Math.min(1, u.s.aspd / 100);
const windup = clip => (_b, u) => model(u).hits[clip][0] / playback(u);
const inRange = (u, e) => live(e) && bodyInKeys(e, u.rangeKeys);
const burst = (e, element) => !!(e.findBuff(`${element}Burst`) || e.burstPending?.[element]);

function syncDiamante(b, u) {
  const talent = u.def.talents.find(t => t.bb.atk != null)?.bb;
  const eligible = live(u) && talent && b.enemies.some(e => inRange(u, e) && burst(e, 'apoptosis'));
  if (!eligible) b.removeBuff(u, 'diamante:necrosis-atk');
  else if (!u.findBuff('diamante:necrosis-atk')) b.addBuff(u, {
    key: 'diamante:necrosis-atk', source: u, mods: { atkPct: talent.atk } });
}

// A born ability retains its selected elemental rider. Only this synchronous
// primary Arts output is observed; nested effects cannot borrow its rider.
function primaryHit(b, u, p, e, info, ratio, element) {
  let hook;
  if (ratio > 0) hook = b.on('damaged', ctx => {
    if (ctx.source !== u || ctx.target !== e || ctx.type !== 'arts'
      || !ctx.dmg?.isAttack || ctx.dmg.attackId !== info.attackId
      || !ctx.dmg.tags?.includes('elemental-caster:primary') || !(ctx.amount > 0)) return;
    // Original ON_AFTER_OUTPUT_DAMAGE and assignRealDamage semantics are
    // recorded; native shield/overkill/floor bookkeeping remains unrecovered.
    b.dealDamage(u, e, { amount: ctx.amount * ratio, type: 'element', element,
      isAttack: false, isSkill: info.isSkill, attackId: info.attackId,
      tags: ['elemental-caster:injury'], canDodge: false });
  });
  try {
    resolveHit(b, u, { ...p, hits: 1, hitsFn: null, chain: null, splashRadius: 0,
      dmgMul: null, tags: ['elemental-caster:primary'] }, e, info, e.x, e.y);
  } finally { if (hook) b.off(hook); }
}
function elementalBonus(b, u, e, scale, element, info) {
  if (!(scale > 0) || !e.alive) return;
  b.dealDamage(u, e, { amount: u.s.atk * u.s.atkScaleMul * scale,
    type: 'elemental', element, isAttack: true, isSkill: !!info.isSkill,
    attackId: info.attackId, applyWay: 'none', tags: ['elemental-caster:bonus'] });
}
function launch(b, u, p, target, info) {
  const bb = u.def.skill.bb, id = u.defId, sid = u.skill.id;
  const selectedSkill = !!info.isSkill;
  const ratio = selectedSkill && sid.endsWith('_1') ? bb['attack@ep_damage_ratio'] : 0;
  const element = id === WARMY ? 'burn' : 'apoptosis';
  const enhanced = id === WARMY && u.mem.warmyCharged;
  b.addProjectile({ from: u, target, source: u, speed: 10, maxAge: 10,
    visual: 'bolt', data: { arkpediaTrackedVisual: true }, onHit: ({ target: e }) => {
      if (!e || !canTargetEnemy(u, e, p)) return;
      // Source active-buff ON_BUFF_START tests current skill state before its
      // additional ELEMENT NORMAL output. Its ordering before Arts is explicit.
      const active = live(u) && u.skill.active && u.skill.id === sid && selectedSkill;
      if (active && burst(e, element)) {
        const scale = id === DIAMANTE ? bb['attack@extra_ep_damage_scale']
          : sid.endsWith('_2') && enhanced ? bb['attack@ep_damage_scale'] : 0;
        elementalBonus(b, u, e, scale, element, info);
      }
      if (id === DIAMANTE) syncDiamante(b, u);
      if (e.alive) primaryHit(b, u, p, e, info, ratio, element);
    } });
}
function beginWarmy(b, u) {
  u.mem.warmyCharged = u.skill.charges >= 1;
  u.skill.charges = 0; u.skill.sp = 0;
  u.skill.timeLeft = u.mem.warmyCharged ? u.def.skill.bb.enhanced_duration : u.skill.duration;
  u.mem.regularFormVisual = { clip: 'Skill_2_Idle', loop: true };
  const duration = model(u).durations.Skill_2_Begin / playback(u);
  u.atkCd = Math.max(u.atkCd, duration);
  u.mem.regularFormVisual = { clip: 'Skill_2_Begin', loop: false };
  b.after(duration, () => {
    if (live(u) && u.skill.active && u.skill.id === 'skchr_warmy_2')
      u.mem.regularFormVisual = { clip: 'Skill_2_Idle', loop: true };
  }, { owner: u });
}

export function customizeElementalCasterKit({ battle: b, id, def, unit: u, kit }) {
  if (!ELEMENTAL_CASTER_OPERATORS[id]) return;
  kit.install = null;
  kit.trait = { attack: 'ranged', dmgType: 'arts', projectile: 'none', hits: 1,
    hitsFn: null, dmgMul: null, chain: null, splashRadius: 0, maxTargets: 1,
    rangeAoe: false, allInRange: false, canHitFly: true, interruptOnSkillChange: true,
    attackVisual: 'Attack', windup: windup('Attack'), launchAttack: launch, install: null };
  const s = def.skill, bb = s.bb;
  if (s.id.endsWith('_1')) kit.skill = { kind: 'duration', duration: s.duration,
    mods: id === DIAMANTE ? { atkPct: bb.atk } : { aspd: bb.attack_speed },
    attack: id === WARMY ? { attackVisual: 'Skill_1', windup: windup('Skill_1') } : {} };
  else if (id === DIAMANTE) kit.skill = { kind: 'duration', duration: s.duration,
    mods: { aspd: bb.attack_speed }, attack: { maxTargets: 2,
      attackVisual: 'Skill_Loop', windup: windup('Skill_Loop') },
    onStart: () => { u.mem.regularFormVisual = { clip: 'Skill_Idle', loop: true }; },
    onEnd: () => { u.mem.regularFormVisual = null; } };
  else kit.skill = { kind: 'duration', duration: s.duration, charges: 2,
    mods: { atkPct: bb.atk, batFlat: bb.base_attack_time },
    attack: { maxTargets: 2, attackVisual: 'Skill_2_Loop', windup: windup('Skill_2_Loop'),
      acquireTargets: (battle, unit, prof) => acquireTargets(battle, unit,
        { ...prof, acquireTargets: null, maxTargets: unit.mem.warmyCharged ? 3 : 2 }) },
    onStart: () => beginWarmy(b, u),
    onEnd: () => { u.mem.warmyCharged = false; u.mem.regularFormVisual = null; } };
}
export function installElementalCaster({ battle: b, unit: u, def }) {
  if (!ELEMENTAL_CASTER_OPERATORS[def.charId]) return;
  u.mem.warmyCharged = false;
  if (def.charId === DIAMANTE) {
    const sync = () => syncDiamante(b, u);
    b.on('tick', sync, { owner: u });
    b.on('deploy', ({ unit }) => { if (unit === u) sync(); }, { owner: u });
    b.on('elementBurst', ({ target, element }) => {
      if (element === 'apoptosis' && inRange(u, target)) sync();
    }, { owner: u });
    b.on('death', ({ unit }) => { if (unit === u) b.removeBuff(u, 'diamante:necrosis-atk'); }, { owner: u });
  } else b.on('elementBurst', ({ target, element }) => {
    const t = def.talents.find(t => t.bb.ep_damage_scale != null)?.bb;
    if (!t || !live(u) || element !== 'burn' || !inRange(u, target)
      || target.hidden || target.s.flags.untargetable) return;
    elementalBonus(b, u, target, t.ep_damage_scale, 'burn', { attackId: ++b._attackSeq });
  }, { owner: u });
}
