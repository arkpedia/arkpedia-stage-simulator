// SPDX-License-Identifier: GPL-3.0-or-later
import { FIVE_STAR_SPECIALIST_EXPANSION_OPERATORS } from '../../../shared/arkpedia/five-star-specialist-expansion-operators.js';
import source from '../../../data/arkpedia-five-star-specialist-expansion-prefabs.json' with { type: 'json' };
import { absoluteRangeKeys } from '../targeting.js';

const live = unit => unit?.alive && unit.deployed && !unit.hidden;
const visual = unit => source.originalModels[unit.defId][['UP', 'LEFT'].includes(unit.dir) ? 'Back' : 'Front'];
const event = clip => (_b, unit) => visual(unit).hits[clip][0] / Math.min(1, unit.s.aspd / 100);
function boundTargets(b, u, skill) {
  const keys = absoluteRangeKeys(skill.rangeGrid, u.tileR, u.tileC, u.dir);
  // Original selector: WALK, exclude existing UNMOVABLE, and respect its
  // immunity. Each cast locks its own recipients rather than retargeting DOT.
  return b.enemiesInKeys(keys, u, { canHitFly: false })
    .filter(e => !e.s.flags.bind && !e.s.flags.noMove && !e.def.immune?.has('bind'))
    .slice(0, skill.bb.max_target);
}
export function customizeFiveStarSpecialistExpansionKit({ battle: b, id, def, unit: u, kit }) {
  if (!FIVE_STAR_SPECIALIST_EXPANSION_OPERATORS[id]) return;
  kit.install = null;
  kit.trait = { attack: 'melee', dmgType: 'phys', canHitFly: false,
    maxTargets: 1, attackVisual: 'Attack', windup: event('Attack'),
    interruptOnSkillChange: true };
  const skill = def.skill, bb = skill.bb;
  if (skill.id === 'skchr_talr_1') {
    kit.skill = { kind: 'toggle', mods: { atkPct: bb.atk },
      targeting: { rangeExtend: bb.ability_range_forward_extend },
      attack: { attackVisual: 'Skill_1_Loop', windup: event('Skill_1_Loop') } };
  } else {
    let targets = [], paidTime = 0, checkTime = 0;
    const clear = () => { for (const target of targets) b.removeBuff(target, `talr:bind:${u.id}`); targets = []; };
    kit.skill = { kind: 'duration', duration: skill.duration, flags: { disarm: true },
      targeting: { rangeGrid: skill.rangeGrid }, canActivate: () => boundTargets(b, u, skill).length > 0,
      onStart: () => {
        clear(); paidTime = checkTime = 0; targets = boundTargets(b, u, skill);
        for (const target of targets) b.addBuff(target, { key: `talr:bind:${u.id}`, source: u,
          duration: skill.duration, interval: 1, flags: { bind: true, noMove: true },
          onTick: () => { if (live(u) && u.skill.active && live(target)) b.dealDamage(u, target, {
            amount: u.s.atk * bb.atk_scale, type: 'phys', isAttack: true, isSkill: true,
            tags: ['talr:lockstitch'] }); } });
      },
      onTick: ({ skill: runtime, dt }) => {
        paidTime += Math.min(dt, Math.max(0, runtime.timeLeft)); checkTime += dt;
        const interval = bb['talr_s_2[cost].interval'];
        while (paidTime >= interval - 1e-9) { paidTime -= interval; b.addDp(u.ownerId, bb['talr_s_2[cost].cost']); }
        if (checkTime >= .3 - 1e-9) {
          checkTime %= .3;
          if (!targets.some(t => t.alive && t.deployed && t.findBuff(`talr:bind:${u.id}`))) runtime.end('no-bound-target');
        }
      }, onEnd: clear,
    };
  }
  kit.skill.id = skill.id; kit.skill.name = skill.name;
}
export function installFiveStarSpecialistExpansion({ battle: b, unit: u, def }) {
  if (!FIVE_STAR_SPECIALIST_EXPANSION_OPERATORS[def.charId]) return;
  const talent = def.talents[0]?.bb;
  if (talent) b.on('hit', ({ source, target, dmg }) => {
    if (source === u && target?.side === 'enemy' && target.blockedBy !== u)
      dmg.mul *= talent.damage_scale;
  }, { owner: u });
}
